import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { lightenColor } from './layoutMath';

/**
 * GridNodeLayer â€“ renders all nodes (milestones) positioned over the grid.
 * Includes Gantt-like time span bars, deadline flags, and node rectangles with
 * selection, inline rename, edge-resize handles, and connection handles.
 *
 * Generic port of DependencyMilestoneLayer â€“ every domain term is replaced:
 *   milestone â†’ node, team â†’ lane, task â†’ row, day â†’ column
 */
export default function GridNodeLayer({
  laneOrder,
  lanes,
  rows,
  nodes,
  rowDisplaySettings,
  hoveredNode,
  selectedNodes,
  editingNodeId,
  editingNodeName,
  blockedMoveHighlight,
  viewMode,
  mode,
  safeMode,
  hideCollapsedNodes,
  LANEWIDTH,
  ROWLABELWIDTH,
  ROWACTIONSWIDTH = 0,
  COLUMNWIDTH,
  LANE_DRAG_HIGHLIGHT_HEIGHT,
  MARGIN_BETWEEN_DRAG_HIGHLIGHT,
  LANE_HEADER_LINE_HEIGHT,
  LANE_HEADER_GAP,
  // Column layout
  columnLayout,
  collapsedColumns = new Set(),
  isLaneVisible,
  isLaneCollapsed,
  getVisibleRows,
  isRowVisible,
  getRowHeight,
  getLaneYOffset,
  getRowYOffset,
  handleNodeMouseDown,
  handleNodeClick,
  setHoveredNode,
  setEditingNodeName,
  setEditingNodeId,
  handleNodeRenameSubmit,
  handleNodeEdgeResize,
  handleConnectionDragStart,
  // Refactor mode
  refactorMode,
  handleRefactorDrag,
  // Expanded row view (Gantt)
  expandedRowView,
  // Deadline
  onSetDeadline,
  totalColumns,
  // Lane phase row height
  getLanePhaseRowHeight,
  // Ghost nodes for inline review preview
  ghostNodes = [],
  // Toggle done callback
  persistToggleNodeDone,
  // Current time index for overdue/warning detection (null = disabled)
  currentTimeIndex = null,
  // Double-click handler — receives the node object
  onNodeDoubleClick = null,
}) {
  const [todoModal, setTodoModal] = useState(null); // { nodeId, incompleteTodos: [] }

  const handleToggleDone = async (nodeId) => {
    if (!persistToggleNodeDone) return;
    try {
      await persistToggleNodeDone(nodeId);
    } catch (err) {
      if (err.data?.incomplete_todos) {
        setTodoModal({ nodeId, incompleteTodos: err.data.incomplete_todos });
      }
    }
  };

  const handleForceComplete = async () => {
    if (!todoModal || !persistToggleNodeDone) return;
    try {
      await persistToggleNodeDone(todoModal.nodeId, { force_complete: true });
    } catch { /* ignore */ }
    setTodoModal(null);
  };

  // Helper: get pixel X offset for a column index using columnLayout
  const getColumnX = (colIndex) => {
    const sidebarW = LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH;
    if (columnLayout) return sidebarW + columnLayout.columnXOffset(colIndex);
    return sidebarW + colIndex * COLUMNWIDTH;
  };

  // Helper: get pixel width for a node spanning startColumn..startColumn+duration
  const getNodePixelWidth = (startIndex, duration) => {
    if (columnLayout) {
      const startX = columnLayout.columnXOffset(startIndex);
      const endIdx = startIndex + duration;
      const endX = endIdx < totalColumns ? columnLayout.columnXOffset(endIdx) : columnLayout.totalColumnsWidth;
      return endX - startX;
    }
    return duration * COLUMNWIDTH;
  };

  // Helper: check if any column in a range is collapsed
  const isAnyColumnCollapsed = (startIndex, duration) => {
    for (let i = startIndex; i < startIndex + duration; i++) {
      if (collapsedColumns.has(i)) return true;
    }
    return false;
  };

  // Helper: check if ALL columns in a range are collapsed
  const isAllColumnsCollapsed = (startIndex, duration) => {
    for (let i = startIndex; i < startIndex + duration; i++) {
      if (!collapsedColumns.has(i)) return false;
    }
    return true;
  };

  // Compute row time spans for Gantt-like bars
  const getRowTimeSpan = (rowId) => {
    const row = rows[rowId];
    if (!row || !row.milestones || row.milestones.length === 0) return null;
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const nRef of row.milestones) {
      const n = nodes[nRef.id];
      if (!n) continue;
      minStart = Math.min(minStart, n.startColumn);
      maxEnd = Math.max(maxEnd, n.startColumn + (n.duration || 1));
    }
    if (minStart === Infinity) return null;
    return { start: minStart, end: maxEnd };
  };

  return (
    <>
    <div
      className="absolute top-0 left-0 w-full h-full"
      style={{ zIndex: 20, pointerEvents: 'none' }}
    >
      {/* Expanded row view: Gantt-like time span bars behind nodes */}
      {expandedRowView && laneOrder.map((lane_key) => {
        if (!isLaneVisible(lane_key)) return null;
        if (isLaneCollapsed(lane_key)) return null;

        const lane = lanes[lane_key];
        if (!lane) return null;

        const visibleRows = getVisibleRows(lane_key);
        const laneColor = lane.color || '#94a3b8';

        return visibleRows.map((row_key) => {
          if (!isRowVisible(row_key, rowDisplaySettings)) return null;
          if (hideCollapsedNodes && rowDisplaySettings[row_key]?.size === 'small') return null;

          const span = getRowTimeSpan(row_key);
          if (!span) return null;

          // Hide if ALL columns in span are collapsed
          if (isAllColumnsCollapsed(span.start, span.end - span.start)) return null;

          const rowHeight = getRowHeight(row_key, rowDisplaySettings);
          const laneYOffset = getLaneYOffset(lane_key);
          const rowYOffset = getRowYOffset(row_key, lane_key);
          const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
          const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
          const phaseRowOffset = getLanePhaseRowHeight ? getLanePhaseRowHeight(lane_key) : 0;
          const rowY = laneYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + rowYOffset;

          const barLeft = getColumnX(span.start);
          const barWidth = getNodePixelWidth(span.start, span.end - span.start);

          return (
            <div
              key={`gantt-${row_key}`}
              className="absolute rounded"
              style={{
                left: `${barLeft}px`,
                top: `${rowY + 2}px`,
                width: `${barWidth}px`,
                height: `${rowHeight - 4}px`,
                backgroundColor: lightenColor(laneColor, 0.82),
                border: `1px solid ${lightenColor(laneColor, 0.65)}`,
                zIndex: 15,
                pointerEvents: 'none',
              }}
            >
              {barWidth > 60 && (
                <div className="flex items-center h-full px-2 overflow-hidden">
                  <span className="truncate text-[10px] font-medium" style={{ color: laneColor, opacity: 0.7 }}>
                    {rows[row_key]?.name}
                  </span>
                </div>
              )}
            </div>
          );
        });
      })}

      {/* Deadline flag markers for rows with hard_deadline */}
      {laneOrder.map((lane_key) => {
        if (!isLaneVisible(lane_key)) return null;
        if (isLaneCollapsed(lane_key)) return null;

        const lane = lanes[lane_key];
        if (!lane) return null;

        const visibleRows = getVisibleRows(lane_key);

        return visibleRows.map((row_key) => {
          if (!isRowVisible(row_key, rowDisplaySettings)) return null;

          const row = rows[row_key];
          if (!row) return null;
          const deadline = row.hard_deadline;
          if (deadline === null || deadline === undefined) return null;

          // Hide flag if deadline column is collapsed
          if (collapsedColumns.has(deadline)) return null;

          const rowHeight = getRowHeight(row_key, rowDisplaySettings);
          const laneYOffset = getLaneYOffset(lane_key);
          const rowYOffset = getRowYOffset(row_key, lane_key);
          const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
          const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
          const phaseRowOffset = getLanePhaseRowHeight ? getLanePhaseRowHeight(lane_key) : 0;
          const rowY = laneYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + rowYOffset;

          const flagLeft = getColumnX(deadline) + (columnLayout?.columnWidth(deadline) ?? COLUMNWIDTH) - 6;

          return (
            <div
              key={`deadline-${row_key}`}
              className="absolute flex flex-col items-center group"
              style={{
                left: `${flagLeft}px`,
                top: `${rowY}px`,
                height: `${rowHeight}px`,
                zIndex: 18,
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
              title={`Hard deadline: column ${deadline + 1} â€” click to remove`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSetDeadline) onSetDeadline(row_key, null);
              }}
            >
              <FlagIcon
                style={{ fontSize: 14, color: '#ef4444', marginTop: 1 }}
                className="drop-shadow-sm group-hover:scale-110 transition-transform"
              />
              <div
                style={{
                  width: '2px',
                  flex: 1,
                  backgroundColor: '#ef4444',
                  opacity: 0.5,
                  marginTop: '-2px',
                }}
              />
            </div>
          );
        });
      })}

      {/* Main node rectangles */}
      {laneOrder.map((lane_key) => {
        if (!isLaneVisible(lane_key)) return null;
        if (isLaneCollapsed(lane_key)) return null;

        const lane = lanes[lane_key];
        if (!lane) return null;

        const visibleRows = getVisibleRows(lane_key);

        return visibleRows.map((row_key) => {
          if (!isRowVisible(row_key, rowDisplaySettings)) return null;

          const rowHeight = getRowHeight(row_key, rowDisplaySettings);
          const laneYOffset = getLaneYOffset(lane_key);
          const rowYOffset = getRowYOffset(row_key, lane_key);
          const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
          const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
          const phaseRowOffset = getLanePhaseRowHeight ? getLanePhaseRowHeight(lane_key) : 0;
          const rowY = laneYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + rowYOffset;

          return rows[row_key]?.milestones?.map((node_from_row) => {
            const node = nodes[node_from_row.id];
            if (!node) return null;

            // Hide nodes for collapsed rows if setting is enabled
            if (hideCollapsedNodes && rowDisplaySettings[row_key]?.size === 'small') {
              return null;
            }

            // Hide nodes only if ALL columns are collapsed
            if (isAllColumnsCollapsed(node.startColumn, node.duration || 1)) {
              return null;
            }

            const showConnect = false;
            const isSelected = selectedNodes.has(node.id);
            const isEditing = editingNodeId === node.id;
            const showEdgeResize = viewMode === "schedule" && hoveredNode === node.id;
            const isBlockedHighlight = blockedMoveHighlight?.nodeId === node.id;

            // Get lane color for node
            const nodeColor = node.color || lane.color || '#facc15';
            const nodeDone = !!node.is_done_effective;
            const effectiveNodeColor = nodeDone ? '#22c55e' : nodeColor;

            // Overdue / warning based on current time index
            const nodeEnd = node.startColumn + (node.duration || 1);
            const isOverdue  = !nodeDone && currentTimeIndex !== null && currentTimeIndex >= nodeEnd;
            const isWarning  = !nodeDone && !isOverdue && currentTimeIndex !== null && currentTimeIndex === nodeEnd - 1;

            // Use node.x (pixel offset) during drag for smooth visual feedback,
            // otherwise use columnLayout-based position
            const nodeLeft = node.x !== undefined
              ? (LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH + node.x)
              : getColumnX(node.startColumn);
            const nodeWidth = getNodePixelWidth(node.startColumn, node.duration || 1);

            return (
              <div
                data-node
                data-node-id={node.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (refactorMode) {
                    handleRefactorDrag(e, "node", {
                      id: node.id,
                      name: node.name,
                      description: node.description || "",
                      color: nodeColor,
                      rowId: row_key,
                      rowName: rows[row_key]?.name || "",
                    });
                    return;
                  }
                  if (!isEditing) {
                    handleNodeMouseDown(e, node_from_row.id);
                  }
                }}
                onClick={(e) => {
                  if (!isEditing) {
                    handleNodeClick(e, node.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!refactorMode && onNodeDoubleClick) {
                    onNodeDoubleClick(node);
                  }
                }}
                title={`${node.name}${rows[row_key]?.name ? `\n${rows[row_key].name}` : ''}`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className={`absolute rounded cursor-pointer ${
                  refactorMode
                    ? 'ring-2 ring-orange-400 ring-offset-1'
                    : isBlockedHighlight
                      ? 'ring-2 ring-red-500 ring-offset-1 shadow-lg animate-pulse'
                      : isSelected
                        ? 'ring-2 ring-blue-500 ring-offset-1 shadow-lg'
                        : isOverdue
                          ? 'ring-2 ring-red-500 ring-offset-1'
                          : isWarning
                            ? 'ring-2 ring-amber-400 ring-offset-1'
                            : 'hover:brightness-95'
                }`}
                style={{
                  left: `${nodeLeft}px`,
                  top: `${rowY}px`,
                  width: `${nodeWidth}px`,
                  height: `${rowHeight - 4}px`,
                  backgroundColor: effectiveNodeColor,
                  pointerEvents: 'auto',
                  zIndex: isSelected ? 25 : 20,
                  marginTop: '2px',
                  opacity: nodeDone ? 0.75 : 1,
                }}
                key={node.id}
              >
                {/* Node name */}
                <div className="flex items-center h-full px-2 overflow-hidden gap-1">
                  {nodeDone && (
                    <CheckCircleIcon style={{ fontSize: 12, flexShrink: 0 }} className="text-white drop-shadow-sm" />
                  )}
                  {isOverdue && (
                    <WarningAmberIcon style={{ fontSize: 12, flexShrink: 0, color: '#ef4444' }} className="drop-shadow-sm" />
                  )}
                  {isWarning && (
                    <WarningAmberIcon style={{ fontSize: 12, flexShrink: 0, color: '#f59e0b' }} className="drop-shadow-sm" />
                  )}
                  <span className={`truncate text-xs ${isSelected ? 'text-white' : ''} ${nodeDone ? 'text-white' : ''}`}>
                    {node.name}
                  </span>
                </div>

                {/* Edit name icon - shown when selected (single) and not already editing */}
                {isSelected && selectedNodes.size === 1 && !isEditing && (
                  <div
                    className="absolute -top-7 left-0 flex items-center gap-1"
                    style={{ pointerEvents: 'auto', zIndex: 30 }}
                  >
                    <div
                      className="flex items-center gap-1 bg-white rounded shadow-md border border-slate-200 px-1.5 py-0.5 cursor-pointer hover:bg-slate-50 transition"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNodeId(node.id);
                        setEditingNodeName(node.name);
                      }}
                    >
                      <EditIcon style={{ fontSize: 12 }} className="text-slate-500" />
                      <span className="text-[10px] text-slate-500">Rename</span>
                    </div>
                    {persistToggleNodeDone && (
                      <div
                        className={`flex items-center gap-1 rounded shadow-md border px-1.5 py-0.5 cursor-pointer transition ${
                          nodeDone
                            ? 'bg-green-50 border-green-300 hover:bg-green-100'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleDone(node.id);
                        }}
                      >
                        <CheckCircleIcon style={{ fontSize: 12 }} className={nodeDone ? 'text-green-500' : 'text-slate-400'} />
                        <span className={`text-[10px] ${nodeDone ? 'text-green-600' : 'text-slate-500'}`}>
                          {nodeDone ? 'Undo' : 'Done'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline rename input */}
                {isEditing && (
                  <div
                    className="absolute -top-8 left-0 z-30"
                    style={{ pointerEvents: 'auto', minWidth: '160px' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={editingNodeName}
                      onChange={(e) => setEditingNodeName(e.target.value)}
                      onBlur={() => handleNodeRenameSubmit(node.id, editingNodeName)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          handleNodeRenameSubmit(node.id, editingNodeName);
                        }
                        if (e.key === 'Escape') {
                          setEditingNodeId(null);
                          setEditingNodeName('');
                        }
                      }}
                      className="w-full px-2 py-1 text-xs font-medium bg-white border-2 border-blue-500 rounded shadow-lg outline-none"
                    />
                  </div>
                )}

                {/* Edge resize handles - only in schedule mode */}
                {showEdgeResize && (
                  <>
                    <div
                      className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
                      style={{ pointerEvents: 'auto', zIndex: 5 }}
                      onMouseDown={(e) => handleNodeEdgeResize(e, node.id, "left")}
                    />
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-black/10"
                      style={{ pointerEvents: 'auto', zIndex: 5 }}
                      onMouseDown={(e) => handleNodeEdgeResize(e, node.id, "right")}
                    />
                  </>
                )}

                {/* Connection handles - only in dependency/edge mode */}
                {viewMode === "dependency" && !safeMode && (
                  <>
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
                        showConnect
                          ? 'w-3 h-3 bg-indigo-500 hover:scale-125'
                          : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
                      }`}
                      style={{ pointerEvents: 'auto', zIndex: 10 }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleConnectionDragStart(e, node.id, "target");
                      }}
                    />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 rounded-full border-2 border-white shadow cursor-crosshair transition-all ${
                        showConnect
                          ? 'w-3 h-3 bg-indigo-500 hover:scale-125'
                          : 'w-2 h-2 bg-slate-400 hover:bg-indigo-500 hover:w-3 hover:h-3'
                      }`}
                      style={{ pointerEvents: 'auto', zIndex: 10 }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleConnectionDragStart(e, node.id, "source");
                      }}
                    />
                  </>
                )}
              </div>
            );
          });
        });
      })}

      {/* Ghost nodes — inline review preview for create/update/move milestone */}
      {ghostNodes.map((gn) => {
        const laneId = rows[gn.row]?.lane;
        if (laneId == null || !isLaneVisible(laneId)) return null;

        const rowHeight = getRowHeight(gn.row, rowDisplaySettings);
        const laneYOffset = getLaneYOffset(laneId);
        const rowYOffset = getRowYOffset(gn.row, laneId);
        const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
        const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
        const phaseRowOffset = getLanePhaseRowHeight ? getLanePhaseRowHeight(laneId) : 0;
        const rowY = laneYOffset + dropHighlightOffset + headerOffset + phaseRowOffset + rowYOffset;

        const nodeLeft = getColumnX(gn.startColumn);
        const nodeWidth = getNodePixelWidth(gn.startColumn, gn.duration || 1);

        const color = gn.isCreate ? '#22c55e' : gn.isUpdate ? '#f59e0b' : '#06b6d4';
        const bgColor = gn.isCreate ? 'rgba(34,197,94,0.22)' : gn.isUpdate ? 'rgba(245,158,11,0.22)' : 'rgba(6,182,212,0.22)';
        const borderColor = gn.isCreate ? 'rgba(34,197,94,0.7)' : gn.isUpdate ? 'rgba(245,158,11,0.7)' : 'rgba(6,182,212,0.7)';

        return (
          <div
            key={gn.id}
            className="absolute rounded flex items-center overflow-hidden"
            style={{
              left: `${nodeLeft}px`,
              top: `${rowY + 2}px`,
              width: `${nodeWidth}px`,
              height: `${rowHeight - 4}px`,
              backgroundColor: bgColor,
              border: `2px dashed ${borderColor}`,
              zIndex: 25,
              pointerEvents: 'none',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            <span className="truncate text-[10px] px-1.5 font-semibold" style={{ color }}>{gn.name}</span>
          </div>
        );
      })}
    </div>

    {/* TODO confirmation modal */}
    {todoModal && (
      <>
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998]" onClick={() => setTodoModal(null)} />
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-5 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <WarningAmberIcon style={{ fontSize: 18 }} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-900">Incomplete TODOs</h3>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              This milestone has incomplete TODOs. Mark all as done?
            </p>
            <div className="space-y-1 mb-4 max-h-40 overflow-y-auto">
              {todoModal.incompleteTodos.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setTodoModal(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleForceComplete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Complete all & mark done
              </button>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}
