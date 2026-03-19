/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║                  PROMPT ENGINE                          ║
 * ║  Centralised AI-prompt system for Orgarhythmus          ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║                                                         ║
 * ║  Architecture:                                          ║
 * ║  ┌─────────────┐                                        ║
 * ║  │  scenarios/  │  Per-domain scenario definitions       ║
 * ║  │  ├ ideabin   │  (id, label, group, availability,     ║
 * ║  │  └ tasks*    │   payload builder, defaults, format)  ║
 * ║  ├─────────────┤                                        ║
 * ║  │  registry    │  Merges all scenarios + lookup API     ║
 * ║  ├─────────────┤                                        ║
 * ║  │  assembler   │  buildClipboardText replacement        ║
 * ║  │              │  (system prompt + project desc +       ║
 * ║  │              │   JSON format + scenario prompt +      ║
 * ║  │              │   payload + end prompt)                ║
 * ║  ├─────────────┤                                        ║
 * ║  │  response    │  Parses AI responses, detects          ║
 * ║  │  Applier     │  content types, previews & applies     ║
 * ║  └─────────────┘                                        ║
 * ║                                                         ║
 * ║  * tasks scenarios will be added later (Phase 2)        ║
 * ║                                                         ║
 * ║  Usage (from any window):                               ║
 * ║    import { getScenario, getGroup } from 'promptEngine'; ║
 * ║    import { assemblePrompt } from 'promptEngine';       ║
 * ║    import { IDEABIN_SCENARIOS } from 'promptEngine';    ║
 * ║                                                         ║
 * ╚══════════════════════════════════════════════════════════╝
 */

export { IDEABIN_SCENARIOS, IDEABIN_GROUPS, IDEABIN_GRID } from './scenarios/ideabinScenarios';
export { TASK_SCENARIOS, TASK_GROUPS, TASK_GRID } from './scenarios/taskScenarios';
export { DEP_SCENARIOS, DEP_GROUPS, DEP_GRID } from './scenarios/depScenarios';
export { ALL_SCENARIOS, ALL_GROUPS, ALL_SCENARIO_KEYS, getScenario, getGroup, getScenariosForDomain, IDEABIN_GRID as GRID, TASK_GRID as TASKS_GRID, DEP_GRID as DEPS_GRID } from './registry';
export { assemblePrompt, assemblePromptSections } from './assembler';
export { detectResponseContent, buildPreviewLabels, hasActionableContent, applyDetected } from './responseApplier';
export { detectTaskResponseContent, buildTaskPreviewLabels, hasTaskActionableContent, applyTaskDetected } from './taskResponseApplier';
export { buildTaskChangeItems, recomposeTaskDetected, TASK_CHANGE_TYPE_META } from './taskChangeBuilder';
export { detectDepResponseContent, buildDepPreviewLabels, hasDepActionableContent, checkDepConflict, applyDepDetected } from './depResponseApplier';
export { buildDepChangeItems, recomposeDepDetected, DEP_CHANGE_TYPE_META } from './depChangeBuilder';
