// Lane drag, row drag, and marquee (lasso) selection handlers.
// Generic version of useDependencyDrag.js.
// API calls extracted into persist callbacks passed from the adapter.

import { useState, useRef } from 'react';
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
 * Hook for lane reordering drag, row reordering/cross-lane drag,
 * and marquee (lasso) multi-select on the canvas background.
 *
 * @param {object} params
 * @param {Function} params.persistLaneOrder  - async (newOrder) => void
 * @param {Function} params.persistRowOrder   - async (rowId, laneId, newOrder) => void
 */
export function useDragInteractions({
  // Data
  nodes,
  lanes,
  rows,
  laneOrder,
  rowDisplaySettings,
  laneDisplaySettings,
  // Setters
  setLanes,
  setLaneOrder,
  // Layout
  COLUMNWIDTH,
  LANEWIDTH,
  ROWLABELWIDTH,
  ROWACTIONSWIDTH = 0,
  getRowHeight,
  getLaneHeight,
  isLaneVisible,
  getLaneYOffset,
  getRowYOffset,
  getVisibleRows,
  // Ref from orchestrator
  justDraggedRef,
  // Phase row offset
  getLanePhaseRowHeight,
  // Layout constants (includes effective HEADER_HEIGHT)
  layoutConstants,
  // Column layout
  columnLayout,
  collapsedColumns,
  // Persist callbacks (adapter-supplied)
  persistLaneOrder,
  persistRowOrder,
}) {
  const {
    containerRef,
    selectedNodes,
    setSelectedNodes,
    setSelectedEdges,
    pushAction,
  } = useGridBoardContext();

  // ── Lane drag state ──
  const [ghost, setGhost] = useState(null);
  const [dropIndex, _setDropIndex] = useState(null);
  const dropIndexRef = useRef(null);
  const setDropIndex = (val) => { dropIndexRef.current = val; _setDropIndex(val); };

  // ── Row drag state ──
  const [rowGhost, setRowGhost] = useState(null);
  const [rowDropTarget, _setRowDropTarget] = useState(null);
  const rowDropTargetRef = useRef(null);
  const setRowDropTarget = (val) => { rowDropTargetRef.current = val; _setRowDropTarget(val); };
  const [moveModal, setMoveModal] = useState(null);

  // ── Marquee state ──
  const [marqueeRect, setMarqueeRect] = useState(null);

  // ────────────────────────────────────────
  // Handle lane drag — allowed in all modes (reordering is non-destructive)
  // ────────────────────────────────────────
  const handleLaneDrag = (e, laneId, orderIndex) => {
    e.preventDefault();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const lane = lanes[laneId];
    if (!lane) return;

    const startY = e.clientY;
    let currentOrderIndex = orderIndex;

    const laneYOffset = getLaneYOffset(laneId);
    const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
    const laneTopY = laneYOffset + dropHighlightOffset + headerOffset;
    const cursorY = e.clientY - containerRect.top;
    const offsetY = cursorY - laneTopY;
    const laneHeight = getLaneHeight(laneId);

    // Collect nodes belonging to this lane for ghost rendering
    const laneNodes = [];
    for (const [nId, n] of Object.entries(nodes)) {
      const row = rows[n.row];
      if (!row || !lane.rows.includes(n.row)) continue;
      laneNodes.push({ ...n, id: parseInt(nId) });
    }

    setGhost({
      id: laneId,
      name: lane.name,
      color: lane.color,
      y: cursorY,
      offsetY,
      height: laneHeight,
      laneRows: lane.rows,
      nodes: laneNodes,
      laneYOffset: laneTopY,
    });
    setDropIndex(orderIndex);

    const onMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - containerRect.top;
      setGhost(prev => prev ? { ...prev, y: deltaY } : null);

      const perLaneOverhead =
        LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2 +
        LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;

      let cumulativeY = layoutConstants?.HEADER_HEIGHT || 0;
      let newDropIndex = 0;
      const visibleLanes = laneOrder.filter(lid => isLaneVisible(lid));

      for (let i = 0; i < visibleLanes.length; i++) {
        const lid = visibleLanes[i];
        const totalH = perLaneOverhead + getLaneHeight(lid);
        if (deltaY < cumulativeY + totalH / 2) {
          newDropIndex = i;
          break;
        }
        cumulativeY += totalH;
        newDropIndex = i + 1;
      }
      setDropIndex(newDropIndex);
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');

      const visibleLanes = laneOrder.filter(lid => isLaneVisible(lid));
      const currentVisibleIndex = visibleLanes.indexOf(laneId);
      const finalDropIndex = dropIndexRef.current;

      if (finalDropIndex !== null && finalDropIndex !== currentVisibleIndex) {
        const newVisibleLanes = visibleLanes.filter(lid => lid !== laneId);
        newVisibleLanes.splice(finalDropIndex, 0, laneId);

        const hiddenLanes = laneOrder.filter(lid => !isLaneVisible(lid));
        const newOrder = [...newVisibleLanes, ...hiddenLanes];

        const oldOrder = [...laneOrder];

        setLaneOrder(newOrder);
        try {
          const persistOrder = newOrder.filter(lid => !lanes[lid]?._virtual);
          if (persistLaneOrder) await persistLaneOrder(persistOrder);
          playSound('teamDragDrop');

          pushAction({
            description: 'Reorder lanes',
            undo: async () => {
              setLaneOrder(oldOrder);
              const oldPersistOrder = oldOrder.filter(lid => !lanes[lid]?._virtual);
              if (persistLaneOrder) await persistLaneOrder(oldPersistOrder);
            },
            redo: async () => {
              setLaneOrder(newOrder);
              if (persistLaneOrder) await persistLaneOrder(persistOrder);
            },
          });
        } catch (err) {
          console.error("Failed to save lane order:", err);
        }
      }

      setGhost(null);
      setDropIndex(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  };

  // ────────────────────────────────────────
  // Handle row drag — allowed in all modes (reordering is non-destructive)
  // ────────────────────────────────────────
  const handleRowDrag = (e, rowId, laneId, rowIndex) => {
    e.preventDefault();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const row = rows[rowId];
    if (!row) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const rowHeight = getRowHeight(rowId, rowDisplaySettings);

    // Collect nodes for this row
    const rowNodes = [];
    for (const [nId, n] of Object.entries(nodes)) {
      if (n.row === rowId) {
        rowNodes.push({ ...n, id: parseInt(nId) });
      }
    }

    const laneYOffset = getLaneYOffset(laneId);
    const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;
    const phaseRowH = getLanePhaseRowHeight ? getLanePhaseRowHeight(laneId) : 0;
    const rowYOff = getRowYOffset(rowId, laneId);
    const rowTopY = laneYOffset + dropHighlightOffset + headerOffset + phaseRowH + rowYOff;
    const cursorY = e.clientY - containerRect.top;

    setRowGhost({
      rowKey: rowId,
      laneKey: laneId,
      name: row.name,
      height: rowHeight,
      width: ROWLABELWIDTH,
      x: e.clientX - containerRect.left,
      y: cursorY,
      nodes: rowNodes,
      rowTopY,
      offsetY: cursorY - rowTopY,
    });

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - containerRect.left;
      const y = moveEvent.clientY - containerRect.top;
      setRowGhost(prev => prev ? { ...prev, x, y } : null);

      let targetLaneId = null;
      let insertIndex = 0;

      const rowAreaOverhead =
        LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2 +
        LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;

      for (const lid of laneOrder) {
        if (!isLaneVisible(lid)) continue;
        const laneYOff = getLaneYOffset(lid);
        const laneH = getLaneHeight(lid);
        const totalLaneH = rowAreaOverhead + laneH;

        if (y >= laneYOff && y <= laneYOff + totalLaneH) {
          targetLaneId = lid;
          const visibleRows = getVisibleRows(lid);
          let rowCumY = laneYOff + rowAreaOverhead;

          for (let i = 0; i < visibleRows.length; i++) {
            const rh = getRowHeight(visibleRows[i], rowDisplaySettings);
            if (y < rowCumY + rh / 2) {
              insertIndex = i;
              break;
            }
            rowCumY += rh;
            insertIndex = i + 1;
          }
          break;
        }
      }

      if (targetLaneId) {
        setRowDropTarget({ laneId: targetLaneId, insertIndex });
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');

      const finalRowDropTarget = rowDropTargetRef.current;
      if (finalRowDropTarget) {
        const { laneId: targetLaneId, insertIndex } = finalRowDropTarget;

        if (targetLaneId === laneId) {
          // Same lane reorder
          const visibleRows = getVisibleRows(laneId);
          const currentIndex = visibleRows.indexOf(rowId);

          if (currentIndex !== -1 && insertIndex !== currentIndex) {
            const newOrder = [...visibleRows];
            newOrder.splice(currentIndex, 1);
            const adjustedIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex;
            newOrder.splice(adjustedIndex, 0, rowId);

            const lane = lanes[laneId];
            const hiddenRows = lane.rows.filter(rid => !isRowVisible(rid, rowDisplaySettings));
            const fullOrder = [...newOrder, ...hiddenRows];

            const oldFullOrder = [...lane.rows];

            setLanes(prev => ({
              ...prev,
              [laneId]: { ...prev[laneId], rows: fullOrder }
            }));

            if (!lanes[laneId]?._virtual) {
              try {
                if (persistRowOrder) await persistRowOrder(rowId, laneId, fullOrder);
                playSound('taskDragDrop');

                pushAction({
                  description: 'Reorder rows',
                  undo: async () => {
                    setLanes(prev => ({ ...prev, [laneId]: { ...prev[laneId], rows: oldFullOrder } }));
                    if (persistRowOrder) await persistRowOrder(rowId, laneId, oldFullOrder);
                  },
                  redo: async () => {
                    setLanes(prev => ({ ...prev, [laneId]: { ...prev[laneId], rows: fullOrder } }));
                    if (persistRowOrder) await persistRowOrder(rowId, laneId, fullOrder);
                  },
                });
              } catch (err) {
                console.error("Failed to reorder rows:", err);
              }
            } else {
              playSound('taskDragDrop');
            }
          }
        } else if (lanes[targetLaneId]?._virtual || lanes[laneId]?._virtual) {
          // Cross-lane move involving a virtual lane — not supported yet
        } else {
          // Cross-lane move — show modal
          setMoveModal({
            rowId,
            sourceLaneId: laneId,
            targetLaneId,
            insertIndex,
          });
        }
      }

      setRowGhost(null);
      setRowDropTarget(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  };

  // ────────────────────────────────────────
  // Marquee (Lasso) Selection
  // ────────────────────────────────────────
  const handleMarqueeStart = (e) => {
    if (e.button !== 0) return;

    const container = containerRef.current;
    const scrollContainer = container?.parentElement;
    if (!container || !scrollContainer) return;

    const initRect = container.getBoundingClientRect();
    const startX = e.clientX - initRect.left;
    const startY = e.clientY - initRect.top;

    setMarqueeRect({ x: startX, y: startY, width: 0, height: 0 });

    const DRAG_THRESHOLD = 4;
    let hasDragged = false;
    let lastClientX = e.clientX;
    let lastClientY = e.clientY;

    const getContentCoords = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const updateMarquee = () => {
      const { x: currentX, y: currentY } = getContentCoords(lastClientX, lastClientY);
      const dx = currentX - startX;
      const dy = currentY - startY;

      if (!hasDragged && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      hasDragged = true;

      setMarqueeRect({
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      });
    };

    const onMouseMove = (moveEvent) => {
      lastClientX = moveEvent.clientX;
      lastClientY = moveEvent.clientY;
      updateMarquee();
    };

    const onScroll = () => {
      if (hasDragged) updateMarquee();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      scrollContainer.removeEventListener('scroll', onScroll);

      if (!hasDragged) {
        setMarqueeRect(null);
        return;
      }

      const { x: endX, y: endY } = getContentCoords(lastClientX, lastClientY);
      const rect = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      };

      const dropHighlightOffset = LANE_DRAG_HIGHLIGHT_HEIGHT + MARGIN_BETWEEN_DRAG_HIGHLIGHT * 2;
      const headerOffset = LANE_HEADER_LINE_HEIGHT + LANE_HEADER_GAP;

      const newSelection = new Set();

      for (const [id, node] of Object.entries(nodes)) {
        const nId = parseInt(id);
        const row = rows[node.row];
        if (!row) continue;

        const lane = lanes[row.lane];
        if (!lane || !isLaneVisible(row.lane)) continue;
        if (!isRowVisible(node.row, rowDisplaySettings)) continue;

        const laneSettings = laneDisplaySettings[row.lane];
        if (laneSettings?.collapsed) continue;

        const rowHeightVal = getRowHeight(node.row, rowDisplaySettings);
        const laneYOff = getLaneYOffset(row.lane);
        const rowYOff = getRowYOffset(node.row, row.lane);

        const nodeX = LANEWIDTH + ROWLABELWIDTH + ROWACTIONSWIDTH + node.startColumn * COLUMNWIDTH;
        const phaseRowOff = getLanePhaseRowHeight ? getLanePhaseRowHeight(row.lane) : 0;
        const nodeY = laneYOff + dropHighlightOffset + headerOffset + phaseRowOff + rowYOff + 2;
        const nodeW = COLUMNWIDTH * (node.duration || 1);
        const nodeH = rowHeightVal - 4;

        // AABB intersection check
        if (
          nodeX < rect.x + rect.width &&
          nodeX + nodeW > rect.x &&
          nodeY < rect.y + rect.height &&
          nodeY + nodeH > rect.y
        ) {
          newSelection.add(nId);
        }
      }

      if (newSelection.size > 0) {
        if (e.ctrlKey || e.metaKey) {
          setSelectedNodes(prev => {
            const merged = new Set(prev);
            for (const nId of newSelection) merged.add(nId);
            return merged;
          });
        } else {
          setSelectedNodes(newSelection);
        }
        setSelectedEdges([]);
        playSound('marqueeSelect');
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      }

      setMarqueeRect(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    scrollContainer.addEventListener('scroll', onScroll);
  };

  return {
    // Lane drag state
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    // Row drag state
    rowGhost,
    setRowGhost,
    rowDropTarget,
    setRowDropTarget,
    moveModal,
    setMoveModal,
    // Marquee
    marqueeRect,
    // Handlers
    handleLaneDrag,
    handleRowDrag,
    handleMarqueeStart,
  };
}
