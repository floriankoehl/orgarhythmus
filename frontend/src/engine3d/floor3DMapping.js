// engine3d/floor3DMapping.js — Coordinate mapping between 3D world space, 2D board space, and domain entities
// ═══════════════════════════════════════════════════════════════════
//
// Pure math functions — no React, no state, no side effects.
//
// Coordinate systems:
//
//   Board pixel space:
//     boardPixelX  — horizontal position in board content (0 = left edge)
//     boardPixelY  — vertical position in board content (0 = top edge / header)
//
//   World space (3D scene, Y=0 floor):
//     worldX — maps from board's vertical axis (team rows)
//     worldZ — maps from board's horizontal axis (days, inverted)
//
//   boardDims: { w, h, offsetX, offsetY } — measured dimensions of the board element
//   SCROLL_Y_PAD — extra padding constant (16px) added to board offset mapping
//
// Mapping formulas (derived from usePersonas.js milestone coordinate logic):
//   worldX = (boardPixelY + boardDims.offsetY + SCROLL_Y_PAD) - boardDims.h / 2
//   worldZ = boardDims.w / 2 - (boardPixelX + boardDims.offsetX)
//
// Inverse:
//   boardPixelY = worldX - boardDims.offsetY - SCROLL_Y_PAD + boardDims.h / 2
//   boardPixelX = boardDims.w / 2 - worldZ - boardDims.offsetX

import {
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  TEAM_PHASE_ROW_HEIGHT,
  TEAM_COLLAPSED_HEIGHT,
  getVisibleTasks,
  isTaskVisible,
  getTaskHeight as getTaskHeightBase,
  getTaskYOffset as getTaskYOffsetBase,
  getRawTeamHeight,
} from '../pages/dependency/layoutMath.js';
import { SCROLL_Y_PAD } from './constants.js';

// ══════════════════════════════════════════════════════════════════
// Coordinate transforms
// ══════════════════════════════════════════════════════════════════

/**
 * Convert a board pixel coordinate to 3D world space (Y=0 floor plane).
 *
 * @param {number} boardPixelX  — horizontal position in the board (→ World Z, inverted)
 * @param {number} boardPixelY  — vertical position in the board (→ World X)
 * @param {{ w: number, h: number, offsetX: number, offsetY: number }} boardDims
 * @returns {{ worldX: number, worldZ: number }}
 */
export function boardPixelToWorld(boardPixelX, boardPixelY, boardDims) {
  return {
    worldX: (boardPixelY + boardDims.offsetY + SCROLL_Y_PAD) - boardDims.h / 2,
    worldZ: boardDims.w / 2 - (boardPixelX + boardDims.offsetX),
  };
}

/**
 * Convert a 3D world-space floor point to board pixel coordinates.
 *
 * @param {number} worldX
 * @param {number} worldZ
 * @param {{ w: number, h: number, offsetX: number, offsetY: number }} boardDims
 * @returns {{ boardPixelX: number, boardPixelY: number }}
 */
export function worldToBoardPixel(worldX, worldZ, boardDims) {
  return {
    boardPixelX: boardDims.w / 2 - worldZ - boardDims.offsetX,
    boardPixelY: worldX + boardDims.h / 2 - boardDims.offsetY - SCROLL_Y_PAD,
  };
}

// ══════════════════════════════════════════════════════════════════
// Entity lookup from board pixel coordinates
// ══════════════════════════════════════════════════════════════════

/**
 * Find the teamId whose row contains boardPixelY.
 * Walks through teams in order, accumulating Y offsets exactly as the layout renderer does.
 *
 * @returns {string|null} teamId, or null if outside any team row
 */
export function boardPixelYToTeamId(
  boardPixelY,
  { teamOrder, teams, taskDisplaySettings, teamDisplaySettings, teamPhasesMap, effectiveHeaderH, thSmall, thNormal },
) {
  let yOffset = effectiveHeaderH;

  for (const teamId of teamOrder) {
    const team = teams[teamId];
    if (!team) continue;

    const teamSettings = teamDisplaySettings[teamId];
    if (teamSettings?.hidden) continue;

    yOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    yOffset += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

    const teamPhases = teamPhasesMap ? (teamPhasesMap[teamId] || []) : [];
    const phaseRowH = teamPhases.length > 0 ? TEAM_PHASE_ROW_HEIGHT : 0;
    const isCollapsed = teamSettings?.collapsed;

    let teamContentH;
    if (isCollapsed) {
      teamContentH = TEAM_COLLAPSED_HEIGHT;
    } else {
      const rawH = getRawTeamHeight(team, taskDisplaySettings, thSmall, thNormal);
      teamContentH = Math.max(rawH, TEAM_COLLAPSED_HEIGHT);
    }

    const teamEnd = yOffset + phaseRowH + teamContentH;

    if (boardPixelY >= yOffset && boardPixelY < teamEnd) {
      return teamId;
    }

    yOffset = teamEnd;
  }
  return null;
}

