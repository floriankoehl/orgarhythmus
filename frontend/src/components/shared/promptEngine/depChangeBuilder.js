/**
 * ═══════════════════════════════════════════════════════════
 *  Dependency Change Builder
 *  ─────────────────────────
 *  Mirrors taskChangeBuilder.js for the Dependency domain.
 *
 *  Hierarchical decline rule:
 *    - Declining a milestone creation disables its child
 *      dependency edges (edges cannot exist without their
 *      endpoint milestone).
 *    - Dependencies are independently toggleable otherwise.
 *
 *  Conflict-aware:
 *    - Each dependency edge change item includes a `conflict`
 *      field when the scheduling rule is violated.
 *    - Conflicts are flagged but not auto-blocked: user can
 *      still accept them and manually adjust positions.
 *
 *  Exports:
 *    buildDepChangeItems(detected, nodesCtx) → ChangeItem[]
 *    recomposeDepDetected(detected, changeItems) → filtered detected[]
 *    DEP_CHANGE_TYPE_META
 * ═══════════════════════════════════════════════════════════
 */

import { checkDepConflict } from "./depResponseApplier";

// ─── Execution order ───────────────────────────────────

const TYPE_ORDER = [
  "update_milestones", "update_dependencies", "remove_dependencies",
  "dep_milestones", "dep_dependencies", "dep_schedule",
];
const TYPE_ORDER_MAP = {};
TYPE_ORDER.forEach((t, i) => { TYPE_ORDER_MAP[t] = i; });

// ─── Helpers ───────────────────────────────────────────

function truncate(str, len = 50) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

// ─── Change-type meta ──────────────────────────────────

export const DEP_CHANGE_TYPE_META = {
  create_milestone:    { color: "text-green-600",  dotColor: "bg-green-500",   verb: "Create" },
  create_dependency:   { color: "text-blue-600",   dotColor: "bg-blue-500",    verb: "Create" },
  update_milestone:    { color: "text-amber-600",  dotColor: "bg-amber-500",   verb: "Update" },
  update_dependency:   { color: "text-amber-600",  dotColor: "bg-amber-500",   verb: "Update" },
  remove_dependency:   { color: "text-red-600",    dotColor: "bg-red-500",     verb: "Remove" },
  move_milestone:      { color: "text-teal-600",   dotColor: "bg-teal-500",    verb: "Move" },
  conflict_dependency: { color: "text-orange-600", dotColor: "bg-orange-500",  verb: "Conflict" },
};


// ═══════════════════════════════════════════════════════════
//  Build Change Items
// ═══════════════════════════════════════════════════════════

/**
 * @param {Array}  detected – from detectDepResponseContent()
 * @param {Object} nodesCtx – current nodes (milestones) for conflict checking
 */
