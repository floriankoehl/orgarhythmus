/**
 * ═══════════════════════════════════════════════════════════
 *  Task Response Applier
 *  ─────────────────────
 *  Mirrors responseApplier.js but for the Task Structure domain.
 *  Detects task/team content from AI responses, previews, and applies
 *  via the task-specific `applyCtx`.
 *
 *  Detected types:
 *    task_teams            — { teams: [{ team_name, tasks: [...] }] }
 *    task_tasks            — { tasks: [...] } or { unassigned_tasks: [...] }
 *    task_assignments      — { assignments: [{ team_name, tasks: [...] }] }
 *    task_new_team_assign  — { teams: [{ team_name, tasks: ["existing..."] }] } (new teams + move)
 *    update_tasks          — { updated_tasks: [...] }
 *    update_teams          — { updated_teams: [...] }
 *    acceptance_criteria   — { acceptance_criteria: [...] }
 *    suggestions           — { suggestions: "..." }
 * ═══════════════════════════════════════════════════════════
 */

// ─── Detection ─────────────────────────────────────────

/**
 * Analyse a parsed JSON response and return an array of
 * detected task-domain content items.
 *
 * @param {Object} json  – parsed AI response
 * @param {string} mode  – detection hint: "tasks" (default).
 *    When "tasks", we interpret `teams` as project teams with tasks,
 *    not as IdeaBin categories.
 */
export function detectTaskResponseContent(json) {
  if (!json || typeof json !== "object") return [];

  const found = [];

  // Bare array → treat as tasks
  if (Array.isArray(json)) {
    if (json.length > 0 && json[0]?.name) {
      found.push({ type: "task_tasks", count: json.length, data: json });
    }
    return found;
  }

  // ── Updated tasks (finetune — match by original_name) ──
  if (Array.isArray(json.updated_tasks) && json.updated_tasks.length > 0) {
    found.push({
      type: "update_tasks", count: json.updated_tasks.length,
      data: json.updated_tasks,
    });
  }

  // ── Updated teams (finetune — match by original_name) ──
  if (Array.isArray(json.updated_teams) && json.updated_teams.length > 0) {
    found.push({
      type: "update_teams", count: json.updated_teams.length,
      data: json.updated_teams,
    });
  }

  // ── Acceptance criteria additions ──
  if (Array.isArray(json.acceptance_criteria) && json.acceptance_criteria.length > 0) {
    const totalCriteria = json.acceptance_criteria.reduce(
      (s, entry) => s + (entry.criteria?.length || 0), 0,
    );
    found.push({
      type: "acceptance_criteria", count: json.acceptance_criteria.length,
      criteriaCount: totalCriteria, data: json.acceptance_criteria,
    });
  }

  // ── Task assignments (move existing tasks to existing teams) ──
  if (Array.isArray(json.assignments) && json.assignments.length > 0) {
    const totalTasks = json.assignments.reduce((s, a) => s + (a.tasks?.length || 0), 0);
    found.push({
      type: "task_assignments", count: json.assignments.length,
      taskCount: totalTasks, data: json.assignments,
    });
  }

  // ── Teams with tasks (create teams + tasks, or new-team assignments) ──
  if (Array.isArray(json.teams) && json.teams.length > 0) {
    // Determine if the tasks are references (strings) or full objects
    const firstTeam = json.teams[0];
    const firstTask = firstTeam?.tasks?.[0];
    const isReference = typeof firstTask === "string";

    if (isReference) {
      // New teams with references to existing tasks → assignment mode
      const totalTasks = json.teams.reduce((s, t) => s + (t.tasks?.length || 0), 0);
      found.push({
        type: "task_new_team_assign", count: json.teams.length,
        taskCount: totalTasks, data: json.teams,
      });
    } else {
      // Full teams with task objects → create mode
      const totalTasks = json.teams.reduce((s, t) => s + (t.tasks?.length || 0), 0);
      found.push({
        type: "task_teams", count: json.teams.length,
        taskCount: totalTasks, data: json.teams,
      });
    }
  }

  // ── Standalone tasks ──
  if (Array.isArray(json.tasks) && json.tasks.length > 0) {
    found.push({ type: "task_tasks", count: json.tasks.length, data: json.tasks });
  }
  if (Array.isArray(json.unassigned_tasks) && json.unassigned_tasks.length > 0) {
    found.push({
      type: "task_tasks", count: json.unassigned_tasks.length,
      data: json.unassigned_tasks, label: "unassigned tasks",
    });
  }

  // ── Add classification systems (legend + types) ──
  if (Array.isArray(json.classification_systems) && json.classification_systems.length > 0) {
    const totalCategories = json.classification_systems.reduce(
      (s, sys) => s + (sys.categories?.length || 0), 0,
    );
    found.push({
      type: "add_classification_systems", count: json.classification_systems.length,
      categoryCount: totalCategories, data: json.classification_systems,
    });
  }

  // ── Label assignments (task → category per classification system) ──
  if (Array.isArray(json.label_assignments) && json.label_assignments.length > 0) {
    const totalAssignments = json.label_assignments.reduce(
      (s, sys) => s + (sys.assignments?.length || 0), 0,
    );
    found.push({
      type: "task_label_assignments", count: json.label_assignments.length,
      assignmentCount: totalAssignments, data: json.label_assignments,
    });
  }

  // ── Suggestions text ──
  if (json.suggestions && typeof json.suggestions === "string") {
    found.push({ type: "suggestions", data: json.suggestions });
  }

  return found;
}


