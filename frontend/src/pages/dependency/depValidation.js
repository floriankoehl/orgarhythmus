// Pure validation functions for dependency milestone operations.
// No React hooks — just data in, result out.
// Portable: can be reused on any future page that needs scheduling validation.

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
      allBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn });
    }
  }

  const outgoingConnections = connections.filter(c => c.source === milestoneId);
  const newEndIndex = newStartIndex + (milestone.duration || 1) - 1;

  for (const conn of outgoingConnections) {
    const targetMilestone = milestones[conn.target];
    if (!targetMilestone) continue;

    if (newEndIndex >= targetMilestone.start_index) {
      allBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn });
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
        allBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn });
      }
    }

    const outgoingConnections = connections.filter(c => c.source === milestoneId);
    const newEndIndex = newStartIndex + (milestone.duration || 1) - 1;

    for (const conn of outgoingConnections) {
      if (movingSet.has(conn.target)) continue;

      const targetMilestone = milestones[conn.target];
      if (!targetMilestone) continue;

      if (newEndIndex >= targetMilestone.start_index) {
        allBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn });
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
