// Per-lane column cell grid.
// Generic version — lane/row/column terminology.
export default function GridColumnGrid({
  isCollapsed,
  laneHeight,
  rawHeight,
  laneRows,
  visibleRows,
  lane_key,
  columns,
  columnLabels,
  COLUMNWIDTH,
  ghost,
  isAddingNode,
  hoveredColumnCell,
  rowDisplaySettings,
  isRowVisible,
  getRowHeight,
  setHoveredColumnCell,
  handleColumnCellClick,
  rows,
  onSetDeadline,
  // Column layout
  columnLayout,
  collapsedColumns = new Set(),
  selectedColumns = new Set(),
  phases = [],
  showPhaseColorsInGrid = true,
  refactorMode = false,
}) {
  const canClickToAdd = isAddingNode || refactorMode;
  const totalColumnsWidth = columnLayout?.totalColumnsWidth ?? (columns || 0) * COLUMNWIDTH;

  // Build a lookup: columnIndex → phase color
  const phaseColorMap = {};
  if (showPhaseColorsInGrid && phases.length > 0) {
    const laneIdNum = typeof lane_key === 'string' ? parseInt(lane_key, 10) : lane_key;
    for (const phase of phases) {
      const phaseLane = phase.lane;
      if (phaseLane !== null && phaseLane !== undefined && phaseLane !== laneIdNum) continue;
      for (let c = phase.start_index; c < phase.start_index + phase.duration; c++) {
        if (!(c in phaseColorMap)) {
          phaseColorMap[c] = phase.color || '#3b82f6';
        }
      }
    }
  }

  return (
    <>
      {!isCollapsed && (
        <div
          className="border-y border-slate-200 relative"
          style={{ height: `${laneHeight}px`, width: `${totalColumnsWidth}px`, backgroundColor: '#fafbfc' }}
        >
          {laneRows.map((row_key) => {
            if (!isRowVisible(row_key, rowDisplaySettings)) return null;

            const rowHeight = getRowHeight(row_key, rowDisplaySettings);
            const visibleRowIndex = visibleRows.indexOf(row_key);
            const isLastVisible = visibleRowIndex === visibleRows.length - 1;
            const rowDeadline = rows?.[row_key]?.hard_deadline;

            let rowYOffset = 0;
            for (let vi = 0; vi < visibleRowIndex; vi++) {
              rowYOffset += getRowHeight(visibleRows[vi], rowDisplaySettings);
            }

            return (
              <div
                className="relative"
                style={{
                  position: 'absolute',
                  top: `${rowYOffset}px`,
                  left: 0,
                  width: `${totalColumnsWidth}px`,
                  height: `${rowHeight}px`,
                  borderBottom: isLastVisible ? "none" : "1px solid #e2e8f0",
                }}
                key={`${row_key}_node`}
              >
                {[...Array(columns)].map((_, i) => {
                  const isColCollapsed = collapsedColumns.has(i);
                  const isColSelected = selectedColumns.has(i);
                  const colX = columnLayout?.columnXOffset(i) ?? (i * COLUMNWIDTH);
                  const colW = columnLayout?.columnWidth(i) ?? COLUMNWIDTH;

                  if (isColCollapsed) {
                    return (
                      <div
                        key={i}
                        className="absolute top-0"
                        style={{
                          left: `${colX}px`,
                          width: `${colW}px`,
                          height: `${rowHeight}px`,
                          backgroundColor: '#94a3b8',
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.25) 2px, rgba(255,255,255,0.25) 4px)',
                          opacity: ghost?.id === lane_key ? 0.2 : 0.7,
                        }}
                      />
                    );
                  }

                  const isHovered = canClickToAdd &&
                    hoveredColumnCell?.rowId === row_key &&
                    hoveredColumnCell?.columnIndex === i;
                  const colInfo = columnLabels && columnLabels[i];
                  const hasPurpose = !!colInfo?.purpose;
                  const purposeLanes = colInfo?.purposeLanes;
                  const showPurposeHighlight = hasPurpose && (
                    purposeLanes === null || purposeLanes === undefined ||
                    (Array.isArray(purposeLanes) && purposeLanes.includes(lane_key))
                  );
                  const isPastDeadline = rowDeadline !== null && rowDeadline !== undefined && i > rowDeadline;
                  const isDeadlineCol = rowDeadline !== null && rowDeadline !== undefined && i === rowDeadline;
                  const phaseColor = phaseColorMap[i];

                  let cellBg = {};
                  if (!isHovered) {
                    if (isPastDeadline) {
                      cellBg = { backgroundColor: 'rgba(15, 23, 42, 0.12)', backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(15,23,42,0.04) 3px, rgba(15,23,42,0.04) 6px)' };
                    } else if (showPurposeHighlight) {
                      cellBg = { backgroundColor: isColSelected ? 'rgba(30, 41, 59, 0.10)' : 'rgba(30, 41, 59, 0.06)' };
                    } else if (isColSelected) {
                      cellBg = { backgroundColor: phaseColor ? `${phaseColor}22` : 'rgba(59, 130, 246, 0.08)' };
                    } else if (phaseColor) {
                      cellBg = {
                        backgroundColor: `${phaseColor}14`,
                        backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 4px, ${phaseColor}0a 4px, ${phaseColor}0a 8px)`,
                      };
                    }
                  }

                  return (
                    <div
                      data-grid-col-index={i}
                      data-grid-col-row-id={row_key}
                      data-grid-col-row-name={rows?.[row_key]?.name || ''}
                      data-grid-col-lane-id={lane_key}
                      data-grid-col-label={colInfo?.dateStr || ''}
                      data-grid-col-weekday={colInfo?.dayNameShort || ''}
                      className={`grid-col-cell absolute top-0 border-r border-slate-100 transition-colors ${
                        canClickToAdd ? 'cursor-pointer hover:bg-blue-50' : ''
                      } ${isHovered ? 'bg-blue-100' : ''}`}
                      style={{
                        left: `${colX}px`,
                        width: `${colW}px`,
                        height: `${rowHeight}px`,
                        opacity: ghost?.id === lane_key ? 0.2 : 1,
                        pointerEvents: 'auto',
                        ...cellBg,
                        ...(isDeadlineCol ? { borderRight: '2.5px solid #ef4444' } : {}),
                      }}
                      key={i}
                      onMouseEnter={() => canClickToAdd && setHoveredColumnCell({ rowId: row_key, columnIndex: i })}
                      onMouseLeave={() => setHoveredColumnCell(null)}
                      onClick={(e) => {
                        if (canClickToAdd) {
                          e.stopPropagation();
                          handleColumnCellClick(row_key, i);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onSetDeadline) {
                          const currentDeadline = rows?.[row_key]?.hard_deadline;
                          if (currentDeadline === i) {
                            onSetDeadline(row_key, null);
                          } else {
                            onSetDeadline(row_key, i);
                          }
                        }
                      }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Empty placeholder when all rows hidden */}
          {rawHeight === 0 && laneHeight > 0 && (
            <div
              className="relative"
              style={{ height: `${laneHeight}px`, width: `${totalColumnsWidth}px` }}
            >
              {[...Array(columns)].map((_, i) => {
                if (collapsedColumns.has(i)) return null;
                const colX = columnLayout?.columnXOffset(i) ?? (i * COLUMNWIDTH);
                const colW = columnLayout?.columnWidth(i) ?? COLUMNWIDTH;
                return (
                  <div
                    className="absolute top-0 border-r border-dashed border-slate-200"
                    style={{
                      left: `${colX}px`,
                      height: `${laneHeight}px`,
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

      {isCollapsed && (
        <div
          className="border-y border-slate-200 bg-slate-50"
          style={{ height: `${laneHeight}px`, width: `${totalColumnsWidth}px` }}
        />
      )}
    </>
  );
}
