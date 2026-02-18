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
  // Day column layout
  dayColumnLayout,
  collapsedDays = new Set(),
  selectedDays = new Set(),
  phases = [],
  showPhaseColorsInGrid = true,
}) {
  const totalDaysWidth = dayColumnLayout?.totalDaysWidth ?? (days || 0) * DAYWIDTH;

  // Build a lookup: dayIndex → phase color (first matching phase wins)
  // Only include phases that apply to this team (global phases or phases assigned to this team)
  const phaseColorMap = {};
  if (showPhaseColorsInGrid && phases.length > 0) {
    const teamIdNum = typeof team_key === 'string' ? parseInt(team_key, 10) : team_key;
    for (const phase of phases) {
      // Phase applies if: no team (global) OR phase.team matches this team
      const phaseTeam = phase.team;
      if (phaseTeam !== null && phaseTeam !== undefined && phaseTeam !== teamIdNum) continue;
      for (let d = phase.start_index; d < phase.start_index + phase.duration; d++) {
        if (!(d in phaseColorMap)) {
          phaseColorMap[d] = phase.color || '#3b82f6';
        }
      }
    }
  }

  return (
    <>
      {/* SCROLLABLE RIGHT: Milestones/Days - day grid with interactive cells in milestone mode */}
      {!isCollapsed && (
        <div
          className="border-y border-slate-200 relative"
          style={{ height: `${teamHeight}px`, width: `${totalDaysWidth}px`, backgroundColor: '#fafbfc' }}
        >
          {teamTasks.map((task_key, taskIndex) => {
            if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
            
            const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
            const visibleTaskIndex = visibleTasks.indexOf(task_key);
            const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
            const taskDeadline = tasks?.[task_key]?.hard_deadline;

            // Calculate Y offset for this task row
            let taskYOffset = 0;
            for (let vi = 0; vi < visibleTaskIndex; vi++) {
              taskYOffset += getTaskHeight(visibleTasks[vi], taskDisplaySettings);
            }
            
            return (
              <div
                className="relative"
                style={{
                  position: 'absolute',
                  top: `${taskYOffset}px`,
                  left: 0,
                  width: `${totalDaysWidth}px`,
                  height: `${taskHeight}px`,
                  borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                }}
                key={`${task_key}_milestone`}
              >
                {/* Day rendering - use absolute positioning with dayColumnLayout */}
                {[...Array(days)].map((_, i) => {
                  const isDayCollapsed = collapsedDays.has(i);
                  const isDaySelected = selectedDays.has(i);
                  const colX = dayColumnLayout?.dayXOffset(i) ?? (i * DAYWIDTH);
                  const colW = dayColumnLayout?.dayWidth(i) ?? DAYWIDTH;

                  if (isDayCollapsed) {
                    // Thin collapsed column indicator
                    return (
                      <div
                        key={i}
                        className="absolute top-0"
                        style={{
                          left: `${colX}px`,
                          width: `${colW}px`,
                          height: `${taskHeight}px`,
                          backgroundColor: '#94a3b8',
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.25) 2px, rgba(255,255,255,0.25) 4px)',
                          opacity: ghost?.id === team_key ? 0.2 : 0.7,
                        }}
                      />
                    );
                  }

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
                  const phaseColor = phaseColorMap[i];

                  // Compute background: priority is deadline > purpose > selected > phase > default
                  let cellBg = {};
                  if (!isHovered) {
                    if (isPastDeadline) {
                      cellBg = { backgroundColor: 'rgba(15, 23, 42, 0.12)', backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(15,23,42,0.04) 3px, rgba(15,23,42,0.04) 6px)' };
                    } else if (showPurposeHighlight) {
                      cellBg = { backgroundColor: isDaySelected ? 'rgba(30, 41, 59, 0.10)' : 'rgba(30, 41, 59, 0.06)' };
                    } else if (isDaySelected) {
                      cellBg = { backgroundColor: phaseColor ? `${phaseColor}22` : 'rgba(59, 130, 246, 0.08)' };
                    } else if (phaseColor) {
                      cellBg = { backgroundColor: `${phaseColor}14` }; // subtle but visible tint
                    }
                  }
                  
                  return (
                    <div
                      data-dep-day-index={i}
                      data-dep-day-task-id={task_key}
                      data-dep-day-task-name={tasks?.[task_key]?.name || ''}
                      data-dep-day-team-id={team_key}
                      data-dep-day-label={dayInfo?.dateStr || ''}
                      data-dep-day-weekday={dayInfo?.dayNameShort || ''}
                      className={`dep-day-cell absolute top-0 border-r border-slate-100 transition-colors ${
                        isAddingMilestone ? 'cursor-pointer hover:bg-blue-50' : ''
                      } ${isHovered ? 'bg-blue-100' : ''}`}
                      style={{
                        left: `${colX}px`,
                        width: `${colW}px`,
                        height: `${taskHeight}px`,
                        opacity: ghost?.id === team_key ? 0.2 : 1,
                        pointerEvents: isAddingMilestone ? 'auto' : 'auto',
                        ...cellBg,
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
                        const currentDeadline = tasks?.[task_key]?.hard_deadline;
                        if (currentDeadline === i) {
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
            className="relative"
            style={{ height: `${teamHeight}px`, width: `${totalDaysWidth}px` }}
          >
            {[...Array(days)].map((_, i) => {
              if (collapsedDays.has(i)) return null;
              const colX = dayColumnLayout?.dayXOffset(i) ?? (i * DAYWIDTH);
              const colW = dayColumnLayout?.dayWidth(i) ?? DAYWIDTH;
              return (
                <div
                  className="absolute top-0 border-r border-dashed border-slate-200"
                  style={{
                    left: `${colX}px`,
                    height: `${teamHeight}px`,
                    width: `${colW}px`,
                    opacity: 0.4,
                    background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(148,163,184,0.06) 8px, rgba(148,163,184,0.06) 16px)',
                  }}
                  key={i}
                />
              );
            })}
          </div>
        )}
      </div>
      )}
      
      {/* Empty day grid placeholder for collapsed teams */}
      {isCollapsed && (
        <div
          className="border-y border-slate-200 bg-slate-50"
          style={{ height: `${teamHeight}px`, width: `${totalDaysWidth}px` }}
        />
      )}
    </>
  );
}
