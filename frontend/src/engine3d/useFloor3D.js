// engine3d/useFloor3D.js — Floor representation hook with hit-testing and entity registry
// ═══════════════════════════════════════════════════════════════════
//
// Isolates the "floor representation" so future 3D interaction can be plugged in cleanly.
//
// Exposes:
//   floorLayout   — { teams: TeamSlab[] } — world-space bounds for all visible entities
//   hitTest(wx, wz) — { teamId, taskId, dayIndex } — entity at a world-space floor point
//
// This hook is intentionally display-only for now.  Interaction will be added
// in a future step by wiring event handlers to hitTest and the entity registry.
//
// See: FINDINGS_AND_PLAN.md for the interaction roadmap.
// See: floor3DMapping.js  for the pure coordinate math.

import { useMemo, useCallback } from 'react';
import {
  computeFloorEntityBounds,
  boardPixelXToDayIndex,
  worldToBoardPixel,
} from './floor3DMapping.js';
import {
  DEFAULT_TASKHEIGHT_SMALL,
  DEFAULT_TASKHEIGHT_NORMAL,
} from '../pages/dependency/layoutMath.js';

/**
 * useFloor3D — builds and exposes the floor entity registry.
 *
 * @param {Object} params
 * @param {Array}   params.teamOrder
 * @param {Object}  params.teams
 * @param {Object}  params.taskDisplaySettings
 * @param {Object}  params.teamDisplaySettings
 * @param {Object}  params.teamPhasesMap
 * @param {number}  params.effectiveHeaderH
 * @param {number}  params.TEAMWIDTH
 * @param {number}  params.TASKWIDTH
 * @param {number}  params.DAYWIDTH
 * @param {number}  params.days               — total day count (for world Z extent)
 * @param {number}  [params.thSmall]          — task height small (default: DEFAULT_TASKHEIGHT_SMALL)
 * @param {number}  [params.thNormal]         — task height normal (default: DEFAULT_TASKHEIGHT_NORMAL)
 * @param {{ w, h, offsetX, offsetY }} params.boardDims — measured board element dimensions
 *
 * @returns {{
 *   floorLayout: { teams: TeamSlab[] },
 *   hitTest: (worldX: number, worldZ: number) => { teamId: string|null, taskId: string|null, dayIndex: number|null },
 * }}
 */
export function useFloor3D({
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
  thSmall = DEFAULT_TASKHEIGHT_SMALL,
  thNormal = DEFAULT_TASKHEIGHT_NORMAL,
  boardDims,
}) {
  // ── Entity registry (world-space bounds for all visible teams/tasks) ──
  const floorLayout = useMemo(() => {
    if (!boardDims || boardDims.w === 0 || boardDims.h === 0) {
      return { teams: [] };
    }
    return computeFloorEntityBounds({
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
    });
  }, [
    teamOrder, teams, taskDisplaySettings, teamDisplaySettings,
    teamPhasesMap, effectiveHeaderH, TEAMWIDTH, TASKWIDTH, DAYWIDTH,
    days, thSmall, thNormal, boardDims,
  ]);

  // ── Hit-test: given world floor coords, return what entity is there ──
  /**
   * Hit-test the floor at a world-space point (worldX, worldZ).
   *
   * Returns the innermost entity found:
   *   - taskId is set if the point lands in a task row
   *   - teamId is always set when inside any team area
   *   - dayIndex is computed from the world Z position
   *
   * @param {number} worldX
   * @param {number} worldZ
   * @returns {{ teamId: string|null, taskId: string|null, dayIndex: number|null }}
   */
  const hitTest = useCallback((worldX, worldZ) => {
    const noHit = { teamId: null, taskId: null, dayIndex: null };
    if (!boardDims || boardDims.w === 0) return noHit;

    // Convert world → board pixel to find day column
    const { boardPixelX } = worldToBoardPixel(worldX, worldZ, boardDims);
    const dayIndex = boardPixelXToDayIndex(boardPixelX, TEAMWIDTH, TASKWIDTH, DAYWIDTH);

    // Walk team slabs to find team and task
    for (const teamSlab of floorLayout.teams) {
      const inX = worldX >= Math.min(teamSlab.worldXStart, teamSlab.worldXEnd) &&
                  worldX <= Math.max(teamSlab.worldXStart, teamSlab.worldXEnd);
      const inZ = worldZ >= Math.min(teamSlab.worldZStart, teamSlab.worldZEnd) &&
                  worldZ <= Math.max(teamSlab.worldZStart, teamSlab.worldZEnd);

      if (inX && inZ) {
        // Check task rows (more specific)
        for (const taskSlab of teamSlab.tasks) {
          const inTaskX = worldX >= Math.min(taskSlab.worldXStart, taskSlab.worldXEnd) &&
                          worldX <= Math.max(taskSlab.worldXStart, taskSlab.worldXEnd);
          if (inTaskX) {
            return { teamId: teamSlab.teamId, taskId: taskSlab.taskId, dayIndex };
          }
        }
        return { teamId: teamSlab.teamId, taskId: null, dayIndex };
      }
    }

    return noHit;
  }, [floorLayout, boardDims, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

  return { floorLayout, hitTest };
}
