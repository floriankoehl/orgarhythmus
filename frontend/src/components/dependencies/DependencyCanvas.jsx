import DependencyMilestoneLayer from './DependencyMilestoneLayer';
import DependencyTeamList from './DependencyTeamList';
import {
  getConnectionPath,
  getStraightPath,
  lightenColor,
  isTaskVisible,
  HEADER_HEIGHT,
  TASK_DROP_INDICATOR_HEIGHT,
  DAY_NAME_WIDTH_THRESHOLD,
} from '../../pages/dependency/layoutMath';

export default function DependencyCanvas({
  // Refs
  teamContainerRef,
  // Data
  teamOrder,
  teams,
  tasks,
  milestones,
  connections,
  dayLabels,
  // Layout helpers
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
  // Constants
  TEAMWIDTH,
  TASKWIDTH,
  DAYWIDTH,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  // Dimensions
  days,
  contentHeight,
  // Display settings
  taskDisplaySettings,
  teamDisplaySettings,
  hideAllDependencies,
  hideCollapsedDependencies,
  hideCollapsedMilestones,
  // UI state
  hoveredMilestone,
  selectedMilestones,
  selectedConnection,
  editingMilestoneId,
  editingMilestoneName,
  blockedMoveHighlight,
  viewMode,
  mode,
  safeMode,
  // Transient state
  ghost,
  dropIndex,
  taskGhost,
  taskDropTarget,
  isDraggingConnection,
  connectionStart,
  connectionEnd,
  openTeamSettings,
  isAddingMilestone,
  hoveredDayCell,
  visibleTeamCount,
  hiddenTeamCount,
  // Handlers
  handleDayHeaderClick,
  handleTeamDrag,
  handleTaskDrag,
  handleConnectionClick,
  handleMileStoneMouseDown,
  handleMilestoneClick,
  handleMilestoneDoubleClick,
  handleMilestoneEdgeResize,
  handleConnectionDragStart,
  handleMilestoneRenameSubmit,
  handleDayCellClick,
  toggleTaskSize,
  toggleTaskVisibility,
  toggleTeamCollapsed,
  addMilestoneLocal,
  showAllHiddenTeams,
  // Setters
  setHoveredMilestone,
  setEditingMilestoneName,
  setEditingMilestoneId,
  setDeleteConfirmModal,
  setOpenTeamSettings,
  setHoveredDayCell,
}) {
  return (
    <>
      {/* Scroll container - wrapper to flip scrollbar to top */}
      <div
        style={{ height: `${contentHeight + 16}px`, transform: 'scaleY(-1)' }}
        className="overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 shadow-sm"
      >
        {/* Inner container - flip back to normal */}
        <div
          ref={teamContainerRef}
          style={{
            width: `${TEAMWIDTH + TASKWIDTH + (days || 0) * DAYWIDTH}px`,
            height: `${contentHeight}px`,
            transform: 'scaleY(-1)',
          }}
          className="relative"
        >
          {/* Sticky overlay for team ghost and task drop indicator */}
          <div
            style={{
              position: 'sticky',
              left: 0,
              top: 0,
              width: `${TEAMWIDTH + TASKWIDTH}px`,
              height: 0,
              zIndex: 150,
              pointerEvents: 'none',
            }}
          >
            {/* Task drop indicator line */}
            {taskGhost && taskDropTarget && (
              <div
                className="pointer-events-none absolute"
                style={{
                  top: `${getTaskDropIndicatorY()}px`,
                  left: `${TEAMWIDTH}px`,
                  width: `${TASKWIDTH}px`,
                  height: `${TASK_DROP_INDICATOR_HEIGHT}px`,
                  backgroundColor: '#1d4ed8',
                  borderRadius: '2px',
                  zIndex: 200,
                  boxShadow: '0 0 8px rgba(29, 78, 216, 0.6)',
                }}
              />
            )}

            {/* Team Ghost */}
            {ghost && (
              <div
                className="pointer-events-none absolute"
                style={{
                  top: `${ghost.y}px`,
                  left: 0,
                  height: `${ghost.height}px`,
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  backgroundColor: `${ghost.color}`,
                  zIndex: 100,
                  opacity: 0.8,
                  border: '2px dashed #374151',
                  borderRadius: '4px',
                }}
              >
                <div className="p-2 text-sm font-medium">{ghost.name}</div>
              </div>
            )}
          </div>

          {/* Header Row */}
          <div className="flex" style={{ height: `${HEADER_HEIGHT}px`, position: 'relative', zIndex: 50 }}>
            <div
              className="flex border-b bg-slate-100 text-sm font-semibold text-slate-700"
              style={{
                width: `${TEAMWIDTH + TASKWIDTH}px`,
                height: `${HEADER_HEIGHT}px`,
                position: 'sticky',
                left: 0,
                zIndex: 50,
              }}
            >
              <div
                className="flex items-center justify-center border-r"
                style={{ width: `${TEAMWIDTH}px` }}
              >
                Team
              </div>
              <div
                className="flex items-center justify-center"
                style={{ width: `${TASKWIDTH}px` }}
              >
                Tasks
              </div>
            </div>
            
            {/* Day Headers - Enhanced */}
            <div className="flex border-b">
              {dayLabels.map((dayInfo, i) => {
                const hasPurpose = !!dayInfo.purpose;
                const isSunday = dayInfo.isSunday;
                const showDayName = DAYWIDTH >= DAY_NAME_WIDTH_THRESHOLD;
                
                return (
                  <div
                    key={i}
                    onClick={() => handleDayHeaderClick(i)}
                    className={`flex flex-col items-center justify-center text-xs border-r cursor-pointer transition-colors ${
                      hasPurpose 
                        ? 'bg-slate-800 text-white hover:bg-slate-700' 
                        : isSunday 
                          ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                    style={{ 
                      width: `${DAYWIDTH}px`,
                      height: `${HEADER_HEIGHT}px`,
                    }}
                    title={hasPurpose ? `${dayInfo.purpose} - Click to edit` : 'Click to set purpose'}
                  >
                    {showDayName && (
                      <span className={`text-[10px] font-medium ${hasPurpose ? 'text-slate-300' : isSunday ? 'text-purple-600' : 'text-slate-400'}`}>
                        {dayInfo.dayNameShort}
                      </span>
                    )}
                    <span className={`font-medium ${hasPurpose ? 'text-white' : ''}`}>
                      {dayInfo.dateStr}
                    </span>
                    {hasPurpose && DAYWIDTH >= 50 && (
                      <span className="text-[9px] truncate max-w-full px-1 text-slate-300">
                        {dayInfo.purpose}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DependencyTeamList
            // Data
            teamOrder={teamOrder}
            teams={teams}
            tasks={tasks}
            // Layout helpers
            isTeamVisible={isTeamVisible}
            isTeamCollapsed={isTeamCollapsed}
            getVisibleTeamIndex={getVisibleTeamIndex}
            getTeamHeight={getTeamHeight}
            getRawTeamHeight={getRawTeamHeight}
            getVisibleTasks={getVisibleTasks}
            getTaskHeight={getTaskHeight}
            lightenColor={lightenColor}
            isTaskVisible={isTaskVisible}
            // Constants
            TEAMWIDTH={TEAMWIDTH}
            TASKWIDTH={TASKWIDTH}
            DAYWIDTH={DAYWIDTH}
            TEAM_DRAG_HIGHLIGHT_HEIGHT={TEAM_DRAG_HIGHLIGHT_HEIGHT}
            MARIGN_BETWEEN_DRAG_HIGHLIGHT={MARIGN_BETWEEN_DRAG_HIGHLIGHT}
            TEAM_HEADER_LINE_HEIGHT={TEAM_HEADER_LINE_HEIGHT}
            TEAM_HEADER_GAP={TEAM_HEADER_GAP}
            // State
            days={days}
            taskDisplaySettings={taskDisplaySettings}
            ghost={ghost}
            dropIndex={dropIndex}
            taskGhost={taskGhost}
            taskDropTarget={taskDropTarget}
            openTeamSettings={openTeamSettings}
            isAddingMilestone={isAddingMilestone}
            hoveredDayCell={hoveredDayCell}
            mode={mode}
            visibleTeamCount={visibleTeamCount}
            hiddenTeamCount={hiddenTeamCount}
            // Handlers
            handleTeamDrag={handleTeamDrag}
            handleTaskDrag={handleTaskDrag}
            toggleTaskSize={toggleTaskSize}
            toggleTaskVisibility={toggleTaskVisibility}
            toggleTeamCollapsed={toggleTeamCollapsed}
            addMilestoneLocal={addMilestoneLocal}
            setOpenTeamSettings={setOpenTeamSettings}
            setHoveredDayCell={setHoveredDayCell}
            handleDayCellClick={handleDayCellClick}
            showAllHiddenTeams={showAllHiddenTeams}
          />

          {/* SVG Layer for Connections - ABOVE day grid */}
          <svg
            className="absolute top-0 left-0 w-full h-full"
            style={{ zIndex: 10, pointerEvents: 'none' }}
          >
            <defs>
              <style>
                {`
                  @keyframes flowAnimation {
                    from { stroke-dashoffset: 24; }
                    to { stroke-dashoffset: 0; }
                  }
                  @keyframes blockedPulse {
                    0%, 100% { opacity: 1; stroke-width: 5; }
                    50% { opacity: 0.5; stroke-width: 3; }
                  }
                `}
              </style>
            </defs>

            {!hideAllDependencies && connections.map((conn) => {
              const sourcePos = getMilestoneHandlePosition(conn.source, "source");
              const targetPos = getMilestoneHandlePosition(conn.target, "target");

              if (!sourcePos || !targetPos) return null;

              // Check if we should hide dependencies for collapsed tasks
              if (hideCollapsedDependencies) {
                const sourceMilestone = milestones[conn.source];
                const targetMilestone = milestones[conn.target];
                if (sourceMilestone && targetMilestone) {
                  const sourceTaskId = sourceMilestone.task;
                  const targetTaskId = targetMilestone.task;
                  const sourceTaskCollapsed = taskDisplaySettings[sourceTaskId]?.size === 'small';
                  const targetTaskCollapsed = taskDisplaySettings[targetTaskId]?.size === 'small';
                  if (sourceTaskCollapsed || targetTaskCollapsed) return null;
                }
              }

              const isSelected = selectedConnection?.source === conn.source && 
                                 selectedConnection?.target === conn.target;
              
              // Determine if this connection is related to any selected milestone
              const isOutgoing = selectedMilestones.size > 0 && selectedMilestones.has(conn.source);
              const isIncoming = selectedMilestones.size > 0 && selectedMilestones.has(conn.target);
              
              // Check if this connection is being highlighted as blocked
              const isBlockedHighlight = blockedMoveHighlight && 
                blockedMoveHighlight.connectionSource === conn.source &&
                blockedMoveHighlight.connectionTarget === conn.target;
              
              // Determine stroke color based on selection state
              let strokeColor = "#374151"; // default gray
              if (isBlockedHighlight) {
                strokeColor = "#dc2626"; // red for blocked
              } else if (isSelected) {
                strokeColor = "#6366f1"; // indigo when connection is selected
              } else if (isOutgoing) {
                strokeColor = "#22c55e"; // green for outgoing edges
              } else if (isIncoming) {
                strokeColor = "#ef4444"; // red for incoming edges
              }
              
              const isHighlighted = isSelected || isOutgoing || isIncoming || isBlockedHighlight;

              return (
                <g key={`${conn.source}-${conn.target}`} style={{ pointerEvents: 'auto' }}>
                  {/* Invisible wider path for easier clicking */}
                  <path
                    d={getConnectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => handleConnectionClick(e, conn)}
                  />
                  {/* Visible animated path */}
                  <path
                    d={getConnectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
                    stroke={strokeColor}
                    strokeWidth={isBlockedHighlight ? "5" : isHighlighted ? "3.5" : "2.5"}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="8, 4"
                    style={{
                      animation: isBlockedHighlight 
                        ? "flowAnimation 3s linear infinite, blockedPulse 0.5s ease-in-out infinite"
                        : "flowAnimation 3s linear infinite",
                      pointerEvents: "none",
                      filter: isHighlighted ? `drop-shadow(0 0 3px ${strokeColor}80)` : "none",
                    }}
                  />
                </g>
              );
            })}

            {isDraggingConnection && connectionStart && (
              <path
                d={getStraightPath(connectionStart.x, connectionStart.y, connectionEnd.x, connectionEnd.y)}
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="5,5"
                fill="none"
                strokeLinecap="round"
                opacity="0.7"
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>

          {/* Milestones Layer - ABOVE connections */}
          <DependencyMilestoneLayer
            teamOrder={teamOrder}
            teams={teams}
            tasks={tasks}
            milestones={milestones}
            taskDisplaySettings={taskDisplaySettings}
            hoveredMilestone={hoveredMilestone}
            selectedMilestones={selectedMilestones}
            editingMilestoneId={editingMilestoneId}
            editingMilestoneName={editingMilestoneName}
            blockedMoveHighlight={blockedMoveHighlight}
            viewMode={viewMode}
            mode={mode}
            safeMode={safeMode}
            hideCollapsedMilestones={hideCollapsedMilestones}
            TEAMWIDTH={TEAMWIDTH}
            TASKWIDTH={TASKWIDTH}
            DAYWIDTH={DAYWIDTH}
            TEAM_DRAG_HIGHLIGHT_HEIGHT={TEAM_DRAG_HIGHLIGHT_HEIGHT}
            MARIGN_BETWEEN_DRAG_HIGHLIGHT={MARIGN_BETWEEN_DRAG_HIGHLIGHT}
            TEAM_HEADER_LINE_HEIGHT={TEAM_HEADER_LINE_HEIGHT}
            TEAM_HEADER_GAP={TEAM_HEADER_GAP}
            isTeamVisible={isTeamVisible}
            isTeamCollapsed={isTeamCollapsed}
            getVisibleTasks={getVisibleTasks}
            isTaskVisible={isTaskVisible}
            getTaskHeight={getTaskHeight}
            getTeamYOffset={getTeamYOffset}
            getTaskYOffset={getTaskYOffset}
            handleMileStoneMouseDown={handleMileStoneMouseDown}
            handleMilestoneClick={handleMilestoneClick}
            handleMilestoneDoubleClick={handleMilestoneDoubleClick}
            setHoveredMilestone={setHoveredMilestone}
            setEditingMilestoneName={setEditingMilestoneName}
            setEditingMilestoneId={setEditingMilestoneId}
            handleMilestoneRenameSubmit={handleMilestoneRenameSubmit}
            handleMilestoneEdgeResize={handleMilestoneEdgeResize}
            handleConnectionDragStart={handleConnectionDragStart}
          />

          {/* Task Ghost */}
          {taskGhost && (
            <div
              className="absolute rounded border border-blue-400 bg-blue-100/90 shadow-lg flex items-center px-2 text-sm font-medium text-blue-900 pointer-events-none"
              style={{
                height: `${taskGhost.height}px`,
                width: `${taskGhost.width}px`,
                left: `${taskGhost.x}px`,
                top: `${taskGhost.y}px`,
                zIndex: 100,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {taskGhost.name}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
