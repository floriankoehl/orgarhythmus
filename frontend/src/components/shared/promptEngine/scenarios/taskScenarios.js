/**
 * ═══════════════════════════════════════════════════════════
 *  Task Structure Prompt Scenarios — Grid Layout
 *  ──────────────────────────────────────────────
 *  Organised as a 2×3 grid:
 *    Columns: Add | Assign | Finetune
 *    Rows:    Tasks | Teams
 *  Plus a "Specials" section for cross-domain operations.
 *
 *  Follows the same pattern as ideabinScenarios.js.
 *  Context toggle:  ctx._withContext (boolean, default true)
 * ═══════════════════════════════════════════════════════════
 */

// ─── Helpers ────────────────────────────────────────────

/** Build a clean task object for export */
const cleanTask = (t) => {
  const obj = { name: t.name || "" };
  if (t.description) obj.description = t.description;
  if (t.priority) obj.priority = t.priority;
  if (t.difficulty) obj.difficulty = t.difficulty;
  if (t.hard_deadline != null) obj.hard_deadline = t.hard_deadline;
  if (t.acceptance_criteria?.length) {
    obj.acceptance_criteria = t.acceptance_criteria.map(c => ({
      title: c.title,
      ...(c.description ? { description: c.description } : {}),
      done: !!c.done,
    }));
  }
  return obj;
};

/** Get unassigned tasks */
const getUnassigned = (ctx) =>
  (ctx.taskOrder || []).map(id => ctx.tasks[id]).filter(Boolean);

/** Get selected tasks as array */
const getSelectedTasks = (ctx) =>
  [...(ctx.selectedTaskIds || [])].map(id => ctx.tasks[id]).filter(Boolean);

/** Get selected teams as array */
const getSelectedTeams = (ctx) =>
  [...(ctx.selectedTeamIds || [])].map(id => ctx.teams[id]).filter(Boolean);

/** All tasks as array */
const allTasks = (ctx) => Object.values(ctx.tasks || {});

