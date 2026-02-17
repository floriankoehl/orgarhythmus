import AddIcon from '@mui/icons-material/Add';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import DependencyDayGrid from './DependencyDayGrid';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';

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
  toggleTeamVisibility,
}) {
  const navigate = useNavigate();
  const { projectId } = useParams();

  return (
    <>
      {teamOrder.map((team_key) => {
        if (!isTeamVisible(team_key)) return null;

        const team = teams[team_key];
        if (!team) return null;

        const visibleIndex = getVisibleTeamIndex(team_key);
        const teamHeight = getTeamHeight(team_key);
        const rawHeight = getRawTeamHeight(team_key);
        const visibleTasks = getVisibleTasks(team_key);
        const isCollapsed = isTeamCollapsed(team_key);
        const teamColor = team.color || '#94a3b8';
        const hasNoTasks = team.tasks.length === 0;
        const allTasksHidden = team.tasks.length > 0 && visibleTasks.length === 0;

        return (
          <div key={team_key}>
            {/* DROP HIGHLIGHT */}
            <div className="flex" style={{ position: 'relative', backgroundColor: 'white' }}>
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
              style={{ 
                height: `${TEAM_HEADER_LINE_HEIGHT}px`,
                marginBottom: `${TEAM_HEADER_GAP}px`,
                backgroundColor: teamColor,
              }}
            />

            {/* Team Row */}
            <div className="flex" style={{ position: 'relative' }}>
              {/* STICKY LEFT: Team + Tasks columns */}
              <div
                className="flex"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 30,
                  width: `${TEAMWIDTH + TASKWIDTH}px`,
                  height: `${teamHeight}px`,
                  opacity: ghost?.id === team_key ? 0.3 : 1,
                }}
              >
                {/* Team Name Column */}
                <div
                  className="flex flex-col items-center justify-start border-r border-b border-slate-200 cursor-grab active:cursor-grabbing"
                  style={{
                    width: `${TEAMWIDTH}px`,
                    height: `${teamHeight}px`,
                    backgroundColor: lightenColor(teamColor, 0.92),
                  }}
                  onMouseDown={(e) => {
                    // Don't initiate drag if clicking on interactive elements
                    if (e.target.closest('[data-no-drag]')) return;
                    handleTeamDrag(e, team_key, visibleIndex);
                  }}
                >
                  <div className="flex items-center gap-1 px-1 py-1.5 w-full">
                    {/* Expand/collapse triangle */}
                    <button
                      data-no-drag
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTeamCollapsed(team_key);
                      }}
                      className="flex-shrink-0 flex items-center justify-center rounded hover:bg-white/50 transition cursor-pointer"
                      style={{ width: '18px', height: '18px' }}
                      title={isCollapsed ? 'Expand team' : 'Collapse team'}
                    >
                      <ArrowRightIcon
                        style={{
                          fontSize: 16,
                          color: teamColor,
                          transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    </button>
                    <span
                      className="text-sm font-medium truncate flex-1"
                      title={team.name}
                    >
                      {team.name}
                    </span>
                    {/* Link to team detail page */}
                    <button
                      data-no-drag
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${projectId}/teams/${team_key}`);
                      }}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/50 transition cursor-pointer"
                      title={`Go to ${team.name} detail page`}
                    >
                      <OpenInNewIcon style={{ fontSize: 12 }} className="text-slate-400 hover:text-blue-500" />
                    </button>
                    <button
                      data-no-drag
                      id={`team-settings-btn-${team_key}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenTeamSettings(openTeamSettings === team_key ? null : team_key);
                      }}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/50 transition"
                    >
                      <MoreVertIcon style={{ fontSize: 14 }} className="text-slate-500" />
                    </button>
                  </div>
                  
                  {/* All tasks hidden indicator */}
                  {allTasksHidden && !isCollapsed && (
                    <div className="flex flex-col items-center justify-center flex-1 px-2 pb-1.5">
                      <VisibilityOffIcon style={{ fontSize: 14 }} className="text-slate-300 mb-0.5" />
                      <span className="text-[10px] text-slate-400 italic">All tasks hidden</span>
                    </div>
                  )}
                </div>

                {/* Tasks Column - only show when not collapsed AND has visible tasks */}
                {!isCollapsed && visibleTasks.length > 0 && (
                  <div className="flex flex-col bg-white">
                    {team.tasks.map((task_key, taskIndex) => {
                      if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
                      
                      const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
                      const isSmall = taskDisplaySettings[task_key]?.size === 'small';
                      const visibleTaskIndex = visibleTasks.indexOf(task_key);
                      const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
                      
                      return (
                        <div
                          className="border-l border-slate-200 flex w-full items-center hover:bg-slate-50/50 transition-colors"
                          style={{
                            height: `${taskHeight}px`,
                            width: `${TASKWIDTH}px`,
                            borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                            opacity: taskGhost?.taskKey === task_key ? 0.3 : 1,
                          }}
                          key={`${task_key}_container`}
                        >
                          {/* Drag Handle */}
                          <div
                            onMouseDown={(e) => {
                              if (mode === "drag") {
                                handleTaskDrag(e, task_key, team_key, visibleTaskIndex);
                              }
                            }}
                            className={`flex-shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors`}
                            style={{ width: '28px', height: '100%' }}
                            title="Drag to reorder task"
                          >
                            <DragIndicatorIcon style={{ fontSize: isSmall ? 12 : 14 }} />
                          </div>

                          {/* Task Name (click to navigate) */}
                          <div
                            className={`flex-1 h-full flex items-center min-w-0 cursor-pointer`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${projectId}/tasks/${task_key}`);
                            }}
                          >
                            <span
                              className={`truncate hover:text-blue-600 hover:underline transition-colors text-slate-600 ${isSmall ? 'text-xs' : 'text-sm'}`}
                              title={`Go to ${tasks[task_key]?.name} detail page`}
                            >
                              {tasks[task_key]?.name}
                            </span>
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

                {/* Empty tasks column placeholder */}
                {!isCollapsed && visibleTasks.length === 0 && (
                  <div
                    className="border-l border-slate-200 flex flex-col items-center justify-center"
                    style={{
                      width: `${TASKWIDTH}px`,
                      height: `${teamHeight}px`,
                      backgroundColor: hasNoTasks ? 'rgba(241,245,249,0.6)' : 'rgba(241,245,249,0.4)',
                      borderLeft: hasNoTasks ? '2px dashed #cbd5e1' : '1px solid #e2e8f0',
                    }}
                  >
                    {hasNoTasks ? (
                      <span className="text-[10px] text-slate-400 italic">No tasks yet</span>
                    ) : (
                      <>
                        <VisibilityOffIcon style={{ fontSize: 14 }} className="text-slate-300 mb-0.5" />
                        <span className="text-[10px] text-slate-400 italic">All hidden</span>
                      </>
                    )}
                  </div>
                )}

                {/* Collapsed team placeholder */}
                {isCollapsed && (
                  <div
                    className="border-l border-slate-200 flex items-center px-2 bg-slate-50/50"
                    style={{
                      width: `${TASKWIDTH}px`,
                      height: `${teamHeight}px`,
                    }}
                  >
                    <span className="text-[10px] text-slate-400 italic">
                      {team.tasks.length} task{team.tasks.length !== 1 ? 's' : ''} (collapsed)
                    </span>
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

      {/* Hidden Teams Banner */}
      {hiddenTeamCount > 0 && (
        <div className="flex items-center justify-center py-2 text-xs text-slate-500">
          <button
            onClick={showAllHiddenTeams}
            className="hover:text-blue-600 hover:underline transition-colors"
          >
            {hiddenTeamCount} hidden team{hiddenTeamCount !== 1 ? 's' : ''} — click to show all
          </button>
        </div>
      )}
    </>
  );
}