// ─── Preview labels ────────────────────────────────────

export function buildTaskPreviewLabels(detected) {
  return detected.map(item => {
    switch (item.type) {
      case "task_teams":
        return `${item.count} team${item.count > 1 ? "s" : ""} with ${item.taskCount} tasks`;
      case "task_tasks":
        return `${item.count} ${item.label || "tasks"}`;
      case "task_assignments":
        return `Assign ${item.taskCount} tasks to ${item.count} teams`;
      case "task_new_team_assign":
        return `${item.count} new team${item.count > 1 ? "s" : ""} + assign ${item.taskCount} existing tasks`;
      case "update_tasks":
        return `Update ${item.count} task${item.count > 1 ? "s" : ""}`;
      case "update_teams":
        return `Update ${item.count} team${item.count > 1 ? "s" : ""}`;
      case "acceptance_criteria":
        return `${item.criteriaCount} acceptance criteria for ${item.count} task${item.count > 1 ? "s" : ""}`;
      case "add_classification_systems":
        return `${item.count} classification system${item.count > 1 ? "s" : ""} with ${item.categoryCount} categories`;
      case "task_label_assignments":
        return `${item.assignmentCount} label assignment${item.assignmentCount > 1 ? "s" : ""} across ${item.count} system${item.count > 1 ? "s" : ""}`;
      case "suggestions":
        return "Suggestions";
      default:
        return "Unknown content";
    }
  });
}


// ─── Actionable check ──────────────────────────────────

const TASK_ACTIONABLE_TYPES = new Set([
  "task_teams", "task_tasks", "task_assignments", "task_new_team_assign",
  "update_tasks", "update_teams", "acceptance_criteria",
  "add_classification_systems", "task_label_assignments",
]);

/** Execution order: updates first, creates second, assignments last. */
const TASK_TYPE_ORDER = [
  "update_teams", "update_tasks", "acceptance_criteria",
  "task_teams", "task_tasks",
  "task_assignments", "task_new_team_assign",
  "add_classification_systems", "task_label_assignments",
];

export function hasTaskActionableContent(detected) {
  return detected.some(item => TASK_ACTIONABLE_TYPES.has(item.type));
}


// ─── Apply ─────────────────────────────────────────────

/**
 * Apply all actionable task items.
 *
 * @param {Array}  detected  – from detectTaskResponseContent()
 * @param {Object} applyCtx  – functions & state provided by TaskStructure:
 *   createTask({ name, description, priority, difficulty, team_id, acceptance_criteria })
 *   createTeam(name, color) → team object
 *   updateTask(taskId, payload)
 *   updateTeam(teamId, payload)
 *   assignTaskToTeam(taskId, teamId)    – move task to team
 *   createLegend(name) → legend object
 *   createLegendType(legendId, name, color) → type object
 *   assignLegendType(taskId, legendId, typeId) → void
 *   refreshAll() → Promise
 *   tasks        – { [id]: { id, name, description, team, … } }
 *   teams        – { [id]: { id, name, color, … } }
 *   teamOrder    – [teamId, ...]
 *   legends      – [{ id, name }]
 *   legendsWithTypes – [{ id, name, types: [{ id, name, color }] }]
 *
 * @returns {{ created: string[], errors: string[] }}
 */
