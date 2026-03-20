/**
 * ═══════════════════════════════════════════════════════════
 *  Dependency Prompt Scenarios — Grid Layout
 *  ──────────────────────────────────────────
 *  Organised as a 3×2 grid:
 *    Columns: Add | Finetune
 *    Rows:    Tasks | Milestones | Dependencies
 *  Plus a "Specials" section for cross-entity operations.
 *
 *  Each scenario defines the same shape as ideabin/task scenarios.
 *
 *  Context toggle:  ctx._withContext (boolean, default true)
 *    When true:  payloads include existing milestones/dependencies
 *    When false: minimal payloads for blank-slate generation
 * ═══════════════════════════════════════════════════════════
 */

import { DEP_DEFAULTS } from '../promptDefaults';

// ─── Helpers ────────────────────────────────────────────

/** Clean task object for export (no internal IDs) */
const cleanTask = (t) => {
  const obj = { id: t.id, name: t.name || "" };
  if (t.description) obj.description = t.description;
  if (t.priority) obj.priority = t.priority;
  if (t.difficulty) obj.difficulty = t.difficulty;
  return obj;
};

/** Clean milestone for export (includes task reference) */
const cleanMilestone = (m, rows) => {
  const obj = {
    id: m.id,
    name: m.name || "",
    start_index: m.start_index ?? m.startColumn ?? 0,
    duration: m.duration ?? 1,
  };
  if (m.description) obj.description = m.description;
  const taskId = m.task ?? m.row;
  if (taskId && rows?.[taskId]) {
    obj.task_name = rows[taskId].name || "";
    obj.task_id = Number(taskId);
  }
  return obj;
};

/** Clean dependency/edge for export */
const cleanEdge = (e, nodes) => {
  const obj = {
    source_id: e.source,
    target_id: e.target,
    weight: e.weight || "strong",
  };
  if (e.reason) obj.reason = e.reason;
  if (e.description) obj.description = e.description;
  if (nodes?.[e.source]) obj.source_name = nodes[e.source].name || "";
  if (nodes?.[e.target]) obj.target_name = nodes[e.target].name || "";
  return obj;
};

/** Get task IDs that are currently selected */
const selectedRowIds = (ctx) => {
  if (ctx.selectedRowIds instanceof Set) return [...ctx.selectedRowIds];
  if (Array.isArray(ctx.selectedRowIds)) return ctx.selectedRowIds;
  return [];
};

/** Get milestone IDs that are currently selected */
const selectedNodeIds = (ctx) => {
  if (ctx.selectedNodeIds instanceof Set) return [...ctx.selectedNodeIds];
  if (Array.isArray(ctx.selectedNodeIds)) return ctx.selectedNodeIds;
  return [];
};

// Counts
const taskCount = (ctx) => Object.keys(ctx.rows || {}).length;
const milestoneCount = (ctx) => Object.keys(ctx.nodes || {}).length;
const edgeCount = (ctx) => (ctx.edges || []).length;
const selectedTaskCount = (ctx) => selectedRowIds(ctx).length;
const selectedMilestoneCount = (ctx) => selectedNodeIds(ctx).length;

/** Build tasks payload */
const buildTasksPayload = (ctx, taskIds = null) => {
  const rows = ctx.rows || {};
  const ids = taskIds || Object.keys(rows);
  return ids
    .filter(id => rows[id])
    .map(id => cleanTask(rows[id]));
};

/** Build milestones payload */
const buildMilestonesPayload = (ctx, milestoneIds = null) => {
  const nodes = ctx.nodes || {};
  const ids = milestoneIds || Object.keys(nodes);
  return ids
    .filter(id => nodes[id])
    .map(id => cleanMilestone(nodes[id], ctx.rows));
};

/** Build edges payload */
const buildEdgesPayload = (ctx) => {
  return (ctx.edges || []).map(e => cleanEdge(e, ctx.nodes));
};

