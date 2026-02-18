export default function DependencyDayGrid({
  isCollapsed,
  teamHeight,
  rawHeight,
  teamTasks,
  visibleTasks,
  team_key,
  days,
  dayLabels,
  DAYWIDTH,
  ghost,
  isAddingMilestone,
  hoveredDayCell,
  taskDisplaySettings,
  isTaskVisible,
  getTaskHeight,
  setHoveredDayCell,
  handleDayCellClick,
  tasks,
  onSetDeadline,
}) {
  return (
    <>
      {/* SCROLLABLE RIGHT: Milestones/Days - day grid with interactive cells in milestone mode */}
      {!isCollapsed && (
        <div
          className="border-y border-slate-200"
          style={{ height: `${teamHeight}px`, backgroundColor: '#fafbfc' }}
        >
          {teamTasks.map((task_key, taskIndex) => {
            if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
            
            const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
            const visibleTaskIndex = visibleTasks.indexOf(task_key);
            const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
            const taskDeadline = tasks?.[task_key]?.hard_deadline;
            
            return (
              <div
                className="flex relative"
                style={{
                  height: `${taskHeight}px`,
                  borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                }}
                key={`${task_key}_milestone`}
              >
                {/* Day rendering - interactive when adding milestone */}
                {[...Array(days)].map((_, i) => {
                  const isHovered = isAddingMilestone && 
                    hoveredDayCell?.taskId === task_key && 
                    hoveredDayCell?.dayIndex === i;
                  const dayInfo = dayLabels && dayLabels[i];
                  const hasPurpose = !!dayInfo?.purpose;
                  const purposeTeams = dayInfo?.purposeTeams;
                  // Highlight only if purpose exists AND (applies to all teams or this team)
                  const showPurposeHighlight = hasPurpose && (
                    purposeTeams === null || purposeTeams === undefined || 
                    (Array.isArray(purposeTeams) && purposeTeams.includes(team_key))
                  );
                  // Hard deadline: mark days after the deadline
                  const isPastDeadline = taskDeadline !== null && taskDeadline !== undefined && i > taskDeadline;
                  const isDeadlineDay = taskDeadline !== null && taskDeadline !== undefined && i === taskDeadline;
                  
                  return (
                    <div
                      data-dep-day-index={i}
                      data-dep-day-task-id={task_key}
                      data-dep-day-task-name={tasks?.[task_key]?.name || ''}
                      data-dep-day-team-id={team_key}
                      data-dep-day-label={dayInfo?.dateStr || ''}
                      data-dep-day-weekday={dayInfo?.dayNameShort || ''}
                      className={`dep-day-cell border-r border-slate-100 transition-colors ${
                        isAddingMilestone ? 'cursor-pointer hover:bg-blue-50' : ''
                      } ${isHovered ? 'bg-blue-100' : ''}`}
                      style={{
                        height: `${taskHeight}px`,
                        width: `${DAYWIDTH}px`,
                        opacity: ghost?.id === team_key ? 0.2 : 1,
                        pointerEvents: isAddingMilestone ? 'auto' : 'auto',
                        ...(!isHovered && showPurposeHighlight && !isPastDeadline ? { backgroundColor: 'rgba(30, 41, 59, 0.06)' } : {}),
                        ...(isPastDeadline ? { backgroundColor: 'rgba(15, 23, 42, 0.12)', backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(15,23,42,0.04) 3px, rgba(15,23,42,0.04) 6px)' } : {}),
                        ...(isDeadlineDay ? { borderRight: '2.5px solid #ef4444' } : {}),
                      }}
                      key={i}
                    onMouseEnter={() => isAddingMilestone && setHoveredDayCell({ taskId: task_key, dayIndex: i })}
                    onMouseLeave={() => setHoveredDayCell(null)}
                    onClick={(e) => {
                      if (isAddingMilestone) {
                        e.stopPropagation();
                        handleDayCellClick(task_key, i);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onSetDeadline) {
                        // Right-click to set deadline at this day for this task
                        const currentDeadline = tasks?.[task_key]?.hard_deadline;
                        if (currentDeadline === i) {
                          // Clicking on current deadline clears it
                          onSetDeadline(task_key, null);
                        } else {
                          onSetDeadline(task_key, i);
                        }
                      }
                    }}
                  />
                );
              })}
            </div>
          );
        })}
        
        {/* Empty placeholder when all tasks hidden or team is empty */}
        {rawHeight === 0 && teamHeight > 0 && (
          <div
            className="flex"
            style={{ height: `${teamHeight}px` }}
          >
            {[...Array(days)].map((_, i) => (
              <div
                className="border-r border-dashed border-slate-200"
                style={{
                  height: `${teamHeight}px`,
                  width: `${DAYWIDTH}px`,
                  opacity: 0.4,
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(148,163,184,0.06) 8px, rgba(148,163,184,0.06) 16px)',
                }}
                key={i}
              />
            ))}
          </div>
        )}
      </div>
      )}
      
      {/* Empty day grid placeholder for collapsed teams */}
      {isCollapsed && (
        <div
          className="border-y border-slate-200 bg-slate-50"
          style={{ height: `${teamHeight}px` }}
        />
      )}
    </>
  );
}
