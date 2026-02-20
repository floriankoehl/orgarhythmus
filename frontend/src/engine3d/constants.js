// engine3d/constants.js — Shared constants and layout helpers for the 3D engine
// ═══════════════════════════════════════════════════════════════════

import {
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  HEADER_HEIGHT,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  TEAM_COLLAPSED_HEIGHT,
  TEAM_PHASE_ROW_HEIGHT,
  getTaskHeight as getTaskHeightBase,
  getVisibleTasks,
  getTaskYOffset as getTaskYOffsetBase,
  isTaskVisible,
  getRawTeamHeight,
} from '../pages/dependency/layoutMath.js';

// ── Phase header height ──────────────────────────────────────────
export const PHASE_HEADER_HEIGHT = 26;

// ── 3D Camera & Scene Constants ──────────────────────────────────
export const CAMERA_BASE_DISTANCE  = 600;
export const CAMERA_DEFAULT_ZOOM   = 500;
export const CAMERA_DEFAULT_TILT   = 30;
export const CAMERA_DEFAULT_YAW    = 30;
export const CAMERA_ZOOM_MIN       = -800;
export const CAMERA_ZOOM_MAX       = 600;
export const CAMERA_SCALE_MIN      = 0.15;
export const CAMERA_SCALE_MAX      = 3.0;
export const CAMERA_DEFAULT_SCALE  = 1.0;
export const PERSPECTIVE_DEPTH     = 1800;

// ── Protopersona defaults ────────────────────────────────────────
export const PERSONA_SIZE          = 25;
export const PERSONA_DRAG_LIFT     = 5;
export const SNAP_RADIUS           = 40;
export const MILESTONE_3D_HEIGHT   = 8;
export const BOARD_3D_HEIGHT       = 14;
export const SCROLL_Y_PAD          = 16;
export const PERSONA_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#4ade80',
  '#22d3ee', '#818cf8', '#e879f9', '#f472b6',
];

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

/** Build day labels from project start date + day metadata */
export function buildDayLabels(numDays, startDate, projectDays) {
  const labels = [];
  const d = new Date(startDate);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < numDays; i++) {
    const curr = new Date(d);
    curr.setDate(curr.getDate() + i);
    const dayOfWeek = curr.getDay();
    const meta = projectDays[i] || {};
    labels.push({
      dateStr: `${curr.getDate()}.${curr.getMonth() + 1}`,
      dayNameShort: dayNames[dayOfWeek],
      isSunday: dayOfWeek === 0,
      purpose: meta.purpose || null,
      purposeTeams: meta.purpose_teams || null,
    });
  }
  return labels;
}

// ── Layout helpers bound to default constants ────────────────────

/** Get task height from display settings (accepts custom heights) */
export function getTaskHeight(taskId, taskDisplaySettings, thSmall = DEFAULT_TASKHEIGHT_SMALL, thNormal = DEFAULT_TASKHEIGHT_NORMAL) {
  return getTaskHeightBase(taskId, taskDisplaySettings, thSmall, thNormal);
}

/** Get Y offset for a task within its team (accepts custom heights) */
export function getTaskYOffset(taskId, team, taskDisplaySettings, thSmall = DEFAULT_TASKHEIGHT_SMALL, thNormal = DEFAULT_TASKHEIGHT_NORMAL) {
  return getTaskYOffsetBase(
    taskId,
    team,
    isTaskVisible,
    (id, ds) => getTaskHeightBase(id, ds, thSmall, thNormal),
    taskDisplaySettings,
  );
}

/** Get team row height including optional phase row (accepts custom heights + collapse) */
export function getTeamRowHeight(team, taskDisplaySettings, phaseRowH = 0, isCollapsed = false, thSmall = DEFAULT_TASKHEIGHT_SMALL, thNormal = DEFAULT_TASKHEIGHT_NORMAL) {
  if (isCollapsed || !team) return TEAM_COLLAPSED_HEIGHT;
  const rawH = getRawTeamHeight(team, taskDisplaySettings, thSmall, thNormal);
  return Math.max(rawH, TEAM_COLLAPSED_HEIGHT) + phaseRowH;
}

/** Calculate total content height (respects team visibility + collapse) */
export function calcContentHeight(teamOrder, teams, taskDisplaySettings, effectiveHeaderH, teamPhasesMap, teamDisplaySettings = {}, thSmall = DEFAULT_TASKHEIGHT_SMALL, thNormal = DEFAULT_TASKHEIGHT_NORMAL) {
  let h = effectiveHeaderH;
  for (const tid of teamOrder) {
    if (teamDisplaySettings[tid]?.hidden) continue;
    h += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    h += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
    const phaseH = (teamPhasesMap[tid] && teamPhasesMap[tid].length > 0) ? TEAM_PHASE_ROW_HEIGHT : 0;
    const isCollapsed = teamDisplaySettings[tid]?.collapsed;
    h += getTeamRowHeight(teams[tid], taskDisplaySettings, phaseH, isCollapsed, thSmall, thNormal);
  }
  h += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
  return h;
}
