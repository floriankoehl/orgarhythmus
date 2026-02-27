import DependencyMilestoneLayer from './DependencyMilestoneLayer';
import DependencyTeamList from './DependencyTeamList';
import { useDependency } from '../../pages/dependency/DependencyContext.jsx';
import {
  getConnectionPath,
  getStraightPath,
  lightenColor,
  isTaskVisible,
  HEADER_HEIGHT,
  TASK_DROP_INDICATOR_HEIGHT,
  DAY_NAME_WIDTH_THRESHOLD,
} from '../../pages/dependency/layoutMath';

const PHASE_HEADER_HEIGHT = 26;

export default function DependencyCanvas({
  // Refs
  teamContainerRef,
  // Scalar dimensions (not grouped — used directly in outer container styles)
  days,
  contentHeight,
  // ── Structured controller objects ────────────────────────────────────────
  //
  //  layout       — layout helpers (functions) + display constants
  //  data         — core domain data
  //  displayState — all display / UI state values
  //  handlers     — event handlers and state setters
  //
  layout = {},
  data = {},
  displayState = {},
  handlers = {},
}) {
  // ── Destructure layout ──────────────────────────────────────────────────
  const {
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
    getTeamPhaseRowHeight,
    TEAMWIDTH,
    TASKWIDTH,
    DAYWIDTH,
    COLLAPSED_DAY_WIDTH = 6,
    TEAM_DRAG_HIGHLIGHT_HEIGHT,
    MARIGN_BETWEEN_DRAG_HIGHLIGHT,
    TEAM_HEADER_LINE_HEIGHT,
    TEAM_HEADER_GAP,
    dayColumnLayout,
  } = layout;

  // ── Destructure data ────────────────────────────────────────────────────
  const {
    teamOrder,
    teams,
    tasks,
    milestones,
    connections,
    dayLabels,
    phases = [],
    teamPhasesMap = {},
  } = data;

  // ── Destructure displayState ────────────────────────────────────────────
  const {
    taskDisplaySettings,
    teamDisplaySettings,
    hideAllDependencies,
    hideCollapsedDependencies,
    hideCollapsedMilestones,
    selectedDays = new Set(),
    collapsedDays = new Set(),
    hoveredMilestone,
    selectedMilestones,
    selectedConnections,
    editingMilestoneId,
    editingMilestoneName,
    blockedMoveHighlight,
    viewMode,
    mode,
    safeMode,
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
    refactorMode,
    expandedTaskView,
    depSettings = {},
    showPhaseColorsInGrid = true,
    collapsedTeamPhaseRows = new Set(),
    hideGlobalPhases = false,
    hideDayHeader = false,
    marqueeRect,
  } = displayState;

  // ── Destructure handlers ────────────────────────────────────────────────
  const {
    handleDayHeaderClick,
    handleTeamDrag,
    handleTaskDrag,
    handleConnectionClick,
    handleMileStoneMouseDown,
    handleMilestoneClick,
    handleMilestoneEdgeResize,
    handleConnectionDragStart,
    handleMilestoneRenameSubmit,
    handleDayCellClick,
    toggleTaskSize,
    toggleTaskVisibility,
    toggleTeamCollapsed,
    addMilestoneLocal,
    showAllHiddenTeams,
    toggleTeamVisibility,
    handleColumnResize,
    setHoveredMilestone,
    setEditingMilestoneName,
    setEditingMilestoneId,
    setDeleteConfirmModal,
    setOpenTeamSettings,
    setHoveredDayCell,
    handleMarqueeStart,
    handleRefactorDrag,
    onSetDeadline,
    setConnectionEditModal,
    setPhaseEditModal,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    setCollapsedTeamPhaseRows,
    collapsePhaseRange,
    focusOnPhase,
    onDaySelect,
    onUncollapseDays,
  } = handlers;

  // Task multi-select from context
  const { selectedTasks, setSelectedTasks } = useDependency();

  const hasPhases = phases.length > 0;
  const globalPhases = phases.filter(p => p.team == null);
  const hasGlobalPhases = globalPhases.length > 0;
  const showGlobalPhases = hasGlobalPhases && !hideGlobalPhases;
  const showDayHeader = !hideDayHeader;
  const totalHeaderHeight = (showDayHeader ? HEADER_HEIGHT : 0) + (showGlobalPhases ? PHASE_HEADER_HEIGHT : 0);
  const totalDaysWidth = dayColumnLayout?.totalDaysWidth ?? (days || 0) * DAYWIDTH;
  const totalWidth = TEAMWIDTH + TASKWIDTH + totalDaysWidth;
  return (
    <>
      {/* Scroll container - wrapper to flip scrollbar to top */}
      <div
        style={{ height: `${contentHeight + 16}px`, transform: 'scaleY(-1)' }}
        className="overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 shadow-sm dep-scroll"
        onWheel={(e) => {
          if (e.shiftKey && e.deltaY !== 0) {
            e.preventDefault();
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        {/* Inner container - flip back to normal */}
        <div
          ref={teamContainerRef}
          onMouseDown={(e) => {
            // Only trigger marquee in the day-grid area and not on milestones
            if (e.target.closest('[data-milestone]')) return;
            // Use scroll container's viewport rect so sticky columns are respected
            const scrollContainer = teamContainerRef.current?.parentElement;
            if (!scrollContainer) return;
            const scrollContainerRect = scrollContainer.getBoundingClientRect();
            const clickXInViewport = e.clientX - scrollContainerRect.left;
            if (clickXInViewport > TEAMWIDTH + TASKWIDTH) {
              handleMarqueeStart?.(e);
            }
          }}
          style={{
            width: `${totalWidth}px`,
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
          </div>

          {/* Team Ghost — full-width row */}
          {ghost && (() => {
            const ghostTop = ghost.y - ghost.offsetY;
            // Build task Y offset map within the ghost
            const taskYMap = {};
            let cumTaskY = 0;
            const phaseRowH = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(ghost.id) : 0;
            for (const tid of (ghost.teamTasks || [])) {
              taskYMap[tid] = cumTaskY;
              cumTaskY += getTaskHeight(tid, taskDisplaySettings);
            }
            return (
              <div
                className="pointer-events-none absolute"
                style={{
                  top: `${ghostTop}px`,
                  left: 0,
                  height: `${ghost.height}px`,
                  width: `${totalWidth}px`,
                  zIndex: 100,
                  opacity: 0.8,
                  border: '2px dashed #1e293b',
                  borderRadius: '4px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                }}
              >
                {/* Team color background */}
                <div style={{ position: 'absolute', inset: 0, backgroundColor: ghost.color, opacity: 0.35 }} />
                {/* Team name */}
                <div
                  className="text-sm font-bold text-slate-900 flex items-start"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${TEAMWIDTH}px`,
                    height: '100%',
                    backgroundColor: ghost.color,
                    padding: '6px 8px',
                    borderRight: '1px solid rgba(0,0,0,0.15)',
                  }}
                >
                  {ghost.name}
                </div>
                {/* Task names column */}
                <div style={{ position: 'absolute', left: `${TEAMWIDTH}px`, top: `${phaseRowH}px`, width: `${TASKWIDTH}px`, height: `${ghost.height - phaseRowH}px`, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
                  {(ghost.teamTasks || []).map(tid => {
                    const t = tasks[tid];
                    if (!t) return null;
                    const th = getTaskHeight(tid, taskDisplaySettings);
                    return (
                      <div key={tid} className="flex items-center px-2 text-xs text-slate-700 truncate" style={{ height: `${th}px`, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        {t.name}
                      </div>
                    );
                  })}
                </div>
                {/* Milestone indicators in day grid */}
                {(ghost.milestones || []).map(m => {
                  const mStartX = dayColumnLayout?.dayXOffset?.(m.start_index);
                  if (mStartX === undefined) return null;
                  const dur = m.duration || 1;
                  let mW = 0;
                  for (let d = 0; d < dur; d++) {
                    mW += dayColumnLayout?.dayWidth?.(m.start_index + d) ?? DAYWIDTH;
                  }
                  if (!mW) mW = DAYWIDTH;
                  const mX = TEAMWIDTH + TASKWIDTH + mStartX;
                  const th = getTaskHeight(m.task, taskDisplaySettings);
                  const mY = phaseRowH + (taskYMap[m.task] ?? 0);
                  return (
                    <div
                      key={m.id}
                      className="absolute rounded-sm flex items-center overflow-hidden"
                      style={{
                        left: `${mX}px`,
                        top: `${mY + 2}px`,
                        width: `${mW}px`,
                        height: `${th - 4}px`,
                        backgroundColor: ghost.color,
                        border: '1px solid rgba(0,0,0,0.3)',
                        opacity: 0.7,
                      }}
                    >
                      <span className="truncate text-[10px] px-1 text-white/90 font-medium" style={{ textShadow: '0 0 2px rgba(0,0,0,0.4)' }}>{m.name}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Header Row */}
          <div className="flex flex-col" style={{ height: `${totalHeaderHeight}px`, position: 'relative', zIndex: 50 }}>
            {/* Phase header row (only if GLOBAL phases exist and not hidden) */}
            {showGlobalPhases && (
              <div className="flex" style={{ height: `${PHASE_HEADER_HEIGHT}px` }}>
                <div
                  className="bg-slate-50 border-b border-r border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-400"
                  style={{
                    width: `${TEAMWIDTH + TASKWIDTH}px`,
                    height: `${PHASE_HEADER_HEIGHT}px`,
                    position: 'sticky',
                    left: 0,
                    zIndex: 51,
                  }}
                >
                  Phases
                </div>
                <div className="relative border-b border-slate-200" style={{ width: `${totalDaysWidth}px`, height: `${PHASE_HEADER_HEIGHT}px` }}>
                  {globalPhases.map((phase) => {
                    const phaseX = dayColumnLayout?.dayXOffset(phase.start_index) ?? (phase.start_index * DAYWIDTH);
                    const endIdx = phase.start_index + phase.duration;
                    const phaseEndX = endIdx < days
                      ? (dayColumnLayout?.dayXOffset(endIdx) ?? (endIdx * DAYWIDTH))
                      : totalDaysWidth;
                    const rawPhaseW = phaseEndX - phaseX;
                    if (rawPhaseW <= 0) return null;

                    // Check if all days in this phase are collapsed
                    let allDaysCollapsed = true;
                    for (let d = phase.start_index; d < endIdx; d++) {
                      if (!collapsedDays.has(d)) { allDaysCollapsed = false; break; }
                    }
                    // Ensure minimum width when all days are collapsed so toggle stays usable
                    const MIN_COLLAPSED_PHASE_W = 28;
                    const phaseW = allDaysCollapsed ? Math.max(rawPhaseW, MIN_COLLAPSED_PHASE_W) : rawPhaseW;

                    return (
                      <div
                        key={phase.id}
                        className="absolute top-0 flex items-center justify-center cursor-pointer hover:brightness-110 transition-all group/phase"
                        style={{
                          left: `${phaseX}px`,
                          width: `${phaseW}px`,
                          height: `${PHASE_HEADER_HEIGHT}px`,
                          backgroundColor: phase.color || '#3b82f6',
                          backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.18) 3px, rgba(255,255,255,0.18) 6px)',
                          color: '#fff',
                          borderRadius: '0 0 4px 4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          borderBottom: '2px solid rgba(0,0,0,0.15)',
                          zIndex: allDaysCollapsed ? 2 : undefined,
                        }}
                        title={`${phase.name}${phase.team ? ` (${teams?.[phase.team]?.name || 'Team'})` : ''} — days ${phase.start_index + 1}–${phase.start_index + phase.duration}${allDaysCollapsed ? ' (collapsed — click chevron to expand)' : ' — double-click to edit, drag to move, drag edges to resize'}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!allDaysCollapsed && handlePhaseDrag) handlePhaseDrag(e, phase.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (allDaysCollapsed) {
                            // When collapsed, double-click expands the phase
                            if (collapsePhaseRange) collapsePhaseRange(phase);
                          } else {
                            if (setPhaseEditModal) setPhaseEditModal({ ...phase, mode: 'edit' });
                          }
                        }}
                      >
                        {/* Left resize handle — hidden when all days collapsed */}
                        {!allDaysCollapsed && (
                        <div
                          className="absolute left-0 top-0 w-[6px] h-full cursor-col-resize opacity-0 group-hover/phase:opacity-100 transition-opacity z-10"
                          style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.5), transparent)' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (handlePhaseEdgeResize) handlePhaseEdgeResize(e, phase.id, 'left');
                          }}
                        />
                        )}
                        <span className="truncate px-1 flex items-center gap-0.5">
                          {!allDaysCollapsed && phase.name}
                          {!allDaysCollapsed && phase.team != null && <span className="opacity-60 ml-0.5 text-[8px]"> · {teams?.[phase.team]?.name || ''}</span>}
                          {/* Collapse/expand phase range button */}
                          {collapsePhaseRange && (
                            <span
                              className={`inline-flex items-center cursor-pointer flex-shrink-0 transition-opacity ${allDaysCollapsed ? 'opacity-100' : 'opacity-0 group-hover/phase:opacity-100'}`}
                              title={allDaysCollapsed ? `Expand days ${phase.start_index + 1}–${phase.start_index + phase.duration}` : `Collapse days ${phase.start_index + 1}–${phase.start_index + phase.duration}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                collapsePhaseRange(phase);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {allDaysCollapsed ? (
                                  <>
                                    <polyline points="7 11 12 6 17 11" />
                                    <polyline points="7 18 12 13 17 18" />
                                  </>
                                ) : (
                                  <>
                                    <polyline points="7 13 12 18 17 13" />
                                    <polyline points="7 6 12 11 17 6" />
                                  </>
                                )}
                              </svg>
                            </span>
                          )}
                          {/* Focus on phase button (collapse everything else) */}
                          {focusOnPhase && !allDaysCollapsed && (
                            <span
                              className="inline-flex items-center opacity-0 group-hover/phase:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                              title={`Focus: collapse all days except ${phase.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                focusOnPhase(phase);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <circle cx="12" cy="12" r="8" />
                              </svg>
                            </span>
                          )}
                        </span>
                        {/* Right resize handle — hidden when all days collapsed */}
                        {!allDaysCollapsed && (
                        <div
                          className="absolute right-0 top-0 w-[6px] h-full cursor-col-resize opacity-0 group-hover/phase:opacity-100 transition-opacity z-10"
                          style={{ background: 'linear-gradient(270deg, rgba(255,255,255,0.5), transparent)' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (handlePhaseEdgeResize) handlePhaseEdgeResize(e, phase.id, 'right');
                          }}
                        />
                        )}
                      </div>
                    );
                  })}
                  {/* Click empty space to add phase */}
                  <div
                    className="absolute inset-0"
                    style={{ zIndex: -1 }}
                    onDoubleClick={(e) => {
                      if (!setPhaseEditModal) return;
                      // Determine approximate day index from click position
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      let dayIdx = 0;
                      if (dayColumnLayout?.offsets) {
                        for (let i = 0; i < days; i++) {
                          if (dayColumnLayout.offsets[i] > clickX) break;
                          dayIdx = i;
                        }
                      }
                      setPhaseEditModal({ mode: 'create', start_index: dayIdx, duration: 7, name: '', color: '#3b82f6' });
                    }}
                  />
                </div>
              </div>
            )}

            {/* Day header row */}
            {showDayHeader && (
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
                  className="flex items-center justify-center border-r border-slate-300"
                  style={{ width: `${TEAMWIDTH}px`, position: 'relative' }}
                >
                  Team
                  {/* Resize divider: team column right edge */}
                  <div
                    onMouseDown={(e) => handleColumnResize('team', e)}
                    style={{
                      position: 'absolute',
                      right: -2,
                      top: 0,
                      width: '5px',
                      height: '100%',
                      cursor: 'col-resize',
                      zIndex: 60,
                    }}
                    className="hover:bg-blue-400/40 transition-colors"
                  />
                </div>
                <div
                  className="flex items-center justify-center border-r border-slate-300"
                  style={{ width: `${TASKWIDTH}px`, position: 'relative' }}
                >
                  Tasks
                  {/* Resize divider: task column right edge */}
                  <div
                    onMouseDown={(e) => handleColumnResize('task', e)}
                    style={{
                      position: 'absolute',
                      right: -2,
                      top: 0,
                      width: '5px',
                      height: '100%',
                      cursor: 'col-resize',
                      zIndex: 60,
                    }}
                    className="hover:bg-blue-400/40 transition-colors"
                  />
                </div>
              </div>
              
              {/* Day Headers - Enhanced with dayColumnLayout */}
              <div className="relative border-b" style={{ width: `${totalDaysWidth}px` }}>
                {dayLabels.map((dayInfo, i) => {
                  const isCollapsed = collapsedDays.has(i);
                  const isSelected = selectedDays.has(i);
                  const colWidth = dayColumnLayout?.dayWidth(i) ?? DAYWIDTH;
                  const colX = dayColumnLayout?.dayXOffset(i) ?? (i * DAYWIDTH);
                  const hasPurpose = !!dayInfo.purpose;
                  const isTeamSpecific = hasPurpose && Array.isArray(dayInfo.purposeTeams) && dayInfo.purposeTeams.length > 0;
                  const isSunday = dayInfo.isSunday;
                  const showDayName = colWidth >= DAY_NAME_WIDTH_THRESHOLD;

                  if (isCollapsed) {
                    // Collapsed day indicator — thin bar with hover to uncollapse
                    // Detect collapsed range for this day
                    const range = dayColumnLayout?.collapsedRanges?.find(r => i >= r.start && i <= r.end);
                    const isRangeStart = range && i === range.start;
                    
                    return (
                      <div
                        key={i}
                        className="absolute top-0 group cursor-pointer"
                        style={{
                          left: `${colX}px`,
                          width: `${colWidth}px`,
                          height: `${HEADER_HEIGHT}px`,
                          backgroundColor: '#94a3b8',
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)',
                        }}
                        title={`Collapsed day${range ? `s ${range.start + 1}–${range.end + 1}` : ` ${i + 1}`} — click to expand`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (range && onUncollapseDays) {
                            const rangeIndices = [];
                            for (let d = range.start; d <= range.end; d++) rangeIndices.push(d);
                            onUncollapseDays(rangeIndices);
                          } else if (onUncollapseDays) {
                            onUncollapseDays([i]);
                          }
                        }}
                      >
                        {/* Expand indicator on first day of a collapsed range */}
                        {isRangeStart && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-amber-500/90 text-white text-[8px] font-bold" style={{ zIndex: 2 }}>
                            ⤢
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={i}
                      className={`absolute top-0 flex flex-col items-center justify-center text-xs border-r cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-200 text-blue-900 ring-1 ring-inset ring-blue-400'
                          : hasPurpose 
                            ? isTeamSpecific
                              ? 'bg-slate-600 text-white hover:bg-slate-500'
                              : 'bg-slate-800 text-white hover:bg-slate-700' 
                            : isSunday 
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                      style={{ 
                        left: `${colX}px`,
                        width: `${colWidth}px`,
                        height: `${HEADER_HEIGHT}px`,
                      }}
                      title={hasPurpose 
                        ? `${dayInfo.purpose}${isTeamSpecific ? ' (team-specific)' : ' (all teams)'} - Click to select, Double-click to edit` 
                        : 'Click to select, Double-click to edit purpose'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDaySelect?.(i, e);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleDayHeaderClick(i);
                      }}
                    >
                      {showDayName && (
                        <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-700' : hasPurpose ? 'text-slate-300' : isSunday ? 'text-purple-600' : 'text-slate-400'}`}>
                          {dayInfo.dayNameShort}
                        </span>
                      )}
                      <span className={`font-medium ${isSelected ? 'text-blue-900' : hasPurpose ? 'text-white' : ''}`}>
                        {dayInfo.dateStr}
                      </span>
                      {hasPurpose && colWidth >= 50 && (
                        <span className="text-[9px] truncate max-w-full px-1 text-slate-300">
                          {dayInfo.purpose}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            )}
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
            // Day column layout
            dayColumnLayout={dayColumnLayout}
            collapsedDays={collapsedDays}
            selectedDays={selectedDays}
            // State
            days={days}
            dayLabels={dayLabels}
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
            toggleTeamVisibility={toggleTeamVisibility}
            // Refactor mode
            refactorMode={refactorMode}
            handleRefactorDrag={handleRefactorDrag}
            // Deadline
            onSetDeadline={onSetDeadline}
            // Phases in grid
            phases={phases}
            showPhaseColorsInGrid={showPhaseColorsInGrid}
            // Team phase rows
            teamPhasesMap={teamPhasesMap}
            getTeamPhaseRowHeight={getTeamPhaseRowHeight}
            collapsedTeamPhaseRows={collapsedTeamPhaseRows}
            setCollapsedTeamPhaseRows={setCollapsedTeamPhaseRows}
            setPhaseEditModal={setPhaseEditModal}
            handlePhaseEdgeResize={handlePhaseEdgeResize}
            handlePhaseDrag={handlePhaseDrag}
            totalDaysWidth={totalDaysWidth}
            collapsePhaseRange={collapsePhaseRange}
            // Task multi-select
            selectedTasks={selectedTasks}
            setSelectedTasks={setSelectedTasks}
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
              const weight = conn.weight || 'strong';

              // Filter by weight visibility settings
              if (depSettings.hideSuggestions && weight === 'suggestion') return null;
              if (depSettings.filterWeights && depSettings.filterWeights.length > 0) {
                if (!depSettings.filterWeights.includes(weight)) return null;
              }

              const sourcePos = getMilestoneHandlePosition(conn.source, "source");
              const targetPos = getMilestoneHandlePosition(conn.target, "target");

              if (!sourcePos || !targetPos) return null;

              // Offset endpoints when their team/task is being dragged
              let srcY = sourcePos.y;
              let tgtY = targetPos.y;
              if (ghost) {
                const teamDragDelta = (ghost.y - ghost.offsetY) - ghost.teamYOffset;
                const sMil = milestones[conn.source];
                const tMil = milestones[conn.target];
                if (sMil && ghost.teamTasks?.includes(sMil.task)) srcY += teamDragDelta;
                if (tMil && ghost.teamTasks?.includes(tMil.task)) tgtY += teamDragDelta;
              }
              if (taskGhost) {
                const taskDragDelta = (taskGhost.y - taskGhost.offsetY) - taskGhost.taskTopY;
                const sMil = milestones[conn.source];
                const tMil = milestones[conn.target];
                if (sMil && sMil.task === taskGhost.taskKey) srcY += taskDragDelta;
                if (tMil && tMil.task === taskGhost.taskKey) tgtY += taskDragDelta;
              }

              // Hide connections when either endpoint's team is collapsed
              const sourceMilestone = milestones[conn.source];
              const targetMilestone = milestones[conn.target];
              if (sourceMilestone && targetMilestone) {
                // Hide connections whose milestones overlap collapsed days
                const sMil = sourceMilestone;
                const tMil = targetMilestone;
                const sOverlapsCollapsed = [...Array(sMil.duration || 1)].some((_, d) => collapsedDays.has(sMil.start_index + d));
                const tOverlapsCollapsed = [...Array(tMil.duration || 1)].some((_, d) => collapsedDays.has(tMil.start_index + d));
                if (sOverlapsCollapsed || tOverlapsCollapsed) return null;

                const sourceTaskId = sourceMilestone.task;
                const targetTaskId = targetMilestone.task;
                // Always hide for collapsed teams
                for (const tId of teamOrder) {
                  const t = teams[tId];
                  if (t && t.tasks.includes(sourceTaskId) && isTeamCollapsed(tId)) return null;
                  if (t && t.tasks.includes(targetTaskId) && isTeamCollapsed(tId)) return null;
                }
                // Optionally hide dependencies for collapsed (small) tasks
                if (hideCollapsedDependencies || hideCollapsedMilestones) {
                  const sourceTaskCollapsed = taskDisplaySettings[sourceTaskId]?.size === 'small';
                  const targetTaskCollapsed = taskDisplaySettings[targetTaskId]?.size === 'small';
                  if (sourceTaskCollapsed || targetTaskCollapsed) return null;
                }
              }

              const isSelected = selectedConnections?.some(sc => sc.source === conn.source && sc.target === conn.target);
              
              // Determine if this connection is related to any selected milestone
              const isOutgoing = depSettings.colorDirectionHighlight !== false && selectedMilestones.size > 0 && selectedMilestones.has(conn.source);
              const isIncoming = depSettings.colorDirectionHighlight !== false && selectedMilestones.size > 0 && selectedMilestones.has(conn.target);
              
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

              // Weight-based visual styling
              const useUniform = depSettings.uniformVisuals;
              let baseStrokeWidth, dashArray, opacity;
              if (useUniform) {
                baseStrokeWidth = 2.5;
                dashArray = "8, 4";
                opacity = 1;
              } else {
                switch (weight) {
                  case 'strong':
                    baseStrokeWidth = 3.5;
                    dashArray = "8, 4";
                    opacity = 1;
                    break;
                  case 'weak':
                    baseStrokeWidth = 2;
                    dashArray = "6, 6";
                    opacity = 0.85;
                    break;
                  case 'suggestion':
                    baseStrokeWidth = 1.5;
                    dashArray = "3, 6";
                    opacity = 0.55;
                    break;
                  default:
                    baseStrokeWidth = 2.5;
                    dashArray = "8, 4";
                    opacity = 1;
                }
              }

              const strokeWidth = isBlockedHighlight ? "5" : isHighlighted ? String(baseStrokeWidth + 1) : String(baseStrokeWidth);
              const pathId = `dep-path-${conn.source}-${conn.target}`;
              const pathD = getConnectionPath(sourcePos.x, srcY, targetPos.x, tgtY);

              // Reason label text
              const showReasons = depSettings.showReasons !== false;
              const reasonText = conn.reason || (showReasons ? "is necessary for" : null);

              return (
                <g key={`${conn.source}-${conn.target}`} style={{ pointerEvents: 'auto', opacity }}>
                  {/* Define the path for textPath reference */}
                  <defs>
                    <path id={pathId} d={pathD} />
                  </defs>
                  {/* Invisible wider path for easier clicking */}
                  <path
                    d={pathD}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => handleConnectionClick(e, conn)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (setConnectionEditModal) {
                        setConnectionEditModal({
                          source: conn.source,
                          target: conn.target,
                          weight: conn.weight || 'strong',
                          reason: conn.reason || '',
                          description: conn.description || '',
                        });
                      }
                    }}
                  />
                  {/* Visible animated path */}
                  <path
                    d={pathD}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={dashArray}
                    style={{
                      animation: isBlockedHighlight 
                        ? "flowAnimation 3s linear infinite, blockedPulse 0.5s ease-in-out infinite"
                        : weight === 'suggestion'
                          ? "none"
                          : "flowAnimation 3s linear infinite",
                      pointerEvents: "none",
                      filter: isHighlighted ? `drop-shadow(0 0 3px ${strokeColor}80)` : "none",
                    }}
                  />
                  {/* Reason text along path */}
                  {showReasons && reasonText && (
                    <text
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      fill={isHighlighted ? strokeColor : "#64748b"}
                      fontSize="10"
                      fontWeight={weight === 'strong' ? '600' : '400'}
                      dy="-6"
                    >
                      <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                        {reasonText}
                      </textPath>
                    </text>
                  )}
                  {/* Weight badge on hover/selected */}
                  {(isSelected || isHighlighted) && !useUniform && (
                    <text
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      fill={strokeColor}
                      fontSize="9"
                      fontWeight="700"
                      dy="14"
                      opacity="0.7"
                    >
                      <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                        {weight.toUpperCase()}
                      </textPath>
                    </text>
                  )}
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
            // Day column layout
            dayColumnLayout={dayColumnLayout}
            collapsedDays={collapsedDays}
            isTeamVisible={isTeamVisible}
            isTeamCollapsed={isTeamCollapsed}
            getVisibleTasks={getVisibleTasks}
            isTaskVisible={isTaskVisible}
            getTaskHeight={getTaskHeight}
            getTeamYOffset={getTeamYOffset}
            getTaskYOffset={getTaskYOffset}
            handleMileStoneMouseDown={handleMileStoneMouseDown}
            handleMilestoneClick={handleMilestoneClick}
            setHoveredMilestone={setHoveredMilestone}
            setEditingMilestoneName={setEditingMilestoneName}
            setEditingMilestoneId={setEditingMilestoneId}
            handleMilestoneRenameSubmit={handleMilestoneRenameSubmit}
            handleMilestoneEdgeResize={handleMilestoneEdgeResize}
            handleConnectionDragStart={handleConnectionDragStart}
            // Refactor mode
            refactorMode={refactorMode}
            handleRefactorDrag={handleRefactorDrag}
            // Expanded task view (Gantt)
            expandedTaskView={expandedTaskView}
            // Deadline
            onSetDeadline={onSetDeadline}
            days={days}
            // Team phase row height
            getTeamPhaseRowHeight={getTeamPhaseRowHeight}
          />

          {/* Marquee selection overlay */}
          {marqueeRect && marqueeRect.width > 0 && marqueeRect.height > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${marqueeRect.x}px`,
                top: `${marqueeRect.y}px`,
                width: `${marqueeRect.width}px`,
                height: `${marqueeRect.height}px`,
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                border: '1.5px solid rgba(59, 130, 246, 0.6)',
                borderRadius: '2px',
                zIndex: 200,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Task Ghost — full-width row */}
          {taskGhost && (() => {
            const taskGhostTop = taskGhost.y - taskGhost.offsetY;
            return (
              <div
                className="absolute pointer-events-none"
                style={{
                  top: `${taskGhostTop}px`,
                  left: `${TEAMWIDTH}px`,
                  height: `${taskGhost.height}px`,
                  width: `${TASKWIDTH + totalDaysWidth}px`,
                  zIndex: 100,
                  border: '2px solid rgba(59,130,246,0.7)',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(219,234,254,0.8)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 0 0 1px rgba(59,130,246,0.3)',
                  overflow: 'hidden',
                }}
              >
                {/* Task name */}
                <div className="flex items-center px-2 text-sm font-medium text-blue-900 h-full" style={{ width: `${TASKWIDTH}px`, borderRight: '1px solid rgba(59,130,246,0.2)' }}>
                  {taskGhost.name}
                </div>
                {/* Milestone indicators */}
                {(taskGhost.milestones || []).map(m => {
                  const mStartX = dayColumnLayout?.dayXOffset?.(m.start_index);
                  if (mStartX === undefined) return null;
                  const dur = m.duration || 1;
                  let mW = 0;
                  for (let d = 0; d < dur; d++) {
                    mW += dayColumnLayout?.dayWidth?.(m.start_index + d) ?? DAYWIDTH;
                  }
                  if (!mW) mW = DAYWIDTH;
                  const mX = TASKWIDTH + mStartX;
                  return (
                    <div
                      key={m.id}
                      className="absolute rounded-sm flex items-center overflow-hidden"
                      style={{
                        left: `${mX}px`,
                        top: '2px',
                        width: `${mW}px`,
                        height: `${taskGhost.height - 4}px`,
                        backgroundColor: 'rgba(59,130,246,0.4)',
                        border: '1px solid rgba(59,130,246,0.6)',
                      }}
                    >
                      <span className="truncate text-[10px] px-1 text-blue-900/80 font-medium">{m.name}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
