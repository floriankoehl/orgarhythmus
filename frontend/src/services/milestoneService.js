/**
 * Unified Milestone Service
 * 
 * Centralized service for all milestone CRUD operations and state modifications.
 * This ensures all milestone changes go through a single pipeline, making the code
 * more maintainable and easier to understand.
 * 
 * Key responsibilities:
 * - Create, read, update, delete milestones
 * - Validate milestone operations
 * - Handle milestone positioning and duration changes
 * - Coordinate with backend API
 */

import {
  add_milestone,
  update_start_index,
  change_duration,
  rename_milestone,
  delete_milestone,
  move_milestone_task,
} from '../api/dependencies_api';

import {
  checkMilestoneOverlap,
  checkMultiMilestoneOverlap,
  validateMilestoneMove,
  validateMultiMilestoneMove,
  checkDeadlineViolation,
  checkMultiDeadlineViolation,
} from '../pages/dependency/depValidation';

/**
 * Create a new milestone
 */
export async function createMilestone({
  projectId,
  taskId,
  name,
  startIndex,
  duration = 1,
}) {
  const response = await add_milestone(projectId, taskId, name, startIndex, duration);
  return response;
}

/**
 * Update milestone position (start_index)
 */
export async function updateMilestonePosition({
  projectId,
  milestoneId,
  newStartIndex,
}) {
  const response = await update_start_index(projectId, milestoneId, newStartIndex);
  return response;
}

/**
 * Update milestone duration
 */
export async function updateMilestoneDuration({
  projectId,
  milestoneId,
  newDuration,
}) {
  const response = await change_duration(projectId, milestoneId, newDuration);
  return response;
}

/**
 * Rename a milestone
 */
export async function renameMilestone({
  projectId,
  milestoneId,
  newName,
}) {
  const response = await rename_milestone(projectId, milestoneId, newName);
  return response;
}

/**
 * Delete a milestone
 */
export async function deleteMilestone({
  projectId,
  milestoneId,
}) {
  const response = await delete_milestone(projectId, milestoneId);
  return response;
}

/**
 * Move milestone to a different task
 */
export async function moveMilestoneToTask({
  projectId,
  milestoneId,
  newTaskId,
}) {
  const response = await move_milestone_task(projectId, milestoneId, newTaskId);
  return response;
}

/**
 * Validate milestone move operation
 */
export function validateMove({
  milestones,
  tasks,
  milestoneId,
  newStartIndex,
  safeMode = false,
}) {
  const milestone = milestones[milestoneId];
  if (!milestone) return { valid: false, reason: 'Milestone not found' };

  return validateMilestoneMove(
    milestone,
    newStartIndex,
    milestones,
    tasks,
    safeMode
  );
}

/**
 * Validate multi-milestone move operation
 */
export function validateMultiMove({
  milestones,
  tasks,
  milestoneIds,
  deltaIndex,
  safeMode = false,
}) {
  return validateMultiMilestoneMove(
    milestoneIds,
    deltaIndex,
    milestones,
    tasks,
    safeMode
  );
}

/**
 * Check for milestone overlap
 */
export function checkOverlap({
  milestones,
  taskId,
  startIndex,
  duration,
  excludeMilestoneId = null,
}) {
  return checkMilestoneOverlap(
    milestones,
    taskId,
    startIndex,
    duration,
    excludeMilestoneId
  );
}

/**
 * Check for multi-milestone overlap
 */
export function checkMultiOverlap({
  milestones,
  tasks,
  milestoneIds,
  deltaIndex,
}) {
  return checkMultiMilestoneOverlap(
    milestoneIds,
    deltaIndex,
    milestones,
    tasks
  );
}

/**
 * Check for deadline violation
 */
export function checkDeadline({
  tasks,
  taskId,
  endIndex,
}) {
  return checkDeadlineViolation(tasks, taskId, endIndex);
}

/**
 * Check for multi-milestone deadline violation
 */
export function checkMultiDeadline({
  milestones,
  tasks,
  milestoneIds,
  deltaIndex,
}) {
  return checkMultiDeadlineViolation(
    milestoneIds,
    deltaIndex,
    milestones,
    tasks
  );
}

/**
 * Calculate milestone visual position
 */
export function calculateMilestonePosition({
  startIndex,
  duration = 1,
  dayColumnLayout,
  TEAMWIDTH,
  TASKWIDTH,
  DAYWIDTH,
}) {
  if (dayColumnLayout) {
    const startX = TEAMWIDTH + TASKWIDTH + dayColumnLayout.dayXOffset(startIndex);
    const endIdx = startIndex + duration;
    const endX = endIdx < dayColumnLayout.dayXOffset.length
      ? TEAMWIDTH + TASKWIDTH + dayColumnLayout.dayXOffset(endIdx)
      : TEAMWIDTH + TASKWIDTH + dayColumnLayout.totalDaysWidth;
    return {
      x: startX,
      width: endX - startX,
    };
  }
  
  return {
    x: TEAMWIDTH + TASKWIDTH + startIndex * DAYWIDTH,
    width: duration * DAYWIDTH,
  };
}

/**
 * Check if milestone is in collapsed day range
 */
export function isMilestoneInCollapsedRange({
  startIndex,
  duration,
  collapsedDays,
  checkAll = false,
}) {
  if (checkAll) {
    // Check if ALL days are collapsed
    for (let i = startIndex; i < startIndex + duration; i++) {
      if (!collapsedDays.has(i)) return false;
    }
    return true;
  } else {
    // Check if ANY day is collapsed
    for (let i = startIndex; i < startIndex + duration; i++) {
      if (collapsedDays.has(i)) return true;
    }
    return false;
  }
}

export default {
  createMilestone,
  updateMilestonePosition,
  updateMilestoneDuration,
  renameMilestone,
  deleteMilestone,
  moveMilestoneToTask,
  validateMove,
  validateMultiMove,
  checkOverlap,
  checkMultiOverlap,
  checkDeadline,
  checkMultiDeadline,
  calculateMilestonePosition,
  isMilestoneInCollapsedRange,
};
