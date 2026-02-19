// Pure validation functions for dependency milestone operations.
// No React hooks — just data in, result out.
// Portable: can be reused on any future page that needs scheduling validation.

/**
 * Compute a cascade of milestone pushes caused by resizing/moving a set of
 * "origin" milestones.  Each origin has a proposed new position.  Any
 * downstream milestone that would be violated (dependency or same-task
 * overlap) is pushed forward by the minimum amount needed.  The push
 * propagates recursively.
 *
 * Returns { valid: true, pushes: { milestoneId: newStartIndex, ... } }
 * or      { valid: false, reason: string }  when a hard deadline blocks.
 *
 * "pushes" contains ONLY the milestones that need to move (not the origins).
 */
export function computeCascadePush(milestones, tasks, connections, originPositions) {
  // Working copy of positions: start with current positions for everything,
  // then overwrite origins with their proposed values.
  const pos = {}; // milestoneId → { startIndex, duration }
  for (const [id, m] of Object.entries(milestones)) {
    pos[id] = { startIndex: m.start_index, duration: m.duration || 1 };
  }
  for (const [id, p] of Object.entries(originPositions)) {
    pos[id] = { startIndex: p.startIndex, duration: p.duration };
  }

  const originSet = new Set(Object.keys(originPositions).map(String));
  const pushes = {}; // milestoneId → newStartIndex  (only non-origin milestones)

  // BFS queue: start with every origin.
  // A milestone can be re-queued if its position changes (pushed further by
  // a different path).  Guard against infinite loops with an iteration cap.
  const queue = [...originSet];
  const MAX_ITERATIONS = Object.keys(milestones).length * 3 + 100;
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const currentId = queue.shift();

    const cur = pos[currentId];
    if (!cur) continue;
    const curEnd = cur.startIndex + cur.duration - 1;

    // 1) Push successors via outgoing dependencies
    const outgoing = connections.filter(c => String(c.source) === String(currentId));
    for (const conn of outgoing) {
      const targetId = String(conn.target);
      const tp = pos[targetId];
      if (!tp) continue;

      // Successor must start AFTER current end (curEnd + 1 at minimum)
      if (curEnd >= tp.startIndex) {
        const newStart = curEnd + 1;
        tp.startIndex = newStart;

        if (!originSet.has(targetId)) {
          pushes[targetId] = newStart;
        }

        // Deadline check
        const targetMs = milestones[targetId];
        if (targetMs) {
          const task = tasks[targetMs.task];
          if (task && task.hard_deadline !== null && task.hard_deadline !== undefined) {
            const newEnd = newStart + tp.duration - 1;
            if (newEnd > task.hard_deadline) {
              return { valid: false, reason: 'hard_deadline', milestoneId: targetId };
            }
          }
        }

        queue.push(targetId);
      }
    }

    // 2) Push same-task milestones that overlap with current
    const currentMs = milestones[currentId];
    if (currentMs) {
      const taskId = currentMs.task;
      const task = tasks[taskId];
      if (task && task.milestones) {
        for (const mRef of task.milestones) {
          const otherId = String(mRef.id);
          if (otherId === String(currentId)) continue;
          const op = pos[otherId];
          if (!op) continue;

          // Does current overlap with other?
          if (curEnd >= op.startIndex && cur.startIndex <= (op.startIndex + op.duration - 1)) {
            // Push the other milestone to just after current ends
            const newStart = curEnd + 1;
            if (newStart > op.startIndex) {
              op.startIndex = newStart;

              if (!originSet.has(otherId)) {
                pushes[otherId] = newStart;
              }

              // Deadline check
              const otherMs = milestones[otherId];
              if (otherMs) {
                const otherTask = tasks[otherMs.task];
                if (otherTask && otherTask.hard_deadline !== null && otherTask.hard_deadline !== undefined) {
                  const newEnd = newStart + op.duration - 1;
                  if (newEnd > otherTask.hard_deadline) {
                    return { valid: false, reason: 'hard_deadline', milestoneId: otherId };
                  }
                }
              }

              queue.push(otherId);
            }
          }
        }
      }
    }
  }

  return { valid: true, pushes };
}