/**
 * Find the taskId whose row contains (boardPixelX, boardPixelY), within a known team.
 * Returns null if outside the task column or no task row matches.
 *
 * @param {number} boardPixelX
 * @param {number} boardPixelY
 * @param {string} teamId        — the team whose tasks to search (already resolved)
 * @param {Object} layoutParams
 * @returns {string|null} taskId, or null
 */
export function boardPixelToTaskId(
  boardPixelX,
  boardPixelY,
  teamId,
  { teams, taskDisplaySettings, teamDisplaySettings, teamPhasesMap, effectiveHeaderH, TEAMWIDTH, thSmall, thNormal },
) {
  // Task column is the second column: [TEAMWIDTH, TEAMWIDTH + TASKWIDTH)
  // We only resolve tasks when the X is in the task panel (or day area)
  const team = teams[teamId];
  if (!team) return null;

  const teamSettings = teamDisplaySettings[teamId];
  if (teamSettings?.collapsed) return null;

  // Recompute team Y start to find relative task Y offset
  let yOffset = effectiveHeaderH;
  for (const tid of Object.keys(teams)) {
    if (tid === teamId) break;
    const t = teams[tid];
    if (!t) continue;
    const ts = teamDisplaySettings[tid];
    if (ts?.hidden) continue;
    yOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    yOffset += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
    const tp = teamPhasesMap ? (teamPhasesMap[tid] || []) : [];
    const phH = tp.length > 0 ? TEAM_PHASE_ROW_HEIGHT : 0;
    const rawH = ts?.collapsed ? TEAM_COLLAPSED_HEIGHT : Math.max(getRawTeamHeight(t, taskDisplaySettings, thSmall, thNormal), TEAM_COLLAPSED_HEIGHT);
    yOffset += phH + rawH;
  }

  yOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
  yOffset += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

  const teamPhases = teamPhasesMap ? (teamPhasesMap[teamId] || []) : [];
  const phaseRowH = teamPhases.length > 0 ? TEAM_PHASE_ROW_HEIGHT : 0;
  const tasksStartY = yOffset + phaseRowH;

  const visibleTasks = getVisibleTasks(team, taskDisplaySettings);
  for (const taskId of visibleTasks) {
    const th = getTaskHeightBase(taskId, taskDisplaySettings, thSmall, thNormal);
    const taskYOff = getTaskYOffsetBase(
      taskId, team, isTaskVisible,
      (id, ds) => getTaskHeightBase(id, ds, thSmall, thNormal),
      taskDisplaySettings,
    );
    const taskYStart = tasksStartY + taskYOff;
    const taskYEnd = taskYStart + th;
    if (boardPixelY >= taskYStart && boardPixelY < taskYEnd) {
      return taskId;
    }
  }
  return null;
}

/**
 * Find the day column index that boardPixelX falls into.
 * Returns null if the X position is in the team/task header columns.
 *
 * @param {number} boardPixelX
 * @param {number} TEAMWIDTH
 * @param {number} TASKWIDTH
 * @param {number} DAYWIDTH
 * @returns {number|null} zero-based day index, or null
 */
export function boardPixelXToDayIndex(boardPixelX, TEAMWIDTH, TASKWIDTH, DAYWIDTH) {
  const dayAreaX = boardPixelX - TEAMWIDTH - TASKWIDTH;
  if (dayAreaX < 0) return null;
  return Math.floor(dayAreaX / DAYWIDTH);
}

// ══════════════════════════════════════════════════════════════════
// World-space entity bounds computation
// ══════════════════════════════════════════════════════════════════

