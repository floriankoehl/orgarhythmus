// Node drag, resize, click, selection, rename, delete, and column-cell click.
// Generic version of useDependencyMilestones.js.
// API calls extracted into persist callbacks passed from the adapter.

import { playSound, startLoopSound, stopLoopSound } from '../assets/sound_registry';
import { useGridBoardContext } from './GridBoardContext.jsx';
import {
  checkNodeOverlap,
  checkMultiNodeOverlap,
  validateNodeMove,
  validateMultiNodeMove,
  checkDeadlineViolation,
  checkMultiDeadlineViolation,
  computeCascadePush,
} from './gridValidation';

/**
 * Hook for all node-centric interactions:
 * drag-to-move, edge-resize, click-select, double-click-rename,
 * delete, and column-cell click (node creation trigger).
 *
 * Persist callbacks (adapter-supplied):
 * @param {Function} params.persistNodeMove      - async (nodeId, newStartColumn) => void
 * @param {Function} params.persistNodeResize    - async (nodeId, durationChange) => void
 * @param {Function} params.persistNodeRename    - async (nodeId, newName) => void
 * @param {Function} params.persistNodeDelete    - async (nodeId) => deletedData
 * @param {Function} params.persistNodeCreate    - async (rowId, data) => createdNode
 * @param {Function} params.persistEdgeCreate    - async (sourceId, targetId) => void
 */
