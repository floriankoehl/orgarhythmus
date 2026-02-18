import AddIcon from '@mui/icons-material/Add';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import DependencyDayGrid from './DependencyDayGrid';
import { TEAM_PHASE_ROW_HEIGHT } from '../../pages/dependency/layoutMath';
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
  dayLabels,
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
  // Refactor mode
  refactorMode,
  handleRefactorDrag,
  // Deadline
  onSetDeadline,
  // Day column layout
  dayColumnLayout,
  collapsedDays,
  selectedDays,
  // Phases in grid
  phases = [],
  showPhaseColorsInGrid = true,
  // Team phase rows
  teamPhasesMap = {},
  getTeamPhaseRowHeight,
  collapsedTeamPhaseRows = new Set(),
  setCollapsedTeamPhaseRows,
  setPhaseEditModal,
  handlePhaseEdgeResize,
  handlePhaseDrag,
  totalDaysWidth,
  collapsePhaseRange,
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
        const isVirtual = !!team._virtual;
        const hasNoTasks = team.tasks.length === 0;
        const allTasksHidden = team.tasks.length > 0 && visibleTasks.length === 0;
        // Phase row height for this team (part of teamHeight, rendered separately)
        const phaseRowH = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(team_key) : 0;
        const teamRowHeight = teamHeight - phaseRowH;

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
                ...(isVirtual ? { backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.5) 6px, rgba(255,255,255,0.5) 12px)' } : {}),
              }}
            />

            {/* Per-team Phase Row (only if team has team-specific phases and row is expanded) */}
            {(() => {
              const teamIdNum = typeof team_key === 'string' ? parseInt(team_key, 10) : team_key;
              const teamPhases = teamPhasesMap[teamIdNum] || [];
              if (teamPhases.length === 0 || phaseRowH === 0) return null;
              return (
                <div className="flex" style={{ height: `${TEAM_PHASE_ROW_HEIGHT}px` }}>
                  {/* Sticky left label */}
                  <div
                    className="flex items-center border-r border-slate-200"
                    style={{
                      width: `${TEAMWIDTH + TASKWIDTH}px`,
                      height: `${TEAM_PHASE_ROW_HEIGHT}px`,
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      backgroundColor: 'rgba(248,250,252,0.97)',
                    }}
                  >
                    <button
                      onClick={() => {
                        if (!setCollapsedTeamPhaseRows) return;
                        setCollapsedTeamPhaseRows(prev => {
                          const next = new Set(prev);
                          if (next.has(teamIdNum)) next.delete(teamIdNum);
                          else next.add(teamIdNum);
                          return next;
                        });
                      }}
                      className="flex items-center gap-0.5 px-1 text-[9px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors truncate"
                      style={{ height: '100%' }}
                      title="Hide team phases"
                    >
                      <ArrowRightIcon
                        style={{
                          fontSize: 12,
                          transform: 'rotate(90deg)',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                      <span className="truncate">Phases</span>
                    </button>
                  </div>
                  {/* Phase bars area */}
                  <div className="relative" style={{ width: `${totalDaysWidth || 0}px`, height: `${TEAM_PHASE_ROW_HEIGHT}px` }}>
                    {teamPhases.map((phase) => {
                      const phaseX = dayColumnLayout?.dayXOffset(phase.start_index) ?? (phase.start_index * DAYWIDTH);
                      const endIdx = phase.start_index + phase.duration;
                      const phaseEndX = endIdx < days
                        ? (dayColumnLayout?.dayXOffset(endIdx) ?? (endIdx * DAYWIDTH))
                        : (totalDaysWidth || days * DAYWIDTH);
                      const phaseW = phaseEndX - phaseX;
                      if (phaseW <= 0) return null;
                      return (
                        <div
                          key={phase.id}
                          className="absolute top-0 flex items-center justify-center cursor-pointer hover:brightness-110 transition-all group/tphase"
                          style={{
                            left: `${phaseX}px`,
                            width: `${phaseW}px`,
                            height: `${TEAM_PHASE_ROW_HEIGHT}px`,
                            backgroundColor: phase.color || '#3b82f6',
                            color: '#fff',
                            borderRadius: '0 0 3px 3px',
                            fontSize: '9px',
                            fontWeight: 600,
                          }}
                          title={`${phase.name} — days ${phase.start_index + 1}–${phase.start_index + phase.duration} — double-click to edit, drag to move, drag edges to resize`}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (handlePhaseDrag) handlePhaseDrag(e, phase.id);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (setPhaseEditModal) setPhaseEditModal({ ...phase, mode: 'edit' });
                          }}
                        >
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 w-[5px] h-full cursor-col-resize opacity-0 group-hover/tphase:opacity-100 transition-opacity z-10"
                            style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.5), transparent)' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (handlePhaseEdgeResize) handlePhaseEdgeResize(e, phase.id, 'left');
                            }}
                          />
                          <span className="truncate px-1">{phase.name}</span>
                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 w-[5px] h-full cursor-col-resize opacity-0 group-hover/tphase:opacity-100 transition-opacity z-10"
                            style={{ background: 'linear-gradient(270deg, rgba(255,255,255,0.5), transparent)' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (handlePhaseEdgeResize) handlePhaseEdgeResize(e, phase.id, 'right');
                            }}
                          />
                          {/* Collapse phase range button */}
                          {collapsePhaseRange && (
                            <div
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/tphase:opacity-100 transition-opacity z-20 cursor-pointer"
                              title={`Collapse days ${phase.start_index + 1}–${phase.start_index + phase.duration}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                collapsePhaseRange(phase);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="7 13 12 18 17 13" />
                                <polyline points="7 6 12 11 17 6" />
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

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
                  height: `${teamRowHeight}px`,
                  opacity: ghost?.id === team_key ? 0.3 : 1,
                  backgroundColor: 'white',
                }}
              >
                {/* Team Name Column */}
                <div
                  data-dep-team-id={team_key}
                  data-dep-team-name={team.name}
                  data-dep-team-color={teamColor}
                  className={`flex flex-col items-center justify-start border-r border-b border-slate-200 ${isVirtual ? '' : 'cursor-grab-visible'} ${
                    refactorMode && !isVirtual ? 'ring-2 ring-orange-300 ring-inset' : ''
                  }`}
                  style={{
                    width: `${TEAMWIDTH}px`,
                    height: `${teamRowHeight}px`,
                    backgroundColor: isVirtual ? '#f1f5f9' : lightenColor(teamColor, 0.92),
                    ...(isVirtual ? { borderLeft: '2px dashed #94a3b8' } : {}),
                  }}
                  onMouseDown={(e) => {
                    // Don't initiate drag if clicking on interactive elements
                    if (e.target.closest('[data-no-drag]')) return;
                    // Virtual teams cannot be dragged or refactored
                    if (isVirtual) return;
                    if (refactorMode) {
                      handleRefactorDrag(e, "team", {
                        id: team_key,
                        name: team.name,
                        color: teamColor,
                        taskIds: team.tasks || [],
                      });
                      return;
                    }
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
                      className={`text-sm font-medium truncate flex-1 ${isVirtual ? 'italic text-slate-400' : ''}`}
                      title={team.name}
                    >
                      {team.name}
                    </span>
                    {/* Link to team detail page - not for virtual teams */}
                    {!isVirtual && (
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
                    )}
                    {!isVirtual && (
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
                    )}
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
                  <div className="flex flex-col border-r border-slate-200" style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}>
                    {team.tasks.map((task_key, taskIndex) => {
                      if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
                      
                      const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
                      const isSmall = taskDisplaySettings[task_key]?.size === 'small';
                      const visibleTaskIndex = visibleTasks.indexOf(task_key);
                      const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
                      
                      return (
                        <div
                          data-dep-task-id={task_key}
                          data-dep-task-name={tasks[task_key]?.name}
                          data-dep-team-id={team_key}
                          data-dep-team-name={team.name}
                          data-dep-team-color={teamColor}
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
                              if (refactorMode) {
                                handleRefactorDrag(e, "task", {
                                  id: task_key,
                                  name: tasks[task_key]?.name,
                                  description: tasks[task_key]?.description || "",
                                  milestones: tasks[task_key]?.milestones || [],
                                  teamId: team_key,
                                  teamName: team.name,
                                  teamColor: teamColor,
                                });
                                return;
                              }
                              if (mode === "drag") {
                                handleTaskDrag(e, task_key, team_key, visibleTaskIndex);
                              }
                            }}
                            className={`flex-shrink-0 flex items-center justify-center cursor-grab-visible text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors`}
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
                      height: `${teamRowHeight}px`,
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
                    className="border-l border-r border-slate-200 flex items-center px-2"
                    style={{
                      width: `${TASKWIDTH}px`,
                      height: `${teamRowHeight}px`,
                      backgroundColor: 'rgba(248,250,252,0.97)',
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
                teamHeight={teamRowHeight}
                rawHeight={rawHeight}
                teamTasks={team.tasks}
                visibleTasks={visibleTasks}
                team_key={team_key}
                days={days}
                dayLabels={dayLabels}
                DAYWIDTH={DAYWIDTH}
                ghost={ghost}
                isAddingMilestone={isAddingMilestone}
                hoveredDayCell={hoveredDayCell}
                taskDisplaySettings={taskDisplaySettings}
                isTaskVisible={isTaskVisible}
                getTaskHeight={getTaskHeight}
                setHoveredDayCell={setHoveredDayCell}
                handleDayCellClick={handleDayCellClick}
                tasks={tasks}
                onSetDeadline={onSetDeadline}
                dayColumnLayout={dayColumnLayout}
                collapsedDays={collapsedDays}
                selectedDays={selectedDays}
                phases={phases}
                showPhaseColorsInGrid={showPhaseColorsInGrid}
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