/**
 * Check if a milestone would overlap with other milestones in the same task.
 * Returns { valid: true } or { valid: false, overlapping: [...milestoneIds] }
 *
 * @param {Object} milestones - All milestones keyed by id
 * @param {Object} tasks - All tasks keyed by id
 * @param {string} milestoneId - The milestone being moved/resized
 * @param {number} newStartIndex - The new start index
 * @param {number} newDuration - The new duration
 * @param {Set} excludeIds - Set of milestone IDs to exclude from check (e.g. milestones being moved together)
 */
export function checkMilestoneOverlap(milestones, tasks, milestoneId, newStartIndex, newDuration, excludeIds = new Set()) {
  const milestone = milestones[milestoneId];
  if (!milestone) return { valid: true };

  const taskId = milestone.task;
  const task = tasks[taskId];
  if (!task) return { valid: true };

  const newEnd = newStartIndex + newDuration - 1;
  const overlapping = [];

  // Check all milestones in the same task
  const taskMilestones = task.milestones || [];
  for (const mRef of taskMilestones) {
    if (mRef.id === milestoneId) continue;
    if (excludeIds.has(mRef.id)) continue;

    const other = milestones[mRef.id];
    if (!other) continue;

    const otherStart = other.start_index;
    const otherEnd = otherStart + (other.duration || 1) - 1;

    // Overlap check: two ranges [newStartIndex, newEnd] and [otherStart, otherEnd]
    if (newStartIndex <= otherEnd && newEnd >= otherStart) {
      overlapping.push({
        blockingMilestoneId: mRef.id,
        blockingConnection: null, // No connection, it's an overlap
        reason: 'overlap',
      });
    }
  }

  if (overlapping.length > 0) {
    return { valid: false, overlapping };
  }
  return { valid: true };
}

/**
 * Check overlap for multiple milestones being moved by the same delta.
 * Each milestone checks against non-moving milestones in its task.
 */
export function checkMultiMilestoneOverlap(milestones, tasks, milestoneIds, deltaIndex) {
  const movingSet = new Set(milestoneIds);
  const allOverlapping = [];

  for (const milestoneId of milestoneIds) {
    const milestone = milestones[milestoneId];
    if (!milestone) continue;

    const newStart = milestone.start_index + deltaIndex;
    const newDuration = milestone.duration || 1;

    const result = checkMilestoneOverlap(milestones, tasks, milestoneId, newStart, newDuration, movingSet);
    if (!result.valid) {
      allOverlapping.push(...result.overlapping);
    }
  }

  if (allOverlapping.length > 0) {
    const seen = new Set();
    const unique = allOverlapping.filter(b => {
      if (seen.has(b.blockingMilestoneId)) return false;
      seen.add(b.blockingMilestoneId);
      return true;
    });
    return { valid: false, allBlocking: unique };
  }
  return { valid: true };
}

/**
 * Check if a single milestone move would violate dependency constraints.
 *
 * @param {Object} milestones - All milestones keyed by id
 * @param {Array} connections - Array of { source, target } dependency connections
 * @param {string} milestoneId - The milestone being moved
 * @param {number} newStartIndex - The proposed new start index
 */
export function validateMilestoneMove(milestones, connections, milestoneId, newStartIndex) {
  const milestone = milestones[milestoneId];
  if (!milestone) return { valid: true };

  const allBlocking = [];

  const incomingConnections = connections.filter(c => c.target === milestoneId);

  for (const conn of incomingConnections) {
    const sourceMilestone = milestones[conn.source];
    if (!sourceMilestone) continue;

    const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;

    if (sourceEndIndex >= newStartIndex) {
      allBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn, weight: conn.weight || 'strong' });
    }
  }

  const outgoingConnections = connections.filter(c => c.source === milestoneId);
  const newEndIndex = newStartIndex + (milestone.duration || 1) - 1;

  for (const conn of outgoingConnections) {
    const targetMilestone = milestones[conn.target];
    if (!targetMilestone) continue;

    if (newEndIndex >= targetMilestone.start_index) {
      allBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn, weight: conn.weight || 'strong' });
    }
  }

  if (allBlocking.length > 0) {
    const seen = new Set();
    const unique = allBlocking.filter(b => {
      if (seen.has(b.blockingMilestoneId)) return false;
      seen.add(b.blockingMilestoneId);
      return true;
    });
    return {
      valid: false,
      allBlocking: unique,
      blockingConnection: unique[0].blockingConnection,
      blockingMilestoneId: unique[0].blockingMilestoneId,
    };
  }
  return { valid: true };
}

