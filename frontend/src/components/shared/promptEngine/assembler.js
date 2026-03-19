/**
 * ═══════════════════════════════════════════════════════════
 *  Prompt Engine — Assembler
 *  ─────────────────────────
 *  Replaces the old buildClipboardText function from
 *  usePromptSettings.js with a scenario-aware version.
 *
 *  Assembly order (each part is optional via user toggles):
 *    1. System prompt         (auto_add_system_prompt)
 *    2. Project description   (auto_add_project_description)
 *    3. Expected JSON format  (auto_add_json_format)
 *    4. Scenario prompt       (auto_add_scenario_prompt)
 *    5. JSON payload          (always included)
 *    6. End prompt            (auto_add_end_prompt)
 *
 *  Usage:
 *    assemblePrompt(scenarioId, ctx, settings)
 *    → returns { text, json }
 *       text = full assembled clipboard string
 *       json = the raw JSON payload object (for file download)
 * ═══════════════════════════════════════════════════════════
 */

import { getScenario } from './registry';

/**
 * Build the full assembled prompt text for a scenario.
 *
 * @param {string}  scenarioId  – scenario key (e.g., "ideas_add_blank")
 * @param {object}  ctx         – data context from the window
 *   { ideas, categories, categoryOrders, unassignedOrder, dims,
 *     selectedIdeaIds, selectedCategoryIds, legendFilters, filterCombineMode,
 *     stackedFilters, stackCombineMode, globalTypeFilter, filterPresets,
 *     activeContext, projectTeams, projectDescription }
 * @param {object}  settings    – user's prompt settings from PromptSettings model
 *   { auto_add_system_prompt, auto_add_json_format, auto_add_scenario_prompt,
 *     auto_add_project_description, auto_add_end_prompt,
 *     system_prompt, end_prompt, scenario_prompts }
 *
 * @returns {{ text: string, json: object, jsonString: string }}
 */
/**
 * Break the assembled prompt into individual labelled sections.
 * Each section has: { key, label, header, content, alwaysIncluded }
 *   header  — the separator string printed before the content in the final text
 *             (e.g. "--- Data ---"), null if no separator
 *   alwaysIncluded — true for the payload section which is never gated by settings
 */
export function assemblePromptSections(scenarioId, ctx, settings) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    console.warn(`[assemblePromptSections] Unknown scenario: ${scenarioId}`);
    return { sections: [], json: {}, jsonString: "{}" };
  }

  const json = scenario.buildPayload(ctx);
  const jsonString = JSON.stringify(json, null, 2);
  const sections = [];

  // 1. System prompt
  if (settings?.auto_add_system_prompt && settings.system_prompt?.trim()) {
    sections.push({ key: "system_prompt", label: "System Prompt", header: null, content: settings.system_prompt.trim() });
  }

  // 2. Project description
  if (settings?.auto_add_project_description && ctx.projectDescription?.trim()) {
    sections.push({ key: "project_description", label: "Project Description", header: "--- Project Description ---", content: ctx.projectDescription.trim() });
  }

  // 3. Expected JSON format
  if (settings?.auto_add_json_format && scenario.expectedFormat) {
    sections.push({ key: "json_format", label: "JSON Format", header: "--- Expected JSON format ---", content: scenario.expectedFormat });
  }

  // 4. Scenario-specific prompt (user-customised or default)
  if (settings?.auto_add_scenario_prompt) {
    const customPrompt = settings.scenario_prompts?.[scenarioId]?.trim();
    const promptText = customPrompt || scenario.defaultPrompt;
    if (promptText) {
      sections.push({ key: "scenario_prompt", label: "Scenario Prompt", header: null, content: promptText });
    }
  }

  // 5. JSON payload (always)
  sections.push({ key: "payload", label: "Data", header: "--- Data ---", content: jsonString, alwaysIncluded: true });

  // 6. End prompt
  if (settings?.auto_add_end_prompt && settings.end_prompt?.trim()) {
    sections.push({ key: "end_prompt", label: "End Prompt", header: null, content: settings.end_prompt.trim() });
  }

  return { sections, json, jsonString };
}

export function assemblePrompt(scenarioId, ctx, settings) {
  const { sections, json, jsonString } = assemblePromptSections(scenarioId, ctx, settings);
  const text = sections
    .map(s => s.header ? s.header + "\n" + s.content : s.content)
    .join("\n\n");
  return { text, json, jsonString };
}
