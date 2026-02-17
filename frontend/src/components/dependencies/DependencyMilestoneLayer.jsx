import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';

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
  setHoveredMilestone,
  setEditingMilestoneName,
  setEditingMilestoneId,
  handleMilestoneRenameSubmit,
  handleMilestoneEdgeResize,
  handleConnectionDragStart,
}) {
  return (
    <div
      className="absolute top-0 left-0 w-full h-full"
      style={{ zIndex: 20, pointerEvents: 'none' }}
    >
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
          const taskY = teamYOffset + dropHighlightOffset + headerOffset + taskYOffset;

          return tasks[task_key]?.milestones?.map((milestone_from_task) => {
            const milestone = milestones[milestone_from_task.id];
            if (!milestone) return null;

            // Hide milestones for collapsed tasks if setting is enabled
            if (hideCollapsedMilestones && taskDisplaySettings[task_key]?.size === 'small') {
              return null;
            }

            const showDurationPlus = hoveredMilestone === milestone.id && mode === "duration";
            const showDurationMinus = hoveredMilestone === milestone.id && mode === "duration" && milestone.duration > 1;
            const showConnect = mode === "connect";
            const isSelected = selectedMilestones.has(milestone.id);
            const isEditing = editingMilestoneId === milestone.id;
            const showEdgeResize = viewMode === "schedule" && hoveredMilestone === milestone.id;
            const isBlockedHighlight = blockedMoveHighlight?.milestoneId === milestone.id;

            // Get team color for milestone
            const milestoneColor = milestone.color || team.color || '#facc15';

            return (
              <div
                onMouseDown={(e) => {
                  if (mode !== "connect" && !isEditing) {
                    handleMileStoneMouseDown(e, milestone_from_task.id);
                  }
                }}
                onClick={(e) => {
                  if (!isEditing) {
                    handleMilestoneClick(e, milestone.id);
                  }
                }}
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
                  left: `${TEAMWIDTH + TASKWIDTH + (milestone.x ?? milestone.start_index * DAYWIDTH)}px`,
                  top: `${taskY}px`,
                  width: `${DAYWIDTH * milestone.duration}px`,
                  height: `${taskHeight - 4}px`,
                  backgroundColor: milestoneColor,
                  pointerEvents: 'auto',
                  zIndex: isSelected ? 25 : 20,
                  marginTop: '2px',
                }}
                key={milestone.id}
              >
                {/* Milestone name */}
                <div className="flex items-center h-full px-2 overflow-hidden">
                  <span className={`truncate text-xs ${isSelected ? 'text-white' : ''}`}>
                    {milestone.name}
                  </span>
                </div>

                {/* Edit name icon - shown when selected (single) and not already editing */}
                {isSelected && selectedMilestones.size === 1 && !isEditing && (
                  <div
                    className="absolute -top-7 left-0 flex items-center gap-1 bg-white rounded shadow-md border border-slate-200 px-1.5 py-0.5 cursor-pointer hover:bg-slate-50 transition"
                    style={{ pointerEvents: 'auto', zIndex: 30 }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingMilestoneId(milestone.id);
                      setEditingMilestoneName(milestone.name);
                    }}
                  >
                    <EditIcon style={{ fontSize: 12 }} className="text-slate-500" />
                    <span className="text-[10px] text-slate-500">Rename</span>
                  </div>
                )}

                {/* Inline rename input - shown above the milestone when editing */}
                {isEditing && (
                  <div
                    className="absolute -top-8 left-0 z-30"
                    style={{ pointerEvents: 'auto', minWidth: '160px' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={editingMilestoneName}
                      onChange={(e) => setEditingMilestoneName(e.target.value)}
                      onBlur={() => handleMilestoneRenameSubmit(milestone.id, editingMilestoneName)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          handleMilestoneRenameSubmit(milestone.id, editingMilestoneName);
                        }
                        if (e.key === 'Escape') {
                          setEditingMilestoneId(null);
                          setEditingMilestoneName('');
                        }
                      }}
                      className="w-full px-2 py-1 text-xs font-medium bg-white border-2 border-blue-500 rounded shadow-lg outline-none"
                    />
                  </div>
                )}

                {/* Duration controls */}
                {showDurationPlus && (
                  <div 
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center cursor-pointer hover:bg-green-600 shadow"
                    style={{ pointerEvents: 'auto', zIndex: 30 }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMilestoneEdgeResize(e, milestone.id, "right");
                    }}
                  >
                    +
                  </div>
                )}
                {showDurationMinus && (
                  <div 
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center cursor-pointer hover:bg-red-600 shadow"
                    style={{ pointerEvents: 'auto', zIndex: 30 }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMilestoneEdgeResize(e, milestone.id, "left");
                    }}
                  >
                    -
                  </div>
                )}

                {/* Edge resize handles - only in edit (schedule) mode */}
                {showEdgeResize && (
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
