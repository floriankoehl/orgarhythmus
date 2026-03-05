/**
 * ═══════════════════════════════════════════════════════════
 *  Dependency Response Applier
 *  ──────────────────────────
 *  Mirrors taskResponseApplier.js for the Dependency domain.
 *  Detects milestones, dependencies, schedule updates, and
 *  suggestions from AI responses, then applies them via
 *  dependency-specific `applyCtx`.
 *
 *  Detected types:
 *    dep_milestones        — new milestones to create
 *    dep_dependencies      — new dependency edges to create
 *    dep_schedule          — schedule (re-position milestones)
 *    update_milestones     — update existing milestones (finetune)
 *    update_dependencies   — update existing dependencies
 *    remove_dependencies   — dependencies to remove
 *    suggestions           — text suggestions
 * ═══════════════════════════════════════════════════════════
 */

// ─── Detection ─────────────────────────────────────────

/**
 * Analyse a parsed JSON response and return an array of
 * detected dependency-domain content items.
 */
export function detectDepResponseContent(json) {
  if (!json || typeof json !== "object") return [];
  const found = [];

  // Bare array → try to determine type from shape
  if (Array.isArray(json)) {
    if (json.length > 0) {
      const first = json[0];
      if (first.source_id || first.source_milestone_name) {
        found.push({ type: "dep_dependencies", count: json.length, data: json });
      } else if (first.task_name || first.task_id) {
        found.push({ type: "dep_milestones", count: json.length, data: json });
      } else if (first.milestone_id) {
        found.push({ type: "dep_schedule", count: json.length, data: json });
      }
    }
    return found;
  }

  // ── Updated milestones (finetune — match by original_name) ──
  if (Array.isArray(json.updated_milestones) && json.updated_milestones.length > 0) {
    found.push({
      type: "update_milestones",
      count: json.updated_milestones.length,
      data: json.updated_milestones,
    });
  }

  // ── Updated dependencies (finetune) ──
  if (Array.isArray(json.updated_dependencies) && json.updated_dependencies.length > 0) {
    found.push({
      type: "update_dependencies",
      count: json.updated_dependencies.length,
      data: json.updated_dependencies,
    });
  }

  // ── Remove dependencies ──
  if (Array.isArray(json.remove_dependencies) && json.remove_dependencies.length > 0) {
    found.push({
      type: "remove_dependencies",
      count: json.remove_dependencies.length,
      data: json.remove_dependencies,
    });
  }

  // ── New milestones ──
  if (Array.isArray(json.milestones) && json.milestones.length > 0) {
    found.push({
      type: "dep_milestones",
      count: json.milestones.length,
      data: json.milestones,
    });
  }

  // ── New dependencies ──
  if (Array.isArray(json.dependencies) && json.dependencies.length > 0) {
    found.push({
      type: "dep_dependencies",
      count: json.dependencies.length,
      data: json.dependencies,
    });
  }

  // ── New dependencies (alt key from suggestions scenario) ──
  if (Array.isArray(json.new_dependencies) && json.new_dependencies.length > 0) {
    found.push({
      type: "dep_dependencies",
      count: json.new_dependencies.length,
      data: json.new_dependencies,
    });
  }

  // ── Schedule updates ──
  if (Array.isArray(json.schedule) && json.schedule.length > 0) {
    found.push({
      type: "dep_schedule",
      count: json.schedule.length,
      data: json.schedule,
    });
  }

  // ── Suggestions text ──
  if (json.suggestions && typeof json.suggestions === "string") {
    found.push({ type: "suggestions", data: json.suggestions });
  }

  return found;
}


// ─── Preview labels ────────────────────────────────────

export function buildDepPreviewLabels(detected) {
  return detected.map(item => {
    switch (item.type) {
      case "dep_milestones":
        return `${item.count} milestone${item.count > 1 ? "s" : ""}`;
      case "dep_dependencies":
        return `${item.count} dependenc${item.count > 1 ? "ies" : "y"}`;
      case "dep_schedule":
        return `Schedule ${item.count} milestone${item.count > 1 ? "s" : ""}`;
      case "update_milestones":
        return `Update ${item.count} milestone${item.count > 1 ? "s" : ""}`;
      case "update_dependencies":
        return `Update ${item.count} dependenc${item.count > 1 ? "ies" : "y"}`;
      case "remove_dependencies":
        return `Remove ${item.count} dependenc${item.count > 1 ? "ies" : "y"}`;
      case "suggestions":
        return "Suggestions";
      default:
        return "Unknown content";
    }
  });
}


// ─── Actionable check ──────────────────────────────────

const DEP_ACTIONABLE_TYPES = new Set([
  "dep_milestones", "dep_dependencies", "dep_schedule",
  "update_milestones", "update_dependencies", "remove_dependencies",
]);

const DEP_TYPE_ORDER = [
  "update_milestones", "update_dependencies", "remove_dependencies",
  "dep_milestones", "dep_dependencies", "dep_schedule",
];

export function hasDepActionableContent(detected) {
  return detected.some(item => DEP_ACTIONABLE_TYPES.has(item.type));
}


