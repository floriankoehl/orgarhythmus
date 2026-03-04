import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPromptSettings, updatePromptSettings } from '../api/promptSettingsApi';
import { fetch_project_detail } from '../api/org_API';
import { ALL_SCENARIOS, ALL_GROUPS, getScenario } from './shared/promptEngine';
import { assemblePrompt } from './shared/promptEngine';

/**
 * Expected-JSON format strings for each scenario.
 * 
 * LEGACY: These are kept for older export modals that still use buildClipboardText().
 * New code should use the prompt engine's assemblePrompt() instead.
 */
const EXPECTED_JSON_FORMATS = {
  ideabin_single_category: `{
  "category_name": "My Category",
  "ideas": [
    {
      "title": "Idea title",
      "description": "Idea description",
      "legend_types": ["Label A", "Label B"]
    }
  ]
}`,

  ideabin_multi_categories: `{
  "categories": [
    {
      "category_name": "Category A",
      "ideas": [
        { "title": "Idea 1", "description": "..." }
      ]
    },
    {
      "category_name": "Category B",
      "ideas": [
        { "title": "Idea 2", "description": "..." }
      ]
    }
  ]
}`,

  task_single_team: `{
  "name": "Team Name",
  "color": "#6366f1",
  "tasks": [
    {
      "name": "Task A",
      "description": "...",
      "priority": "high",
      "difficulty": "easy",
      "acceptance_criteria": [
        { "title": "Criterion 1", "done": false }
      ]
    }
  ]
}`,

  task_multi_teams: `{
  "teams": [
    {
      "name": "Design",
      "color": "#6366f1",
      "tasks": [
        {
          "name": "Task A",
          "description": "...",
          "priority": "high",
          "difficulty": "medium",
          "acceptance_criteria": [
            { "title": "Responsive layout", "done": false }
          ]
        }
      ]
    },
    {
      "name": "Dev",
      "color": "#10b981",
      "tasks": [{ "name": "Task C" }]
    }
  ],
  "unassigned_tasks": [
    { "name": "Task D", "description": "backlog item" }
  ]
}`,

  task_single_task: `{
  "tasks": [
    {
      "name": "Task A",
      "description": "...",
      "priority": "high",
      "difficulty": "easy",
      "acceptance_criteria": [
        { "title": "Criterion 1", "done": true },
        { "title": "Criterion 2", "description": "Optional clarification", "done": false }
      ]
    }
  ]
}`,

  dep_selected_tasks: `{
  "tasks": [
    {
      "id": 1,
      "name": "Task name",
      "description": "Task description",
      "difficulty": "medium",
      "priority": "high"
    }
  ]
}`,
};

export const SCENARIO_LABELS = {
  ideabin_single_category: 'IdeaBin — Single Category Export',
  ideabin_multi_categories: 'IdeaBin — Multi Category Export',
  task_single_team: 'Task Structure — Single Team Export',
  task_multi_teams: 'Task Structure — Multi Team / Project Export',
  task_single_task: 'Task Structure — Task(s) Export',
  dep_selected_tasks: 'Dependencies — Selected Tasks Export',
};

export const SCENARIO_GROUPS = [
  {
    label: 'IdeaBin',
    scenarios: ['ideabin_single_category', 'ideabin_multi_categories'],
  },
  {
    label: 'Task Structure',
    scenarios: ['task_single_team', 'task_multi_teams', 'task_single_task'],
  },
  {
    label: 'Dependencies',
    scenarios: ['dep_selected_tasks'],
  },
];

// ── New prompt-engine labels + groups (used by Profile.jsx for settings editing) ──
export const ENGINE_SCENARIO_LABELS = Object.fromEntries(
  ALL_SCENARIOS.map(s => [s.id, s.label])
);
export const ENGINE_SCENARIO_GROUPS = ALL_GROUPS.map(groupLabel => ({
  label: groupLabel,
  scenarios: ALL_SCENARIOS.filter(s => s.group === groupLabel).map(s => s.id),
}));

// Re-export for convenience
export { assemblePrompt, ALL_SCENARIOS, getScenario };

/**
 * Hook to manage prompt settings per user.
 *
 * Returns:
 *   settings        – current settings object (null while loading)
 *   loading         – boolean
 *   error           – string | null
 *   update(patch)   – async partial-update
 *   buildClipboardText(scenarioKey, jsonString) – prepend prompts based on toggles
 */
export default function usePromptSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const settingsRef = useRef(null);
  const projectDescRef = useRef('');

  // Extract projectId from URL (if inside a project route)
  const params = useParams();
  const projectId = params?.projectId;

  // Fetch prompt settings
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPromptSettings();
        if (!cancelled) {
          setSettings(data);
          settingsRef.current = data;
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch project description when inside a project
  useEffect(() => {
    if (!projectId) { projectDescRef.current = ''; return; }
    let cancelled = false;
    (async () => {
      try {
        const proj = await fetch_project_detail(projectId);
        if (!cancelled) projectDescRef.current = proj?.description || '';
      } catch {
        if (!cancelled) projectDescRef.current = '';
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const update = useCallback(async (patch) => {
    try {
      const data = await updatePromptSettings(patch);
      setSettings(data);
      settingsRef.current = data;
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  /**
   * Build the full clipboard text by concatenating:
   *   1. System prompt            (if auto_add_system_prompt && system_prompt)
   *   2. Project description      (if auto_add_project_description && provided)
   *   3. Expected JSON format     (if auto_add_json_format)
   *   4. Scenario-specific prompt (if auto_add_scenario_prompt && scenario_prompts[key])
   *   5. The actual JSON string
   *   6. End prompt               (if auto_add_end_prompt && end_prompt)
   *
   * @param {string} scenarioKey
   * @param {string} jsonString
   * @param {{ projectDescription?: string }} [opts]
   */
  const buildClipboardText = useCallback((scenarioKey, jsonString, opts = {}) => {
    const s = settingsRef.current;
    if (!s) return jsonString;

    const parts = [];

    // 1. System prompt
    if (s.auto_add_system_prompt && s.system_prompt?.trim()) {
      parts.push(s.system_prompt.trim());
    }

    // 2. Project description
    if (s.auto_add_project_description) {
      const desc = opts.projectDescription?.trim() || projectDescRef.current?.trim();
      if (desc) {
        parts.push(
          '--- Project Description ---\n' +
          desc
        );
      }
    }

    // 3. Expected JSON format
    if (s.auto_add_json_format && EXPECTED_JSON_FORMATS[scenarioKey]) {
      parts.push(
        '--- Expected JSON format ---\n' +
        EXPECTED_JSON_FORMATS[scenarioKey]
      );
    }

    // 4. Scenario prompt
    if (
      s.auto_add_scenario_prompt &&
      s.scenario_prompts?.[scenarioKey]?.trim()
    ) {
      parts.push(s.scenario_prompts[scenarioKey].trim());
    }

    // 5. Actual JSON
    parts.push(jsonString);

    // 6. End prompt
    if (s.auto_add_end_prompt && s.end_prompt?.trim()) {
      parts.push(s.end_prompt.trim());
    }

    return parts.join('\n\n');
  }, []);

  return { settings, loading, error, update, buildClipboardText, settingsRef, projectDescRef };
}