export function buildDepChangeItems(detected, nodesCtx = {}) {
  const items = [];
  let nextId = 1;
  const makeId = () => `dch-${nextId++}`;

  // Track milestone names → their change item ids (for parent-child linking)
  const milestoneChangeIds = {};

  for (let detIdx = 0; detIdx < detected.length; detIdx++) {
    const item = detected[detIdx];
    const sortOrder = TYPE_ORDER_MAP[item.type] ?? 999;

    switch (item.type) {

      // ── Update existing milestones ──
      case "update_milestones": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const parts = [];
          if (entry.name && entry.name !== entry.original_name)
            parts.push(`Name → "${truncate(entry.name, 30)}"`);
          if (entry.start_index !== undefined)
            parts.push(`Day: ${entry.start_index}`);
          if (entry.duration !== undefined)
            parts.push(`Duration: ${entry.duration}`);

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Update milestone: "${truncate(entry.original_name, 35)}"`,
            sublabel: parts.join(" · ") || entry.description || null,
            changeType: "update_milestone",
            group: "Update Milestones",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Update existing dependencies ──
      case "update_dependencies": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const parts = [];
          if (entry.weight) parts.push(`Weight: ${entry.weight}`);
          if (entry.reason) parts.push(`Reason: "${truncate(entry.reason, 40)}"`);

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Update dependency: ${entry.source_id} → ${entry.target_id}`,
            sublabel: parts.join(" · ") || null,
            changeType: "update_dependency",
            group: "Update Dependencies",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Remove dependencies ──
      case "remove_dependencies": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const label = entry.source_milestone_name
            ? `"${truncate(entry.source_milestone_name, 25)}" → "${truncate(entry.target_milestone_name, 25)}"`
            : `${entry.source_id} → ${entry.target_id}`;

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Remove dependency: ${label}`,
            sublabel: entry.reason ? `Reason: "${truncate(entry.reason, 50)}"` : null,
            changeType: "remove_dependency",
            group: "Remove Dependencies",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Create new milestones ──
      case "dep_milestones": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const id = makeId();
          const nameKey = (entry.name || "").toLowerCase().trim();
          if (nameKey) milestoneChangeIds[nameKey] = id;

          items.push({
            id, parentId: null, accepted: true,
            label: `Create milestone: "${truncate(entry.name, 35)}"`,
            sublabel: [
              entry.task_name ? `Task: ${truncate(entry.task_name, 25)}` : null,
              entry.start_index !== undefined ? `Day: ${entry.start_index}` : null,
              entry.duration ? `Duration: ${entry.duration}` : null,
            ].filter(Boolean).join(" · ") || entry.description || null,
            changeType: "create_milestone",
            group: "New Milestones",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Create new dependencies ──
      case "dep_dependencies": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];

          // Determine parent (if the dependency connects to a newly created milestone)
          const srcKey = (entry.source_milestone_name || "").toLowerCase().trim();
          const tgtKey = (entry.target_milestone_name || "").toLowerCase().trim();
          const parentId = milestoneChangeIds[srcKey] || milestoneChangeIds[tgtKey] || null;

          // Conflict detection
          let conflict = null;
          const sourceId = entry.source_id;
          const targetId = entry.target_id;
          if (sourceId && targetId && nodesCtx[sourceId] && nodesCtx[targetId]) {
            const check = checkDepConflict(nodesCtx[sourceId], nodesCtx[targetId]);
            if (check.conflict) {
              conflict = {
                sourceEnd: check.sourceEnd,
                targetStart: check.targetStart,
                message: `Predecessor ends at day ${check.sourceEnd} but successor starts at day ${check.targetStart}`,
              };
            }
          }

          const srcLabel = entry.source_milestone_name || entry.source_id;
          const tgtLabel = entry.target_milestone_name || entry.target_id;

          items.push({
            id: makeId(),
            parentId,
            accepted: true,
            label: `${conflict ? "⚠️ " : ""}Dependency: "${truncate(String(srcLabel), 25)}" → "${truncate(String(tgtLabel), 25)}"`,
            sublabel: [
              entry.weight ? `Weight: ${entry.weight}` : null,
              entry.reason ? `Reason: "${truncate(entry.reason, 40)}"` : null,
              conflict ? `⚠️ ${conflict.message}` : null,
            ].filter(Boolean).join(" · ") || null,
            changeType: conflict ? "conflict_dependency" : "create_dependency",
            group: conflict ? "Conflicting Dependencies" : "New Dependencies",
            depth: parentId ? 1 : 0,
            conflict,
            _sortOrder: conflict ? sortOrder + 0.5 : sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Schedule moves ──
      case "dep_schedule": {
        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const ms = nodesCtx[entry.milestone_id];
          const currentPos = ms ? (ms.start_index ?? ms.startColumn ?? "?") : "?";

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Move milestone: "${truncate(ms?.name || String(entry.milestone_id), 35)}"`,
            sublabel: `Day ${currentPos} → Day ${entry.start_index}${entry.duration ? ` (duration: ${entry.duration})` : ""}`,
            changeType: "move_milestone",
            group: "Schedule Changes",
            depth: 0,
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }
    }
  }

  return items;
}


// ═══════════════════════════════════════════════════════════
//  Recompose Detected (filter to accepted items only)
// ═══════════════════════════════════════════════════════════

export function recomposeDepDetected(detected, changeItems) {
  // Build set of accepted refs
  const parentDisabled = new Set();
  for (const ci of changeItems) {
    if (!ci.accepted) parentDisabled.add(ci.id);
  }

  // Group accepted change items by detected index
  const acceptedByDet = {};
  for (const ci of changeItems) {
    // Skip if this item or its parent is declined
    if (!ci.accepted) continue;
    if (ci.parentId && parentDisabled.has(ci.parentId)) continue;

    const { detectedIdx, dataIdx } = ci._ref;
    if (!acceptedByDet[detectedIdx]) acceptedByDet[detectedIdx] = new Set();
    acceptedByDet[detectedIdx].add(dataIdx);
  }

  const result = [];
  for (let i = 0; i < detected.length; i++) {
    const item = detected[i];
    const accepted = acceptedByDet[i];

    // Non-actionable items (suggestions) — always pass through
    if (item.type === "suggestions") {
      result.push(item);
      continue;
    }

    if (!accepted || accepted.size === 0) continue;

    if (Array.isArray(item.data)) {
      const filteredData = item.data.filter((_, idx) => accepted.has(idx));
      if (filteredData.length > 0) {
        result.push({ ...item, data: filteredData, count: filteredData.length });
      }
    } else {
      result.push(item);
    }
  }

  return result;
}