export function useNodeInteractions({
  // Data
  nodes,
  rows,
  edges,
  // Setters
  setNodes,
  setRows,
  setEdges,
  setNodeCreateModal,
  // Layout
  COLUMNWIDTH,
  // Column layout for accurate pixel offsets
  columnLayout,
  // Mode
  safeMode,
  // Ref from orchestrator
  justDraggedRef,
  // Warning/feedback (from useGridWarnings)
  addWarning,
  showBlockingFeedback,
  // Weak edge confirmation callback
  onWeakEdgeConflict,
  // Collapsed columns for barrier check
  collapsedColumns,
  // Persist callbacks
  persistNodeMove,
  persistNodeResize,
  persistNodeRename,
  persistNodeDelete,
  persistNodeCreate,
  persistEdgeCreate,
}) {
  const {
    containerRef,
    viewMode,
    selectedNodes,
    setSelectedNodes,
    selectedEdges,
    setSelectedEdges,
    autoSelectBlocking,
    resizeAllSelected,
    setEditingNodeId,
    setEditingNodeName,
    pushAction,
  } = useGridBoardContext();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Node drag (move) â€” supports multi-select
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNodeMouseDown = (e, nodeId) => {
    if (viewMode !== "schedule" && viewMode !== "dependency") return;

    e.preventDefault();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const node = nodes[nodeId];
    if (!node) return;

    let nodesToMove;
    if (selectedNodes.has(nodeId) && selectedNodes.size > 1) {
      nodesToMove = Array.from(selectedNodes);
    } else {
      nodesToMove = [nodeId];
    }

    const initialPositions = {};
    for (const nId of nodesToMove) {
      const n = nodes[nId];
      if (n) {
        initialPositions[nId] = {
          startColumn: n.startColumn,
          duration: n.duration || 1,
          startVisualX: columnLayout
            ? columnLayout.columnXOffset(n.startColumn)
            : n.startColumn * COLUMNWIDTH,
        };
      }
    }

    const startX = e.clientX;
    const DRAG_THRESHOLD = 3;
    let hasDragged = false;
    let currentDeltaIndex = 0;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;

      if (!hasDragged && Math.abs(deltaX) < DRAG_THRESHOLD) return;
      hasDragged = true;

      const deltaIndex = Math.round(deltaX / COLUMNWIDTH);

      setNodes(prev => {
        const updated = { ...prev };
        for (const nId of nodesToMove) {
          const initial = initialPositions[nId];
          if (initial) {
            updated[nId] = {
              ...updated[nId],
              x: Math.max(0, initial.startVisualX + deltaX),
            };
          }
        }
        return updated;
      });

      currentDeltaIndex = deltaIndex;
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');

      if (hasDragged) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      } else {
        setNodes(prev => {
          const updated = { ...prev };
          for (const nId of nodesToMove) {
            if (updated[nId]) {
              const { x, ...rest } = updated[nId];
              updated[nId] = rest;
            }
          }
          return updated;
        });
        return;
      }

      if (currentDeltaIndex === 0) {
        setNodes(prev => {
          const updated = { ...prev };
          for (const nId of nodesToMove) {
            if (updated[nId]) {
              const { x, ...rest } = updated[nId];
              updated[nId] = rest;
            }
          }
          return updated;
        });
        return;
      }

      // Check column-0 boundary
      for (const nId of nodesToMove) {
        const initial = initialPositions[nId];
        if (initial && initial.startColumn + currentDeltaIndex < 0) {
          addWarning("Move blocked: before column 0", "Nodes cannot be placed before the start.");
          setNodes(prev => {
            const updated = { ...prev };
            for (const mid of nodesToMove) {
              const init = initialPositions[mid];
              if (init) {
                const { x, ...rest } = updated[mid];
                updated[mid] = { ...rest, startColumn: init.startColumn };
              }
            }
            return updated;
          });
          return;
        }
      }

      // Check collapsed-column barrier
      if (collapsedColumns && collapsedColumns.size > 0) {
        for (const nId of nodesToMove) {
          const initial = initialPositions[nId];
          if (!initial) continue;
          const newStart = initial.startColumn + currentDeltaIndex;
          const duration = initial.duration || 1;
          for (let d = newStart; d < newStart + duration; d++) {
            if (collapsedColumns.has(d)) {
              addWarning("Move blocked: collapsed column", "Nodes cannot be placed on collapsed columns. Uncollapse them first.");
              setNodes(prev => {
                const updated = { ...prev };
                for (const mid of nodesToMove) {
                  const init = initialPositions[mid];
                  if (init) {
                    const { x, ...rest } = updated[mid];
                    updated[mid] = { ...rest, startColumn: init.startColumn };
                  }
                }
                return updated;
              });
              return;
            }
          }
        }
      }

      // Validate edge constraints
      let validation;
      if (nodesToMove.length === 1) {
        const newStart = initialPositions[nodesToMove[0]].startColumn + currentDeltaIndex;
        validation = validateNodeMove(nodes, edges, nodesToMove[0], newStart);
      } else {
        validation = validateMultiNodeMove(nodes, edges, nodesToMove, currentDeltaIndex);
      }

      const overlapValidation = checkMultiNodeOverlap(nodes, rows, nodesToMove, currentDeltaIndex);
      const deadlineValidation = checkMultiDeadlineViolation(nodes, rows, nodesToMove, currentDeltaIndex);

      if (!validation.valid || !overlapValidation.valid || !deadlineValidation.valid) {
        const depBlocking = validation.allBlocking || [];
        const overlapBlocking = overlapValidation.allBlocking || [];
        const allBlocking = [...depBlocking, ...overlapBlocking];

        const seen = new Set();
        const uniqueBlocking = allBlocking.filter(b => {
          if (seen.has(b.blockingNodeId)) return false;
          seen.add(b.blockingNodeId);
          return true;
        });

        const hasOverlapBlocking = overlapBlocking.length > 0;
        const hasDeadlineBlocking = !deadlineValidation.valid;

        const strongBlocking = depBlocking.filter(b => (b.weight || 'strong') === 'strong');
        const weakBlocking = depBlocking.filter(b => b.weight === 'weak');
        const suggestionBlocking = depBlocking.filter(b => b.weight === 'suggestion');

        const hasHardBlock = hasOverlapBlocking || hasDeadlineBlocking || strongBlocking.length > 0;

        if (hasHardBlock) {
          if (hasDeadlineBlocking) {
            addWarning("Move blocked: exceeds hard deadline", "A node would be placed past its row's hard deadline.");
          } else if (strongBlocking.length > 0 && hasOverlapBlocking) {
            addWarning("Move blocked: edge constraint & node overlap", "Nodes cannot overlap within a row, and edges must be respected.");
          } else if (hasOverlapBlocking) {
            addWarning("Move blocked: nodes would overlap", "Nodes within the same row cannot occupy the same columns.");
          } else {
            addWarning("Move blocked: strong edge constraint", "A strong edge prevents this move.");
          }

          for (const { blockingNodeId, blockingEdge } of uniqueBlocking) {
            showBlockingFeedback(blockingNodeId, blockingEdge);
          }

          if (autoSelectBlocking && uniqueBlocking.length > 0) {
            setSelectedNodes(prev => {
              const newSet = new Set(prev);
              for (const nId of nodesToMove) newSet.add(nId);
              for (const { blockingNodeId } of uniqueBlocking) newSet.add(blockingNodeId);
              return newSet;
            });
          }

          setNodes(prev => {
            const updated = { ...prev };
            for (const nId of nodesToMove) {
              const initial = initialPositions[nId];
              if (initial) {
                const { x, ...rest } = updated[nId];
                updated[nId] = { ...rest, startColumn: initial.startColumn };
              }
            }
            return updated;
          });
          return;
        }

        if (weakBlocking.length > 0) {
          setNodes(prev => {
            const updated = { ...prev };
            for (const nId of nodesToMove) {
              const initial = initialPositions[nId];
              if (initial) {
                const { x, ...rest } = updated[nId];
                updated[nId] = { ...rest, startColumn: initial.startColumn };
              }
            }
            return updated;
          });

          if (onWeakEdgeConflict) {
            onWeakEdgeConflict({
              weakEdges: weakBlocking.map(b => b.blockingEdge),
              blockingNodeIds: weakBlocking.map(b => b.blockingNodeId),
              nodesToMove,
              initialPositions,
              currentDeltaIndex,
              suggestionBlocking: suggestionBlocking.map(b => b.blockingEdge),
            });
          } else {
            addWarning("Move blocked: weak edge conflict", "A weak edge prevents this move. Cannot resolve automatically.");
          }
          return;
        }

        if (suggestionBlocking.length > 0) {
          addWarning("Suggestion edge violated", "This move violates a suggestion edge, but it is allowed.");
          for (const { blockingNodeId, blockingEdge } of suggestionBlocking) {
            showBlockingFeedback(blockingNodeId, blockingEdge);
          }
        }
      }

      // Validation passed â€” persist
      playSound('milestoneMove');
      const beforePositions = {};
      const afterPositions = {};
      for (const nId of nodesToMove) {
        const initial = initialPositions[nId];
        if (!initial) continue;
        beforePositions[nId] = initial.startColumn;
        afterPositions[nId] = initial.startColumn + currentDeltaIndex;
      }

      for (const nId of nodesToMove) {
        const newStart = afterPositions[nId];
        if (newStart === undefined) continue;

        setNodes(prev => {
          const { x, ...rest } = prev[nId];
          return { ...prev, [nId]: { ...rest, startColumn: newStart } };
        });

        try {
          if (persistNodeMove) await persistNodeMove(nId, newStart);
        } catch (err) {
          console.error("Failed to update start column:", err);
        }
      }

      pushAction({
        description: `Move ${nodesToMove.length} node(s)`,
        undo: async () => {
          for (const nId of nodesToMove) {
            const oldStart = beforePositions[nId];
            if (oldStart === undefined) continue;
            setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: oldStart } }));
            if (persistNodeMove) await persistNodeMove(nId, oldStart);
          }
        },
        redo: async () => {
          for (const nId of nodesToMove) {
            const newStart = afterPositions[nId];
            if (newStart === undefined) continue;
            setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: newStart } }));
            if (persistNodeMove) await persistNodeMove(nId, newStart);
          }
        },
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Node edge resize â€” with validation AND overlap check
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNodeEdgeResize = (e, nodeId, edge) => {
    if (safeMode) return;
    e.stopPropagation();
    e.preventDefault();

    const node = nodes[nodeId];
    if (!node) return;

    let nodesToResize;
    if (resizeAllSelected && selectedNodes.has(nodeId) && selectedNodes.size > 1) {
      nodesToResize = Array.from(selectedNodes);
    } else {
      nodesToResize = [nodeId];
    }

    const initialStates = {};
    for (const nId of nodesToResize) {
      const n = nodes[nId];
      if (n) {
        initialStates[nId] = {
          startColumn: n.startColumn,
          duration: n.duration || 1,
        };
      }
    }

    const startX = e.clientX;
    let currentIndexDelta = 0;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / COLUMNWIDTH);
      currentIndexDelta = indexDelta;

      setNodes(prev => {
        const updated = { ...prev };
        for (const nId of nodesToResize) {
          const initial = initialStates[nId];
          if (!initial) continue;

          if (edge === "right") {
            const newDuration = Math.max(1, initial.duration + indexDelta);
            updated[nId] = { ...updated[nId], duration: newDuration };
          } else if (edge === "left") {
            const newStartColumn = Math.max(0, initial.startColumn + indexDelta);
            const durationChange = initial.startColumn - newStartColumn;
            const newDuration = Math.max(1, initial.duration + durationChange);
            updated[nId] = { ...updated[nId], startColumn: newStartColumn, duration: newDuration };
          }
        }
        return updated;
      });
    };

    const onMouseUp = async (upEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      stopLoopSound('dragLoop');

      const altHeld = upEvent && upEvent.altKey;

      const allResizeBlocking = [];
      let hasOverlapViolation = false;
      let hasDepViolation = false;
      let hasDeadlineViolation = false;

      const resizedPositions = {};
      for (const nId of nodesToResize) {
        const initial = initialStates[nId];
        if (!initial) continue;
        let currentStartColumn, currentDuration;
        if (edge === "right") {
          currentStartColumn = initial.startColumn;
          currentDuration = Math.max(1, initial.duration + currentIndexDelta);
        } else {
          currentStartColumn = Math.max(0, initial.startColumn + currentIndexDelta);
          const durationChange = initial.startColumn - currentStartColumn;
          currentDuration = Math.max(1, initial.duration + durationChange);
        }
        resizedPositions[nId] = { startColumn: currentStartColumn, duration: currentDuration };
      }

      // â”€â”€ Alt+Resize: cascade push blocking nodes forward â”€â”€
      if (altHeld) {
        const altResizeIds = [nodeId];
        const altResizedPositions = { [nodeId]: resizedPositions[nodeId] };

        if (nodesToResize.length > 1) {
          setNodes(prev => {
            const updated = { ...prev };
            for (const nId of nodesToResize) {
              if (nId === nodeId) continue;
              const initial = initialStates[nId];
              if (initial) {
                updated[nId] = { ...updated[nId], startColumn: initial.startColumn, duration: initial.duration };
              }
            }
            return updated;
          });
          setSelectedNodes(new Set([nodeId]));
        }

        const cascadeResult = computeCascadePush(nodes, rows, edges, altResizedPositions);

        if (!cascadeResult.valid) {
          setNodes(prev => {
            const updated = { ...prev };
            for (const nId of altResizeIds) {
              const initial = initialStates[nId];
              if (initial) {
                updated[nId] = { ...updated[nId], startColumn: initial.startColumn, duration: initial.duration };
              }
            }
            return updated;
          });
          addWarning("Cascade blocked: hard deadline", "Pushing nodes forward would exceed a row's hard deadline.");
          return;
        }

        const pushedIds = Object.keys(cascadeResult.pushes);

        const allBefore = {};
        const allAfter = {};
        for (const nId of altResizeIds) {
          const initial = initialStates[nId];
          const rp = altResizedPositions[nId];
          if (!initial || !rp) continue;
          allBefore[nId] = { startColumn: initial.startColumn, duration: initial.duration };
          allAfter[nId] = { startColumn: rp.startColumn, duration: rp.duration, resized: true };
        }
        for (const pId of pushedIds) {
          const n = nodes[pId];
          if (!n) continue;
          allBefore[pId] = { startColumn: n.startColumn, duration: n.duration || 1 };
          allAfter[pId] = { startColumn: cascadeResult.pushes[pId], duration: n.duration || 1, resized: false };
        }

        setNodes(prev => {
          const updated = { ...prev };
          for (const nId of altResizeIds) {
            const rp = altResizedPositions[nId];
            if (rp) {
              updated[nId] = { ...updated[nId], startColumn: rp.startColumn, duration: rp.duration };
            }
          }
          for (const pId of pushedIds) {
            if (updated[pId]) {
              updated[pId] = { ...updated[pId], startColumn: cascadeResult.pushes[pId] };
            }
          }
          return updated;
        });

        if (pushedIds.length > 0) {
          for (const pId of pushedIds) {
            showBlockingFeedback(pId, null);
          }
          setSelectedNodes(new Set(altResizeIds));
        }

        playSound('milestoneResize');

        for (const id of Object.keys(allAfter)) {
          const before = allBefore[id];
          const after = allAfter[id];
          if (!before || !after) continue;

          if (after.resized) {
            const durationChange = after.duration - before.duration;
            if (durationChange !== 0) {
              try { if (persistNodeResize) await persistNodeResize(id, durationChange); } catch (err) { console.error("Failed to change duration:", err); }
            }
            if (edge === "left" && after.startColumn !== before.startColumn) {
              try { if (persistNodeMove) await persistNodeMove(id, after.startColumn); } catch (err) { console.error("Failed to update start column:", err); }
            }
          } else {
            if (after.startColumn !== before.startColumn) {
              try { if (persistNodeMove) await persistNodeMove(id, after.startColumn); } catch (err) { console.error("Failed to update start column:", err); }
            }
          }
        }

        pushAction({
          description: `Alt+Resize: cascade ${altResizeIds.length} + push ${pushedIds.length} node(s)`,
          undo: async () => {
            for (const id of Object.keys(allAfter)) {
              const before = allBefore[id];
              const after = allAfter[id];
              if (!before || !after) continue;
              if (after.resized) {
                const durationDelta = before.duration - after.duration;
                if (durationDelta !== 0 && persistNodeResize) await persistNodeResize(id, durationDelta);
                if (before.startColumn !== after.startColumn && persistNodeMove) await persistNodeMove(id, before.startColumn);
              } else {
                if (before.startColumn !== after.startColumn && persistNodeMove) await persistNodeMove(id, before.startColumn);
              }
              setNodes(prev => ({ ...prev, [id]: { ...prev[id], startColumn: before.startColumn, duration: before.duration } }));
            }
          },
          redo: async () => {
            for (const id of Object.keys(allAfter)) {
              const before = allBefore[id];
              const after = allAfter[id];
              if (!before || !after) continue;
              if (after.resized) {
                const durationDelta = after.duration - before.duration;
                if (durationDelta !== 0 && persistNodeResize) await persistNodeResize(id, durationDelta);
                if (before.startColumn !== after.startColumn && persistNodeMove) await persistNodeMove(id, after.startColumn);
              } else {
                if (before.startColumn !== after.startColumn && persistNodeMove) await persistNodeMove(id, after.startColumn);
              }
              setNodes(prev => ({ ...prev, [id]: { ...prev[id], startColumn: after.startColumn, duration: after.duration } }));
            }
          },
        });

        return;
      }

      // Normal resize validation
      for (const nId of nodesToResize) {
        const rp = resizedPositions[nId];
        if (!rp) continue;
        const { startColumn: currentStartColumn, duration: currentDuration } = rp;
        const newEndColumn = currentStartColumn + currentDuration - 1;

        const outgoingEdges = edges.filter(c => c.source === nId);
        for (const conn of outgoingEdges) {
          const targetNode = nodes[conn.target];
          if (!targetNode) continue;
          const targetStart = resizedPositions[conn.target]
            ? resizedPositions[conn.target].startColumn
            : targetNode.startColumn;
          if (newEndColumn >= targetStart) {
            allResizeBlocking.push({ blockingNodeId: conn.target, blockingEdge: conn, weight: conn.weight || 'strong' });
            hasDepViolation = true;
          }
        }

        const incomingEdges = edges.filter(c => c.target === nId);
        for (const conn of incomingEdges) {
          const sourceNode = nodes[conn.source];
          if (!sourceNode) continue;
          let sourceEndColumn;
          if (resizedPositions[conn.source]) {
            const sp = resizedPositions[conn.source];
            sourceEndColumn = sp.startColumn + sp.duration - 1;
          } else {
            sourceEndColumn = sourceNode.startColumn + (sourceNode.duration || 1) - 1;
          }
          if (sourceEndColumn >= currentStartColumn) {
            allResizeBlocking.push({ blockingNodeId: conn.source, blockingEdge: conn, weight: conn.weight || 'strong' });
            hasDepViolation = true;
          }
        }

        const excludeSet = new Set(nodesToResize);
        const overlapResult = checkNodeOverlap(nodes, rows, nId, currentStartColumn, currentDuration, excludeSet);
        if (!overlapResult.valid) {
          for (const ov of overlapResult.overlapping) {
            allResizeBlocking.push(ov);
          }
          hasOverlapViolation = true;
        }

        const deadlineResult = checkDeadlineViolation(nodes, rows, nId, currentStartColumn, currentDuration);
        if (!deadlineResult.valid) {
          hasDeadlineViolation = true;
        }
      }

      if (allResizeBlocking.length > 0 || hasDeadlineViolation) {
        const depBlocking = allResizeBlocking.filter(b => b.blockingEdge);
        const strongResizeBlocking = depBlocking.filter(b => (b.weight || 'strong') === 'strong');
        const weakResizeBlocking = depBlocking.filter(b => b.weight === 'weak');
        const suggestionResizeBlocking = depBlocking.filter(b => b.weight === 'suggestion');

        const hasHardResizeBlock = hasOverlapViolation || hasDeadlineViolation || strongResizeBlocking.length > 0;

        if (hasHardResizeBlock) {
          setNodes(prev => {
            const updated = { ...prev };
            for (const nId of nodesToResize) {
              const initial = initialStates[nId];
              if (initial) {
                updated[nId] = { ...updated[nId], startColumn: initial.startColumn, duration: initial.duration };
              }
            }
            return updated;
          });

          if (hasDeadlineViolation) {
            addWarning("Resize blocked: exceeds hard deadline", "A node would extend past its row's hard deadline.");
          } else if (hasDepViolation && hasOverlapViolation) {
            addWarning("Resize blocked: edge & overlap conflict", "Nodes cannot overlap within a row, and edges must be respected.");
          } else if (hasOverlapViolation) {
            addWarning("Resize blocked: nodes would overlap", "Nodes within the same row cannot occupy the same columns.");
          } else {
            addWarning("Resize blocked: edge constraint", "A strong edge prevents this resize.");
          }

          for (const { blockingNodeId, blockingEdge } of allResizeBlocking) {
            showBlockingFeedback(blockingNodeId, blockingEdge);
          }
          if (autoSelectBlocking) {
            setSelectedNodes(prev => {
              const newSet = new Set(prev);
              for (const nId of nodesToResize) newSet.add(nId);
              for (const { blockingNodeId } of allResizeBlocking) newSet.add(blockingNodeId);
              return newSet;
            });
          }
          return;
        }

        if (weakResizeBlocking.length > 0) {
          setNodes(prev => {
            const updated = { ...prev };
            for (const nId of nodesToResize) {
              const initial = initialStates[nId];
              if (initial) {
                updated[nId] = { ...updated[nId], startColumn: initial.startColumn, duration: initial.duration };
              }
            }
            return updated;
          });

          if (onWeakEdgeConflict) {
            onWeakEdgeConflict({
              type: 'resize',
              weakEdges: weakResizeBlocking.map(b => b.blockingEdge),
              blockingNodeIds: weakResizeBlocking.map(b => b.blockingNodeId),
              nodesToResize,
              initialStates,
              edge,
              currentIndexDelta,
              suggestionBlocking: suggestionResizeBlocking.map(b => b.blockingEdge),
            });
          } else {
            addWarning("Resize blocked: weak edge conflict", "A weak edge prevents this resize. Cannot resolve automatically.");
          }
          return;
        }

        if (suggestionResizeBlocking.length > 0) {
          addWarning("Suggestion edge violated", "This resize violates a suggestion edge, but it is allowed.");
          for (const { blockingNodeId, blockingEdge } of suggestionResizeBlocking) {
            showBlockingFeedback(blockingNodeId, blockingEdge);
          }
        }
      }

      // Validation passed â€” save
      playSound('milestoneResize');
      const resizeBefore = {};
      const resizeAfter = {};

      for (const nId of nodesToResize) {
        const initial = initialStates[nId];
        if (!initial) continue;
        const rp = resizedPositions[nId];
        if (!rp) continue;

        resizeBefore[nId] = { startColumn: initial.startColumn, duration: initial.duration };
        resizeAfter[nId] = { startColumn: rp.startColumn, duration: rp.duration };

        const durationChange = rp.duration - initial.duration;
        if (durationChange !== 0) {
          try {
            if (persistNodeResize) await persistNodeResize(nId, durationChange);
          } catch (err) {
            console.error("Failed to change duration:", err);
          }
        }

        if (edge === "left" && rp.startColumn !== initial.startColumn) {
          try {
            if (persistNodeMove) await persistNodeMove(nId, rp.startColumn);
          } catch (err) {
            console.error("Failed to update start column:", err);
          }
        }
      }

      pushAction({
        description: `Resize ${nodesToResize.length} node(s)`,
        undo: async () => {
          for (const nId of nodesToResize) {
            const before = resizeBefore[nId];
            const after = resizeAfter[nId];
            if (!before || !after) continue;
            const durationDelta = before.duration - after.duration;
            if (durationDelta !== 0 && persistNodeResize) await persistNodeResize(nId, durationDelta);
            if (before.startColumn !== after.startColumn && persistNodeMove) await persistNodeMove(nId, before.startColumn);
            setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: before.startColumn, duration: before.duration } }));
          }
        },
        redo: async () => {
          for (const nId of nodesToResize) {
            const before = resizeBefore[nId];
            const after = resizeAfter[nId];
            if (!before || !after) continue;
            const durationDelta = after.duration - before.duration;
            if (durationDelta !== 0 && persistNodeResize) await persistNodeResize(nId, durationDelta);
            if (before.startColumn !== after.startColumn && persistNodeMove) await persistNodeMove(nId, after.startColumn);
            setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: after.startColumn, duration: after.duration } }));
          }
        },
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Node click (selection)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNodeClick = (e, nodeId) => {
    e.stopPropagation();

    if (justDraggedRef.current) return;

    setSelectedEdges([]);

    const wasSelected = selectedNodes.has(nodeId);

    if (e.ctrlKey || e.metaKey) {
      setSelectedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) newSet.delete(nodeId);
        else newSet.add(nodeId);
        return newSet;
      });
      playSound(wasSelected ? 'milestoneDeselect' : 'milestoneSelect');
    } else {
      const willDeselect = selectedNodes.size === 1 && wasSelected;
      setSelectedNodes(prev => {
        if (prev.size === 1 && prev.has(nodeId)) return new Set();
        return new Set([nodeId]);
      });
      playSound(willDeselect ? 'milestoneDeselect' : 'milestoneSelect');
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Node delete
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNodeDelete = async (nodeId) => {
    const deletedNode = nodes[nodeId];
    const deletedEdges = edges.filter(c => c.source === nodeId || c.target === nodeId);
    const ownerRowId = deletedNode?.row;

    try {
      if (persistNodeDelete) await persistNodeDelete(nodeId);
      playSound('milestoneDelete');

      setNodes(prev => {
        const updated = { ...prev };
        delete updated[nodeId];
        return updated;
      });

      setRows(prev => {
        const updated = { ...prev };
        for (const rowId of Object.keys(updated)) {
          if (updated[rowId]?.nodes) {
            updated[rowId] = {
              ...updated[rowId],
              nodes: updated[rowId].nodes.filter(n => n.id !== nodeId)
            };
          }
        }
        return updated;
      });

      setEdges(prev => prev.filter(c => c.source !== nodeId && c.target !== nodeId));

      setSelectedNodes(prev => {
        const updated = new Set(prev);
        updated.delete(nodeId);
        return updated;
      });

      if (deletedNode) {
        pushAction({
          description: 'Delete node',
          undo: async () => {
            if (persistNodeCreate) {
              const result = await persistNodeCreate(ownerRowId, {
                name: deletedNode.name,
                description: deletedNode.description || '',
                startColumn: deletedNode.startColumn,
                duration: deletedNode.duration || 1,
              });
              if (result) {
                const newId = result.id;
                setNodes(prev => ({ ...prev, [newId]: result }));
                setRows(prev => ({
                  ...prev,
                  [ownerRowId]: {
                    ...prev[ownerRowId],
                    nodes: [...(prev[ownerRowId]?.nodes || []), result],
                  },
                }));

                // Recreate edges
                const restoredEdges = [];
                for (const edge of deletedEdges) {
                  const src = edge.source === nodeId ? newId : edge.source;
                  const tgt = edge.target === nodeId ? newId : edge.target;
                  try {
                    if (persistEdgeCreate) await persistEdgeCreate(src, tgt);
                    restoredEdges.push({ source: src, target: tgt, weight: edge.weight || 'strong', reason: edge.reason || null });
                  } catch (e) { /* skip if other node also deleted */ }
                }
                if (restoredEdges.length > 0) {
                  setEdges(prev => [...prev, ...restoredEdges]);
                }
              }
            }
          },
          redo: async () => {
            // Best-effort: find node by row+startColumn+name
            const currentNode = Object.entries(nodes).find(([, n]) =>
              n.row === ownerRowId &&
              n.name === deletedNode.name &&
              n.startColumn === deletedNode.startColumn
            );
            if (currentNode) {
              const [redoId] = currentNode;
              if (persistNodeDelete) await persistNodeDelete(parseInt(redoId));
              setNodes(prev => {
                const updated = { ...prev };
                delete updated[redoId];
                return updated;
              });
              setRows(prev => {
                const updated = { ...prev };
                for (const rowId of Object.keys(updated)) {
                  if (updated[rowId]?.nodes) {
                    updated[rowId] = {
                      ...updated[rowId],
                      nodes: updated[rowId].nodes.filter(n => n.id !== parseInt(redoId))
                    };
                  }
                }
                return updated;
              });
              setEdges(prev => prev.filter(c => c.source !== parseInt(redoId) && c.target !== parseInt(redoId)));
            }
          },
        });
      }

    } catch (err) {
      console.error("Failed to delete node:", err);
      throw err;
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Node double click (rename)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNodeDoubleClick = (e, node) => {
    e.stopPropagation();
    setEditingNodeId(node.id);
    setEditingNodeName(node.name);
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Node rename submit
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleNodeRenameSubmit = async (nodeId, editingNameVal) => {
    if (!editingNameVal.trim()) {
      setEditingNodeId(null);
      setEditingNodeName("");
      return;
    }

    const oldName = nodes[nodeId]?.name || "";
    const newName = editingNameVal.trim();

    try {
      if (persistNodeRename) await persistNodeRename(nodeId, newName);
      playSound('milestoneRename');

      setNodes(prev => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], name: newName }
      }));

      pushAction({
        description: 'Rename node',
        undo: async () => {
          if (persistNodeRename) await persistNodeRename(nodeId, oldName);
          setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], name: oldName } }));
        },
        redo: async () => {
          if (persistNodeRename) await persistNodeRename(nodeId, newName);
          setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], name: newName } }));
        },
      });
    } catch (err) {
      console.error("Failed to rename node:", err);
    }

    setEditingNodeId(null);
    setEditingNodeName("");
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Column cell click (trigger node creation modal)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleColumnCellClick = (rowId, columnIndex) => {
    setNodeCreateModal({ rowId, columnIndex });
  };

  return {
    handleNodeMouseDown,
    handleNodeEdgeResize,
    handleNodeClick,
    handleNodeDelete,
    handleNodeDoubleClick,
    handleNodeRenameSubmit,
    handleColumnCellClick,
  };
}
