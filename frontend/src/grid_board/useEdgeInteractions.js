// Edge drag-to-create, click-select, delete, and node position helpers.
// Generic version of useDependencyConnections.js.
// API calls extracted into persist callbacks passed from the adapter.

import { useState } from 'react';
import { playSound, startLoopSound, stopLoopSound } from '../assets/sound_registry';
import { isRowVisible } from './layoutMath';
import {
  LANE_DRAG_HIGHLIGHT_HEIGHT,
  MARGIN_BETWEEN_DRAG_HIGHLIGHT,
  LANE_HEADER_LINE_HEIGHT,
  LANE_HEADER_GAP,
} from './layoutMath';
import { useGridBoardContext } from './GridBoardContext.jsx';

/**
 * Hook for edge-connection interactions:
 * drag from node handles to create edges,
 * click to select, delete, and position helpers for SVG paths.
 *
 * Persist callbacks (adapter-supplied):
 * @param {Function} params.persistEdgeCreate  - async (sourceId, targetId, opts) => void
 * @param {Function} params.persistEdgeDelete  - async (sourceId, targetId) => void
 * @param {Function} params.persistEdgeUpdate  - async (sourceId, targetId, updates) => void
 */
export function useEdgeInteractions({
  // Data
  nodes,
  lanes,
  rows,
  edges,
  rowDisplaySettings,
  // Setters
  setEdges,
  // Layout
  COLUMNWIDTH,
  LANEWIDTH,
  ROWLABELWIDTH,
  ROWACTIONSWIDTH = 0,
  getRowHeight,
  isLaneVisible,
  getLaneYOffset,
  getRowYOffset,
  // Mode
  safeMode,
  // Warning/feedback (from useGridWarnings)
  addWarning,
  setBlockedMoveHighlight,
  // Callbacks
  onSuggestionOffer,
  // Settings
  defaultEdgeWeight = 'strong',
  // Column layout
  columnLayout,
  // Phase row offset
  getLanePhaseRowHeight,
  // Persist callbacks
  persistEdgeCreate,
  persistEdgeDelete,
  persistEdgeUpdate,
}) {
  const {
    containerRef,
    selectedNodes,
    setSelectedNodes,
    selectedEdges,
    setSelectedEdges,
    warningDuration,
    pushAction,
  } = useGridBoardContext();

  // â”€â”€ Edge drag state â”€â”€
  const [isDraggingEdge, setIsDraggingEdge] = useState(false);
  const [edgeStart, setEdgeStart] = useState(null);
  const [edgeEnd, setEdgeEnd] = useState({ x: 0, y: 0 });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Find node at position (hit-test)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const findNodeAtPosition = (x, y) => {
    for (const [id, node] of Object.entries(nodes)) {
      const row = rows[node.row];
      if (!row) continue;

      const lane = lanes[row.lane];
      if (!lane || !isLaneVisible(row.lane)) continue;
      if (!isRowVisible(node.row, rowDisplaySettings)) continue;

      const rowHeightVal = getRowHeight(node.row, rowDisplaySettings);
      const laneYOff = getLaneYOffset(row.lane);
      const rowYOff = getRowYOffset(node.row, row.lane);
      const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
      const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;

      const nodeX = columnLayout
        ? LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH + columnLayout.columnXOffset(node.startColumn)
        : LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH + node.startColumn * COLUMNWIDTH;
      const phaseRowOff = getLanePhaseRowHeight ? getLanePhaseRowHeight(row.lane) : 0;
      const nodeTopY = laneYOff + dropHighlightOffset + headerOffset + phaseRowOff + rowYOff;
      const nodeWidth = columnLayout
        ? (() => {
            const startX = columnLayout.columnXOffset(node.startColumn);
            const endIdx = node.startColumn + (node.duration || 1);
            const endX = endIdx < (columnLayout.offsets?.length ?? Infinity)
              ? columnLayout.columnXOffset(endIdx)
              : columnLayout.totalColumnsWidth;
            return endX - startX;
          })()
        : COLUMNWIDTH * node.duration;

      if (
        x >= nodeX - 10 &&
        x <= nodeX + nodeWidth + 10 &&
        y >= nodeTopY &&
        y <= nodeTopY + rowHeightVal
      ) {
        return { id: parseInt(id), ...node };
      }
    }
    return null;
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Get node handle position (for SVG edge paths)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getNodeHandlePosition = (nodeId, handleType) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const row = rows[node.row];
    if (!row) return null;

    const lane = lanes[row.lane];
    if (!lane || !isLaneVisible(row.lane)) return null;
    if (!isRowVisible(node.row, rowDisplaySettings)) return null;

    const rowHeightVal = getRowHeight(node.row, rowDisplaySettings);
    const laneYOff = getLaneYOffset(row.lane);
    const rowYOff = getRowYOffset(node.row, row.lane);
    const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;

    let nodeX, nodeWidth;
    if (node.x !== undefined) {
      nodeX = LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH + node.x;
      if (columnLayout) {
        const startX = columnLayout.columnXOffset(node.startColumn);
        const endIdx = node.startColumn + (node.duration || 1);
        const endX = endIdx < (columnLayout.offsets?.length ?? Infinity)
          ? columnLayout.columnXOffset(endIdx)
          : columnLayout.totalColumnsWidth;
        nodeWidth = endX - startX;
      } else {
        nodeWidth = COLUMNWIDTH * node.duration;
      }
    } else if (columnLayout) {
      nodeX = LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH + columnLayout.columnXOffset(node.startColumn);
      const endIdx = node.startColumn + (node.duration || 1);
      const endX = endIdx < (columnLayout.offsets?.length ?? Infinity)
        ? columnLayout.columnXOffset(endIdx)
        : columnLayout.totalColumnsWidth;
      nodeWidth = endX - columnLayout.columnXOffset(node.startColumn);
    } else {
      nodeX = LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH + node.startColumn * COLUMNWIDTH;
      nodeWidth = COLUMNWIDTH * node.duration;
    }
    const nodeY = laneYOff + dropHighlightOffset + headerOffset + (getLanePhaseRowHeight ? getLanePhaseRowHeight(row.lane) : 0) + rowYOff + rowHeightVal / 2;

    if (handleType === "source") {
      return { x: nodeX + nodeWidth, y: nodeY };
    } else {
      return { x: nodeX, y: nodeY };
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Edge drag start (create edge by dragging between handles)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleEdgeDragStart = (e, nodeId, handleType) => {
    if (safeMode) return;
    e.stopPropagation();
    e.preventDefault();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const initialX = e.clientX - containerRect.left;
    const initialY = e.clientY - containerRect.top;

    setEdgeStart({
      nodeId,
      handleType,
      x: initialX,
      y: initialY,
    });
    setEdgeEnd({ x: initialX, y: initialY });
    setIsDraggingEdge(true);

    let rafId = null;

    const onMouseMove = (moveEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const currentRect = containerRef.current?.getBoundingClientRect();
        if (!currentRect) { rafId = null; return; }

        setEdgeEnd({
          x: moveEvent.clientX - currentRect.left,
          y: moveEvent.clientY - currentRect.top,
        });
        rafId = null;
      });
    };

    const onMouseUp = async (upEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      const currentRect = containerRef.current?.getBoundingClientRect();
      if (!currentRect) {
        setIsDraggingEdge(false);
        setEdgeStart(null);
        return;
      }

      const targetNode = findNodeAtPosition(
        upEvent.clientX - currentRect.left,
        upEvent.clientY - currentRect.top
      );

      if (targetNode && targetNode.id !== nodeId) {
        const sourceId = handleType === "source" ? nodeId : targetNode.id;
        const targetId = handleType === "source" ? targetNode.id : nodeId;

        const exists = edges.some(c => c.source === sourceId && c.target === targetId);
        const reverseExists = edges.some(c => c.source === targetId && c.target === sourceId);

        if (!exists && !reverseExists) {
          const sourceNode = nodes[sourceId];
          const targetNodeData = nodes[targetId];

          if (sourceNode && targetNodeData) {
            const sourceEndColumn = sourceNode.startColumn + (sourceNode.duration || 1) - 1;
            const timingViolated = sourceEndColumn >= targetNodeData.startColumn;

            if (timingViolated && defaultEdgeWeight !== 'suggestion') {
              if (onSuggestionOffer) {
                onSuggestionOffer({ sourceId, targetId });
              } else {
                setBlockedMoveHighlight({
                  nodeId: sourceId,
                  edgeSource: sourceId,
                  edgeTarget: targetId,
                });
                setTimeout(() => setBlockedMoveHighlight(null), warningDuration);
                addWarning("Cannot create edge", "Source node must finish before target starts.");
              }
            } else {
              const weightToUse = timingViolated ? 'suggestion' : defaultEdgeWeight;
              const defaultReason = weightToUse === 'strong' ? 'is required for' : weightToUse === 'weak' ? 'should be before' : 'could be before';
              try {
                if (persistEdgeCreate) await persistEdgeCreate(sourceId, targetId, { weight: weightToUse !== 'strong' ? weightToUse : undefined, reason: defaultReason });
                setEdges(prev => [...prev, { source: sourceId, target: targetId, weight: weightToUse, reason: defaultReason }]);
                playSound('connectionCreate');

                pushAction({
                  description: 'Create edge',
                  undo: async () => {
                    if (persistEdgeDelete) await persistEdgeDelete(sourceId, targetId);
                    setEdges(prev => prev.filter(c => !(c.source === sourceId && c.target === targetId)));
                  },
                  redo: async () => {
                    if (persistEdgeCreate) await persistEdgeCreate(sourceId, targetId, { weight: weightToUse !== 'strong' ? weightToUse : undefined, reason: defaultReason });
                    setEdges(prev => [...prev, { source: sourceId, target: targetId, weight: weightToUse, reason: defaultReason }]);
                  },
                });
              } catch (err) {
                console.error("Failed to create edge:", err);
              }
            }
          }
        } else {
          addWarning("Edge already exists", exists ? "This exact edge already exists." : "A reverse edge already exists (would create cycle).");
        }
      }

      setIsDraggingEdge(false);
      setEdgeStart(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Edge click (select)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleEdgeClick = (e, edge) => {
    e.stopPropagation();
    setSelectedNodes(new Set());

    if (e.ctrlKey || e.metaKey) {
      setSelectedEdges(prev => {
        const exists = prev.some(c => c.source === edge.source && c.target === edge.target);
        if (exists) {
          const result = prev.filter(c => !(c.source === edge.source && c.target === edge.target));
          if (result.length === 0) playSound('milestoneDeselect');
          return result;
        } else {
          playSound('connectionSelect');
          return [...prev, edge];
        }
      });
    } else {
      const isSame = selectedEdges.length === 1 &&
                     selectedEdges[0].source === edge.source &&
                     selectedEdges[0].target === edge.target;
      if (isSame) {
        setSelectedEdges([]);
        playSound('milestoneDeselect');
      } else {
        setSelectedEdges([edge]);
        playSound('connectionSelect');
      }
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Delete edge
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDeleteEdge = async (edge) => {
    const deletedEdge = { ...edge };
    try {
      if (persistEdgeDelete) await persistEdgeDelete(edge.source, edge.target);
      setEdges(prev => prev.filter(c => !(c.source === edge.source && c.target === edge.target)));
      setSelectedEdges([]);
      playSound('connectionDelete');

      pushAction({
        description: 'Delete edge',
        undo: async () => {
          if (persistEdgeCreate) await persistEdgeCreate(deletedEdge.source, deletedEdge.target);
          if (deletedEdge.weight && deletedEdge.weight !== 'strong' && persistEdgeUpdate) {
            await persistEdgeUpdate(deletedEdge.source, deletedEdge.target, { weight: deletedEdge.weight });
          }
          if (deletedEdge.reason && persistEdgeUpdate) {
            await persistEdgeUpdate(deletedEdge.source, deletedEdge.target, { reason: deletedEdge.reason });
          }
          setEdges(prev => [...prev, { source: deletedEdge.source, target: deletedEdge.target, weight: deletedEdge.weight || 'strong', reason: deletedEdge.reason || null, description: deletedEdge.description || null }]);
        },
        redo: async () => {
          if (persistEdgeDelete) await persistEdgeDelete(deletedEdge.source, deletedEdge.target);
          setEdges(prev => prev.filter(c => !(c.source === deletedEdge.source && c.target === deletedEdge.target)));
        },
      });
    } catch (err) {
      console.error("Failed to delete edge:", err);
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Update edge weight / reason
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleUpdateEdge = async (edge, updates, { skipHistory = false } = {}) => {
    if (updates.weight) {
      const WEIGHT_ORDER = { suggestion: 0, weak: 1, strong: 2 };
      const oldWeight = edge.weight || 'strong';
      const newWeight = updates.weight;
      if ((WEIGHT_ORDER[newWeight] ?? 0) > (WEIGHT_ORDER[oldWeight] ?? 0)) {
        const sourceNode = nodes[edge.source];
        const targetNode = nodes[edge.target];
        if (sourceNode && targetNode) {
          const sourceEnd = sourceNode.startColumn + (sourceNode.duration || 1) - 1;
          if (sourceEnd >= targetNode.startColumn) {
            addWarning(
              `Cannot upgrade to ${newWeight}`,
              "The source node must finish before the target starts. Move the nodes apart first."
            );
            if (setBlockedMoveHighlight) {
              setBlockedMoveHighlight({
                nodeId: edge.source,
                edgeSource: edge.source,
                edgeTarget: edge.target,
              });
              setTimeout(() => setBlockedMoveHighlight(null), warningDuration);
            }
            return false;
          }
        }
      }
    }

    const DEFAULT_REASONS = ['is required for', 'should be before', 'could be before'];
    const WEIGHT_REASON_MAP = { strong: 'is required for', weak: 'should be before', suggestion: 'could be before' };
    if (updates.weight && !updates.reason) {
      const currentReason = edge.reason;
      if (!currentReason || DEFAULT_REASONS.includes(currentReason)) {
        updates = { ...updates, reason: WEIGHT_REASON_MAP[updates.weight] || currentReason };
      }
    }

    const oldValues = {};
    for (const key of Object.keys(updates)) {
      oldValues[key] = edge[key];
    }
    try {
      if (persistEdgeUpdate) await persistEdgeUpdate(edge.source, edge.target, updates);
      playSound('settingToggle');
      setEdges(prev => prev.map(c => {
        if (c.source === edge.source && c.target === edge.target) {
          return { ...c, ...updates };
        }
        return c;
      }));

      if (!skipHistory) {
        pushAction({
          description: 'Update edge',
          undo: async () => {
            if (persistEdgeUpdate) await persistEdgeUpdate(edge.source, edge.target, oldValues);
            setEdges(prev => prev.map(c => {
              if (c.source === edge.source && c.target === edge.target) {
                return { ...c, ...oldValues };
              }
              return c;
            }));
          },
          redo: async () => {
            if (persistEdgeUpdate) await persistEdgeUpdate(edge.source, edge.target, updates);
            setEdges(prev => prev.map(c => {
              if (c.source === edge.source && c.target === edge.target) {
                return { ...c, ...updates };
              }
              return c;
            }));
          },
        });
      }
      return true;
    } catch (err) {
      console.error("Failed to update edge:", err);
      return false;
    }
  };

  return {
    // Edge drag state
    isDraggingEdge,
    setIsDraggingEdge,
    edgeStart,
    setEdgeStart,
    edgeEnd,
    setEdgeEnd,
    // Handlers
    handleEdgeDragStart,
    handleEdgeClick,
    handleDeleteEdge,
    handleUpdateEdge,
    // Position helpers
    findNodeAtPosition,
    getNodeHandlePosition,
  };
}
