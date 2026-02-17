export default function DependencyDayGrid({
  isCollapsed,
  teamHeight,
  rawHeight,
  teamTasks,
  visibleTasks,
  team_key,
  days,
  DAYWIDTH,
  ghost,
  isAddingMilestone,
  hoveredDayCell,
  taskDisplaySettings,
  isTaskVisible,
  getTaskHeight,
  setHoveredDayCell,
  handleDayCellClick,
}) {
  return (
    <>
      {/* SCROLLABLE RIGHT: Milestones/Days - day grid with interactive cells in milestone mode */}
      {!isCollapsed && (
        <div
          className="border-y border-slate-200 bg-white"
          style={{ height: `${teamHeight}px` }}
        >
          {teamTasks.map((task_key, taskIndex) => {
            if (!isTaskVisible(task_key, taskDisplaySettings)) return null;
            
            const taskHeight = getTaskHeight(task_key, taskDisplaySettings);
            const visibleTaskIndex = visibleTasks.indexOf(task_key);
            const isLastVisible = visibleTaskIndex === visibleTasks.length - 1;
            
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
                  
                  return (
                    <div
                      className={`border-r border-slate-100 transition-colors ${
                        isAddingMilestone ? 'cursor-pointer hover:bg-blue-50' : ''
                      } ${isHovered ? 'bg-blue-100' : ''}`}
                      style={{
                        height: `${taskHeight}px`,
                        width: `${DAYWIDTH}px`,
                        opacity: ghost?.id === team_key ? 0.2 : 1,
                        pointerEvents: isAddingMilestone ? 'auto' : 'none',
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