/** Tasks grouped by team (for team-scoped exports) */
const tasksByTeam = (ctx) => {
  const map = {};
  for (const t of allTasks(ctx)) {
    const key = t.team || "__unassigned";
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return map;
};

/** Build team+tasks payload for a list of team ids */
const buildTeamsPayload = (ctx, teamIds) => {
  const byTeam = tasksByTeam(ctx);
  return teamIds.map(tid => {
    const team = ctx.teams[tid];
    if (!team) return null;
    return {
      team_name: team.name || "Unnamed",
      color: team.color || "#6366f1",
      tasks: (byTeam[tid] || []).map(cleanTask),
    };
  }).filter(Boolean);
};

/** Build full project structure */
const buildFullProject = (ctx) => ({
  teams: buildTeamsPayload(ctx, ctx.teamOrder || []),
  unassigned_tasks: getUnassigned(ctx).map(cleanTask),
});

/** Context toggle shorthand */
const wCtx = (ctx) => ctx._withContext !== false;

/** Count helpers */
const taskCount = (ctx) => Object.keys(ctx.tasks || {}).length;
const teamCount = (ctx) => (ctx.teamOrder || []).length;
const selectedTaskCount = (ctx) => (ctx.selectedTaskIds || new Set()).size;
const selectedTeamCount = (ctx) => (ctx.selectedTeamIds || new Set()).size;
const unassignedCount = (ctx) => (ctx.taskOrder || []).length;



// ═══════════════════════════════════════════════════════════
//  SCENARIO DEFINITIONS
// ═══════════════════════════════════════════════════════════

export const TASK_SCENARIOS = [

  // ─────────────────────────────────────────────────────────
  //  TASKS — ADD
  // ─────────────────────────────────────────────────────────

  {
    id: "tasks_add",
    domain: "tasks",
    grid: { row: "tasks", col: "add" },
    group: "Tasks — Add",
    action: "add",
    label: "New tasks",
    description: "Generate new tasks. Toggle 'with context' to include existing structure.",
    unavailableMsg: () => null,
    defaultPrompt:
      "Generate 8-12 well-defined tasks for this project. " +
      "Each task should have a clear name, description, and 2-4 acceptance criteria. " +
      "Also suggest a priority (high/medium/low) and difficulty (easy/medium/hard).",
    expectedFormat: '{ "tasks": [{ "name": "...", "description": "...", "priority": "high|medium|low", "difficulty": "easy|medium|hard", "acceptance_criteria": [{ "title": "..." }] }] }',
    buildPayload: (ctx) => {
      if (!wCtx(ctx)) {
        return {
          project_description: ctx.projectDescription || "",
          existing_teams: (ctx.teamOrder || []).map(tid => ctx.teams[tid]?.name).filter(Boolean),
        };
      }
      return {
        ...buildFullProject(ctx),
        project_description: ctx.projectDescription || "",
      };
    },
  },

  {
    id: "tasks_add_for_teams",
    domain: "tasks",
    grid: { row: "tasks", col: "add" },
    group: "Tasks — Add",
    action: "add",
    label: "Tasks for teams",
    description: "Generate tasks specifically designed for existing teams.",
    unavailableMsg: (ctx) =>
      teamCount(ctx) === 0 ? "No teams created yet" : null,
    defaultPrompt:
      "Generate 3-5 well-defined tasks for each team. " +
      "Each task should fit the team's area of responsibility. " +
      "Include name, description, priority, difficulty, and acceptance criteria.",
    expectedFormat: '{ "teams": [{ "team_name": "...", "tasks": [{ "name": "...", "description": "...", "priority": "...", "difficulty": "...", "acceptance_criteria": [{ "title": "..." }] }] }] }',
    buildPayload: (ctx) => ({
      ...buildFullProject(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  TASKS — ASSIGN
  // ─────────────────────────────────────────────────────────

  {
    id: "tasks_assign_unassigned_existing",
    domain: "tasks",
    grid: { row: "tasks", col: "assign" },
    group: "Assign (Tasks ↔ Teams)",
    action: "assign",
    label: "Unassigned → existing teams",
    description: "Let AI suggest which existing team each unassigned task belongs to.",
    unavailableMsg: (ctx) => {
      if (unassignedCount(ctx) === 0) return "No unassigned tasks";
      if (teamCount(ctx) === 0) return "No teams to assign to";
      return null;
    },
    defaultPrompt:
      "For each unassigned task, suggest the most appropriate existing team to assign it to. " +
      "Return assignments as a JSON array.",
    expectedFormat: '{ "assignments": [{ "team_name": "...", "tasks": ["task name 1", "task name 2"] }] }',
    buildPayload: (ctx) => ({
      unassigned_tasks: getUnassigned(ctx).map(cleanTask),
      teams: buildTeamsPayload(ctx, ctx.teamOrder || []),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "tasks_assign_unassigned_new",
    domain: "tasks",
    grid: { row: "tasks", col: "assign" },
    group: "Assign (Tasks ↔ Teams)",
    action: "assign",
    label: "Unassigned → new teams",
    description: "Create new teams from unassigned tasks and assign them.",
    unavailableMsg: (ctx) =>
      unassignedCount(ctx) === 0 ? "No unassigned tasks" : null,
    defaultPrompt:
      "Suggest new team groupings for the unassigned tasks. " +
      "Group them logically by domain or function. " +
      "Return new teams with their assigned tasks.",
    expectedFormat: '{ "teams": [{ "team_name": "...", "color": "#hex", "tasks": ["task name 1", "task name 2"] }] }',
    buildPayload: (ctx) => ({
      unassigned_tasks: getUnassigned(ctx).map(cleanTask),
      existing_teams: buildTeamsPayload(ctx, ctx.teamOrder || []),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "tasks_assign_selected_existing",
    domain: "tasks",
    grid: { row: "tasks", col: "assign" },
    group: "Assign (Tasks ↔ Teams)",
    action: "assign",
    label: "Selected → existing teams",
    description: "Assign selected tasks to existing teams.",
    unavailableMsg: (ctx) => {
      if (selectedTaskCount(ctx) === 0) return "No tasks selected";
      if (teamCount(ctx) === 0) return "No teams to assign to";
      return null;
    },
    defaultPrompt:
      "Assign each selected task to the most appropriate existing team. " +
      "Consider each team's current workload and domain.",
    expectedFormat: '{ "assignments": [{ "team_name": "...", "tasks": ["task name 1"] }] }',
    buildPayload: (ctx) => ({
      selected_tasks: getSelectedTasks(ctx).map(cleanTask),
      teams: buildTeamsPayload(ctx, ctx.teamOrder || []),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "tasks_assign_selected_new",
    domain: "tasks",
    grid: { row: "tasks", col: "assign" },
    group: "Assign (Tasks ↔ Teams)",
    action: "assign",
    label: "Selected → new teams",
    description: "Create new teams from selected tasks.",
    unavailableMsg: (ctx) =>
      selectedTaskCount(ctx) === 0 ? "No tasks selected" : null,
    defaultPrompt:
      "Group the selected tasks into new teams based on logical categories. " +
      "Suggest a team name and color for each group.",
    expectedFormat: '{ "teams": [{ "team_name": "...", "color": "#hex", "tasks": ["task name 1"] }] }',
    buildPayload: (ctx) => ({
      selected_tasks: getSelectedTasks(ctx).map(cleanTask),
      existing_teams: buildTeamsPayload(ctx, ctx.teamOrder || []),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  TASKS — FINETUNE
  // ─────────────────────────────────────────────────────────

  {
    id: "tasks_finetune_selected",
    domain: "tasks",
    grid: { row: "tasks", col: "finetune" },
    group: "Tasks — Finetune",
    action: "finetune",
    label: "Finetune selected",
    description: "Improve names, descriptions, and criteria of selected tasks.",
    unavailableMsg: (ctx) =>
      selectedTaskCount(ctx) === 0 ? "No tasks selected" : null,
    defaultPrompt:
      "Improve these tasks: refine the names to be clearer and more actionable, " +
      "enhance descriptions, adjust priority/difficulty if appropriate, " +
      "and improve or add acceptance criteria. Return the full updated tasks.",
    expectedFormat: '{ "updated_tasks": [{ "original_name": "...", "name": "...", "description": "...", "priority": "...", "difficulty": "...", "acceptance_criteria": [{ "title": "..." }] }] }',
    buildPayload: (ctx) => ({
      tasks: getSelectedTasks(ctx).map(cleanTask),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "tasks_finetune_all",
    domain: "tasks",
    grid: { row: "tasks", col: "finetune" },
    group: "Tasks — Finetune",
    action: "finetune",
    label: "Finetune all",
    description: "Improve all tasks in the project.",
    unavailableMsg: (ctx) =>
      taskCount(ctx) === 0 ? "No tasks exist" : null,
    defaultPrompt:
      "Review and improve all tasks: refine names, enhance descriptions, " +
      "adjust priority/difficulty, and improve acceptance criteria. " +
      "Return the full updated set of tasks.",
    expectedFormat: '{ "updated_tasks": [{ "original_name": "...", "name": "...", "description": "...", "priority": "...", "difficulty": "...", "acceptance_criteria": [{ "title": "..." }] }] }',
    buildPayload: (ctx) => ({
      ...buildFullProject(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  TEAMS — ADD
  // ─────────────────────────────────────────────────────────

  {
    id: "teams_add",
    domain: "tasks",
    grid: { row: "teams", col: "add" },
    group: "Teams — Add",
    action: "add",
    label: "New teams",
    description: "Generate new teams. Toggle 'with context' to include existing structure for reference.",
    unavailableMsg: () => null,
    defaultPrompt:
      "Suggest 3-5 well-defined teams for this project. " +
      "Each team should have a clear name, purpose description, and a suggested color. " +
      "Also suggest 3-5 tasks per team.",
    expectedFormat: '{ "teams": [{ "team_name": "...", "color": "#hex", "tasks": [{ "name": "...", "description": "...", "priority": "...", "difficulty": "...", "acceptance_criteria": [{ "title": "..." }] }] }] }',
    buildPayload: (ctx) => {
      if (!wCtx(ctx)) {
        return { project_description: ctx.projectDescription || "" };
      }
      return {
        ...buildFullProject(ctx),
        project_description: ctx.projectDescription || "",
      };
    },
  },

  {
    id: "teams_add_for_tasks",
    domain: "tasks",
    grid: { row: "teams", col: "add" },
    group: "Teams — Add",
    action: "add",
    label: "Teams for tasks",
    description: "Create new teams designed to organise existing tasks.",
    unavailableMsg: (ctx) =>
      taskCount(ctx) === 0 ? "No tasks to group" : null,
    defaultPrompt:
      "Analyse the existing tasks and suggest new teams to group them logically. " +
      "Include team name, color, and which existing tasks belong to each team.",
    expectedFormat: '{ "teams": [{ "team_name": "...", "color": "#hex", "tasks": ["existing task name 1", "existing task name 2"] }] }',
    buildPayload: (ctx) => ({
      ...buildFullProject(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  TEAMS — FINETUNE
  // ─────────────────────────────────────────────────────────

  {
    id: "teams_finetune_selected",
    domain: "tasks",
    grid: { row: "teams", col: "finetune" },
    group: "Teams — Finetune",
    action: "finetune",
    label: "Finetune selected",
    description: "Improve names and organisation of selected teams.",
    unavailableMsg: (ctx) =>
      selectedTeamCount(ctx) === 0 ? "No teams selected" : null,
    defaultPrompt:
      "Improve these teams: refine team names, suggest better colours, " +
      "and review their task assignments. " +
      "Return the updated teams with any suggested changes.",
    expectedFormat: '{ "updated_teams": [{ "original_name": "...", "name": "...", "color": "#hex" }] }',
    buildPayload: (ctx) => ({
      teams: buildTeamsPayload(ctx, [...(ctx.selectedTeamIds || [])]),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "teams_finetune_all",
    domain: "tasks",
    grid: { row: "teams", col: "finetune" },
    group: "Teams — Finetune",
    action: "finetune",
    label: "Finetune all",
    description: "Improve all teams in the project.",
    unavailableMsg: (ctx) =>
      teamCount(ctx) === 0 ? "No teams exist" : null,
    defaultPrompt:
      "Review and improve all teams: refine names, suggest better colours, " +
      "and review task distribution across teams.",
    expectedFormat: '{ "updated_teams": [{ "original_name": "...", "name": "...", "color": "#hex" }] }',
    buildPayload: (ctx) => ({
      ...buildFullProject(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  // ─────────────────────────────────────────────────────────
  //  SPECIALS
  // ─────────────────────────────────────────────────────────

  {
    id: "special_tasks_and_teams",
    domain: "tasks",
    grid: null, // special
    group: "Specials",
    action: "special",
    label: "New tasks & teams",
    description: "Generate both new teams (with tasks) and additional unassigned tasks in one go.",
    unavailableMsg: () => null,
    defaultPrompt:
      "Generate a complete project structure from scratch (or extending what exists). " +
      "Create 3-6 teams, each with 3-5 well-defined tasks. " +
      "Also add 3-5 unassigned tasks that don't fit neatly into a single team. " +
      "Every task should have a name, description, priority, difficulty, and 2-4 acceptance criteria.",
    expectedFormat:
      '{ "teams": [{ "team_name": "...", "color": "#hex", "tasks": [{ "name": "...", "description": "...", "priority": "high|medium|low", "difficulty": "easy|medium|hard", "acceptance_criteria": [{ "title": "..." }] }] }], "unassigned_tasks": [{ "name": "...", "description": "...", "priority": "...", "difficulty": "..." }] }',
    buildPayload: (ctx) => {
      if (!wCtx(ctx)) {
        return { project_description: ctx.projectDescription || "" };
      }
      return {
        ...buildFullProject(ctx),
        project_description: ctx.projectDescription || "",
      };
    },
  },

  {
    id: "special_acceptance_criteria_selected",
    domain: "tasks",
    grid: null, // special
    group: "Specials",
    action: "special",
    label: "Add criteria (selected)",
    description: "Generate acceptance criteria for selected tasks that lack them.",
    unavailableMsg: (ctx) =>
      selectedTaskCount(ctx) === 0 ? "No tasks selected" : null,
    defaultPrompt:
      "For each task, generate 3-5 clear, testable acceptance criteria. " +
      "Each criterion should be specific and verifiable. " +
      "Return using the original_name to match tasks.",
    expectedFormat:
      '{ "acceptance_criteria": [{ "original_name": "Task Name", "criteria": [{ "title": "Criterion text" }] }] }',
    buildPayload: (ctx) => ({
      tasks: getSelectedTasks(ctx).map(cleanTask),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "special_acceptance_criteria_all",
    domain: "tasks",
    grid: null, // special
    group: "Specials",
    action: "special",
    label: "Add criteria (all)",
    description: "Generate acceptance criteria for all tasks that are missing them.",
    unavailableMsg: (ctx) =>
      taskCount(ctx) === 0 ? "No tasks exist" : null,
    defaultPrompt:
      "For each task, generate 3-5 clear, testable acceptance criteria. " +
      "Focus on tasks that don't have any criteria yet. " +
      "Return using the original_name to match tasks.",
    expectedFormat:
      '{ "acceptance_criteria": [{ "original_name": "Task Name", "criteria": [{ "title": "Criterion text" }] }] }',
    buildPayload: (ctx) => ({
      ...buildFullProject(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },

  {
    id: "special_task_suggestions",
    domain: "tasks",
    grid: null, // special
    group: "Specials",
    action: "special",
    label: "Suggestions",
    description: "Get suggestions on how to improve the overall task structure.",
    unavailableMsg: (ctx) =>
      taskCount(ctx) === 0 && teamCount(ctx) === 0 ? "No content yet" : null,
    defaultPrompt:
      "Analyse the current task structure and provide suggestions for improvement. " +
      "Consider: missing tasks, team balance, task clarity, priority distribution, " +
      "and acceptance criteria quality.",
    expectedFormat: '{ "suggestions": "..." }',
    buildPayload: (ctx) => ({
      ...buildFullProject(ctx),
      project_description: ctx.projectDescription || "",
    }),
  },
];


// ─── Grid layout metadata for UI rendering ─────────────

export const TASK_GRID = {
  rows: [
    { key: "tasks", label: "Tasks" },
    { key: "teams", label: "Teams" },
  ],
  columns: [
    { key: "add", label: "Add" },
    { key: "assign", label: "Assign" },
    { key: "finetune", label: "Finetune" },
  ],
  cells: {
    "tasks:add":      ["tasks_add", "tasks_add_for_teams"],
    "tasks:assign":   ["tasks_assign_unassigned_existing", "tasks_assign_unassigned_new",
                        "tasks_assign_selected_existing", "tasks_assign_selected_new"],
    "tasks:finetune": ["tasks_finetune_selected", "tasks_finetune_all"],
    "teams:add":      ["teams_add", "teams_add_for_tasks"],
    "teams:assign":   null, // merged into tasks:assign (assign column spans both rows)
    "teams:finetune": ["teams_finetune_selected", "teams_finetune_all"],
  },
  specials: [
    "special_tasks_and_teams",
    "special_acceptance_criteria_selected",
    "special_acceptance_criteria_all",
    "special_task_suggestions",
  ],
};


// ─── Flat group ordering (legacy, kept for registry) ───

export const TASK_GROUPS = [
  "Tasks — Add",
  "Tasks — Finetune",
  "Assign (Tasks ↔ Teams)",
  "Teams — Add",
  "Teams — Finetune",
  "Specials",
];