/** Build lanes (teams) payload */
const buildLanesPayload = (ctx) => {
  const lanes = ctx.lanes || {};
  return (ctx.laneOrder || [])
    .filter(id => lanes[id] && !lanes[id]._virtual)
    .map(id => ({
      id: lanes[id].id,
      name: lanes[id].name || "",
      color: lanes[id].color || null,
    }));
};

/** Build tasks grouped by team (lane) */
const buildTasksByTeam = (ctx) => {
  const lanes = ctx.lanes || {};
  const rows = ctx.rows || {};
  return (ctx.laneOrder || [])
    .filter(id => lanes[id])
    .map(lid => ({
      team_name: lanes[lid].name || (lanes[lid]._virtual ? "Unassigned" : ""),
      tasks: (lanes[lid].rows || [])
        .filter(tid => rows[tid])
        .map(tid => cleanTask(rows[tid])),
    }))
    .filter(t => t.tasks.length > 0);
};


// ═══════════════════════════════════════════════════════════
//  SCENARIO DEFINITIONS
// ═══════════════════════════════════════════════════════════

export const DEP_SCENARIOS = [

  // ─────────────────────────────────────────────────────────
  //  TASKS — ADD (milestones for tasks)
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_milestones_add",
    domain: "dependencies",
    grid: { row: "milestones", col: "add" },
    group: "Milestones — Add",
    action: "add",
    label: "Generate milestones",
    description:
      "For each task, generate one or more milestones with scheduling positions.",
    unavailableMsg: (ctx) =>
      taskCount(ctx) === 0 ? "No tasks in project" : null,
    defaultPrompt: DEP_DEFAULTS.dep_milestones_add,
    expectedFormat:
      '{ "milestones": [{ "task_name": "...", "name": "...", "description": "...", "start_index": 0, "duration": 1 }] }',
    buildPayload: (ctx) => ({
      tasks: buildTasksByTeam(ctx),
      ...(ctx._withContext && milestoneCount(ctx) > 0
        ? { existing_milestones: buildMilestonesPayload(ctx) }
        : {}),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  TASKS — FINETUNE
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_milestones_finetune",
    domain: "dependencies",
    grid: { row: "milestones", col: "finetune" },
    group: "Milestones — Finetune",
    action: "finetune",
    label: "Refine milestones",
    description:
      "Improve existing milestone names, descriptions, and scheduling positions.",
    unavailableMsg: (ctx) =>
      milestoneCount(ctx) === 0 ? "No milestones to refine" : null,
    defaultPrompt: DEP_DEFAULTS.dep_milestones_finetune,
    expectedFormat:
      '{ "updated_milestones": [{ "original_name": "...", "name": "...", "description": "...", "start_index": 0, "duration": 1 }] }',
    buildPayload: (ctx) => ({
      milestones: buildMilestonesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      teams: buildLanesPayload(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  MILESTONES — ADD (dependencies between milestones)
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_connections_add",
    domain: "dependencies",
    grid: { row: "milestones", col: "add" },
    group: "Milestones — Add",
    action: "add",
    label: "Generate dependencies",
    description:
      "Analyse milestones and suggest dependency connections between them.",
    unavailableMsg: (ctx) =>
      milestoneCount(ctx) < 2 ? "Need at least 2 milestones" : null,
    defaultPrompt: DEP_DEFAULTS.dep_connections_add,
    expectedFormat:
      '{ "dependencies": [{ "source_id": 1, "target_id": 2, "weight": "strong", "reason": "Short label", "description": "Detailed explanation..." }] }',
    buildPayload: (ctx) => ({
      milestones: buildMilestonesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      ...(ctx._withContext && edgeCount(ctx) > 0
        ? { existing_dependencies: buildEdgesPayload(ctx) }
        : {}),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  MILESTONES — ADD (selected milestones only)
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_connections_add_selected",
    domain: "dependencies",
    grid: { row: "milestones", col: "add" },
    group: "Milestones — Add",
    action: "add",
    label: "Dependencies for selected",
    description:
      "Generate dependencies only for the currently selected milestones.",
    unavailableMsg: (ctx) =>
      selectedMilestoneCount(ctx) < 1 ? "Select milestones first" : null,
    defaultPrompt: DEP_DEFAULTS.dep_connections_add_selected,
    expectedFormat:
      '{ "dependencies": [{ "source_id": 1, "target_id": 2, "weight": "strong", "reason": "Short label", "description": "Detailed explanation..." }] }',
    buildPayload: (ctx) => ({
      selected_milestones: buildMilestonesPayload(ctx, selectedNodeIds(ctx)),
      all_milestones: buildMilestonesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      ...(ctx._withContext && edgeCount(ctx) > 0
        ? { existing_dependencies: buildEdgesPayload(ctx) }
        : {}),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  MILESTONES — FINETUNE
  // ─────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────
  //  MILESTONES — FINETUNE (durations)
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_durations_finetune",
    domain: "dependencies",
    grid: { row: "milestones", col: "finetune" },
    group: "Milestones — Finetune",
    action: "finetune",
    label: "Adjust durations",
    description:
      "Suggest realistic durations for each milestone based on task complexity and dependencies.",
    unavailableMsg: (ctx) =>
      milestoneCount(ctx) === 0 ? "No milestones to adjust" : null,
    defaultPrompt: DEP_DEFAULTS.dep_durations_finetune,
    expectedFormat:
      '{ "updated_milestones": [{ "original_name": "...", "duration": 3, "reason": "..." }] }',
    buildPayload: (ctx) => ({
      milestones: buildMilestonesPayload(ctx),
      dependencies: buildEdgesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  MILESTONES — FINETUNE (dependencies)
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_connections_finetune",
    domain: "dependencies",
    grid: { row: "milestones", col: "finetune" },
    group: "Milestones — Finetune",
    action: "finetune",
    label: "Refine dependencies",
    description:
      "Review existing dependencies — adjust weights, add reasons, suggest removals.",
    unavailableMsg: (ctx) =>
      edgeCount(ctx) === 0 ? "No dependencies to refine" : null,
    defaultPrompt: DEP_DEFAULTS.dep_connections_finetune,
    expectedFormat:
      '{ "updated_dependencies": [{ "source_id": 1, "target_id": 2, "weight": "strong", "reason": "Short label", "description": "Detailed explanation..." }], ' +
      '"remove_dependencies": [{ "source_id": 3, "target_id": 4, "reason": "Short label", "description": "Detailed explanation..." }], ' +
      '"new_dependencies": [{ "source_id": 5, "target_id": 6, "weight": "strong", "reason": "Short label", "description": "Detailed explanation..." }] }',
    buildPayload: (ctx) => ({
      dependencies: buildEdgesPayload(ctx),
      milestones: buildMilestonesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  DEPENDENCIES — ADD (full scheduling)
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_schedule_add",
    domain: "dependencies",
    grid: { row: "schedule", col: "add" },
    group: "Schedule — Add",
    action: "add",
    label: "Generate schedule",
    description:
      "Generate a full schedule: milestones with start positions and durations, respecting dependencies.",
    unavailableMsg: (ctx) =>
      milestoneCount(ctx) < 2 ? "Need at least 2 milestones" : null,
    defaultPrompt: DEP_DEFAULTS.dep_schedule_add,
    expectedFormat:
      '{ "schedule": [{ "milestone_id": 1, "start_index": 0, "duration": 1 }] }',
    buildPayload: (ctx) => ({
      milestones: buildMilestonesPayload(ctx),
      dependencies: buildEdgesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  DEPENDENCIES — FINETUNE
  // ─────────────────────────────────────────────────────────

  {
    id: "dep_schedule_finetune",
    domain: "dependencies",
    grid: { row: "schedule", col: "finetune" },
    group: "Schedule — Finetune",
    action: "finetune",
    label: "Optimise schedule",
    description:
      "Optimise the current schedule — compress timeline, resolve conflicts, balance workload.",
    unavailableMsg: (ctx) =>
      milestoneCount(ctx) === 0 ? "No milestones to optimise" : null,
    defaultPrompt: DEP_DEFAULTS.dep_schedule_finetune,
    expectedFormat:
      '{ "schedule": [{ "milestone_id": 1, "start_index": 0, "duration": 1 }], ' +
      '"suggestions": "..." }',
    buildPayload: (ctx) => ({
      milestones: buildMilestonesPayload(ctx),
      dependencies: buildEdgesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      teams: buildLanesPayload(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  SPECIALS
  // ─────────────────────────────────────────────────────────

  {
    id: "special_full_dependency_graph",
    domain: "dependencies",
    grid: { row: "special", col: "special" },
    group: "Specials",
    action: "special",
    label: "Full dependency graph",
    description:
      "Generate milestones AND dependencies for all tasks in one go. " +
      "The AI determines which tasks depend on each other and schedules them.",
    unavailableMsg: (ctx) =>
      taskCount(ctx) < 2 ? "Need at least 2 tasks" : null,
    defaultPrompt: DEP_DEFAULTS.special_full_dependency_graph,
    expectedFormat:
      '{ "milestones": [{ "task_name": "...", "name": "...", "description": "...", "start_index": 0, "duration": 1 }], ' +
      '"dependencies": [{ "source_milestone_name": "...", "target_milestone_name": "...", "weight": "strong", "reason": "Short label", "description": "Detailed explanation..." }] }',
    buildPayload: (ctx) => ({
      tasks: buildTasksByTeam(ctx),
      ...(ctx._withContext && milestoneCount(ctx) > 0
        ? { existing_milestones: buildMilestonesPayload(ctx) }
        : {}),
      ...(ctx._withContext && edgeCount(ctx) > 0
        ? { existing_dependencies: buildEdgesPayload(ctx) }
        : {}),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "special_dep_suggestions",
    domain: "dependencies",
    grid: { row: "dependencies", col: "add" },
    group: "Dependencies — Add",
    action: "add",
    label: "Suggest missing dependencies",
    description:
      "Analyse the existing graph and suggest dependencies that might be missing.",
    unavailableMsg: (ctx) =>
      milestoneCount(ctx) < 2 ? "Need at least 2 milestones" : null,
    defaultPrompt: DEP_DEFAULTS.special_dep_suggestions,
    expectedFormat:
      '{ "new_dependencies": [{ "source_milestone_name": "...", "target_milestone_name": "...", "weight": "strong", "reason": "Short label", "description": "Detailed explanation..." }], ' +
      '"suggestions": "..." }',
    buildPayload: (ctx) => ({
      milestones: buildMilestonesPayload(ctx),
      dependencies: buildEdgesPayload(ctx),
      tasks: buildTasksPayload(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },
];


// ─── Grid layout metadata for UI rendering ─────────────

export const DEP_GRID = {
  rows: [
    { key: "milestones", label: "Milestones" },
    { key: "dependencies", label: "Dependencies" },
    { key: "schedule", label: "Schedule" },
  ],
  columns: [
    { key: "add", label: "Add" },
    { key: "finetune", label: "Finetune" },
  ],
  cells: {
    "milestones:add":       ["dep_milestones_add"],
    "milestones:finetune":  ["dep_milestones_finetune", "dep_durations_finetune"],
    "dependencies:add":     ["dep_connections_add", "dep_connections_add_selected", "special_dep_suggestions"],
    "dependencies:finetune":["dep_connections_finetune"],
    "schedule:add":         ["dep_schedule_add"],
    "schedule:finetune":    ["dep_schedule_finetune"],
  },
  specials: ["special_full_dependency_graph"],
};


// ─── Flat group ordering (legacy, kept for registry) ───

export const DEP_GROUPS = [
  "Milestones — Add",
  "Milestones — Finetune",
  "Dependencies — Add",
  "Dependencies — Finetune",
  "Schedule — Add",
  "Schedule — Finetune",
  "Specials",
];
