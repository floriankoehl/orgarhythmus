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

/** Resolve a milestone name: authoritative nodesCtx lookup first, then AI-provided name, then raw ID */
function nodeName(entry, field, idField, nodesCtx) {
  // Prefer the live data — most reliable source
  const id = entry[idField];
  if (id != null && nodesCtx[id]?.name) return nodesCtx[id].name;
  // Fall back to AI-provided name, but skip it if it looks like a bare numeric ID
  const nameVal = entry[field];
  if (nameVal && !/^\d+$/.test(String(nameVal).trim())) return String(nameVal);
  return String(id ?? "?");
}

/** Resolve team/task context for a milestone node */
function nodeContext(nodeId, nodesCtx, rowsCtx, lanesCtx) {
  const node = nodesCtx[nodeId];
  if (!node) return null;
  const row = rowsCtx[node.row || node.task];
  if (!row) return { taskName: null, teamName: null, teamColor: null };
  const lane = lanesCtx[row.lane || row.team];
  return {
    taskName: row.name || null,
    teamName: lane?.name || null,
    teamColor: lane?.color || null,
  };
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
 * @param {Array}  detected  – from detectDepResponseContent()
 * @param {Object} nodesCtx  – current nodes (milestones) for conflict checking
 * @param {Object} rowsCtx   – rows/tasks for team/task context
 * @param {Object} lanesCtx  – lanes/teams for team names/colors
 * @param {Array}  edgesCtx  – current edges for successor conflict detection
 */
export function buildDepChangeItems(detected, nodesCtx = {}, rowsCtx = {}, lanesCtx = {}, edgesCtx = []) {
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
        // Build name→id lookup once for conflict detection
        const nameToMsId = {};
        for (const [id, n] of Object.entries(nodesCtx)) {
          const k = (n.name || "").toLowerCase().trim();
          if (k) nameToMsId[k] = parseInt(id);
        }

        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];
          const parts = [];
          if (entry.name && entry.name !== entry.original_name)
            parts.push(`Name → "${truncate(entry.name, 30)}"`);
          if (entry.start_index !== undefined)
            parts.push(`Day: ${entry.start_index}`);
          if (entry.duration !== undefined)
            parts.push(`Duration: ${entry.duration}`);
          if (entry.reason)
            parts.push(`Reason: "${truncate(entry.reason, 40)}"`);

          // Detect scheduling conflicts caused by duration increase
          let conflict = null;
          const msId = nameToMsId[(entry.original_name || "").toLowerCase().trim()];
          if (msId && entry.duration !== undefined && nodesCtx[msId]) {
            const ms = nodesCtx[msId];
            const startIdx = ms.startColumn ?? ms.start_index ?? 0;
            const newEnd = startIdx + entry.duration;
            const violatedSuccessors = [];
            for (const edge of edgesCtx) {
              if (Number(edge.source) === msId) {
                const targetNode = nodesCtx[Number(edge.target)];
                if (targetNode) {
                  const targetStart = targetNode.startColumn ?? targetNode.start_index ?? 0;
                  if (newEnd > targetStart) {
                    violatedSuccessors.push({
                      id: Number(edge.target),
                      name: targetNode.name || String(edge.target),
                      newEnd,
                      targetStart,
                    });
                  }
                }
              }
            }
            if (violatedSuccessors.length > 0) {
              conflict = {
                message: violatedSuccessors
                  .map(v => `"${v.name}" starts day ${v.targetStart} but predecessor now ends day ${v.newEnd}`)
                  .join("; "),
                violatedSuccessors,
              };
            }
          }

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `${conflict ? "⚠️ " : ""}Update milestone: "${truncate(entry.original_name, 35)}"`,
            sublabel: parts.join(" · ") || entry.description || null,
            changeType: "update_milestone",
            group: conflict ? "Conflicting Updates" : "Update Milestones",
            depth: 0,
            conflict: conflict || undefined,
            detail: {
              type: "update_milestone",
              originalName: entry.original_name,
              newName: entry.name !== entry.original_name ? entry.name : null,
              startIndex: entry.start_index,
              duration: entry.duration,
              description: entry.reason || entry.description || null,
              conflict: conflict || null,
            },
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

          const srcName = nodeName(entry, "source_milestone_name", "source_id", nodesCtx);
          const tgtName = nodeName(entry, "target_milestone_name", "target_id", nodesCtx);
          const srcCtx = nodeContext(entry.source_id, nodesCtx, rowsCtx, lanesCtx);
          const tgtCtx = nodeContext(entry.target_id, nodesCtx, rowsCtx, lanesCtx);

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Update dependency: "${truncate(srcName, 25)}" → "${truncate(tgtName, 25)}"`,
            sublabel: parts.join(" · ") || null,
            changeType: "update_dependency",
            group: "Update Dependencies",
            depth: 0,
            detail: {
              type: "update_dependency",
              sourceId: entry.source_id,
              targetId: entry.target_id,
              sourceName: srcName,
              targetName: tgtName,
              sourceCtx: srcCtx,
              targetCtx: tgtCtx,
              weight: entry.weight || null,
              reason: entry.reason || null,
              description: entry.description || null,
            },
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
          const srcName = nodeName(entry, "source_milestone_name", "source_id", nodesCtx);
          const tgtName = nodeName(entry, "target_milestone_name", "target_id", nodesCtx);
          const srcCtx = nodeContext(entry.source_id, nodesCtx, rowsCtx, lanesCtx);
          const tgtCtx = nodeContext(entry.target_id, nodesCtx, rowsCtx, lanesCtx);
          const label = `"${truncate(srcName, 25)}" → "${truncate(tgtName, 25)}"`;

          items.push({
            id: makeId(), parentId: null, accepted: true,
            label: `Remove dependency: ${label}`,
            sublabel: entry.reason ? `Reason: "${truncate(entry.reason, 50)}"` : null,
            changeType: "remove_dependency",
            group: "Remove Dependencies",
            depth: 0,
            detail: {
              type: "remove_dependency",
              sourceName: srcName,
              targetName: tgtName,
              sourceCtx: srcCtx,
              targetCtx: tgtCtx,
              reason: entry.reason || null,
              description: entry.description || null,
            },
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
            detail: {
              type: "create_milestone",
              name: entry.name,
              taskName: entry.task_name || null,
              startIndex: entry.start_index,
              duration: entry.duration || null,
              description: entry.description || null,
            },
            _sortOrder: sortOrder,
            _ref: { detectedIdx: detIdx, dataIdx: di, childField: null, childIdx: null },
          });
        }
        break;
      }

      // ── Create new dependencies ──
      case "dep_dependencies": {
        // Build name→id lookup once for this batch (used when AI returns names instead of IDs)
        const nameToNodeId = {};
        for (const [id, n] of Object.entries(nodesCtx)) {
          const key = (n.name || "").toLowerCase().trim();
          if (key) nameToNodeId[key] = parseInt(id);
        }

        for (let di = 0; di < item.data.length; di++) {
          const entry = item.data[di];

          // Determine parent (if the dependency connects to a newly created milestone)
          const srcKey = (entry.source_milestone_name || "").toLowerCase().trim();
          const tgtKey = (entry.target_milestone_name || "").toLowerCase().trim();
          const parentId = milestoneChangeIds[srcKey] || milestoneChangeIds[tgtKey] || null;

          // Resolve IDs — prefer explicit source_id/target_id, fall back to name lookup
          let sourceId = entry.source_id;
          let targetId = entry.target_id;
          if (!sourceId && srcKey) sourceId = nameToNodeId[srcKey];
          if (!targetId && tgtKey) targetId = nameToNodeId[tgtKey];

          // Conflict detection
          let conflict = null;
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

          const srcLabel = nodeName(entry, "source_milestone_name", "source_id", nodesCtx);
          const tgtLabel = nodeName(entry, "target_milestone_name", "target_id", nodesCtx);
          const srcCtx = nodeContext(entry.source_id, nodesCtx, rowsCtx, lanesCtx);
          const tgtCtx = nodeContext(entry.target_id, nodesCtx, rowsCtx, lanesCtx);

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
            detail: {
              type: conflict ? "conflict_dependency" : "create_dependency",
              sourceId: sourceId,
              targetId: targetId,
              sourceName: String(srcLabel),
              targetName: String(tgtLabel),
              sourceCtx: srcCtx,
              targetCtx: tgtCtx,
              weight: entry.weight || "strong",
              reason: entry.reason || null,
              description: entry.description || null,
              conflict: conflict || null,
            },
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
            detail: {
              type: "move_milestone",
              milestoneName: ms?.name || String(entry.milestone_id),
              currentDay: currentPos,
              newDay: entry.start_index,
              duration: entry.duration || null,
            },
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