/**
 * Compute world-space bounding boxes for every visible team and task row.
 * Used by useFloor3D to build the entity registry and render 3D height slabs.
 *
 * @param {Object} params
 * @returns {{ teams: TeamSlab[] }}
 *
 * TeamSlab: {
 *   teamId, team,
 *   worldXStart, worldXEnd,   ← board vertical (Y) → world X
 *   worldZStart, worldZEnd,   ← board horizontal (X) → world Z
 *   boardYStart, boardYEnd,
 *   tasks: TaskSlab[],
 * }
 *
 * TaskSlab: {
 *   taskId, teamId,
 *   worldXStart, worldXEnd,
 *   worldZStart, worldZEnd,
 *   boardYStart, boardYEnd,
 * }
 */
export function computeFloorEntityBounds({
  teamOrder,
  teams,
  taskDisplaySettings,
  teamDisplaySettings,
  teamPhasesMap,
  effectiveHeaderH,
  TEAMWIDTH,
  TASKWIDTH,
  DAYWIDTH,
  days,
  thSmall,
  thNormal,
  boardDims,
}) {
  const totalBoardWidth = TEAMWIDTH + TASKWIDTH + (days || 0) * DAYWIDTH;

  // World Z extent of the full board width
  const { worldZ: worldZLeft } = boardPixelToWorld(totalBoardWidth, 0, boardDims);
  const { worldZ: worldZRight } = boardPixelToWorld(0, 0, boardDims);
  // Note: worldZ is inverted relative to board X, so left board edge has lower worldZ

  const teamSlabs = [];
  let yOffset = effectiveHeaderH;

  for (const teamId of teamOrder) {
    const team = teams[teamId];
    if (!team) continue;

    const teamSettings = teamDisplaySettings[teamId];
    if (teamSettings?.hidden) continue;

    yOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    yOffset += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

    const teamPhases = teamPhasesMap ? (teamPhasesMap[teamId] || []) : [];
    const phaseRowH = teamPhases.length > 0 ? TEAM_PHASE_ROW_HEIGHT : 0;
    const isCollapsed = teamSettings?.collapsed;

    let teamContentH;
    if (isCollapsed) {
      teamContentH = TEAM_COLLAPSED_HEIGHT;
    } else {
      const rawH = getRawTeamHeight(team, taskDisplaySettings, thSmall, thNormal);
      teamContentH = Math.max(rawH, TEAM_COLLAPSED_HEIGHT);
    }

    const teamBoardYStart = yOffset + phaseRowH;
    const teamBoardYEnd = teamBoardYStart + teamContentH;

    const { worldX: worldXStart } = boardPixelToWorld(0, teamBoardYStart, boardDims);
    const { worldX: worldXEnd } = boardPixelToWorld(0, teamBoardYEnd, boardDims);

    // Task slabs (only for non-collapsed teams)
    const taskSlabs = [];
    if (!isCollapsed) {
      const visibleTasks = getVisibleTasks(team, taskDisplaySettings);
      for (const taskId of visibleTasks) {
        const th = getTaskHeightBase(taskId, taskDisplaySettings, thSmall, thNormal);
        const taskYOff = getTaskYOffsetBase(
          taskId, team, isTaskVisible,
          (id, ds) => getTaskHeightBase(id, ds, thSmall, thNormal),
          taskDisplaySettings,
        );
        const taskBoardYStart = teamBoardYStart + taskYOff;
        const taskBoardYEnd = taskBoardYStart + th;
        const { worldX: txStart } = boardPixelToWorld(0, taskBoardYStart, boardDims);
        const { worldX: txEnd } = boardPixelToWorld(0, taskBoardYEnd, boardDims);
        taskSlabs.push({
          taskId,
          teamId,
          worldXStart: txStart,
          worldXEnd: txEnd,
          worldZStart: worldZLeft,
          worldZEnd: worldZRight,
          boardYStart: taskBoardYStart,
          boardYEnd: taskBoardYEnd,
        });
      }
    }

    teamSlabs.push({
      teamId,
      team,
      worldXStart,
      worldXEnd,
      worldZStart: worldZLeft,
      worldZEnd: worldZRight,
      boardYStart: teamBoardYStart,
      boardYEnd: teamBoardYEnd,
      tasks: taskSlabs,
    });

    yOffset += phaseRowH + teamContentH;
  }

  return { teams: teamSlabs };
}