/**
 * Check if moving multiple milestones by a delta would violate dependencies.
 * Connections between co-moving milestones are excluded from checks.
 *
 * @param {Object} milestones - All milestones keyed by id
 * @param {Array} connections - Array of { source, target } dependency connections
 * @param {Array} milestoneIds - IDs of milestones being moved together
 * @param {number} deltaIndex - The number of day-columns to shift
 */
export function validateMultiMilestoneMove(milestones, connections, milestoneIds, deltaIndex) {
  const movingSet = new Set(milestoneIds);
  const allBlocking = [];

  for (const milestoneId of milestoneIds) {
    const milestone = milestones[milestoneId];
    if (!milestone) continue;

    const newStartIndex = milestone.start_index + deltaIndex;
    if (newStartIndex < 0) {
      return { valid: false, reason: "Cannot move before project start", blockingMilestoneIds: [milestoneId], allBlocking: [] };
    }

    const incomingConnections = connections.filter(c => c.target === milestoneId);

    for (const conn of incomingConnections) {
      if (movingSet.has(conn.source)) continue;

      const sourceMilestone = milestones[conn.source];
      if (!sourceMilestone) continue;

      const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;

      if (sourceEndIndex >= newStartIndex) {
        allBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn, weight: conn.weight || 'strong' });
      }
    }

    const outgoingConnections = connections.filter(c => c.source === milestoneId);
    const newEndIndex = newStartIndex + (milestone.duration || 1) - 1;

    for (const conn of outgoingConnections) {
      if (movingSet.has(conn.target)) continue;

      const targetMilestone = milestones[conn.target];
      if (!targetMilestone) continue;

      if (newEndIndex >= targetMilestone.start_index) {
        allBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn, weight: conn.weight || 'strong' });
      }
    }
  }

  if (allBlocking.length > 0) {
    const seen = new Set();
    const unique = allBlocking.filter(b => {
      if (seen.has(b.blockingMilestoneId)) return false;
      seen.add(b.blockingMilestoneId);
      return true;
    });
    return {
      valid: false,
      allBlocking: unique,
      blockingConnection: unique[0].blockingConnection,
      blockingMilestoneId: unique[0].blockingMilestoneId,
    };
  }
  return { valid: true };
}

/**
 * Check if a milestone move/resize would violate the task's hard deadline.
 * Returns { valid: true } or { valid: false, taskId, deadline, endIndex }
 *
 * @param {Object} milestones - All milestones keyed by id
 * @param {Object} tasks - All tasks keyed by id
 * @param {string|number} milestoneId - The milestone being moved/resized
 * @param {number} newStartIndex - The proposed start index
 * @param {number} newDuration - The proposed duration
 */
export function checkDeadlineViolation(milestones, tasks, milestoneId, newStartIndex, newDuration) {
  const milestone = milestones[milestoneId];
  if (!milestone) return { valid: true };

  const taskId = milestone.task;
  const task = tasks[taskId];
  if (!task) return { valid: true };

  const deadline = task.hard_deadline;
  if (deadline === null || deadline === undefined) return { valid: true };

  const newEnd = newStartIndex + newDuration - 1;
  if (newEnd > deadline) {
    return { valid: false, taskId, deadline, endIndex: newEnd };
  }
  return { valid: true };
}

/**
 * Check deadline violations for multiple milestones being moved by the same delta.
 *
 * @param {Object} milestones - All milestones keyed by id
 * @param {Object} tasks - All tasks keyed by id
 * @param {Array} milestoneIds - IDs of milestones being moved together
 * @param {number} deltaIndex - The number of day-columns to shift
 */
export function checkMultiDeadlineViolation(milestones, tasks, milestoneIds, deltaIndex) {
  const violations = [];

  for (const milestoneId of milestoneIds) {
    const milestone = milestones[milestoneId];
    if (!milestone) continue;

    const newStart = milestone.start_index + deltaIndex;
    const newDuration = milestone.duration || 1;
    const result = checkDeadlineViolation(milestones, tasks, milestoneId, newStart, newDuration);
    if (!result.valid) {
      violations.push({ milestoneId, ...result });
    }
  }

  if (violations.length > 0) {
    return { valid: false, violations };
  }
  return { valid: true };
}