// ─── Conflict detection ────────────────────────────────

/**
 * Check whether a dependency (source → target) violates the
 * scheduling rule: source must end before target starts.
 *
 * @param {Object} sourceNode - milestone with start_index/startColumn and duration
 * @param {Object} targetNode - milestone with start_index/startColumn and duration
 * @returns {{ conflict: boolean, sourceEnd: number, targetStart: number }}
 */
export function checkDepConflict(sourceNode, targetNode) {
  // Prefer startColumn (optimistically updated during drag) over start_index (from API)
  const sourceStart = sourceNode.startColumn ?? sourceNode.start_index ?? 0;
  const sourceDuration = sourceNode.duration ?? 1;
  const sourceEnd = sourceStart + sourceDuration;
  const targetStart = targetNode.startColumn ?? targetNode.start_index ?? 0;

  return {
    conflict: sourceEnd > targetStart,
    sourceEnd,
    targetStart,
  };
}


// ─── Apply ─────────────────────────────────────────────

/**
 * Apply all actionable dependency items.
 *
 * @param {Array}  detected  – from detectDepResponseContent()
 * @param {Object} applyCtx  – functions & state:
 *   addMilestone(taskId, { name, description, start_index })
 *   createDependency(sourceId, targetId, { weight, reason, description })
 *   updateMilestone(milestoneId, { name, description, start_index, duration })
 *   updateDependency(sourceId, targetId, { weight, reason, description })
 *   deleteDependency(sourceId, targetId)
 *   moveMilestone(milestoneId, newStartIndex)
 *   refreshAll() → Promise
 *   nodes  – { [id]: { id, name, task, start_index, startColumn, duration } }
 *   edges  – [{ source, target, weight, reason, description }]
 *   rows   – { [id]: { id, name, description, team } }
 */
