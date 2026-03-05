/**
 * ═══════════════════════════════════════════════════════════
 *  Task Change Builder
 *  ───────────────────
 *  Mirrors changeBuilder.js for the Task Structure domain.
 *
 *  Hierarchical decline rule:
 *    - Declining a team creation makes its child tasks unassigned
 *      (they are still created, just without a team).
 *    - Each task inside a team is independently toggleable.
 *
 *  Exports:
 *    buildTaskChangeItems(detected) → ChangeItem[]
 *    recomposeTaskDetected(detected, changeItems) → filtered detected[]
 *    TASK_CHANGE_TYPE_META
 * ═══════════════════════════════════════════════════════════
 */

// ─── Execution order ───────────────────────────────────

const TYPE_ORDER = [
  "update_teams", "update_tasks", "acceptance_criteria",
  "task_teams", "task_tasks",
  "task_assignments", "task_new_team_assign",
];
const TYPE_ORDER_MAP = {};
TYPE_ORDER.forEach((t, i) => { TYPE_ORDER_MAP[t] = i; });

// ─── Helpers ───────────────────────────────────────────

function truncate(str, len = 50) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

// ─── Change-type meta ──────────────────────────────────

export const TASK_CHANGE_TYPE_META = {
  create_task:       { color: "text-green-600",  dotColor: "bg-green-500",   verb: "Create" },
  create_team:       { color: "text-indigo-600", dotColor: "bg-indigo-500",  verb: "Create" },
  update_task:       { color: "text-amber-600",  dotColor: "bg-amber-500",   verb: "Update" },
  update_team:       { color: "text-amber-600",  dotColor: "bg-amber-500",   verb: "Update" },
  move_task:         { color: "text-teal-600",   dotColor: "bg-teal-500",    verb: "Assign" },
  add_criteria:      { color: "text-purple-600", dotColor: "bg-purple-500",  verb: "Add" },
};


// ═══════════════════════════════════════════════════════════
//  Build Change Items
// ═══════════════════════════════════════════════════════════

