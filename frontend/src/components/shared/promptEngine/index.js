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

export { IDEABIN_SCENARIOS, IDEABIN_GROUPS } from './scenarios/ideabinScenarios';
export { ALL_SCENARIOS, ALL_GROUPS, ALL_SCENARIO_KEYS, getScenario, getGroup, getScenariosForDomain } from './registry';
export { assemblePrompt } from './assembler';
export { detectResponseContent, buildPreviewLabels, hasActionableContent, applyDetected } from './responseApplier';
