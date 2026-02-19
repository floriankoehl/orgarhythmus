/**
 * Prop configuration objects for DependencyCanvas
 * 
 * Groups related props together to reduce prop drilling and improve organization.
 */

/**
 * Layout configuration - all layout constants and dimensions
 */
export function createLayoutConfig({
  TEAMWIDTH,
  TASKWIDTH,
  DAYWIDTH,
  COLLAPSED_DAY_WIDTH = 6,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  days,
  contentHeight,
  dayColumnLayout,
}) {
  return {
    TEAMWIDTH,
    TASKWIDTH,
    DAYWIDTH,
    COLLAPSED_DAY_WIDTH,
    TEAM_DRAG_HIGHLIGHT_HEIGHT,
    MARIGN_BETWEEN_DRAG_HIGHLIGHT,
    TEAM_HEADER_LINE_HEIGHT,
    TEAM_HEADER_GAP,
    days,
    contentHeight,
    dayColumnLayout,
  };
}

/**
 * Layout helpers - functions for calculating positions and dimensions
 */
export function createLayoutHelpers({
  isTeamVisible,
  isTeamCollapsed,
  getVisibleTeamIndex,
  getTeamHeight,
  getRawTeamHeight,
  getVisibleTasks,
  getTaskHeight,
  getTeamYOffset,
  getTaskYOffset,
  getTaskDropIndicatorY,
  getMilestoneHandlePosition,
  getTeamPhaseRowHeight,
}) {
  return {
    isTeamVisible,
    isTeamCollapsed,
    getVisibleTeamIndex,
    getTeamHeight,
    getRawTeamHeight,
    getVisibleTasks,
    getTaskHeight,
    getTeamYOffset,
    getTaskYOffset,
    getTaskDropIndicatorY,
    getMilestoneHandlePosition,
    getTeamPhaseRowHeight,
  };
}

/**
 * Milestone handlers - all milestone-related event handlers
 */
export function createMilestoneHandlers({
  handleMileStoneMouseDown,
  handleMilestoneClick,
  handleMilestoneEdgeResize,
  handleConnectionDragStart,
  handleMilestoneRenameSubmit,
  setHoveredMilestone,
  setEditingMilestoneName,
  setEditingMilestoneId,
  setDeleteConfirmModal,
}) {
  return {
    handleMileStoneMouseDown,
    handleMilestoneClick,
    handleMilestoneEdgeResize,
    handleConnectionDragStart,
    handleMilestoneRenameSubmit,
    setHoveredMilestone,
    setEditingMilestoneName,
    setEditingMilestoneId,
    setDeleteConfirmModal,
  };
}

/**
 * Team/Task handlers - all team and task-related event handlers
 */
export function createTeamTaskHandlers({
  handleTeamDrag,
  handleTaskDrag,
  toggleTaskSize,
  toggleTaskVisibility,
  toggleTeamCollapsed,
  showAllHiddenTeams,
  toggleTeamVisibility,
  setOpenTeamSettings,
}) {
  return {
    handleTeamDrag,
    handleTaskDrag,
    toggleTaskSize,
    toggleTaskVisibility,
    toggleTeamCollapsed,
    showAllHiddenTeams,
    toggleTeamVisibility,
    setOpenTeamSettings,
  };
}

/**
 * Display settings - all visibility and display configuration
 */
export function createDisplayConfig({
  hideAllDependencies,
  hideCollapsedDependencies,
  hideCollapsedMilestones,
  expandedTaskView,
  showPhaseColorsInGrid,
  hideGlobalPhases,
  hideDayHeader,
  depSettings,
}) {
  return {
    hideAllDependencies,
    hideCollapsedDependencies,
    hideCollapsedMilestones,
    expandedTaskView,
    showPhaseColorsInGrid,
    hideGlobalPhases,
    hideDayHeader,
    depSettings,
  };
}

/**
 * Day/Phase handlers - all day and phase-related event handlers
 */
export function createDayPhaseHandlers({
  handleDayHeaderClick,
  handleDayCellClick,
  onDaySelect,
  onUncollapseDays,
  setPhaseEditModal,
  handlePhaseEdgeResize,
  handlePhaseDrag,
  setCollapsedTeamPhaseRows,
  collapsePhaseRange,
  focusOnPhase,
  addMilestoneLocal,
  setHoveredDayCell,
}) {
  return {
    handleDayHeaderClick,
    handleDayCellClick,
    onDaySelect,
    onUncollapseDays,
    setPhaseEditModal,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    setCollapsedTeamPhaseRows,
    collapsePhaseRange,
    focusOnPhase,
    addMilestoneLocal,
    setHoveredDayCell,
  };
}

/**
 * Connection handlers - all dependency connection-related handlers
 */
export function createConnectionHandlers({
  handleConnectionClick,
  setConnectionEditModal,
}) {
  return {
    handleConnectionClick,
    setConnectionEditModal,
  };
}
