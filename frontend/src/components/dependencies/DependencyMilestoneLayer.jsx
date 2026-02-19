import FlagIcon from '@mui/icons-material/Flag';
import { lightenColor } from '../../pages/dependency/layoutMath';
import MilestoneBar from './milestone/MilestoneBar';

export default function DependencyMilestoneLayer({
  teamOrder,
  teams,
  tasks,
  milestones,
  taskDisplaySettings,
  hoveredMilestone,
  selectedMilestones,
  editingMilestoneId,
  editingMilestoneName,
  blockedMoveHighlight,
  viewMode,
  mode,
  safeMode,
  hideCollapsedMilestones,
  TEAMWIDTH,
  TASKWIDTH,
  DAYWIDTH,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  // Day column layout
  dayColumnLayout,
  collapsedDays = new Set(),
  isTeamVisible,
  isTeamCollapsed,
  getVisibleTasks,
  isTaskVisible,
  getTaskHeight,
  getTeamYOffset,
  getTaskYOffset,
  handleMileStoneMouseDown,
  handleMilestoneClick,
  setHoveredMilestone,
  setEditingMilestoneName,
  setEditingMilestoneId,
  handleMilestoneRenameSubmit,
  handleMilestoneEdgeResize,
  handleConnectionDragStart,
  // Refactor mode
  refactorMode,
  handleRefactorDrag,
  // Expanded task view (Gantt)
  expandedTaskView,
  // Deadline
  onSetDeadline,
  days,
  // Team phase row height
  getTeamPhaseRowHeight,
}) {
  // Helper: get pixel X offset for a day index using dayColumnLayout
  const getDayX = (dayIndex) => {
    if (dayColumnLayout) return TEAMWIDTH + TASKWIDTH + dayColumnLayout.dayXOffset(dayIndex);
    return TEAMWIDTH + TASKWIDTH + dayIndex * DAYWIDTH;
  };

  // Helper: get pixel width for a milestone spanning start_index..start_index+duration
  const getMilestonePixelWidth = (startIndex, duration) => {
    if (dayColumnLayout) {
      const startX = dayColumnLayout.dayXOffset(startIndex);
      const endIdx = startIndex + duration;
      const endX = endIdx < days ? dayColumnLayout.dayXOffset(endIdx) : dayColumnLayout.totalDaysWidth;
      return endX - startX;
    }
    return duration * DAYWIDTH;
  };

  // Helper: check if any day in a range is collapsed
  const isAnyDayCollapsed = (startIndex, duration) => {
    for (let i = startIndex; i < startIndex + duration; i++) {
      if (collapsedDays.has(i)) return true;
    }
    return false;
  };

  // Helper: check if ALL days in a range are collapsed
  const isAllDaysCollapsed = (startIndex, duration) => {
    for (let i = startIndex; i < startIndex + duration; i++) {
      if (!collapsedDays.has(i)) return false;
    }
    return true;
  };
  // Compute task time spans for Gantt-like bars
  const getTaskTimeSpan = (taskId) => {
    const task = tasks[taskId];
    if (!task || !task.milestones || task.milestones.length === 0) return null;
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const mRef of task.milestones) {
      const m = milestones[mRef.id];
      if (!m) continue;
      minStart = Math.min(minStart, m.start_index);
      maxEnd = Math.max(maxEnd, m.start_index + (m.duration || 1));
    }
    if (minStart === Infinity) return null;
    return { start: minStart, end: maxEnd };
  };

  return (
    <div
      className="absolute top-0 left-0 w-full h-full"
      style={{ zIndex: 20, pointerEvents: 'none' }}
    >
      {/* Expanded task view: Gantt-like time span bars behind milestones */}
      {expandedTaskView && teamOrder.map((team_key) => {
        if (!isTeamVisible(team_key)) return null;
        if (isTeamCollapsed(team_key)) return null;
        
        const team = teams[team_key];
        if (!team) return null;

        const visibleTasks = getVisibleTasks(team_key);
        const teamColor = team.color || '#94a3b8';

        return visibleTasks.map((task_key) => {
          if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
          if (hideCollapsedMilestones && taskDisplaySettings[task_key]?.size === 'small') return null;

          const span = getTaskTimeSpan(task_key);
          if (!span) return null;

          // Hide if ALL days in span are collapsed (partial visibility is fine)
          if (isAllDaysCollapsed(span.start, span.end - span.start)) return null;

          const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
          const teamYOffset = getTeamYOffset(team_key);
          const taskYOffset = getTaskYOffset(task_key, team_key);
          const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
          const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
          const phaseRowOffset = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(team_key) : 0;
          const taskY = teamYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + taskYOffset;

          const barLeft = getDayX(span.start);
          const barWidth = getMilestonePixelWidth(span.start, span.end - span.start);

          return (
            <div
              key={`gantt-${task_key}`}
              className="absolute rounded"
              style={{
                left: `${barLeft}px`,
                top: `${taskY + 2}px`,
                width: `${barWidth}px`,
                height: `${taskHeight - 4}px`,
                backgroundColor: lightenColor(teamColor, 0.82),
                border: `1px solid ${lightenColor(teamColor, 0.65)}`,
                zIndex: 15,
                pointerEvents: 'none',
              }}
            >
              {/* Task name label on the bar (only when wide enough) */}
              {barWidth > 60 && (
                <div className="flex items-center h-full px-2 overflow-hidden">
                  <span className="truncate text-[10px] font-medium" style={{ color: teamColor, opacity: 0.7 }}>
                    {tasks[task_key]?.name}
                  </span>
                </div>
              )}
            </div>
          );
        });
      })}

      {/* Deadline flag markers for tasks with hard_deadline */}
      {teamOrder.map((team_key) => {
        if (!isTeamVisible(team_key)) return null;
        if (isTeamCollapsed(team_key)) return null;
        
        const team = teams[team_key];
        if (!team) return null;

        const visibleTasks = getVisibleTasks(team_key);

        return visibleTasks.map((task_key) => {
          if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
          
          const task = tasks[task_key];
          if (!task) return null;
          const deadline = task.hard_deadline;
          if (deadline === null || deadline === undefined) return null;

          // Hide flag if deadline day is collapsed
          if (collapsedDays.has(deadline)) return null;

          const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
          const teamYOffset = getTeamYOffset(team_key);
          const taskYOffset = getTaskYOffset(task_key, team_key);
          const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
          const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
          const phaseRowOffset = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(team_key) : 0;
          const taskY = teamYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + taskYOffset;

          const flagLeft = getDayX(deadline) + (dayColumnLayout?.dayWidth(deadline) ?? DAYWIDTH) - 6;

          return (
            <div
              key={`deadline-${task_key}`}
              className="absolute flex flex-col items-center group"
              style={{
                left: `${flagLeft}px`,
                top: `${taskY}px`,
                height: `${taskHeight}px`,
                zIndex: 18,
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
              title={`Hard deadline: day ${deadline + 1} — click to remove`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSetDeadline) onSetDeadline(task_key, null);
              }}
            >
              <FlagIcon
                style={{ fontSize: 14, color: '#ef4444', marginTop: 1 }}
                className="drop-shadow-sm group-hover:scale-110 transition-transform"
              />
              <div
                style={{
                  width: '2px',
                  flex: 1,
                  backgroundColor: '#ef4444',
                  opacity: 0.5,
                  marginTop: '-2px',
                }}
              />
            </div>
          );
        });
      })}

      {teamOrder.map((team_key) => {
        if (!isTeamVisible(team_key)) return null;
        if (isTeamCollapsed(team_key)) return null;
        
        const team = teams[team_key];
        if (!team) return null;

        const visibleTasks = getVisibleTasks(team_key);

        return visibleTasks.map((task_key) => {
          if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
          
          const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
          const teamYOffset = getTeamYOffset(team_key);
          const taskYOffset = getTaskYOffset(task_key, team_key);
          const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
          const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
          const phaseRowOffset = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(team_key) : 0;
          const taskY = teamYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + taskYOffset;

          return tasks[task_key]?.milestones?.map((milestone_from_task) => {
            const milestone = milestones[milestone_from_task.id];
            if (!milestone) return null;

            // Hide milestones for collapsed tasks if setting is enabled
            if (hideCollapsedMilestones && taskDisplaySettings[task_key]?.size === 'small') {
              return null;
            }

            // Hide milestones only if ALL days are collapsed (partial visibility is fine)
            if (isAllDaysCollapsed(milestone.start_index, milestone.duration || 1)) {
              return null;
            }

            const showDurationMinus = false;
            const showConnect = false;
            const isSelected = selectedMilestones.has(milestone.id);
            const isEditing = editingMilestoneId === milestone.id;
            const showEdgeResize = viewMode === "schedule" && hoveredMilestone === milestone.id;
            const isBlockedHighlight = blockedMoveHighlight?.milestoneId === milestone.id;

            // Get team color for milestone
            const milestoneColor = milestone.color || team.color || '#facc15';

            // Use milestone.x (pixel offset) during drag for smooth visual feedback,
            // otherwise use dayColumnLayout-based position
            const msLeft = milestone.x !== undefined
              ? (TEAMWIDTH + TASKWIDTH + milestone.x)
              : getDayX(milestone.start_index);
            const msWidth = getMilestonePixelWidth(milestone.start_index, milestone.duration || 1);

            return (
              <MilestoneBar
                key={milestone.id}
                milestone={milestone}
                task_key={task_key}
                tasks={tasks}
                team={team}
                taskHeight={taskHeight}
                taskY={taskY}
                milestoneColor={milestoneColor}
                msLeft={msLeft}
                msWidth={msWidth}
                isSelected={isSelected}
                isEditing={isEditing}
                showEdgeResize={showEdgeResize}
                isBlockedHighlight={isBlockedHighlight}
                refactorMode={refactorMode}
                viewMode={viewMode}
                safeMode={safeMode}
                selectedMilestones={selectedMilestones}
                editingMilestoneName={editingMilestoneName}
                handleMileStoneMouseDown={handleMileStoneMouseDown}
                handleMilestoneClick={handleMilestoneClick}
                handleRefactorDrag={handleRefactorDrag}
                setHoveredMilestone={setHoveredMilestone}
                setEditingMilestoneId={setEditingMilestoneId}
                setEditingMilestoneName={setEditingMilestoneName}
                handleMilestoneRenameSubmit={handleMilestoneRenameSubmit}
                handleMilestoneEdgeResize={handleMilestoneEdgeResize}
                handleConnectionDragStart={handleConnectionDragStart}
              />
            );
          });
        });
      })}
    </div>
  );
}