export function buildTaskChangeItems(detected) {
  const items = [];
  let nextId = 1;
  const makeId = () => `tch-${nextId++}`;

  for (let detIdx = 0; detIdx < detected.length; detIdx++) {
    const item = detected[detIdx];
    const sortOrder = TYPE_ORDER_MAP[item.type] ?? 999;

    switch (item.type) {

      // ── Update existing teams ──
      case "update_teams": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const renamed = entry.name && entry.name !== entry.original_name;
          const parts = [];
          if (renamed) parts.push(`Name → "${truncate(entry.name, 30)}"`);
          if (entry.color) parts.push(`Color: ${entry.color}`);

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Update team: "${truncate(entry.original_name, 35)}"`,
            sublabel: parts.join(" · ") || null,
            changeType: "update_team",
            group: "Update Teams",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
            detail: {
              type: "update_team",
              originalName: entry.original_name || "",
              newName: entry.name || entry.original_name || "",
              renamed: !!renamed,
              color: entry.color || null,
            },
          });
        }
        break;
      }

      // ── Update existing tasks ──
      case "update_tasks": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const renamed = entry.name && entry.name !== entry.original_name;
          const parts = [];
          if (renamed) parts.push(`Name → "${truncate(entry.name, 30)}"`);
          if (entry.description != null) parts.push("Description updated");
          if (entry.priority) parts.push(`Priority: ${entry.priority}`);
          if (entry.difficulty) parts.push(`Difficulty: ${entry.difficulty}`);
          if (entry.acceptance_criteria?.length) parts.push(`${entry.acceptance_criteria.length} criteria`);

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Update task: "${truncate(entry.original_name, 35)}"`,
            sublabel: parts.join(" · ") || null,
            changeType: "update_task",
            group: "Update Tasks",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
            detail: {
              type: "update_task",
              originalName: entry.original_name || "",
              newName: entry.name || entry.original_name || "",
              renamed: !!renamed,
              description: entry.description ?? null,
              priority: entry.priority || null,
              difficulty: entry.difficulty || null,
              criteriaCount: entry.acceptance_criteria?.length || 0,
            },
          });
        }
        break;
      }

      // ── Add acceptance criteria ──
      case "acceptance_criteria": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const criteria = entry.criteria || [];

          for (let ci = 0; ci < criteria.length; ci++) {
            const c = criteria[ci];
            const title = typeof c === "string" ? c : c.title || "";
            items.push({
              id: makeId(), parentId: null, accepted: true,
              label: `Criterion: "${truncate(title, 40)}"`,
              sublabel: `For task: "${truncate(entry.original_name, 30)}"`,
              changeType: "add_criteria",
              group: "Acceptance Criteria",
              depth: 0,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "criteria", childIdx: ci },
              detail: {
                type: "add_criteria",
                taskName: entry.original_name || "",
                criterionTitle: title,
              },
            });
          }
        }
        break;
      }

      // ── Create teams with tasks ──
      // Hierarchical: declining team → tasks become unassigned (still created)
      case "task_teams": {
        for (let di = 0; di < item.data.length; di++) {
          const teamData = item.data[di];
          const teamName = teamData.team_name || teamData.name || "Unnamed";
          const taskNames = (teamData.tasks || []).map(t => t.name || "Untitled");

          const teamItemId = makeId();
          items.push({
            id: teamItemId, parentId: null, accepted: true,
            label: `Create team: "${truncate(teamName, 35)}"`,
            sublabel: teamData.tasks?.length
              ? `${teamData.tasks.length} task${teamData.tasks.length > 1 ? "s" : ""}`
              : "Empty",
            changeType: "create_team",
            group: "New Teams",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
            detail: {
              type: "create_team",
              teamName,
              color: teamData.color || "#6366f1",
              taskNames,
              taskCount: teamData.tasks?.length || 0,
            },
          });

          for (let ci = 0; ci < (teamData.tasks || []).length; ci++) {
            const taskData = teamData.tasks[ci];
            const acCount = taskData.acceptance_criteria?.length || 0;
            items.push({
              id: makeId(), parentId: teamItemId, accepted: true,
              label: `Create task: "${truncate(taskData.name, 38)}"`,
              sublabel: [
                taskData.description ? truncate(taskData.description, 40) : null,
                acCount > 0 ? `${acCount} criteria` : null,
              ].filter(Boolean).join(" · ") || null,
              changeType: "create_task",
              group: "New Teams",
              depth: 1,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "tasks", childIdx: ci },
              detail: {
                type: "create_task",
                name: taskData.name || "Untitled",
                description: taskData.description || "",
                priority: taskData.priority || "",
                difficulty: taskData.difficulty || "",
                criteriaCount: acCount,
                target: teamName,
              },
            });
          }
        }
        break;
      }

      // ── Create unassigned tasks ──
      case "task_tasks": {
        const groupLabel = item.label
          ? item.label.charAt(0).toUpperCase() + item.label.slice(1)
          : "New Tasks";
        for (let di = 0; di < item.data.length; di++) {
          const taskData = item.data[di];
          const acCount = taskData.acceptance_criteria?.length || 0;
          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Create task: "${truncate(taskData.name, 38)}"`,
            sublabel: [
              taskData.description ? truncate(taskData.description, 40) : null,
              acCount > 0 ? `${acCount} criteria` : null,
            ].filter(Boolean).join(" · ") || null,
            changeType: "create_task",
            group: groupLabel,
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
            detail: {
              type: "create_task",
              name: taskData.name || "Untitled",
              description: taskData.description || "",
              priority: taskData.priority || "",
              difficulty: taskData.difficulty || "",
              criteriaCount: acCount,
              target: "Unassigned",
            },
          });
        }
        break;
      }

      // ── Assign tasks to existing teams ──
      case "task_assignments": {
        for (let di = 0; di < item.data.length; di++) {
          const assignment = item.data[di];
          for (let ci = 0; ci < (assignment.tasks || []).length; ci++) {
            const taskRef = assignment.tasks[ci];
            const taskName = typeof taskRef === "string" ? taskRef : taskRef?.name || "";
            items.push({
              id: makeId(), parentId: null, accepted: true,
              label: `Assign: "${truncate(taskName, 35)}"`,
              sublabel: `To team: "${truncate(assignment.team_name, 30)}"`,
              changeType: "move_task",
              group: "Task Assignments",
              depth: 0,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "tasks", childIdx: ci },
              detail: {
                type: "move_task",
                taskName,
                targetTeam: assignment.team_name || "",
              },
            });
          }
        }
        break;
      }

      // ── Create new teams + move existing tasks to them ──
      case "task_new_team_assign": {
        for (let di = 0; di < item.data.length; di++) {
          const teamData = item.data[di];
          const teamName = teamData.team_name || teamData.name || "New Team";
          const moveNames = (teamData.tasks || []).map(ref =>
            typeof ref === "string" ? ref : ref?.name || "",
          );

          const teamItemId = makeId();
          items.push({
            id: teamItemId, parentId: null, accepted: true,
            label: `Create team: "${truncate(teamName, 33)}"`,
            sublabel: teamData.tasks?.length
              ? `+ assign ${teamData.tasks.length} task${teamData.tasks.length > 1 ? "s" : ""}`
              : null,
            changeType: "create_team",
            group: "New Teams + Assign",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
            detail: {
              type: "create_team",
              teamName,
              color: teamData.color || "#6366f1",
              taskNames: moveNames,
              taskCount: teamData.tasks?.length || 0,
              isAssignment: true,
            },
          });

          for (let ci = 0; ci < (teamData.tasks || []).length; ci++) {
            const taskRef = teamData.tasks[ci];
            const taskName = typeof taskRef === "string" ? taskRef : taskRef?.name || "";
            items.push({
              id: makeId(), parentId: teamItemId, accepted: true,
              label: `Assign: "${truncate(taskName, 38)}"`,
              sublabel: null,
              changeType: "move_task",
              group: "New Teams + Assign",
              depth: 1,
              _sortOrder: sortOrder,
              _ref: { detectedIdx: detIdx, dataIdx: di, childField: "tasks", childIdx: ci },
              detail: {
                type: "move_task",
                taskName,
                targetTeam: teamName,
              },
            });
          }
        }
        break;
      }

      default:
        break;
    }
  }

  return items;
}


// ═══════════════════════════════════════════════════════════
//  Recompose Detected
// ═══════════════════════════════════════════════════════════

const RECOMPOSABLE_TYPES = new Set([
  "update_teams", "update_tasks", "acceptance_criteria",
  "task_teams", "task_tasks",
  "task_assignments", "task_new_team_assign",
]);

/**
 * Rebuild the `detected` array by filtering out items the
 * user has declined, then pass to `applyTaskDetected()`.
 *
 * Hierarchical rule for task_teams:
 *   - If a team is declined but its child tasks are accepted,
 *     those tasks are converted to unassigned tasks
 *     (added to a synthetic task_tasks entry).
 */
export function recomposeTaskDetected(detected, changeItems) {
  const acceptedRoots = {};
  const declinedRoots = {};
  const acceptedChildren = {};

  for (const ci of changeItems) {
    const { detectedIdx, dataIdx, childField, childIdx } = ci._ref;

    if (childField === null && childIdx === null) {
      // Root item
      if (ci.accepted) {
        if (!acceptedRoots[detectedIdx]) acceptedRoots[detectedIdx] = new Set();
        acceptedRoots[detectedIdx].add(dataIdx);
      } else {
        if (!declinedRoots[detectedIdx]) declinedRoots[detectedIdx] = new Set();
        declinedRoots[detectedIdx].add(dataIdx);
      }
    } else {
      // Child item
      if (ci.accepted) {
        if (!acceptedChildren[detectedIdx]) acceptedChildren[detectedIdx] = {};
        if (!acceptedChildren[detectedIdx][dataIdx]) acceptedChildren[detectedIdx][dataIdx] = new Set();
        acceptedChildren[detectedIdx][dataIdx].add(childIdx);
      }
    }
  }

  const result = [];
  // Collect orphaned tasks (team declined but child tasks accepted)
  const orphanedTasks = [];

  for (let detIdx = 0; detIdx < detected.length; detIdx++) {
    const item = detected[detIdx];

    if (!RECOMPOSABLE_TYPES.has(item.type)) {
      result.push(item);
      continue;
    }

    const roots = acceptedRoots[detIdx];
    const declined = declinedRoots[detIdx];
    const children = acceptedChildren[detIdx];

    if (!roots && !children) continue;

    const filteredData = filterTaskItemData(item, roots, declined, children, orphanedTasks);
    if (filteredData && filteredData.length > 0) {
      result.push({ ...item, data: filteredData });
    }
  }

  // Add orphaned tasks as unassigned
  if (orphanedTasks.length > 0) {
    result.push({
      type: "task_tasks",
      count: orphanedTasks.length,
      data: orphanedTasks,
      label: "tasks (team declined)",
    });
  }

  return result;
}


// ─── Internal: filter a single detected item's data ────

function filterTaskItemData(item, acceptedRoots, declinedRoots, acceptedChildren, orphanedTasks) {
  const rootSet = acceptedRoots || new Set();
  const declinedSet = declinedRoots || new Set();
  const childMap = acceptedChildren || {};

  switch (item.type) {

    case "update_teams":
    case "update_tasks":
    case "task_tasks": {
      return item.data.filter((_, idx) => rootSet.has(idx));
    }

    case "acceptance_criteria": {
      return item.data
        .map((entry, idx) => {
          const childSet = childMap[idx];
          if (!childSet) return null;
          const filtered = (entry.criteria || []).filter((_, ci) => childSet.has(ci));
          return filtered.length > 0 ? { ...entry, criteria: filtered } : null;
        })
        .filter(Boolean);
    }

    case "task_teams": {
      return item.data
        .map((entry, idx) => {
          const teamAccepted = rootSet.has(idx);
          const childSet = childMap[idx];
          const teamDeclined = declinedSet.has(idx);

          if (teamDeclined && childSet) {
            // Team declined but tasks accepted → tasks become orphaned (unassigned)
            const acceptedTasks = (entry.tasks || []).filter((_, ci) => childSet.has(ci));
            orphanedTasks.push(...acceptedTasks);
            return null;
          }

          if (!teamAccepted) return null;

          if (!entry.tasks?.length) return entry;
          if (!childSet) return { ...entry, tasks: [] };
          const filtered = (entry.tasks || []).filter((_, ci) => childSet.has(ci));
          return { ...entry, tasks: filtered };
        })
        .filter(Boolean);
    }

    case "task_assignments": {
      return item.data
        .map((entry, idx) => {
          const childSet = childMap[idx];
          if (!childSet) return null;
          const filtered = (entry.tasks || []).filter((_, ci) => childSet.has(ci));
          return filtered.length > 0 ? { ...entry, tasks: filtered } : null;
        })
        .filter(Boolean);
    }

    case "task_new_team_assign": {
      return item.data
        .map((entry, idx) => {
          const teamAccepted = rootSet.has(idx);
          const childSet = childMap[idx];

          if (!teamAccepted) return null;
          if (!childSet) return { ...entry, tasks: [] };
          const filtered = (entry.tasks || []).filter((_, ci) => childSet.has(ci));
          return { ...entry, tasks: filtered };
        })
        .filter(Boolean);
    }

    default:
      return item.data;
  }
}
