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
export function assemblePrompt(scenarioId, ctx, settings) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    console.warn(`[assemblePrompt] Unknown scenario: ${scenarioId}`);
    return { text: "", json: {}, jsonString: "{}" };
  }

  // Build the JSON payload from the scenario's builder
  const json = scenario.buildPayload(ctx);
  const jsonString = JSON.stringify(json, null, 2);

  const parts = [];

  // 1. System prompt
  if (settings?.auto_add_system_prompt && settings.system_prompt?.trim()) {
    parts.push(settings.system_prompt.trim());
  }

  // 2. Project description
  if (settings?.auto_add_project_description && ctx.projectDescription?.trim()) {
    parts.push(
      "--- Project Description ---\n" +
      ctx.projectDescription.trim()
    );
  }

  // 3. Expected JSON format
  if (settings?.auto_add_json_format && scenario.expectedFormat) {
    parts.push(
      "--- Expected JSON format ---\n" +
      scenario.expectedFormat
    );
  }

  // 4. Scenario-specific prompt (user-customised or default)
  if (settings?.auto_add_scenario_prompt) {
    const customPrompt = settings.scenario_prompts?.[scenarioId]?.trim();
    const promptText = customPrompt || scenario.defaultPrompt;
    if (promptText) {
      parts.push(promptText);
    }
  }

  // 5. JSON payload (always)
  parts.push(
    "--- Data ---\n" +
    jsonString
  );

  // 6. End prompt
  if (settings?.auto_add_end_prompt && settings.end_prompt?.trim()) {
    parts.push(settings.end_prompt.trim());
  }

  return {
    text: parts.join("\n\n"),
    json,
    jsonString,
  };
}
