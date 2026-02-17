import AddIcon from '@mui/icons-material/Add';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DependencyDayGrid from './DependencyDayGrid';

export default function DependencyTeamList({
  // Data
  teamOrder,
  teams,
  tasks,
  // Layout helpers
  isTeamVisible,
  isTeamCollapsed,
  getVisibleTeamIndex,
  getTeamHeight,
  getRawTeamHeight,
  getVisibleTasks,
  getTaskHeight,
  lightenColor,
  isTaskVisible,
  // Constants
  TEAMWIDTH,
  TASKWIDTH,
  DAYWIDTH,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  // State
  days,
  taskDisplaySettings,
  ghost,
  dropIndex,
  taskGhost,
  taskDropTarget,
  openTeamSettings,
  isAddingMilestone,
  hoveredDayCell,
  mode,
  visibleTeamCount,
  hiddenTeamCount,
  // Handlers
  handleTeamDrag,
  handleTaskDrag,
  toggleTaskSize,
  toggleTaskVisibility,
  toggleTeamCollapsed,
  addMilestoneLocal,
  setOpenTeamSettings,
  setHoveredDayCell,
  handleDayCellClick,
  showAllHiddenTeams,
}) {
  return (
    <>
      {/* Teams List */}
      {teamOrder.map((team_key, orderIndex) => {
        const team = teams[team_key];
        if (!team) return null;
        
        // Skip hidden teams
        if (!isTeamVisible(team_key)) return null;
        
        const visibleIndex = getVisibleTeamIndex(team_key);
        const teamHeight = getTeamHeight(team_key);
        const rawHeight = getRawTeamHeight(team_key);
        const visibleTasks = getVisibleTasks(team_key);
        const isTargetTeam = taskGhost && taskDropTarget?.teamId === team_key && taskDropTarget?.teamId !== taskGhost.fromTeamId;
        const isSettingsOpen = openTeamSettings === team_key;
        
        return (
          <div key={`${team_key}_container`} style={{ position: 'relative' }}>
            {/* Drop Highlighter */}
            <div className="flex" style={{ backgroundColor: 'white' }}>
              <div
                style={{
                  marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  opacity: dropIndex === visibleIndex ? 1 : 0,
                  position: 'sticky',
                  left: 0,
                  zIndex: 40,
                  backgroundColor: dropIndex === visibleIndex ? 'black' : 'white',
                }}
                className="rounded-l-full"
              />
              <div
                style={{
                  marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
                  opacity: dropIndex === visibleIndex ? 1 : 0,
                  backgroundColor: dropIndex === visibleIndex ? 'black' : 'white',
                }}
                className="rounded-r-full flex-1"
              />
            </div>

            {/* Team Color Header Line - spans full width */}
            <div 
              className="flex"
              style={{ 
                height: `${TEAM_HEADER_LINE_HEIGHT}px`,
                backgroundColor: team.color,
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <div 
                style={{ 
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  position: 'sticky',
                  left: 0,
                  zIndex: 41,
                  backgroundColor: team.color,
                }}
              />
              <div style={{ flex: 1 }} />
            </div>
            
            {/* Gap after header line */}
            <div style={{ height: `${TEAM_HEADER_GAP}px` }} />

            {/* Team Row */}
            <div className="flex">
              {/* STICKY LEFT: Team + Tasks */}
              <div
                style={{
                  height: teamHeight,
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  backgroundColor: isTargetTeam ? '#dbeafe' : lightenColor(team.color, 0.9),
                  opacity: ghost?.id === team_key ? 0.2 : 1,
                  position: 'sticky',
                  left: 0,
                  zIndex: 40,
                  transition: 'all 0.15s ease',
                  boxShadow: isTargetTeam ? 'inset 0 0 0 2px #3b82f6' : '2px 0 4px rgba(0,0,0,0.05)',
                  borderLeft: `3px solid ${team.color}`,
                }}
                className="flex border-y border-r border-slate-200 flex-shrink-0"
              >
                {/* Team Column */}
                <div
                  style={{ width: isTeamCollapsed(team_key) ? `${TEAMWIDTH + TASKWIDTH}px` : `${TEAMWIDTH}px` }}
                  className="flex flex-col"
                >
                  {/* Team Name Row - Draggable + Settings */}
                  <div className={`${isTeamCollapsed(team_key) ? '' : 'border-b border-slate-200'} h-8 px-3 flex items-center justify-between`}>
                    <div 
                      onMouseDown={(e) => handleTeamDrag(e, team_key, orderIndex)}
                      className="flex-1 flex items-center gap-2 cursor-grab active:cursor-grabbing overflow-hidden"
                    >
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="truncate text-sm font-semibold text-slate-700">{team.name}</span>
                      {isTeamCollapsed(team_key) && (
                        <span className="text-xs text-slate-400 ml-1">
                          ({team.tasks.length} task{team.tasks.length !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    
                    {/* Expand button for collapsed teams */}
                    {isTeamCollapsed(team_key) && (
                      <button
                        onClick={() => toggleTeamCollapsed(team_key)}
                        className="flex items-center justify-center h-6 w-6 rounded hover:bg-slate-100 transition mr-1"
                        title="Expand team"
                      >
                        <UnfoldMoreIcon style={{ fontSize: 16 }} className="text-slate-500" />
                      </button>
                    )}
                    
                    {/* Team Settings Button */}
                    <div className="relative">
                      <button
                        id={`team-settings-btn-${team_key}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTeamSettings(isSettingsOpen ? null : team_key);
                        }}
                        className={`flex items-center justify-center h-6 w-6 rounded hover:bg-slate-100 transition ${isSettingsOpen ? 'bg-slate-100' : ''}`}
                        title="Team settings"
                      >
                        <MoreVertIcon style={{ fontSize: 16 }} className="text-slate-500" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Empty space indicator when all tasks hidden but team shown due to min height */}
                  {!isTeamCollapsed(team_key) && rawHeight === 0 && teamHeight > 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-xs text-slate-400 italic">All tasks hidden</span>
                    </div>
                  )}
                </div>

                {/* Tasks Column - only show when not collapsed AND has visible tasks */}
                {!isTeamCollapsed(team_key) && visibleTasks.length > 0 && (
                  <div className="flex flex-col bg-white">
                    {team.tasks.map((task_key, taskIndex) => {
                      if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
                      
                      const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
                      const isSmall = taskDisplaySettings[task_key]?.size === 'small';
                      const visibleTaskIndex = visibleTasks.indexOf(task_key);
                      const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
                      
                      return (
                        <div
                          className="border-l border-slate-200 flex justify-between w-full items-center hover:bg-slate-50/50 transition-colors"
                          style={{
                            height: `${taskHeight}px`,
                            width: `${TASKWIDTH}px`,
                            borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                            opacity: taskGhost?.taskKey === task_key ? 0.3 : 1,
                          }}
                          key={`${task_key}_container`}
                        >
                          {/* Task Name */}
                          <div
                            onMouseDown={(e) => {
                              if (mode === "drag") {
                                handleTaskDrag(e, task_key, team_key, visibleTaskIndex);
                              }
                            }}
                            className={`flex-1 h-full flex items-center px-2 cursor-grab active:cursor-grabbing truncate text-slate-600 ${isSmall ? 'text-xs' : 'text-sm'}`}
                          >
                            {tasks[task_key]?.name}
                          </div>

                          {/* Task Controls */}
                          <div className="flex items-center gap-0.5 pr-1.5 opacity-60 hover:opacity-100 transition-opacity">
                            {/* Size Toggle */}
                            <button
                              onClick={() => toggleTaskSize(task_key)}
                              className={`flex items-center justify-center rounded hover:bg-slate-200 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                              title={isSmall ? "Expand task" : "Collapse task"}
                            >
                              {isSmall ? (
                                <UnfoldMoreIcon style={{ fontSize: isSmall ? 12 : 14 }} className="text-slate-500" />
                              ) : (
                                <UnfoldLessIcon style={{ fontSize: 14 }} className="text-slate-500" />
                              )}
                            </button>
                            
                            {/* Hide Task */}
                            <button
                              onClick={() => toggleTaskVisibility(task_key)}
                              className={`flex items-center justify-center rounded hover:bg-slate-200 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                              title="Hide task"
                            >
                              <VisibilityOffIcon style={{ fontSize: isSmall ? 12 : 14 }} className="text-slate-500" />
                            </button>
                            
                            {/* Add Milestone */}
                            {!isSmall && (
                              <button 
                                onClick={() => addMilestoneLocal(task_key)}
                                className="h-6 w-6 flex justify-center items-center rounded hover:bg-slate-200 transition cursor-pointer"
                              >
                                <AddIcon style={{ fontSize: 14 }} className="text-slate-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <DependencyDayGrid
                isCollapsed={isTeamCollapsed(team_key)}
                teamHeight={teamHeight}
                rawHeight={rawHeight}
                teamTasks={team.tasks}
                visibleTasks={visibleTasks}
                team_key={team_key}
                days={days}
                DAYWIDTH={DAYWIDTH}
                ghost={ghost}
                isAddingMilestone={isAddingMilestone}
                hoveredDayCell={hoveredDayCell}
                taskDisplaySettings={taskDisplaySettings}
                isTaskVisible={isTaskVisible}
                getTaskHeight={getTaskHeight}
                setHoveredDayCell={setHoveredDayCell}
                handleDayCellClick={handleDayCellClick}
              />
            </div>
          </div>
        );
      })}

      {/* LAST DROP HIGHLIGHT */}
      <div className="flex" style={{ position: 'relative', backgroundColor: 'white' }}>
        <div
          style={{
            marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
            marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
            height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
            width: `${TEAMWIDTH + TASKWIDTH}px`,
            opacity: dropIndex === visibleTeamCount ? 1 : 0,
            backgroundColor: dropIndex === visibleTeamCount ? 'black' : 'white',
            position: 'sticky',
            left: 0,
            zIndex: 40,
          }}
          className="rounded-l-full"
        />
        <div
          style={{
            marginBottom: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
            marginTop: `${MARIGN_BETWEEN_DRAG_HIGHLIGHT}px`,
            height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT}px`,
            opacity: dropIndex === visibleTeamCount ? 1 : 0,
            backgroundColor: dropIndex === visibleTeamCount ? 'black' : 'white',
          }}
          className="rounded-r-full flex-1"
        />
      </div>

      {/* Hidden Teams Indicator */}
      {hiddenTeamCount > 0 && (
        <div 
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 border-t"
          style={{ position: 'sticky', left: 0, width: `${TEAMWIDTH + TASKWIDTH}px`, zIndex: 45 }}
        >
          <VisibilityOffIcon style={{ fontSize: 16 }} className="text-slate-500" />
          <span className="text-xs text-slate-600">
            {hiddenTeamCount} hidden team(s)
          </span>
          <button
            onClick={() => showAllHiddenTeams()}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Show all
          </button>
        </div>
      )}
    </>
  );
}