export async function applyDepDetected(detected, applyCtx) {
  const {
    addMilestone,
    createDependency,
    updateMilestone,
    updateDependency,
    deleteDependency,
    moveMilestone,
    refreshAll,
    nodes,
    edges,
    rows,
  } = applyCtx;

  const result = { created: [], errors: [], conflicts: [] };

  const sorted = [...detected].sort((a, b) => {
    const ai = DEP_TYPE_ORDER.indexOf(a.type);
    const bi = DEP_TYPE_ORDER.indexOf(b.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  // ── Lookup helpers ──

  const buildMilestoneNameLookup = () => {
    const map = {};
    for (const [id, m] of Object.entries(nodes || {})) {
      const key = (m.name || "").toLowerCase().trim();
      if (key) map[key] = { id: parseInt(id), milestone: m };
    }
    return map;
  };

  const buildTaskNameLookup = () => {
    const map = {};
    for (const [id, t] of Object.entries(rows || {})) {
      const key = (t.name || "").toLowerCase().trim();
      if (key) map[key] = parseInt(id);
    }
    return map;
  };

  // Track milestones created during this apply (name → id)
  const newMilestoneIds = {};

  for (const item of sorted) {
    if (!DEP_ACTIONABLE_TYPES.has(item.type)) continue;

    try {
      switch (item.type) {

        // ── Update existing milestones ──
        case "update_milestones": {
          const lookup = buildMilestoneNameLookup();
          for (const entry of item.data) {
            const origKey = (entry.original_name || "").toLowerCase().trim();
            const match = lookup[origKey];
            if (!match) {
              result.errors.push(`Milestone not found: "${entry.original_name}"`);
              continue;
            }
            const updates = {};
            if (entry.name && entry.name !== entry.original_name) updates.name = entry.name;
            if (entry.description !== undefined) updates.description = entry.description;
            if (entry.start_index !== undefined) updates.start_index = entry.start_index;
            if (entry.duration !== undefined) updates.duration = entry.duration;

            if (Object.keys(updates).length > 0) {
              await updateMilestone(match.id, updates);
              result.created.push(`Updated milestone: "${entry.original_name}"`);
            }
          }
          break;
        }

        // ── Update existing dependencies ──
        case "update_dependencies": {
          for (const entry of item.data) {
            const sourceId = entry.source_id;
            const targetId = entry.target_id;
            if (!sourceId || !targetId) {
              result.errors.push("Dependency update missing source_id or target_id");
              continue;
            }
            const updates = {};
            if (entry.weight) updates.weight = entry.weight;
            if (entry.reason !== undefined) updates.reason = entry.reason;
            if (entry.description !== undefined) updates.description = entry.description;

            await updateDependency(sourceId, targetId, updates);
            result.created.push(`Updated dependency: ${sourceId} → ${targetId}`);
          }
          break;
        }

        // ── Remove dependencies ──
        case "remove_dependencies": {
          for (const entry of item.data) {
            const sourceId = entry.source_id;
            const targetId = entry.target_id;
            if (!sourceId || !targetId) {
              // Try name-based resolution
              const lookup = buildMilestoneNameLookup();
              const srcMatch = lookup[(entry.source_milestone_name || "").toLowerCase().trim()];
              const tgtMatch = lookup[(entry.target_milestone_name || "").toLowerCase().trim()];
              if (srcMatch && tgtMatch) {
                await deleteDependency(srcMatch.id, tgtMatch.id);
                result.created.push(`Removed dependency: "${entry.source_milestone_name}" → "${entry.target_milestone_name}"`);
              } else {
                result.errors.push(`Could not resolve dependency to remove: ${entry.source_milestone_name || entry.source_id} → ${entry.target_milestone_name || entry.target_id}`);
              }
              continue;
            }
            await deleteDependency(sourceId, targetId);
            result.created.push(`Removed dependency: ${sourceId} → ${targetId}`);
          }
          break;
        }

        // ── Create new milestones ──
        case "dep_milestones": {
          const taskLookup = buildTaskNameLookup();
          for (const entry of item.data) {
            // Resolve task by task_name or task_id
            let taskId = entry.task_id;
            if (!taskId && entry.task_name) {
              taskId = taskLookup[(entry.task_name || "").toLowerCase().trim()];
            }
            if (!taskId) {
              result.errors.push(`Task not found for milestone: "${entry.name}" (task: "${entry.task_name || entry.task_id}")`);
              continue;
            }
            const res = await addMilestone(taskId, {
              name: entry.name || `${entry.task_name || "Milestone"}_0`,
              description: entry.description || "",
              start_index: entry.start_index ?? 0,
            });
            const newId = res?.milestone?.id || res?.id;
            if (newId) {
              newMilestoneIds[(entry.name || "").toLowerCase().trim()] = newId;
            }
            result.created.push(`Created milestone: "${entry.name}" for task "${entry.task_name || taskId}"`);
          }
          break;
        }

        // ── Create new dependencies ──
        case "dep_dependencies": {
          const msLookup = buildMilestoneNameLookup();
          // Merge in newly created milestones
          for (const [name, id] of Object.entries(newMilestoneIds)) {
            if (!msLookup[name]) {
              msLookup[name] = { id, milestone: { id, name } };
            }
          }

          for (const entry of item.data) {
            let sourceId = entry.source_id;
            let targetId = entry.target_id;

            // Name-based resolution
            if (!sourceId && entry.source_milestone_name) {
              const m = msLookup[(entry.source_milestone_name || "").toLowerCase().trim()];
              sourceId = m?.id;
            }
            if (!targetId && entry.target_milestone_name) {
              const m = msLookup[(entry.target_milestone_name || "").toLowerCase().trim()];
              targetId = m?.id;
            }

            if (!sourceId || !targetId) {
              result.errors.push(
                `Could not resolve dependency: "${entry.source_milestone_name || entry.source_id}" → "${entry.target_milestone_name || entry.target_id}"`,
              );
              continue;
            }

            // Conflict check: does this violate scheduling rules?
            const sourceNode = nodes?.[sourceId] || { start_index: 0, duration: 1, name: entry.source_milestone_name };
            const targetNode = nodes?.[targetId] || { start_index: 0, duration: 1, name: entry.target_milestone_name };
            const check = checkDepConflict(sourceNode, targetNode);

            if (check.conflict) {
              result.conflicts.push({
                sourceId, targetId,
                sourceName: sourceNode.name || entry.source_milestone_name || String(sourceId),
                targetName: targetNode.name || entry.target_milestone_name || String(targetId),
                sourceEnd: check.sourceEnd,
                targetStart: check.targetStart,
                weight: entry.weight || "strong",
                reason: entry.reason || "",
              });
              // Still create the dependency — the conflict is informational
              // so user can manually adjust milestone positions
            }

            await createDependency(sourceId, targetId, {
              weight: entry.weight || "strong",
              reason: entry.reason || null,
              description: entry.description || null,
            });
            const srcLabel = entry.source_milestone_name || sourceId;
            const tgtLabel = entry.target_milestone_name || targetId;
            result.created.push(
              `Created dependency: "${srcLabel}" → "${tgtLabel}"` +
              (check.conflict ? " ⚠️ CONFLICT" : ""),
            );
          }
          break;
        }

        // ── Schedule updates (move milestones to new positions) ──
        case "dep_schedule": {
          const msLookup = buildMilestoneNameLookup();
          for (const entry of item.data) {
            let milestoneId = entry.milestone_id;
            if (!milestoneId && entry.milestone_name) {
              const m = msLookup[(entry.milestone_name || "").toLowerCase().trim()];
              milestoneId = m?.id;
            }
            if (!milestoneId || !nodes?.[milestoneId]) {
              result.errors.push(`Milestone not found: ${entry.milestone_name || entry.milestone_id}`);
              continue;
            }
            if (entry.start_index !== undefined) {
              await moveMilestone(milestoneId, entry.start_index);
              result.created.push(`Moved milestone "${nodes[milestoneId].name}" to day ${entry.start_index}`);
            }
          }
          break;
        }
      }
    } catch (err) {
      result.errors.push(`${item.type}: ${err.message}`);
    }
  }

  if (refreshAll) {
    try { await refreshAll(); } catch { /* ignore */ }
  }

  return result;
}
