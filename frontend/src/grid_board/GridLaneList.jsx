import AddIcon from '@mui/icons-material/Add';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import GridColumnGrid from './GridColumnGrid';
import { playSound } from '../assets/sound_registry';
import { LANE_PHASE_ROW_HEIGHT } from './layoutMath';

/**
 * GridLaneList â€“ renders the lane (team) sidebar, row (task) labels,
 * per-lane phase rows, and delegates the column-cell grid per lane.
 *
 * Generic port of DependencyTeamList â€“ all domain terms replaced:
 *   team â†’ lane, task â†’ row, milestone â†’ node, day â†’ column
 *
 * Navigation is delegated via callback props instead of useNavigate/useParams.
 */
export default function GridLaneList({
  // Data
  laneOrder,
  lanes,
  rows,
  // Layout helpers
  isLaneVisible,
  isLaneCollapsed,
  getVisibleLaneIndex,
  getLaneHeight,
  getRawLaneHeight,
  getVisibleRows,
  getRowHeight,
  lightenColor,
  isRowVisible,
  // Constants
  LANEWIDTH,
  ROWLABELWIDTH,
  ROWACTIONSWIDTH = 0,
  COLUMNWIDTH,
  LANE_DRAG_HIGHLIGHT_HEIGHT,
  MARGIN_BETWEEN_DRAG_HIGHLIGHT,
  LANE_HEADER_LINE_HEIGHT,
  LANE_HEADER_GAP,
  // State
  totalColumns,
  columnLabels,
  rowDisplaySettings,
  ghost,
  dropIndex,
  rowGhost,
  rowDropTarget,
  openLaneSettings,
  isAddingNode,
  hoveredColumnCell,
  mode,
  visibleLaneCount,
  hiddenLaneCount,
  // Handlers
  handleLaneDrag,
  handleRowDrag,
  toggleRowSize,
  toggleRowVisibility,
  toggleLaneCollapsed,
  addNodeLocal,
  setOpenLaneSettings,
  setHoveredColumnCell,
  handleColumnCellClick,
  showAllHiddenLanes,
  toggleLaneVisibility,
  // Navigation callbacks (adapter provides these)
  onLaneNavigate,
  onRowNavigate,
  // Refactor mode
  refactorMode,
  handleRefactorDrag,
  // Deadline
  onSetDeadline,
  // Column layout
  columnLayout,
  collapsedColumns,
  selectedColumns,
  // Phases in grid
  phases = [],
  showPhaseColorsInGrid = true,
  // Lane phase rows
  lanePhasesMap = {},
  getLanePhaseRowHeight,
  collapsedLanePhaseRows = new Set(),
  setCollapsedLanePhaseRows,
  setPhaseEditModal,
  handlePhaseEdgeResize,
  handlePhaseDrag,
  totalColumnsWidth,
  collapsePhaseRange,
  // Row multi-select
  selectedRows = new Set(),
  setSelectedRows,
}) {
  return (
    <>
      {laneOrder.map((lane_key) => {
        if (!isLaneVisible(lane_key)) return null;

        const lane = lanes[lane_key];
        if (!lane) return null;

        const visibleIndex = getVisibleLaneIndex(lane_key);
        const laneHeight = getLaneHeight(lane_key);
        const rawHeight = getRawLaneHeight(lane_key);
        const visibleRows_ = getVisibleRows(lane_key);
        const isCollapsed = isLaneCollapsed(lane_key);
        const laneColor = lane.color || '#94a3b8';
        const isVirtual = !!lane._virtual;
        const hasNoRows = (lane.rows || []).length === 0;
        const allRowsHidden = (lane.rows || []).length > 0 && visibleRows_.length === 0;
        // Phase row height for this lane
        const phaseRowH = isCollapsed ? 0 : (getLanePhaseRowHeight ? getLanePhaseRowHeight(lane_key) : 0);
        const laneRowHeight = laneHeight - phaseRowH;

        return (
          <div key={lane_key}>
            {/* DROP HIGHLIGHT */}
            <div className="flex" style={{ position: 'relative', backgroundColor: 'white' }}>
              <div
                style={{
                  marginBottom: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  marginTop: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  height: `${LANE_DRAG_HIGHLIGHT_HEIGHT}px`,
                  width: `${LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH}px`,
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
                  marginBottom: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  marginTop: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
                  height: `${LANE_DRAG_HIGHLIGHT_HEIGHT}px`,
                  opacity: dropIndex === visibleIndex ? 1 : 0,
                  backgroundColor: dropIndex === visibleIndex ? 'black' : 'white',
                }}
                className="rounded-r-full flex-1"
              />
            </div>

            {/* Lane Color Header Line - spans full width */}
            <div
              style={{
                height: `${LANE_HEADER_LINE_HEIGHT}px`,
                marginBottom: `${LANE_HEADER_GAP}px`,
                backgroundColor: laneColor,
                ...(isVirtual ? { backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.5) 6px, rgba(255,255,255,0.5) 12px)' } : {}),
              }}
            />

            {/* Per-lane Phase Row */}
            {(() => {
              if (isCollapsed) return null;
              const laneIdNum = typeof lane_key === 'string' ? parseInt(lane_key, 10) : lane_key;
              const lanePhases = lanePhasesMap[laneIdNum] || [];
              if (lanePhases.length === 0 || phaseRowH === 0) return null;
              return (
                <div className="flex" style={{ height: `${LANE_PHASE_ROW_HEIGHT}px` }}>
                  {/* Sticky left label */}
                  <div
                    className="flex items-center border-r border-slate-200"
                    style={{
                      width: `${LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH}px`,
                      height: `${LANE_PHASE_ROW_HEIGHT}px`,
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      backgroundColor: 'rgba(248,250,252,0.97)',
                    }}
                  >
                    <button
                      onClick={() => {
                        if (!setCollapsedLanePhaseRows) return;
                        playSound('collapse');
                        setCollapsedLanePhaseRows(prev => {
                          const next = new Set(prev);
                          if (next.has(laneIdNum)) next.delete(laneIdNum);
                          else next.add(laneIdNum);
                          return next;
                        });
                      }}
                      className="flex items-center gap-0.5 px-1 text-[9px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors truncate"
                      style={{ height: '100%' }}
                      title="Hide lane phases"
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
                  <div className="relative" style={{ width: `${totalColumnsWidth || 0}px`, height: `${LANE_PHASE_ROW_HEIGHT}px` }}>
                    {lanePhases.map((phase) => {
                      const phaseX = columnLayout?.columnXOffset(phase.start_index) ?? (phase.start_index * COLUMNWIDTH);
                      const endIdx = phase.start_index + phase.duration;
                      const phaseEndX = endIdx < totalColumns
                        ? (columnLayout?.columnXOffset(endIdx) ?? (endIdx * COLUMNWIDTH))
                        : (totalColumnsWidth || totalColumns * COLUMNWIDTH);
                      const phaseW = phaseEndX - phaseX;
                      if (phaseW <= 0) return null;
                      return (
                        <div
                          key={phase.id}
                          className="absolute top-0 flex items-center justify-center cursor-pointer hover:brightness-110 transition-all group/lphase"
                          style={{
                            left: `${phaseX}px`,
                            width: `${phaseW}px`,
                            height: `${LANE_PHASE_ROW_HEIGHT}px`,
                            backgroundColor: phase.color || '#3b82f6',
                            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(255,255,255,0.18) 2px, rgba(255,255,255,0.18) 4px)',
                            color: '#fff',
                            borderRadius: '0 0 3px 3px',
                            fontSize: '9px',
                            fontWeight: 600,
                            borderBottom: '1.5px solid rgba(0,0,0,0.15)',
                          }}
                          title={`${phase.name} â€” columns ${phase.start_index + 1}â€“${phase.start_index + phase.duration} â€” double-click to edit, drag to move, drag edges to resize`}
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
                            className="absolute left-0 top-0 w-[5px] h-full cursor-col-resize opacity-0 group-hover/lphase:opacity-100 transition-opacity z-10"
                            style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.5), transparent)' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (handlePhaseEdgeResize) handlePhaseEdgeResize(e, phase.id, 'left');
                            }}
                          />
                          <span className="truncate px-1 flex items-center gap-0.5">
                            {phase.name}
                            {collapsePhaseRange && (
                              <span
                                className="inline-flex items-center opacity-0 group-hover/lphase:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                                title={`Collapse columns ${phase.start_index + 1}â€“${phase.start_index + phase.duration}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  collapsePhaseRange(phase);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="7 13 12 18 17 13" />
                                  <polyline points="7 6 12 11 17 6" />
                                </svg>
                              </span>
                            )}
                          </span>
                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 w-[5px] h-full cursor-col-resize opacity-0 group-hover/lphase:opacity-100 transition-opacity z-10"
                            style={{ background: 'linear-gradient(270deg, rgba(255,255,255,0.5), transparent)' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (handlePhaseEdgeResize) handlePhaseEdgeResize(e, phase.id, 'right');
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Lane Row */}
            <div className="flex" style={{ position: 'relative' }}>
              {/* STICKY LEFT: Lane + Rows columns */}
              <div
                className="flex"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 30,
                  width: `${LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH}px`,
                  height: `${laneRowHeight}px`,
                  opacity: ghost?.id === lane_key ? 0.3 : 1,
                  backgroundColor: 'white',
                }}
              >
                {/* Lane Name Column */}
                <div
                  data-grid-lane-id={lane_key}
                  data-grid-lane-name={lane.name}
                  data-grid-lane-color={laneColor}
                  className={`flex flex-col items-center justify-start border-r border-b border-slate-200 ${isVirtual ? '' : 'cursor-grab-visible'} ${
                    refactorMode && !isVirtual ? 'ring-2 ring-orange-300 ring-inset' : ''
                  }`}
                  style={{
                    width: `${LANEWIDTH}px`,
                    height: `${laneRowHeight}px`,
                    backgroundColor: isVirtual ? '#f1f5f9' : lightenColor(laneColor, 0.92),
                    overflow: LANEWIDTH === 0 ? 'hidden' : undefined,
                    ...(isVirtual ? { borderLeft: '2px dashed #94a3b8' } : {}),
                  }}
                  onMouseDown={(e) => {
                    if (e.target.closest('[data-no-drag]')) return;
                    if (isVirtual) return;
                    if (refactorMode) {
                      handleRefactorDrag(e, "lane", {
                        id: lane_key,
                        name: lane.name,
                        color: laneColor,
                        rowIds: lane.rows || [],
                      });
                      return;
                    }
                    handleLaneDrag(e, lane_key, visibleIndex);
                  }}
                >
                  <div className="flex items-center gap-1 px-1 py-1.5 w-full">
                    {/* Expand/collapse triangle */}
                    <button
                      data-no-drag
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLaneCollapsed(lane_key);
                      }}
                      className="flex-shrink-0 flex items-center justify-center rounded hover:bg-white/50 transition cursor-pointer"
                      style={{ width: '18px', height: '18px' }}
                      title={isCollapsed ? 'Expand lane' : 'Collapse lane'}
                    >
                      <ArrowRightIcon
                        style={{
                          fontSize: 16,
                          color: laneColor,
                          transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    </button>
                    <span
                      className={`text-sm font-medium truncate flex-1 ${isVirtual ? 'italic text-slate-400' : ''}`}
                      title={lane.name}
                    >
                      {lane.name}
                    </span>
                    {/* Link to lane detail page - not for virtual lanes */}
                    {!isVirtual && onLaneNavigate && (
                      <button
                        data-no-drag
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaneNavigate(lane_key);
                        }}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/50 transition cursor-pointer"
                        title={`Go to ${lane.name} detail page`}
                      >
                        <OpenInNewIcon style={{ fontSize: 12 }} className="text-slate-400 hover:text-blue-500" />
                      </button>
                    )}
                    {!isVirtual && (
                      <button
                        data-no-drag
                        id={`lane-settings-btn-${lane_key}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenLaneSettings(openLaneSettings === lane_key ? null : lane_key);
                        }}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/50 transition"
                      >
                        <MoreVertIcon style={{ fontSize: 14 }} className="text-slate-500" />
                      </button>
                    )}
                  </div>

                  {/* All rows hidden indicator */}
                  {allRowsHidden && !isCollapsed && (
                    <div className="flex flex-col items-center justify-center flex-1 px-2 pb-1.5">
                      <VisibilityOffIcon style={{ fontSize: 14 }} className="text-slate-300 mb-0.5" />
                      <span className="text-[10px] text-slate-400 italic">All rows hidden</span>
                    </div>
                  )}
                </div>

                {/* Row labels column - only show when not collapsed AND has visible rows */}
                {!isCollapsed && visibleRows_.length > 0 && (
                  <div className="flex flex-col border-r border-slate-200" style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}>
                    {(lane.rows || []).map((row_key) => {
                      if (!isRowVisible(row_key, rowDisplaySettings)) return null;

                      const rowHeight = getRowHeight(row_key, rowDisplaySettings);
                      const isSmall = rowDisplaySettings[row_key]?.size === 'small';
                      const visibleRowIndex = visibleRows_.indexOf(row_key);
                      const isLastVisible = visibleRowIndex === visibleRows_.length - 1;
                      const rowIdNum = typeof row_key === 'string' ? parseInt(row_key, 10) : row_key;
                      const isRowSelected = selectedRows.has(rowIdNum);

                      return (
                        <div
                          data-grid-row-id={row_key}
                          data-grid-row-name={rows[row_key]?.name}
                          data-grid-lane-id={lane_key}
                          data-grid-lane-name={lane.name}
                          data-grid-lane-color={laneColor}
                          className={`border-l border-slate-200 flex w-full items-center transition-colors ${isRowSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-400' : 'hover:bg-slate-50/50'}`}
                          style={{
                            height: `${rowHeight}px`,
                            width: `${ROWLABELWIDTH}px`,
                            borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                            opacity: rowGhost?.rowKey === row_key ? 0.3 : 1,
                            overflow: ROWLABELWIDTH === 0 ? 'hidden' : undefined,
                          }}
                          key={`${row_key}_container`}
                        >
                          {/* Drag Handle */}
                          <div
                            onMouseDown={(e) => {
                              if (refactorMode) {
                                handleRefactorDrag(e, "row", {
                                  id: row_key,
                                  name: rows[row_key]?.name,
                                  description: rows[row_key]?.description || "",
                                  milestones: rows[row_key]?.milestones || [],
                                  laneId: lane_key,
                                  laneName: lane.name,
                                  laneColor: laneColor,
                                });
                                return;
                              }
                              if (mode === "drag") {
                                handleRowDrag(e, row_key, lane_key, visibleRowIndex);
                              }
                            }}
                            className="flex-shrink-0 flex items-center justify-center cursor-grab-visible text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                            style={{ width: '28px', height: '100%' }}
                            title="Drag to reorder row"
                          >
                            <DragIndicatorIcon style={{ fontSize: isSmall ? 12 : 14 }} />
                          </div>

                          {/* Row Name (click to navigate, Ctrl+click to select) */}
                          <div
                            className="flex-1 h-full flex items-center min-w-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.ctrlKey || e.metaKey) {
                                // Ctrl+Click: toggle row selection
                                if (setSelectedRows) {
                                  setSelectedRows(prev => {
                                    const next = new Set(prev);
                                    const id = typeof row_key === 'string' ? parseInt(row_key, 10) : row_key;
                                    if (next.has(id)) next.delete(id);
                                    else next.add(id);
                                    return next;
                                  });
                                  playSound('click');
                                }
                                return;
                              }
                              if (onRowNavigate) onRowNavigate(row_key);
                            }}
                          >
                            <span
                              className={`truncate hover:text-blue-600 hover:underline transition-colors ${isRowSelected ? 'text-blue-700 font-semibold' : 'text-slate-600'} ${isSmall ? 'text-xs' : 'text-sm'}`}
                              title={`${rows[row_key]?.name} â€” Click to open, Ctrl+Click to select`}
                            >
                              {rows[row_key]?.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Row Actions column — separate from row labels, independently collapsible */}
                {!isCollapsed && visibleRows_.length > 0 && ROWACTIONSWIDTH > 0 && (
                  <div className="flex flex-col border-r border-slate-200" style={{ backgroundColor: 'rgba(255,255,255,0.97)' }}>
                    {(lane.rows || []).map((row_key) => {
                      if (!isRowVisible(row_key, rowDisplaySettings)) return null;

                      const rowHeight = getRowHeight(row_key, rowDisplaySettings);
                      const isSmall = rowDisplaySettings[row_key]?.size === 'small';
                      const visibleRowIndex = visibleRows_.indexOf(row_key);
                      const isLastVisible = visibleRowIndex === visibleRows_.length - 1;

                      return (
                        <div
                          className="flex items-center justify-center"
                          style={{
                            height: `${rowHeight}px`,
                            width: `${ROWACTIONSWIDTH}px`,
                            borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                            opacity: rowGhost?.rowKey === row_key ? 0.3 : 1,
                          }}
                          key={`${row_key}_actions`}
                        >
                          <div className="flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
                            {/* Size Toggle */}
                            <button
                              onClick={() => toggleRowSize(row_key)}
                              className={`flex items-center justify-center rounded hover:bg-slate-200 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                              title={isSmall ? "Expand row" : "Collapse row"}
                            >
                              {isSmall ? (
                                <UnfoldMoreIcon style={{ fontSize: isSmall ? 12 : 14 }} className="text-slate-500" />
                              ) : (
                                <UnfoldLessIcon style={{ fontSize: 14 }} className="text-slate-500" />
                              )}
                            </button>

                            {/* Hide Row */}
                            <button
                              onClick={() => toggleRowVisibility(row_key)}
                              className={`flex items-center justify-center rounded hover:bg-slate-200 transition ${isSmall ? 'h-5 w-5' : 'h-6 w-6'}`}
                              title="Hide row"
                            >
                              <VisibilityOffIcon style={{ fontSize: isSmall ? 12 : 14 }} className="text-slate-500" />
                            </button>

                            {/* Add Node */}
                            {!isSmall && (
                              <button
                                onClick={() => addNodeLocal(row_key)}
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

                {/* Empty rows column placeholder */}
                {!isCollapsed && visibleRows_.length === 0 && (
                  <div
                    className="border-l border-slate-200 flex flex-col items-center justify-center"
                    style={{
                      width: `${ROWLABELWIDTH + ROWACTIONSWIDTH}px`,
                      height: `${laneRowHeight}px`,
                      backgroundColor: hasNoRows ? 'rgba(241,245,249,0.6)' : 'rgba(241,245,249,0.4)',
                      borderLeft: hasNoRows ? '2px dashed #cbd5e1' : '1px solid #e2e8f0',
                    }}
                  >
                    {hasNoRows ? (
                      <span className="text-[10px] text-slate-400 italic">No rows yet</span>
                    ) : (
                      <>
                        <VisibilityOffIcon style={{ fontSize: 14 }} className="text-slate-300 mb-0.5" />
                        <span className="text-[10px] text-slate-400 italic">All hidden</span>
                      </>
                    )}
                  </div>
                )}

                {/* Collapsed lane placeholder */}
                {isCollapsed && (
                  <div
                    className="border-l border-r border-slate-200 flex items-center px-2"
                    style={{
                      width: `${ROWLABELWIDTH + ROWACTIONSWIDTH}px`,
                      height: `${laneRowHeight}px`,
                      backgroundColor: 'rgba(248,250,252,0.97)',
                    }}
                  >
                    <span className="text-[10px] text-slate-400 italic">
                      {(lane.rows || []).length} row{(lane.rows || []).length !== 1 ? 's' : ''} (collapsed)
                    </span>
                  </div>
                )}
              </div>

              <GridColumnGrid
                isCollapsed={isLaneCollapsed(lane_key)}
                laneHeight={laneRowHeight}
                rawHeight={rawHeight}
                laneRows={lane.rows || []}
                visibleRows={visibleRows_}
                lane_key={lane_key}
                columns={totalColumns}
                columnLabels={columnLabels}
                COLUMNWIDTH={COLUMNWIDTH}
                ghost={ghost}
                isAddingNode={isAddingNode}
                hoveredColumnCell={hoveredColumnCell}
                rowDisplaySettings={rowDisplaySettings}
                isRowVisible={isRowVisible}
                getRowHeight={getRowHeight}
                setHoveredColumnCell={setHoveredColumnCell}
                handleColumnCellClick={handleColumnCellClick}
                rows={rows}
                onSetDeadline={onSetDeadline}
                columnLayout={columnLayout}
                collapsedColumns={collapsedColumns}
                selectedColumns={selectedColumns}
                phases={phases}
                showPhaseColorsInGrid={showPhaseColorsInGrid}
                refactorMode={refactorMode}
              />
            </div>
          </div>
        );
      })}

      {/* LAST DROP HIGHLIGHT */}
      <div className="flex" style={{ position: 'relative', backgroundColor: 'white' }}>
        <div
          style={{
            marginBottom: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
            marginTop: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
            height: `${LANE_DRAG_HIGHLIGHT_HEIGHT}px`,
            width: `${LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH}px`,
            opacity: dropIndex === visibleLaneCount ? 1 : 0,
            backgroundColor: dropIndex === visibleLaneCount ? 'black' : 'white',
            position: 'sticky',
            left: 0,
            zIndex: 40,
          }}
          className="rounded-l-full"
        />
        <div
          style={{
            marginBottom: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
            marginTop: `${MARGIN_BETWEEN_DRAG_HIGHLIGHT}px`,
            height: `${LANE_DRAG_HIGHLIGHT_HEIGHT}px`,
            opacity: dropIndex === visibleLaneCount ? 1 : 0,
            backgroundColor: dropIndex === visibleLaneCount ? 'black' : 'white',
          }}
          className="rounded-r-full flex-1"
        />
      </div>

      {/* Hidden Lanes Banner */}
      {hiddenLaneCount > 0 && (
        <div className="flex items-center justify-center py-2 text-xs text-slate-500">
          <button
            onClick={showAllHiddenLanes}
            className="hover:text-blue-600 hover:underline transition-colors"
          >
            {hiddenLaneCount} hidden lane{hiddenLaneCount !== 1 ? 's' : ''} â€” click to show all
          </button>
        </div>
      )}
    </>
  );
}
