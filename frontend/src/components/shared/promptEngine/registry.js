/**
 * ═══════════════════════════════════════════════════════════
 *  Prompt Engine — Scenario Registry
 *  ──────────────────────────────────
 *  Central lookup for all prompt scenarios across all domains.
 *  Currently: ideabin. Later: tasks, dependencies.
 *
 *  To add a new domain:
 *    1. Create scenarios/<domain>Scenarios.js (export SCENARIOS + GROUPS)
 *    2. Import here and spread into ALL_SCENARIOS / ALL_GROUPS
 * ═══════════════════════════════════════════════════════════
 */

import { IDEABIN_SCENARIOS, IDEABIN_GROUPS, IDEABIN_GRID } from './scenarios/ideabinScenarios';

// ─── Aggregate all scenarios ────────────────────────────

export const ALL_SCENARIOS = [
  ...IDEABIN_SCENARIOS,
  // ...TASK_SCENARIOS,      // Phase 2
  // ...DEP_SCENARIOS,       // Phase 2
];

export const ALL_GROUPS = [
  ...IDEABIN_GROUPS,
  // ...TASK_GROUPS,         // Phase 2
];

// ─── Grid metadata (per-domain) ─────────────────────────
export { IDEABIN_GRID };

/** Set of every valid scenario key (for backend sync) */
export const ALL_SCENARIO_KEYS = new Set(ALL_SCENARIOS.map(s => s.id));

// ─── Lookup helpers ─────────────────────────────────────

const _byId = new Map(ALL_SCENARIOS.map(s => [s.id, s]));

/** Get a single scenario by its id */
export function getScenario(id) {
  return _byId.get(id) ?? null;
}

/** Get all scenarios in a named group */
export function getGroup(groupLabel) {
  return ALL_SCENARIOS.filter(s => s.group === groupLabel);
}

/** Get all scenarios for a domain (e.g., "ideabin") */
export function getScenariosForDomain(domain) {
  return ALL_SCENARIOS.filter(s => s.domain === domain);
}
