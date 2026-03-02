import GridNodeLayer from './GridNodeLayer';
import GridLaneList from './GridLaneList';
import { useGridBoardContext } from './GridBoardContext';
import {
  getConnectionPath,
  getStraightPath,
  lightenColor,
  isRowVisible,
  HEADER_HEIGHT,
  ROW_DROP_INDICATOR_HEIGHT,
  COLUMN_LABEL_WIDTH_THRESHOLD,
} from './layoutMath';

const PHASE_HEADER_HEIGHT = 26;

/**
 * GridCanvas – the main scroll container that renders the entire grid board:
 *   header row (column labels + phase bar), lane list, SVG edge layer,
 *   node layer, marquee overlay, and drag ghosts.
 *
 * Generic port of DependencyCanvas – domain terms replaced:
 *   team → lane, task → row, milestone → node,
 *   connection/dependency → edge, day → column
 *
 * Navigation is handled via callback props rather than useNavigate/useParams.
 */
export default function GridCanvas({
  // Refs
  containerRef,
  // Scalar dimensions
  totalColumns,
  contentHeight,
  // ── Structured controller objects ──
  layout = {},
  data = {},
  displayState = {},
  handlers = {},
}) {
  // ── Destructure layout ──
  const {
    isLaneVisible,
    isLaneCollapsed,
    getVisibleLaneIndex,
    getLaneHeight,
    getRawLaneHeight,
    getVisibleRows: getVisibleRowsFn,
    getRowHeight,
    getLaneYOffset,
    getRowYOffset,
    getRowDropIndicatorY,
    getNodeHandlePosition,
    getLanePhaseRowHeight,
    LANEWIDTH,
    ROWLABELWIDTH,
    COLUMNWIDTH,
    COLLAPSED_COLUMN_WIDTH = 6,
    LANE_DRAG_HIGHLIGHT_HEIGHT,
    MARGIN_BETWEEN_DRAG_HIGHLIGHT,
    LANE_HEADER_LINE_HEIGHT,
    LANE_HEADER_GAP,
    columnLayout,
  } = layout;

  // ── Destructure data ──
  const {
    laneOrder,
    lanes,
    rows,
    nodes,
    edges,
    columnLabels,
    phases = [],
    lanePhasesMap = {},
  } = data;

  // ── Destructure displayState ──
  const {
    rowDisplaySettings,
    laneDisplaySettings,
    hideAllEdges,
    hideCollapsedEdges,
    hideCollapsedNodes,
    selectedColumns = new Set(),
    collapsedColumns = new Set(),
    hoveredNode,
    selectedNodes,
    selectedEdges,
    editingNodeId,
    editingNodeName,
    blockedMoveHighlight,
    viewMode,
    mode,
    safeMode,
    ghost,
    dropIndex,
    rowGhost,
    rowDropTarget,
    isDraggingConnection,
    connectionStart,
    connectionEnd,
    openLaneSettings,
    isAddingNode,
    hoveredColumnCell,
    visibleLaneCount,
    hiddenLaneCount,
    refactorMode,
    expandedRowView,
    edgeSettings = {},
    showPhaseColorsInGrid = true,
    collapsedLanePhaseRows = new Set(),
    hideGlobalPhases = false,
    hideColumnHeader = false,
    marqueeRect,
  } = displayState;

  // ── Destructure handlers ──
  const {
    handleColumnHeaderClick,
    handleLaneDrag,
    handleRowDrag,
    handleEdgeClick,
    handleNodeMouseDown,
    handleNodeClick,
    handleNodeEdgeResize,
    handleConnectionDragStart,
    handleNodeRenameSubmit,
    handleColumnCellClick,
    toggleRowSize,
    toggleRowVisibility,
    toggleLaneCollapsed,
    addNodeLocal,
    showAllHiddenLanes,
    toggleLaneVisibility,
    handleColumnResize,
    setHoveredNode,
    setEditingNodeName,
    setEditingNodeId,
    setDeleteConfirmModal,
    setOpenLaneSettings,
    setHoveredColumnCell,
    handleMarqueeStart,
    handleRefactorDrag,
    onSetDeadline,
    setEdgeEditModal,
    setPhaseEditModal,
    handlePhaseEdgeResize,
    handlePhaseDrag,
    setCollapsedLanePhaseRows,
    collapsePhaseRange,
    focusOnPhase,
    onColumnSelect,
    onUncollapseColumns,
    // Navigation callbacks (optional, forwarded to GridLaneList)
    onLaneNavigate,
    onRowNavigate,
  } = handlers;

  // Row multi-select from context
  const { selectedRows, setSelectedRows } = useGridBoardContext();

  const hasPhases = phases.length > 0;
  const globalPhases = phases.filter(p => p.team == null);
  const hasGlobalPhases = globalPhases.length > 0;
  const showGlobalPhases = hasGlobalPhases && !hideGlobalPhases;
  const showColumnHeader = !hideColumnHeader;
  const totalHeaderHeight = (showColumnHeader ? HEADER_HEIGHT : 0) + (showGlobalPhases ? PHASE_HEADER_HEIGHT : 0);
  const totalColumnsWidth = columnLayout?.totalColumnsWidth ?? (totalColumns || 0) * COLUMNWIDTH;
  const totalWidth = LANEWIDTH + ROWLABELWIDTH + totalColumnsWidth;

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
          ref={containerRef}
          onMouseDown={(e) => {
            if (e.target.closest('[data-node]')) return;
            const scrollContainer = containerRef.current?.parentElement;
            if (!scrollContainer) return;
            const scrollContainerRect = scrollContainer.getBoundingClientRect();
            const clickXInViewport = e.clientX - scrollContainerRect.left;
            if (clickXInViewport > LANEWIDTH + ROWLABELWIDTH) {
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
          {/* Sticky overlay for lane ghost and row drop indicator */}
          <div
            style={{
              position: 'sticky',
              left: 0,
              top: 0,
              width: `${LANEWIDTH + ROWLABELWIDTH}px`,
              height: 0,
              zIndex: 150,
              pointerEvents: 'none',
            }}
          >
            {/* Row drop indicator line */}
            {rowGhost && rowDropTarget && (
              <div
                className="pointer-events-none absolute"
                style={{
                  top: `${getRowDropIndicatorY()}px`,
                  left: `${LANEWIDTH}px`,
                  width: `${ROWLABELWIDTH}px`,
                  height: `${ROW_DROP_INDICATOR_HEIGHT}px`,
                  backgroundColor: '#1d4ed8',
                  borderRadius: '2px',
                  zIndex: 200,
                  boxShadow: '0 0 8px rgba(29, 78, 216, 0.6)',
                }}
              />
            )}
          </div>

          {/* Lane Ghost — full-width row */}
          {ghost && (() => {
            const ghostTop = ghost.y - ghost.offsetY;
            const rowYMap = {};
            let cumRowY = 0;
            const phaseRowH = getLanePhaseRowHeight ? getLanePhaseRowHeight(ghost.id) : 0;
            for (const rid of (ghost.laneRows || [])) {
              rowYMap[rid] = cumRowY;
              cumRowY += getRowHeight(rid, rowDisplaySettings);
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
                <div style={{ position: 'absolute', inset: 0, backgroundColor: ghost.color, opacity: 0.35 }} />
                {/* Lane name */}
                <div
                  className="text-sm font-bold text-slate-900 flex items-start"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${LANEWIDTH}px`,
                    height: '100%',
                    backgroundColor: ghost.color,
                    padding: '6px 8px',
                    borderRight: '1px solid rgba(0,0,0,0.15)',
                  }}
                >
                  {ghost.name}
                </div>
                {/* Row names column */}
                <div style={{ position: 'absolute', left: `${LANEWIDTH}px`, top: `${phaseRowH}px`, width: `${ROWLABELWIDTH}px`, height: `${ghost.height - phaseRowH}px`, borderRight: '1px solid rgba(0,0,0,0.1)' }}>
                  {(ghost.laneRows || []).map(rid => {
                    const r = rows[rid];
                    if (!r) return null;
                    const rh = getRowHeight(rid, rowDisplaySettings);
                    return (
                      <div key={rid} className="flex items-center px-2 text-xs text-slate-700 truncate" style={{ height: `${rh}px`, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        {r.name}
                      </div>
                    );
                  })}
                </div>
                {/* Node indicators in column grid */}
                {(ghost.milestones || []).map(n => {
                  const nStartX = columnLayout?.columnXOffset?.(n.startColumn);
                  if (nStartX === undefined) return null;
                  const dur = n.duration || 1;
                  let nW = 0;
                  for (let d = 0; d < dur; d++) {
                    nW += columnLayout?.columnWidth?.(n.startColumn + d) ?? COLUMNWIDTH;
                  }
                  if (!nW) nW = COLUMNWIDTH;
                  const nX = LANEWIDTH + ROWLABELWIDTH + nStartX;
                  const rh = getRowHeight(n.row, rowDisplaySettings);
                  const nY = phaseRowH + (rowYMap[n.row] ?? 0);
                  return (
                    <div
                      key={n.id}
                      className="absolute rounded-sm flex items-center overflow-hidden"
                      style={{
                        left: `${nX}px`,
                        top: `${nY + 2}px`,
                        width: `${nW}px`,
                        height: `${rh - 4}px`,
                        backgroundColor: ghost.color,
                        border: '1px solid rgba(0,0,0,0.3)',
                        opacity: 0.7,
                      }}
                    >
                      <span className="truncate text-[10px] px-1 text-white/90 font-medium" style={{ textShadow: '0 0 2px rgba(0,0,0,0.4)' }}>{n.name}</span>
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
                    width: `${LANEWIDTH + ROWLABELWIDTH}px`,
                    height: `${PHASE_HEADER_HEIGHT}px`,
                    position: 'sticky',
                    left: 0,
                    zIndex: 51,
                  }}
                >
                  Phases
                </div>
                <div className="relative border-b border-slate-200" style={{ width: `${totalColumnsWidth}px`, height: `${PHASE_HEADER_HEIGHT}px` }}>
                  {globalPhases.map((phase) => {
                    const phaseX = columnLayout?.columnXOffset(phase.start_index) ?? (phase.start_index * COLUMNWIDTH);
                    const endIdx = phase.start_index + phase.duration;
                    const phaseEndX = endIdx < totalColumns
                      ? (columnLayout?.columnXOffset(endIdx) ?? (endIdx * COLUMNWIDTH))
                      : totalColumnsWidth;
                    const rawPhaseW = phaseEndX - phaseX;
                    if (rawPhaseW <= 0) return null;

                    let allColumnsCollapsed = true;
                    for (let c = phase.start_index; c < endIdx; c++) {
                      if (!collapsedColumns.has(c)) { allColumnsCollapsed = false; break; }
                    }
                    const MIN_COLLAPSED_PHASE_W = 28;
                    const phaseW = allColumnsCollapsed ? Math.max(rawPhaseW, MIN_COLLAPSED_PHASE_W) : rawPhaseW;

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
                          zIndex: allColumnsCollapsed ? 2 : undefined,
                        }}
                        title={`${phase.name}${phase.team ? ` (${lanes?.[phase.team]?.name || 'Lane'})` : ''} — columns ${phase.start_index + 1}–${phase.start_index + phase.duration}${allColumnsCollapsed ? ' (collapsed — click chevron to expand)' : ' — double-click to edit, drag to move, drag edges to resize'}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!allColumnsCollapsed && handlePhaseDrag) handlePhaseDrag(e, phase.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (allColumnsCollapsed) {
                            if (collapsePhaseRange) collapsePhaseRange(phase);
                          } else {
                            if (setPhaseEditModal) setPhaseEditModal({ ...phase, mode: 'edit' });
                          }
                        }}
                      >
                        {!allColumnsCollapsed && (
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
                          {!allColumnsCollapsed && phase.name}
                          {!allColumnsCollapsed && phase.team != null && <span className="opacity-60 ml-0.5 text-[8px]"> · {lanes?.[phase.team]?.name || ''}</span>}
                          {collapsePhaseRange && (
                            <span
                              className={`inline-flex items-center cursor-pointer flex-shrink-0 transition-opacity ${allColumnsCollapsed ? 'opacity-100' : 'opacity-0 group-hover/phase:opacity-100'}`}
                              title={allColumnsCollapsed ? `Expand columns ${phase.start_index + 1}–${phase.start_index + phase.duration}` : `Collapse columns ${phase.start_index + 1}–${phase.start_index + phase.duration}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                collapsePhaseRange(phase);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {allColumnsCollapsed ? (
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
                          {focusOnPhase && !allColumnsCollapsed && (
                            <span
                              className="inline-flex items-center opacity-0 group-hover/phase:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                              title={`Focus: collapse all columns except ${phase.name}`}
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
                        {!allColumnsCollapsed && (
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
                  <div
                    className="absolute inset-0"
                    style={{ zIndex: -1 }}
                    onDoubleClick={(e) => {
                      if (!setPhaseEditModal) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      let colIdx = 0;
                      if (columnLayout?.offsets) {
                        for (let i = 0; i < totalColumns; i++) {
                          if (columnLayout.offsets[i] > clickX) break;
                          colIdx = i;
                        }
                      }
                      setPhaseEditModal({ mode: 'create', start_index: colIdx, duration: 7, name: '', color: '#3b82f6' });
                    }}
                  />
                </div>
              </div>
            )}

            {/* Column header row */}
            {showColumnHeader && (
              <div className="flex" style={{ height: `${HEADER_HEIGHT}px`, position: 'relative', zIndex: 50 }}>
                <div
                  className="flex border-b bg-slate-100 text-sm font-semibold text-slate-700"
                  style={{
                    width: `${LANEWIDTH + ROWLABELWIDTH}px`,
                    height: `${HEADER_HEIGHT}px`,
                    position: 'sticky',
                    left: 0,
                    zIndex: 50,
                  }}
                >
                  <div
                    className="flex items-center justify-center border-r border-slate-300"
                    style={{ width: `${LANEWIDTH}px`, position: 'relative' }}
                  >
                    Lane
                    <div
                      onMouseDown={(e) => handleColumnResize('lane', e)}
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
                    style={{ width: `${ROWLABELWIDTH}px`, position: 'relative' }}
                  >
                    Rows
                    <div
                      onMouseDown={(e) => handleColumnResize('row', e)}
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

                {/* Column Headers */}
                <div className="relative border-b" style={{ width: `${totalColumnsWidth}px` }}>
                  {columnLabels.map((colInfo, i) => {
                    const isCollapsed = collapsedColumns.has(i);
                    const isSelected = selectedColumns.has(i);
                    const colWidth = columnLayout?.columnWidth(i) ?? COLUMNWIDTH;
                    const colX = columnLayout?.columnXOffset(i) ?? (i * COLUMNWIDTH);
                    const hasPurpose = !!colInfo.purpose;
                    const isLaneSpecific = hasPurpose && Array.isArray(colInfo.purposeTeams) && colInfo.purposeTeams.length > 0;
                    const isSunday = colInfo.isSunday;
                    const showColName = colWidth >= COLUMN_LABEL_WIDTH_THRESHOLD;

                    if (isCollapsed) {
                      const range = columnLayout?.collapsedRanges?.find(r => i >= r.start && i <= r.end);
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
                          title={`Collapsed column${range ? `s ${range.start + 1}–${range.end + 1}` : ` ${i + 1}`} — click to expand`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (range && onUncollapseColumns) {
                              const rangeIndices = [];
                              for (let c = range.start; c <= range.end; c++) rangeIndices.push(c);
                              onUncollapseColumns(rangeIndices);
                            } else if (onUncollapseColumns) {
                              onUncollapseColumns([i]);
                            }
                          }}
                        >
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
                              ? isLaneSpecific
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
                          ? `${colInfo.purpose}${isLaneSpecific ? ' (lane-specific)' : ' (all lanes)'} - Click to select, Double-click to edit`
                          : 'Click to select, Double-click to edit purpose'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onColumnSelect?.(i, e);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleColumnHeaderClick(i);
                        }}
                      >
                        {showColName && (
                          <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-700' : hasPurpose ? 'text-slate-300' : isSunday ? 'text-purple-600' : 'text-slate-400'}`}>
                            {colInfo.dayNameShort}
                          </span>
                        )}
                        <span className={`font-medium ${isSelected ? 'text-blue-900' : hasPurpose ? 'text-white' : ''}`}>
                          {colInfo.dateStr}
                        </span>
                        {hasPurpose && colWidth >= 50 && (
                          <span className="text-[9px] truncate max-w-full px-1 text-slate-300">
                            {colInfo.purpose}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <GridLaneList
            laneOrder={laneOrder}
            lanes={lanes}
            rows={rows}
            isLaneVisible={isLaneVisible}
            isLaneCollapsed={isLaneCollapsed}
            getVisibleLaneIndex={getVisibleLaneIndex}
            getLaneHeight={getLaneHeight}
            getRawLaneHeight={getRawLaneHeight}
            getVisibleRows={getVisibleRowsFn}
            getRowHeight={getRowHeight}
            lightenColor={lightenColor}
            isRowVisible={isRowVisible}
            LANEWIDTH={LANEWIDTH}
            ROWLABELWIDTH={ROWLABELWIDTH}
            COLUMNWIDTH={COLUMNWIDTH}
            LANE_DRAG_HIGHLIGHT_HEIGHT={LANE_DRAG_HIGHLIGHT_HEIGHT}
            MARGIN_BETWEEN_DRAG_HIGHLIGHT={MARGIN_BETWEEN_DRAG_HIGHLIGHT}
            LANE_HEADER_LINE_HEIGHT={LANE_HEADER_LINE_HEIGHT}
            LANE_HEADER_GAP={LANE_HEADER_GAP}
            columnLayout={columnLayout}
            collapsedColumns={collapsedColumns}
            selectedColumns={selectedColumns}
            totalColumns={totalColumns}
            columnLabels={columnLabels}
            rowDisplaySettings={rowDisplaySettings}
            ghost={ghost}
            dropIndex={dropIndex}
            rowGhost={rowGhost}
            rowDropTarget={rowDropTarget}
            openLaneSettings={openLaneSettings}
            isAddingNode={isAddingNode}
            hoveredColumnCell={hoveredColumnCell}
            mode={mode}
            visibleLaneCount={visibleLaneCount}
            hiddenLaneCount={hiddenLaneCount}
            handleLaneDrag={handleLaneDrag}
            handleRowDrag={handleRowDrag}
            toggleRowSize={toggleRowSize}
            toggleRowVisibility={toggleRowVisibility}
            toggleLaneCollapsed={toggleLaneCollapsed}
            addNodeLocal={addNodeLocal}
            setOpenLaneSettings={setOpenLaneSettings}
            setHoveredColumnCell={setHoveredColumnCell}
            handleColumnCellClick={handleColumnCellClick}
            showAllHiddenLanes={showAllHiddenLanes}
            toggleLaneVisibility={toggleLaneVisibility}
            onLaneNavigate={onLaneNavigate}
            onRowNavigate={onRowNavigate}
            refactorMode={refactorMode}
            handleRefactorDrag={handleRefactorDrag}
            onSetDeadline={onSetDeadline}
            phases={phases}
            showPhaseColorsInGrid={showPhaseColorsInGrid}
            lanePhasesMap={lanePhasesMap}
            getLanePhaseRowHeight={getLanePhaseRowHeight}
            collapsedLanePhaseRows={collapsedLanePhaseRows}
            setCollapsedLanePhaseRows={setCollapsedLanePhaseRows}
            setPhaseEditModal={setPhaseEditModal}
            handlePhaseEdgeResize={handlePhaseEdgeResize}
            handlePhaseDrag={handlePhaseDrag}
            totalColumnsWidth={totalColumnsWidth}
            collapsePhaseRange={collapsePhaseRange}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
          />

          {/* SVG Layer for Edges */}
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

            {!hideAllEdges && edges.map((edge) => {
              const weight = edge.weight || 'strong';

              if (edgeSettings.hideSuggestions && weight === 'suggestion') return null;
              if (edgeSettings.filterWeights && edgeSettings.filterWeights.length > 0) {
                if (!edgeSettings.filterWeights.includes(weight)) return null;
              }

              const sourcePos = getNodeHandlePosition(edge.source, "source");
              const targetPos = getNodeHandlePosition(edge.target, "target");

              if (!sourcePos || !targetPos) return null;

              let srcY = sourcePos.y;
              let tgtY = targetPos.y;
              if (ghost) {
                const laneDragDelta = (ghost.y - ghost.offsetY) - ghost.laneYOffset;
                const sNode = nodes[edge.source];
                const tNode = nodes[edge.target];
                if (sNode && ghost.laneRows?.includes(sNode.row)) srcY += laneDragDelta;
                if (tNode && ghost.laneRows?.includes(tNode.row)) tgtY += laneDragDelta;
              }
              if (rowGhost) {
                const rowDragDelta = (rowGhost.y - rowGhost.offsetY) - rowGhost.rowTopY;
                const sNode = nodes[edge.source];
                const tNode = nodes[edge.target];
                if (sNode && sNode.row === rowGhost.rowKey) srcY += rowDragDelta;
                if (tNode && tNode.row === rowGhost.rowKey) tgtY += rowDragDelta;
              }

              const sourceNode = nodes[edge.source];
              const targetNode = nodes[edge.target];
              if (sourceNode && targetNode) {
                const sOverlapsCollapsed = [...Array(sourceNode.duration || 1)].some((_, d) => collapsedColumns.has(sourceNode.startColumn + d));
                const tOverlapsCollapsed = [...Array(targetNode.duration || 1)].some((_, d) => collapsedColumns.has(targetNode.startColumn + d));
                if (sOverlapsCollapsed || tOverlapsCollapsed) return null;

                const sourceRowId = sourceNode.row;
                const targetRowId = targetNode.row;
                for (const lId of laneOrder) {
                  const l = lanes[lId];
                  if (l && (l.rows || []).includes(sourceRowId) && isLaneCollapsed(lId)) return null;
                  if (l && (l.rows || []).includes(targetRowId) && isLaneCollapsed(lId)) return null;
                }
                if (hideCollapsedEdges || hideCollapsedNodes) {
                  const sourceRowCollapsed = rowDisplaySettings[sourceRowId]?.size === 'small';
                  const targetRowCollapsed = rowDisplaySettings[targetRowId]?.size === 'small';
                  if (sourceRowCollapsed || targetRowCollapsed) return null;
                }
              }

              const isSelected = selectedEdges?.some(se => se.source === edge.source && se.target === edge.target);
              const isOutgoing = edgeSettings.colorDirectionHighlight !== false && selectedNodes.size > 0 && selectedNodes.has(edge.source);
              const isIncoming = edgeSettings.colorDirectionHighlight !== false && selectedNodes.size > 0 && selectedNodes.has(edge.target);
              const isBlockedHighlight = blockedMoveHighlight &&
                blockedMoveHighlight.edgeSource === edge.source &&
                blockedMoveHighlight.edgeTarget === edge.target;

              let strokeColor = "#374151";
              if (isBlockedHighlight) {
                strokeColor = "#dc2626";
              } else if (isSelected) {
                strokeColor = "#6366f1";
              } else if (isOutgoing) {
                strokeColor = "#22c55e";
              } else if (isIncoming) {
                strokeColor = "#ef4444";
              }

              const isHighlighted = isSelected || isOutgoing || isIncoming || isBlockedHighlight;

              const useUniform = edgeSettings.uniformVisuals;
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
              const pathId = `edge-path-${edge.source}-${edge.target}`;
              const pathD = getConnectionPath(sourcePos.x, srcY, targetPos.x, tgtY);

              const showReasons = edgeSettings.showReasons !== false;
              const reasonText = edge.reason || (showReasons ? "is necessary for" : null);

              return (
                <g key={`${edge.source}-${edge.target}`} style={{ pointerEvents: 'auto', opacity }}>
                  <defs>
                    <path id={pathId} d={pathD} />
                  </defs>
                  <path
                    d={pathD}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => handleEdgeClick(e, edge)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (setEdgeEditModal) {
                        setEdgeEditModal({
                          source: edge.source,
                          target: edge.target,
                          weight: edge.weight || 'strong',
                          reason: edge.reason || '',
                          description: edge.description || '',
                        });
                      }
                    }}
                  />
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

          {/* Nodes Layer - ABOVE edges */}
          <GridNodeLayer
            laneOrder={laneOrder}
            lanes={lanes}
            rows={rows}
            nodes={nodes}
            rowDisplaySettings={rowDisplaySettings}
            hoveredNode={hoveredNode}
            selectedNodes={selectedNodes}
            editingNodeId={editingNodeId}
            editingNodeName={editingNodeName}
            blockedMoveHighlight={blockedMoveHighlight}
            viewMode={viewMode}
            mode={mode}
            safeMode={safeMode}
            hideCollapsedNodes={hideCollapsedNodes}
            LANEWIDTH={LANEWIDTH}
            ROWLABELWIDTH={ROWLABELWIDTH}
            COLUMNWIDTH={COLUMNWIDTH}
            LANE_DRAG_HIGHLIGHT_HEIGHT={LANE_DRAG_HIGHLIGHT_HEIGHT}
            MARGIN_BETWEEN_DRAG_HIGHLIGHT={MARGIN_BETWEEN_DRAG_HIGHLIGHT}
            LANE_HEADER_LINE_HEIGHT={LANE_HEADER_LINE_HEIGHT}
            LANE_HEADER_GAP={LANE_HEADER_GAP}
            columnLayout={columnLayout}
            collapsedColumns={collapsedColumns}
            isLaneVisible={isLaneVisible}
            isLaneCollapsed={isLaneCollapsed}
            getVisibleRows={getVisibleRowsFn}
            isRowVisible={isRowVisible}
            getRowHeight={getRowHeight}
            getLaneYOffset={getLaneYOffset}
            getRowYOffset={getRowYOffset}
            handleNodeMouseDown={handleNodeMouseDown}
            handleNodeClick={handleNodeClick}
            setHoveredNode={setHoveredNode}
            setEditingNodeName={setEditingNodeName}
            setEditingNodeId={setEditingNodeId}
            handleNodeRenameSubmit={handleNodeRenameSubmit}
            handleNodeEdgeResize={handleNodeEdgeResize}
            handleConnectionDragStart={handleConnectionDragStart}
            refactorMode={refactorMode}
            handleRefactorDrag={handleRefactorDrag}
            expandedRowView={expandedRowView}
            onSetDeadline={onSetDeadline}
            totalColumns={totalColumns}
            getLanePhaseRowHeight={getLanePhaseRowHeight}
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

          {/* Row Ghost — full-width row */}
          {rowGhost && (() => {
            const rowGhostTop = rowGhost.y - rowGhost.offsetY;
            return (
              <div
                className="absolute pointer-events-none"
                style={{
                  top: `${rowGhostTop}px`,
                  left: `${LANEWIDTH}px`,
                  height: `${rowGhost.height}px`,
                  width: `${ROWLABELWIDTH + totalColumnsWidth}px`,
                  zIndex: 100,
                  border: '2px solid rgba(59,130,246,0.7)',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(219,234,254,0.8)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 0 0 1px rgba(59,130,246,0.3)',
                  overflow: 'hidden',
                }}
              >
                <div className="flex items-center px-2 text-sm font-medium text-blue-900 h-full" style={{ width: `${ROWLABELWIDTH}px`, borderRight: '1px solid rgba(59,130,246,0.2)' }}>
                  {rowGhost.name}
                </div>
                {(rowGhost.milestones || []).map(n => {
                  const nStartX = columnLayout?.columnXOffset?.(n.startColumn);
                  if (nStartX === undefined) return null;
                  const dur = n.duration || 1;
                  let nW = 0;
                  for (let d = 0; d < dur; d++) {
                    nW += columnLayout?.columnWidth?.(n.startColumn + d) ?? COLUMNWIDTH;
                  }
                  if (!nW) nW = COLUMNWIDTH;
                  const nX = ROWLABELWIDTH + nStartX;
                  return (
                    <div
                      key={n.id}
                      className="absolute rounded-sm flex items-center overflow-hidden"
                      style={{
                        left: `${nX}px`,
                        top: '2px',
                        width: `${nW}px`,
                        height: `${rowGhost.height - 4}px`,
                        backgroundColor: 'rgba(59,130,246,0.4)',
                        border: '1px solid rgba(59,130,246,0.6)',
                      }}
                    >
                      <span className="truncate text-[10px] px-1 text-blue-900/80 font-medium">{n.name}</span>
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