export async function applyTaskDetected(detected, applyCtx) {
  const {
    createTask,
    createTeam,
    updateTask,
    updateTeam,
    assignTaskToTeam,
    createLegend,
    createLegendType,
    assignLegendType,
    refreshAll,
    tasks,
    teams,
    teamOrder,
    legends = [],
    legendsWithTypes = [],
  } = applyCtx;

  const result = { created: [], errors: [] };

  // Sort by execution order
  const sorted = [...detected].sort((a, b) => {
    const ai = TASK_TYPE_ORDER.indexOf(a.type);
    const bi = TASK_TYPE_ORDER.indexOf(b.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  // Track teams created during this apply call (name → id)
  const newTeamIds = {};

  // Lookups
  const buildTaskNameLookup = () => {
    const map = {};
    for (const [id, t] of Object.entries(tasks || {})) {
      const key = (t.name || "").toLowerCase().trim();
      if (key) map[key] = { id: parseInt(id), task: t };
    }
    return map;
  };

  const buildTeamNameLookup = () => {
    const map = {};
    for (const [id, t] of Object.entries(teams || {})) {
      const key = (t.name || "").toLowerCase().trim();
      if (key) map[key] = { id: parseInt(id), team: t };
    }
    return map;
  };

  /** Normalise acceptance_criteria from various AI formats */
  const normaliseCriteria = (criteria) => {
    if (!criteria || !Array.isArray(criteria)) return [];
    return criteria.map(c =>
      typeof c === "string"
        ? { title: c, done: false }
        : { title: c.title || c.text || "", description: c.description || "", done: !!c.done },
    ).filter(c => c.title);
  };

  for (const item of sorted) {
    if (!TASK_ACTIONABLE_TYPES.has(item.type)) continue;

    try {
      switch (item.type) {

        // ── Update existing teams (matched by original_name) ──
        case "update_teams": {
          const teamLookup = buildTeamNameLookup();
          let updated = 0;
          let notFound = 0;

          for (const entry of item.data) {
            const origKey = (entry.original_name || "").toLowerCase().trim();
            const match = teamLookup[origKey];
            if (!match) { notFound++; continue; }

            const payload = {};
            if (entry.name && entry.name !== entry.original_name) payload.name = entry.name;
            if (entry.color) payload.color = entry.color;

            if (Object.keys(payload).length > 0 && updateTeam) {
              await updateTeam(match.id, payload);
              updated++;
            }
          }

          if (updated) result.created.push(`${updated} teams updated`);
          if (notFound) result.errors.push(`${notFound} teams not matched by name`);
          break;
        }

        // ── Update existing tasks (matched by original_name) ──
        case "update_tasks": {
          const taskLookup = buildTaskNameLookup();
          let updated = 0;
          let notFound = 0;

          for (const entry of item.data) {
            const origKey = (entry.original_name || "").toLowerCase().trim();
            const match = taskLookup[origKey];
            if (!match) { notFound++; continue; }

            const payload = {};
            if (entry.name && entry.name !== entry.original_name) payload.name = entry.name;
            if (entry.description != null) payload.description = entry.description;
            if (entry.priority) payload.priority = entry.priority;
            if (entry.difficulty) payload.difficulty = entry.difficulty;
            if (entry.acceptance_criteria) {
              payload.acceptance_criteria = normaliseCriteria(entry.acceptance_criteria);
            }

            if (Object.keys(payload).length > 0 && updateTask) {
              await updateTask(match.id, payload);
              updated++;
            }
          }

          if (updated) result.created.push(`${updated} tasks updated`);
          if (notFound) result.errors.push(`${notFound} tasks not matched by name`);
          break;
        }

        // ── Add acceptance criteria to tasks (matched by original_name) ──
        case "acceptance_criteria": {
          const taskLookup = buildTaskNameLookup();
          let updated = 0;
          let notFound = 0;
          let totalCriteria = 0;

          for (const entry of item.data) {
            const origKey = (entry.original_name || "").toLowerCase().trim();
            const match = taskLookup[origKey];
            if (!match) { notFound++; continue; }

            const newCriteria = normaliseCriteria(entry.criteria);
            if (newCriteria.length === 0) continue;

            // Merge with existing criteria
            const existing = match.task.acceptance_criteria || [];
            const merged = [
              ...existing.map(c => ({ title: c.title, description: c.description || "", done: c.done })),
              ...newCriteria,
            ];

            if (updateTask) {
              await updateTask(match.id, { acceptance_criteria: merged });
              updated++;
              totalCriteria += newCriteria.length;
            }
          }

          if (updated) result.created.push(`${totalCriteria} criteria added to ${updated} tasks`);
          if (notFound) result.errors.push(`${notFound} tasks not matched by name`);
          break;
        }

        // ── Create teams with tasks ──
        case "task_teams": {
          let teamsCreated = 0;
          let tasksCreated = 0;

          for (const teamData of item.data) {
            const teamName = teamData.team_name || teamData.name || "Unnamed";
            const color = teamData.color || "#6366f1";
            const team = await createTeam(teamName, color);
            if (!team) {
              result.errors.push(`Failed to create team "${teamName}"`);
              continue;
            }
            teamsCreated++;
            newTeamIds[teamName.toLowerCase().trim()] = team.id;

            for (const taskData of (teamData.tasks || [])) {
              const payload = {
                name: taskData.name || "Untitled",
                description: taskData.description || "",
                priority: taskData.priority || "",
                difficulty: taskData.difficulty || "",
                team_id: team.id,
                acceptance_criteria: normaliseCriteria(taskData.acceptance_criteria),
              };
              if (taskData.hard_deadline != null) payload.hard_deadline = taskData.hard_deadline;
              await createTask(payload);
              tasksCreated++;
            }
          }

          if (teamsCreated) result.created.push(`${teamsCreated} teams`);
          if (tasksCreated) result.created.push(`${tasksCreated} tasks`);
          break;
        }

        // ── Create unassigned tasks ──
        case "task_tasks": {
          for (const taskData of item.data) {
            const payload = {
              name: taskData.name || "Untitled",
              description: taskData.description || "",
              priority: taskData.priority || "",
              difficulty: taskData.difficulty || "",
              team_id: null,
              acceptance_criteria: normaliseCriteria(taskData.acceptance_criteria),
            };
            if (taskData.hard_deadline != null) payload.hard_deadline = taskData.hard_deadline;
            await createTask(payload);
          }
          result.created.push(`${item.data.length} tasks`);
          break;
        }

        // ── Assign existing tasks to existing teams ──
        case "task_assignments": {
          const taskLookup = buildTaskNameLookup();
          const teamLookup = buildTeamNameLookup();
          let moved = 0;
          let notFoundTasks = 0;
          let notFoundTeams = 0;

          for (const assignment of item.data) {
            const teamKey = (assignment.team_name || "").toLowerCase().trim();
            const team = teamLookup[teamKey] || (newTeamIds[teamKey] ? { id: newTeamIds[teamKey] } : null);
            if (!team) { notFoundTeams++; continue; }

            for (const taskRef of (assignment.tasks || [])) {
              const taskName = typeof taskRef === "string" ? taskRef : taskRef?.name || "";
              const taskMatch = taskLookup[taskName.toLowerCase().trim()];
              if (!taskMatch) { notFoundTasks++; continue; }

              if (assignTaskToTeam) {
                await assignTaskToTeam(taskMatch.id, team.id);
                moved++;
              }
            }
          }

          if (moved) result.created.push(`${moved} tasks assigned to teams`);
          if (notFoundTasks) result.errors.push(`${notFoundTasks} tasks not found`);
          if (notFoundTeams) result.errors.push(`${notFoundTeams} teams not found`);
          break;
        }

        // ── Create classification systems (legends + types) ──
        case "add_classification_systems": {
          let systemsCreated = 0;
          let categoriesCreated = 0;

          for (const sys of item.data) {
            const name = sys.name || "Unnamed";
            if (!createLegend) break;
            const legend = await createLegend(name);
            if (!legend) { result.errors.push(`Failed to create classification system "${name}"`); continue; }
            systemsCreated++;

            for (const cat of (sys.categories || [])) {
              if (!createLegendType) continue;
              await createLegendType(legend.id, cat.name || "Unnamed", cat.color || "#64748b");
              categoriesCreated++;
            }
          }

          if (systemsCreated) result.created.push(`${systemsCreated} classification system${systemsCreated > 1 ? "s" : ""}`);
          if (categoriesCreated) result.created.push(`${categoriesCreated} categories`);
          break;
        }

        // ── Assign tasks to legend types (label assignments) ──
        case "task_label_assignments": {
          const taskLookup = buildTaskNameLookup();
          let assigned = 0;
          let notFoundSystems = 0;
          let notFoundTasks = 0;
          let notFoundCategories = 0;

          for (const sysAssignment of item.data) {
            const sysName = (sysAssignment.classification_system || "").toLowerCase().trim();
            // Find legend by name in the runtime legends list
            const legend = legends.find(l => (l.name || "").toLowerCase().trim() === sysName);
            if (!legend) { notFoundSystems++; continue; }

            // Build type lookup for this legend from legendsWithTypes
            const systemTypes = legendsWithTypes.find(l => l.id === legend.id)?.types || [];
            const typeLookup = {};
            for (const t of systemTypes) {
              typeLookup[(t.name || "").toLowerCase().trim()] = t;
            }

            for (const a of (sysAssignment.assignments || [])) {
              const taskName = (a.task || "").toLowerCase().trim();
              const catName = (a.category || "").toLowerCase().trim();

              const taskMatch = taskLookup[taskName];
              if (!taskMatch) { notFoundTasks++; continue; }

              const typeMatch = typeLookup[catName];
              if (!typeMatch) { notFoundCategories++; continue; }

              if (assignLegendType) {
                await assignLegendType(taskMatch.id, legend.id, typeMatch.id);
                assigned++;
              }
            }
          }

          if (assigned) result.created.push(`${assigned} label assignment${assigned > 1 ? "s" : ""}`);
          if (notFoundSystems) result.errors.push(`${notFoundSystems} classification system${notFoundSystems > 1 ? "s" : ""} not found`);
          if (notFoundTasks) result.errors.push(`${notFoundTasks} tasks not matched by name`);
          if (notFoundCategories) result.errors.push(`${notFoundCategories} categories not found`);
          break;
        }

        // ── Create new teams + assign existing tasks to them ──
        case "task_new_team_assign": {
          const taskLookup = buildTaskNameLookup();
          let teamsCreated = 0;
          let moved = 0;
          let notFound = 0;

          for (const teamData of item.data) {
            const teamName = teamData.team_name || teamData.name || "New Team";
            const color = teamData.color || "#6366f1";
            const team = await createTeam(teamName, color);
            if (!team) {
              result.errors.push(`Failed to create team "${teamName}"`);
              continue;
            }
            teamsCreated++;
            newTeamIds[teamName.toLowerCase().trim()] = team.id;

            for (const taskRef of (teamData.tasks || [])) {
              const taskName = typeof taskRef === "string" ? taskRef : taskRef?.name || "";
              const match = taskLookup[taskName.toLowerCase().trim()];
              if (match && assignTaskToTeam) {
                await assignTaskToTeam(match.id, team.id);
                moved++;
              } else {
                notFound++;
              }
            }
          }

          if (teamsCreated) result.created.push(`${teamsCreated} new teams`);
          if (moved) result.created.push(`${moved} tasks moved to new teams`);
          if (notFound) result.errors.push(`${notFound} tasks not matched by name`);
          break;
        }
      }
    } catch (e) {
      result.errors.push(`${item.type}: ${e.message || "Unknown error"}`);
    }
  }

  // Refresh everything
  if (result.created.length > 0 && refreshAll) {
    try { await refreshAll(); } catch { /* ignore */ }
  }

  return result;
}
