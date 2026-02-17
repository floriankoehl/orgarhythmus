// ==========================================
// Layout Constants (defaults)
// ==========================================
export const DEFAULT_TASKHEIGHT_NORMAL = 32;
export const DEFAULT_TASKHEIGHT_SMALL = 22;
export const TASKWIDTH = 200;
export const TEAMWIDTH = 150;
export const TEAM_DRAG_HIGHLIGHT_HEIGHT = 5;
export const MARIGN_BETWEEN_DRAG_HIGHLIGHT = 5;
export const TEAM_HEADER_LINE_HEIGHT = 3;
export const TEAM_HEADER_GAP = 2;
export const DEFAULT_DAYWIDTH = 60;
export const HEADER_HEIGHT = 48;
export const TASK_DROP_INDICATOR_HEIGHT = 3;
export const CONNECTION_RADIUS = 20;
export const DAY_NAME_WIDTH_THRESHOLD = 45;
export const TEAM_COLLAPSED_HEIGHT = 32;

// Column resize limits
export const MIN_TEAMWIDTH = 80;
export const MAX_TEAMWIDTH = 400;
export const MIN_TASKWIDTH = 100;
export const MAX_TASKWIDTH = 500;

// ==========================================
// Pure Utility Functions
// ==========================================

// Helper function to lighten a hex color while keeping high opacity
export const lightenColor = (hex, amount = 0.9) => {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  
  return `rgba(${newR}, ${newG}, ${newB}, 0.95)`;
};

// Helper to check if task is visible
export const isTaskVisible = (taskId, taskDisplaySettings) => {
  const settings = taskDisplaySettings[taskId];
  return settings ? !settings.hidden : true;
};

// Calculate days between two dates
export function daysBetween(start, end) {
    const startDate = new Date(start)
    const endDate = new Date(end)

    const diffMs = endDate - startDate
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    return diffDays
}

// ==========================================
// Task Height Functions
// ==========================================

export const getTaskHeight = (taskId, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL) => {
    const settings = taskDisplaySettings[taskId];
    if (!settings || settings.hidden) return 0;
    return settings.size === 'small' ? TASKHEIGHT_SMALL : TASKHEIGHT_NORMAL;
};

export const getRawTeamHeight = (team, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL) => {
    if (!team) return 0;
    
    let height = 0;
    for (const taskId of team.tasks) {
      height += getTaskHeight(taskId, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL);
    }
    return height;
};

// ==========================================
// Team Height and Offset Functions
// ==========================================

export const getTeamHeightBase = (team, teamDisplaySettings, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL, TEAM_MIN_HEIGHT, TEAM_COLLAPSED_HEIGHT_VAL) => {
    if (!team) return TEAM_MIN_HEIGHT;
    
    if (teamDisplaySettings[team.id]?.collapsed) {
      return TEAM_COLLAPSED_HEIGHT_VAL;
    }
    
    let height = 0;
    for (const taskId of team.tasks) {
      height += getTaskHeight(taskId, taskDisplaySettings, TASKHEIGHT_SMALL, TASKHEIGHT_NORMAL);
    }
    return Math.max(height, TEAM_MIN_HEIGHT);
};

export const getTeamYOffset = (teamId, teamOrder, isTeamVisibleFn, getTeamHeightFn, layoutConstants) => {
    const { HEADER_HEIGHT, TEAM_DRAG_HIGHLIGHT_HEIGHT, MARIGN_BETWEEN_DRAG_HIGHLIGHT, TEAM_HEADER_LINE_HEIGHT, TEAM_HEADER_GAP } = layoutConstants;
    let offset = HEADER_HEIGHT;
    for (const tid of teamOrder) {
      if (tid === teamId) break;
      if (!isTeamVisibleFn(tid)) continue;
      offset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      offset += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
      offset += getTeamHeightFn(tid);
    }
    return offset;
};

export const getTaskYOffset = (taskId, team, isTaskVisibleFn, getTaskHeightFn, taskDisplaySettings) => {
    if (!team) return 0;
    let offset = 0;
    for (const tid of team.tasks) {
      if (tid === taskId) break;
      if (!isTaskVisibleFn(tid, taskDisplaySettings)) continue;
      offset += getTaskHeightFn(tid, taskDisplaySettings);
    }
    return offset;
};

// ==========================================
// Visibility and Filtering Functions
// ==========================================

export const getVisibleTasks = (team, taskDisplaySettings) => {
    if (!team) return [];
    return team.tasks.filter(taskId => isTaskVisible(taskId, taskDisplaySettings));
};

export const getVisibleTeamIndex = (teamId, teamOrder, isTeamVisibleFn) => {
    let index = 0;
    for (const tid of teamOrder) {
      if (tid === teamId) return index;
      if (isTeamVisibleFn(tid)) index++;
    }
    return index;
};

export const isTeamVisibleBase = (teamId, teamDisplaySettings, teams, taskDisplaySettings) => {
    const settings = teamDisplaySettings[teamId];
    if (settings?.hidden) return false;
    
    return true;
};

// ==========================================
// Drop Indicator Functions
// ==========================================

export const getTaskDropIndicatorY = (taskDropTarget, getTeamYOffsetFn, getVisibleTasksFn, getTaskHeightFn, taskDisplaySettings, layoutConstants) => {
    if (!taskDropTarget) return 0;
    const { TEAM_DRAG_HIGHLIGHT_HEIGHT, MARIGN_BETWEEN_DRAG_HIGHLIGHT } = layoutConstants;
    const { teamId, insertIndex } = taskDropTarget;
    const teamYOffset = getTeamYOffsetFn(teamId);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    
    const visibleTasks = getVisibleTasksFn(teamId);
    let taskOffset = 0;
    for (let i = 0; i < insertIndex && i < visibleTasks.length; i++) {
      taskOffset += getTaskHeightFn(visibleTasks[i], taskDisplaySettings);
    }
    
    return teamYOffset + dropHighlightOffset + taskOffset;
};

// ==========================================
// Content Height Calculation
// ==========================================

export const calculateContentHeight = (teamOrder, isTeamVisibleFn, getTeamHeightFn, layoutConstants) => {
    const { HEADER_HEIGHT, TEAM_DRAG_HIGHLIGHT_HEIGHT, MARIGN_BETWEEN_DRAG_HIGHLIGHT, TEAM_HEADER_LINE_HEIGHT, TEAM_HEADER_GAP } = layoutConstants;
    let height = HEADER_HEIGHT;
    for (const teamId of teamOrder) {
      if (!isTeamVisibleFn(teamId)) continue;
      height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      height += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
      height += getTeamHeightFn(teamId);
    }
    height += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    return height;
};

// ==========================================
// SVG Path Functions
// ==========================================

export const getConnectionPath = (x1, y1, x2, y2) => {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
};

export const getStraightPath = (x1, y1, x2, y2) => {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
};
