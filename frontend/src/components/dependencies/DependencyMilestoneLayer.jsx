import CloseIcon from '@mui/icons-material/Close';

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
  isTeamVisible,
  isTeamCollapsed,
  getVisibleTasks,
  isTaskVisible,
  getTaskHeight,
  getTeamYOffset,
  getTaskYOffset,
  handleMileStoneMouseDown,
  handleMilestoneClick,
  handleMilestoneDoubleClick,
  setHoveredMilestone,
  setEditingMilestoneName,
  setEditingMilestoneId,
  handleMilestoneRenameSubmit,
  setDeleteConfirmModal,
  handleMilestoneEdgeResize,
  handleConnectionDragStart,
}) {
  return (
    <div
      className="absolute top-0 left-0 w-full h-full"
      style={{ zIndex: 15, pointerEvents: 'none' }}
    >
      {teamOrder.map((team_key) => {
        const team = teams[team_key];
        if (!team || !isTeamVisible(team_key)) return null;
        
        // Don't render milestones for collapsed teams
        if (isTeamCollapsed(team_key)) return null;

        const visibleTasks = getVisibleTasks(team_key);
        
        // Don't render milestones if all tasks are hidden
        if (visibleTasks.length === 0) return null;

        return team.tasks.map((task_key) => {
          if (!isTaskVisible(task_key, taskDisplaySettings)) return null;

          const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
          const isSmall = taskDisplaySettings[task_key]?.size === 'small';

          // Hide milestones for collapsed tasks if setting is enabled
          if (hideCollapsedMilestones && isSmall) return null;

          // Calculate Y position for this task
          const teamYOffset = getTeamYOffset(team_key);
          const taskYOffset = getTaskYOffset(task_key, team_key);
          const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
          const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
          const taskY = teamYOffset + dropHighlightOffset + headerOffset + taskYOffset;

          return tasks[task_key]?.milestones?.map((milestone_from_task) => {
            const milestone = milestones[milestone_from_task.id];
            if (!milestone) return null;

            const showDelete = hoveredMilestone === milestone.id && viewMode === "milestone";
            const showDurationPlus = hoveredMilestone === milestone.id && mode === "duration";
            const showDurationMinus = hoveredMilestone === milestone.id && mode === "duration" && milestone.duration > 1;
            const showConnect = mode === "connect";
            const isSelected = selectedMilestones.has(milestone.id);
            const isEditing = editingMilestoneId === milestone.id;
            const showEdgeResize = viewMode === "dependency" && hoveredMilestone === milestone.id;
            const isBlockedHighlight = blockedMoveHighlight?.milestoneId === milestone.id;

            return (
              <div
                onMouseDown={(e) => {
                  if (mode !== "connect" && !isEditing) {
                    handleMileStoneMouseDown(e, milestone_from_task.id);
                  }
                }}
                onClick={(e) => {
                  if (mode === "drag" && !isEditing) {
                    handleMilestoneClick(e, milestone.id);
                  }
                }}
                onDoubleClick={(e) => handleMilestoneDoubleClick(e, milestone)}
                onMouseEnter={() => setHoveredMilestone(milestone.id)}
                onMouseLeave={() => setHoveredMilestone(null)}
                className={`absolute rounded cursor-pointer ${
                  isBlockedHighlight 
                    ? 'ring-2 ring-red-500 ring-offset-1 shadow-lg animate-pulse'
                    : isSelected 
                      ? 'ring-2 ring-blue-500 ring-offset-1 shadow-lg' 
                      : 'hover:brightness-95'
                }`}
                style={{
                  pointerEvents: 'auto',
                  overflow: 'visible',
                  left: `${TEAMWIDTH + TASKWIDTH + (milestone.x ?? (milestone.start_index * DAYWIDTH))}px`,
                  top: `${taskY}px`,
                  width: `${DAYWIDTH * milestone.duration}px`,
                  height: `${taskHeight}px`,
                  backgroundColor: isBlockedHighlight ? '#dc2626' : isSelected ? '#3b82f6' : team.color,
                  boxShadow: isBlockedHighlight
                    ? '0 4px 12px rgba(220, 38, 38, 0.5)'
                    : isSelected 
                      ? '0 4px 12px rgba(59, 130, 246, 0.4)' 
                      : '0 1px 3px rgba(0,0,0,0.1)',
                }}
                key={milestone.id}
              >
                {/* Milestone name / edit input */}
                {isEditing ? (
                  <div className="h-full flex items-center justify-center px-1">
                    <input
                      autoFocus
                      type="text"
                      value={editingMilestoneName}
                      onChange={(e) => setEditingMilestoneName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleMilestoneRenameSubmit(milestone.id);
                        } else if (e.key === 'Escape') {
                          setEditingMilestoneId(null);
                          setEditingMilestoneName("");
                        }
                      }}
                      onBlur={() => handleMilestoneRenameSubmit(milestone.id)}
                      className={`w-full bg-white/90 rounded px-1 text-slate-900 outline-none ${isSmall ? 'text-[9px]' : 'text-[11px]'}`}
                      style={{ pointerEvents: 'auto' }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <div className={`h-full flex items-center justify-center overflow-hidden px-1 ${isSmall ? 'text-[9px]' : 'text-[11px]'}`}>
                    <span className={`truncate font-medium ${isSelected ? 'text-white' : ''}`}>
                      {milestone.name}
                    </span>
                  </div>
                )}

                {/* Delete icon - only in milestone mode, tiny and top-right */}
                {showDelete && (
                  <div 
                    className="absolute -top-1 -right-1 bg-slate-400/60 rounded-full cursor-pointer hover:bg-red-500 transition-all"
                    style={{ pointerEvents: 'auto', padding: '1px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmModal({ milestoneId: milestone.id, milestoneName: milestone.name });
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Delete milestone"
                  >
                    <CloseIcon style={{ fontSize: 8, color: 'white' }} />
                  </div>
                )}

                {/* Edge resize handles - only in milestone mode */}
                {viewMode === "milestone" && (
                  <>
                    {/* Left edge resize handle */}
                    <div
                      className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
                      style={{ pointerEvents: 'auto', zIndex: 5 }}
                      onMouseDown={(e) => handleMilestoneEdgeResize(e, milestone.id, "left")}
                    />
                    {/* Right edge resize handle */}
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
                      style={{ pointerEvents: 'auto', zIndex: 5 }}
                      onMouseDown={(e) => handleMilestoneEdgeResize(e, milestone.id, "right")}
                    />
                  </>
                )}

                {/* Connection handles - only in dependency mode */}
                {viewMode === "dependency" && !safeMode && (
                  <>
                    {/* Target handle (left) */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
                        showConnect 
                          ? 'w-3 h-3 bg-indigo-500 hover:scale-125' 
                          : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
                      }`}
                      style={{ pointerEvents: 'auto', zIndex: 10 }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleConnectionDragStart(e, milestone.id, "target");
                      }}
                    />
                    {/* Source handle (right) */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
                        showConnect 
                          ? 'w-3 h-3 bg-indigo-500 hover:scale-125' 
                          : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
                      }`}
                      style={{ pointerEvents: 'auto', zIndex: 10 }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleConnectionDragStart(e, milestone.id, "source");
                      }}
                    />
                  </>
                )}
              </div>
            );
          });
        });
      })}
    </div>
  );
}
