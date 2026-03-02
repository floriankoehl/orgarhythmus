// Backend operations and state mutation logic for DependencyGrid.
// Generic version — all API calls extracted into persist callbacks.
import { isRowVisible } from './layoutMath';
import { useGridBoardContext } from './GridBoardContext.jsx';
import { playSound } from '../assets/sound_registry';

/**
 * Custom hook for backend operations and state mutations in the DependencyGrid.
 *
 * Persist callbacks (adapter-supplied):
 * @param {Function} params.persistColumnPurpose     - async (colIdx, purpose, purposeLanes) => result
 * @param {Function} params.persistNodeCreate         - async (rowId, opts?) => created
 * @param {Function} params.persistNodeMove           - async (nodeId, newStartColumn) => void
 * @param {Function} params.persistNodeDelete         - async (nodeId) => void
 * @param {Function} params.persistNodeResize         - async (nodeId, durationDelta) => void
 * @param {Function} params.persistEdgeCreate         - async (sourceId, targetId, opts?) => created
 * @param {Function} params.persistEdgeDelete         - async (sourceId, targetId) => void
 * @param {Function} params.persistEdgeUpdate         - async (sourceId, targetId, data) => updated
 * @param {Function} params.persistRowReorder         - async (rowId, targetLaneId, newRowOrder) => void
 * @param {Function} params.persistRowDeadline        - async (rowId, deadlineColumn) => void
 * @param {Function} params.persistNodeTaskChange     - async (nodeId, targetRowId) => void
 * @param {Function} params.persistLaneCreate         - async (data) => created
 * @param {Function} params.persistRowCreate          - async (data) => created
 */
export function useGridActions({
  // Data state
  lanes,
  rowDisplaySettings,

  // Modal state values
  columnPurposeModal,
  nodeCreateModal,
  moveModal,
  deleteConfirmModal,

  // Form state values
  newColumnPurpose,
  newColumnPurposeLanes,
  newLaneName,
  newLaneColor,
  newRowName,
  newRowLaneId,

  // Data state setters
  setColumns,
  setNodes,
  setRows,
  setLanes,
  setReloadData,

  // Modal state setters
  setColumnPurposeModal,
  setNodeCreateModal,
  setMoveModal,
  setDeleteConfirmModal,
  setIsAddingNode,

  // Form state setters
  setNewColumnPurpose,
  setNewColumnPurposeLanes,
  setNewLaneName,
  setNewLaneColor,
  setNewRowName,
  setNewRowLaneId,
  setShowCreateLaneModal,
  setShowCreateRowModal,
  setIsCreating,

  // Layout helpers
  getVisibleRows,

  // Interaction handlers (from useGridInteraction)
  handleDeleteEdge,
  handleNodeDelete,
  handleUpdateEdge,

  // Modal state for suggestion-offer flow
  suggestionOfferModal,
  setSuggestionOfferModal,

  // Additional data setters
  setEdges,

  // Computed
  safeMode,

  // ── Persist callbacks ──
  persistColumnPurpose,
  persistNodeCreate,
  persistNodeMove,
  persistNodeDelete,
  persistNodeResize,
  persistEdgeCreate,
  persistEdgeDelete,
  persistEdgeUpdate,
  persistRowReorder,
  persistRowDeadline,
  persistNodeTaskChange,
  persistLaneCreate,
  persistRowCreate,
}) {

  // Get shared state from context
  const {
    selectedEdges,
    setSelectedEdges,
    selectedNodes,
    setSelectedNodes,
    pushAction,
  } = useGridBoardContext();

  // ________COLUMN PURPOSE HANDLERS________

  const handleSaveColumnPurpose = async () => {
    if (!columnPurposeModal) return;

    const colIdx = columnPurposeModal.columnIndex;
    const savePurpose = newColumnPurpose;
    const savePurposeLanes = newColumnPurposeLanes;

    try {
      let oldPurpose = null;
      let oldPurposeLanes = null;
      setColumns(prev => {
        const oldCol = prev[colIdx];
        if (oldCol) {
          oldPurpose = oldCol.purpose || null;
          oldPurposeLanes = oldCol.purpose_lanes || null;
        }
        return prev;
      });

      if (persistColumnPurpose) {
        const result = await persistColumnPurpose(colIdx, savePurpose, savePurposeLanes);
        if (result?.success) {
          setColumns(prev => ({
            ...prev,
            [colIdx]: result.column || result.day,
          }));

          pushAction({
            description: 'Set column purpose',
            undo: async () => {
              const r = await persistColumnPurpose(colIdx, oldPurpose, oldPurposeLanes);
              if (r?.success) setColumns(prev => ({ ...prev, [colIdx]: r.column || r.day }));
            },
            redo: async () => {
              const r = await persistColumnPurpose(colIdx, savePurpose, savePurposeLanes);
              if (r?.success) setColumns(prev => ({ ...prev, [colIdx]: r.column || r.day }));
            },
          });
        }
      }
    } catch (err) {
      console.error("Failed to save column purpose:", err);
    }

    playSound('settingToggle');
    setColumnPurposeModal(null);
    setNewColumnPurpose("");
    setNewColumnPurposeLanes(null);
  };

  const handleClearColumnPurpose = async () => {
    if (!columnPurposeModal) return;

    const colIdx = columnPurposeModal.columnIndex;

    try {
      let oldPurpose = null;
      let oldPurposeLanes = null;
      setColumns(prev => {
        const oldCol = prev[colIdx];
        if (oldCol) {
          oldPurpose = oldCol.purpose || null;
          oldPurposeLanes = oldCol.purpose_lanes || null;
        }
        return prev;
      });

      if (persistColumnPurpose) {
        const result = await persistColumnPurpose(colIdx, null, null);
        if (result?.success) {
          setColumns(prev => ({
            ...prev,
            [colIdx]: result.column || result.day,
          }));

          pushAction({
            description: 'Clear column purpose',
            undo: async () => {
              const r = await persistColumnPurpose(colIdx, oldPurpose, oldPurposeLanes);
              if (r?.success) setColumns(prev => ({ ...prev, [colIdx]: r.column || r.day }));
            },
            redo: async () => {
              const r = await persistColumnPurpose(colIdx, null, null);
              if (r?.success) setColumns(prev => ({ ...prev, [colIdx]: r.column || r.day }));
            },
          });
        }
      }
      playSound('settingToggle');
    } catch (err) {
      console.error("Failed to clear column purpose:", err);
    }

    setColumnPurposeModal(null);
    setNewColumnPurpose("");
    setNewColumnPurposeLanes(null);
  };

  // ________NODE HANDLERS________

  const addNodeLocal = async (rowId) => {
    try {
      const created = persistNodeCreate ? await persistNodeCreate(rowId) : null;
      if (created) {
        const newId = created.id;
        setNodes(prev => ({
          ...prev,
          [newId]: { ...created, display: "default" }
        }));
        setRows(prev => ({
          ...prev,
          [rowId]: {
            ...prev[rowId],
            nodes: [...(prev[rowId]?.nodes || []), created]
          }
        }));
        playSound('milestoneCreate');

        pushAction({
          description: 'Add node',
          undo: async () => {
            if (persistNodeDelete) await persistNodeDelete(newId);
            setNodes(prev => { const u = { ...prev }; delete u[newId]; return u; });
            setRows(prev => ({
              ...prev,
              [rowId]: { ...prev[rowId], nodes: (prev[rowId]?.nodes || []).filter(n => n.id !== newId) }
            }));
          },
          redo: async () => {
            const r = persistNodeCreate ? await persistNodeCreate(rowId) : null;
            if (r) {
              setNodes(prev => ({ ...prev, [r.id]: { ...r, display: "default" } }));
              setRows(prev => ({
                ...prev,
                [rowId]: { ...prev[rowId], nodes: [...(prev[rowId]?.nodes || []), r] }
              }));
            }
          },
        });
      }
    } catch (err) {
      console.error("Failed to add node:", err);
    }
  };

  const confirmNodeCreate = async () => {
    if (!nodeCreateModal) return;

    const { rowId, columnIndex } = nodeCreateModal;

    try {
      const created = persistNodeCreate
        ? await persistNodeCreate(rowId, { startColumn: columnIndex })
        : null;

      if (created) {
        const newId = created.id;
        if (persistNodeMove) await persistNodeMove(newId, columnIndex);

        const newNode = { ...created, startColumn: columnIndex, display: "default" };

        setNodes(prev => ({
          ...prev,
          [newId]: newNode
        }));

        setRows(prev => ({
          ...prev,
          [rowId]: {
            ...prev[rowId],
            nodes: [...(prev[rowId]?.nodes || []), newNode]
          }
        }));
        playSound('milestoneCreate');

        pushAction({
          description: 'Create node at column',
          undo: async () => {
            if (persistNodeDelete) await persistNodeDelete(newId);
            setNodes(prev => { const u = { ...prev }; delete u[newId]; return u; });
            setRows(prev => ({
              ...prev,
              [rowId]: { ...prev[rowId], nodes: (prev[rowId]?.nodes || []).filter(n => n.id !== newId) }
            }));
          },
          redo: async () => {
            const r = persistNodeCreate ? await persistNodeCreate(rowId) : null;
            if (r) {
              if (persistNodeMove) await persistNodeMove(r.id, columnIndex);
              const ns = { ...r, startColumn: columnIndex, display: "default" };
              setNodes(prev => ({ ...prev, [r.id]: ns }));
              setRows(prev => ({
                ...prev,
                [rowId]: { ...prev[rowId], nodes: [...(prev[rowId]?.nodes || []), ns] }
              }));
            }
          },
        });
      }
    } catch (err) {
      console.error("Failed to create node:", err);
    }

    setNodeCreateModal(null);
    setIsAddingNode(false);
  };

  // ________ROW MOVE HANDLER________

  const handleConfirmMove = async () => {
    const { rowId, sourceLaneId, targetLaneId, insertIndex } = moveModal;

    const oldSourceRows = [...lanes[sourceLaneId].rows];
    const oldTargetRows = [...lanes[targetLaneId].rows];
    const oldRowLane = sourceLaneId;

    const sourceLane = lanes[sourceLaneId];
    const newSourceRows = sourceLane.rows.filter(id => id !== rowId);

    const targetLane = lanes[targetLaneId];
    const visibleRows = getVisibleRows(targetLaneId);

    let actualInsertIndex = 0;
    let visibleCount = 0;
    for (let i = 0; i < targetLane.rows.length; i++) {
      if (isRowVisible(targetLane.rows[i], rowDisplaySettings)) {
        if (visibleCount === insertIndex) {
          actualInsertIndex = i;
          break;
        }
        visibleCount++;
      }
      actualInsertIndex = i + 1;
    }

    const newTargetRows = [...targetLane.rows];
    newTargetRows.splice(actualInsertIndex, 0, rowId);

    setLanes(prev => ({
      ...prev,
      [sourceLaneId]: { ...prev[sourceLaneId], rows: newSourceRows },
      [targetLaneId]: { ...prev[targetLaneId], rows: newTargetRows }
    }));

    setRows(prev => ({
      ...prev,
      [rowId]: { ...prev[rowId], lane: targetLaneId }
    }));

    try {
      if (persistRowReorder) await persistRowReorder(rowId, targetLaneId, newTargetRows);
      playSound('taskDragDrop');

      pushAction({
        description: 'Move row cross-lane',
        undo: async () => {
          setLanes(prev => ({
            ...prev,
            [sourceLaneId]: { ...prev[sourceLaneId], rows: oldSourceRows },
            [targetLaneId]: { ...prev[targetLaneId], rows: oldTargetRows },
          }));
          setRows(prev => ({ ...prev, [rowId]: { ...prev[rowId], lane: oldRowLane } }));
          if (persistRowReorder) await persistRowReorder(rowId, sourceLaneId, oldSourceRows);
        },
        redo: async () => {
          setLanes(prev => ({
            ...prev,
            [sourceLaneId]: { ...prev[sourceLaneId], rows: newSourceRows },
            [targetLaneId]: { ...prev[targetLaneId], rows: newTargetRows },
          }));
          setRows(prev => ({ ...prev, [rowId]: { ...prev[rowId], lane: targetLaneId } }));
          if (persistRowReorder) await persistRowReorder(rowId, targetLaneId, newTargetRows);
        },
      });
    } catch (err) {
      console.error("Failed to move row:", err);
    }

    setMoveModal(null);
  };

  // ________DELETE HANDLER________

  const handleDeleteSelected = () => {
    if (selectedEdges.length > 0) {
      setDeleteConfirmModal({
        edgeId: true,
        edgeName: 'Edge',
        edges: [...selectedEdges],
      });
    } else if (selectedNodes.size > 0) {
      const nodeIds = Array.from(selectedNodes);
      if (nodeIds.length === 1) {
        setDeleteConfirmModal({
          nodeId: nodeIds[0],
          nodeName: "this node",
        });
      } else {
        setDeleteConfirmModal({ nodeIds });
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmModal?.edgeId) {
      try {
        const conns = deleteConfirmModal.edges || selectedEdges;
        for (const edge of conns) {
          await handleDeleteEdge(edge);
        }
        setSelectedEdges([]);
      } catch (err) {
        console.error("Failed to delete edge:", err);
      }
    } else if (deleteConfirmModal?.nodeIds) {
      for (const nId of deleteConfirmModal.nodeIds) {
        try {
          await handleNodeDelete(nId);
        } catch (err) {
          console.error("Failed to delete node:", err);
        }
      }
      setSelectedNodes(new Set());
    } else if (deleteConfirmModal?.nodeId) {
      try {
        await handleNodeDelete(deleteConfirmModal.nodeId);
      } catch (err) {
        console.error("Failed to delete node:", err);
      }
    }
    setDeleteConfirmModal(null);
  };

  // ________CREATE HANDLERS________

  const handleCreateLane = async () => {
    if (!newLaneName.trim()) return;
    setIsCreating(true);
    try {
      if (persistLaneCreate) {
        const result = await persistLaneCreate({
          name: newLaneName.trim(),
          color: newLaneColor,
        });
        if (result) {
          setReloadData(true);
          setShowCreateLaneModal(false);
          setNewLaneName("");
          setNewLaneColor("#facc15");
          playSound('uiClick');
        }
      }
    } catch (err) {
      console.error("Failed to create lane:", err);
    }
    setIsCreating(false);
  };

  const handleCreateRow = async () => {
    if (!newRowName.trim() || !newRowLaneId) return;
    setIsCreating(true);
    try {
      if (persistRowCreate) {
        const result = await persistRowCreate({
          name: newRowName.trim(),
          lane_id: newRowLaneId,
        });
        if (result) {
          setReloadData(true);
          setShowCreateRowModal(false);
          setNewRowName("");
          setNewRowLaneId(null);
          playSound('uiClick');
        }
      }
    } catch (err) {
      console.error("Failed to create row:", err);
    }
    setIsCreating(false);
  };

  // ________DEADLINE HANDLER________

  const handleSetDeadline = async (rowId, deadlineColumn) => {
    let oldDeadline = null;
    setRows(prev => { oldDeadline = prev[rowId]?.hard_deadline ?? null; return prev; });
    try {
      if (persistRowDeadline) await persistRowDeadline(rowId, deadlineColumn);
      setRows(prev => ({
        ...prev,
        [rowId]: { ...prev[rowId], hard_deadline: deadlineColumn },
      }));
      playSound('milestoneMove');
      pushAction({
        description: 'Set deadline',
        undo: async () => {
          if (persistRowDeadline) await persistRowDeadline(rowId, oldDeadline);
          setRows(prev => ({ ...prev, [rowId]: { ...prev[rowId], hard_deadline: oldDeadline } }));
        },
        redo: async () => {
          if (persistRowDeadline) await persistRowDeadline(rowId, deadlineColumn);
          setRows(prev => ({ ...prev, [rowId]: { ...prev[rowId], hard_deadline: deadlineColumn } }));
        },
      });
    } catch (err) {
      console.error('Failed to set deadline:', err);
    }
  };

  // ________SUGGESTION-OFFER HANDLER________

  const handleSuggestionOfferAccept = async () => {
    if (!suggestionOfferModal) return;
    const { sourceId, targetId } = suggestionOfferModal;
    setSuggestionOfferModal(null);
    try {
      const defaultReason = 'could be before';
      if (persistEdgeCreate) await persistEdgeCreate(sourceId, targetId, { weight: 'suggestion', reason: defaultReason });
      setEdges(prev => [
        ...prev,
        { source: sourceId, target: targetId, weight: 'suggestion', reason: defaultReason },
      ]);
      pushAction({
        description: 'Create edge (suggestion)',
        undo: async () => {
          if (persistEdgeDelete) await persistEdgeDelete(sourceId, targetId);
          setEdges(prev => prev.filter(e => !(e.source === sourceId && e.target === targetId)));
        },
        redo: async () => {
          if (persistEdgeCreate) await persistEdgeCreate(sourceId, targetId, { weight: 'suggestion', reason: defaultReason });
          setEdges(prev => [
            ...prev,
            { source: sourceId, target: targetId, weight: 'suggestion', reason: defaultReason },
          ]);
        },
      });
    } catch (err) {
      console.error('Failed to create suggestion edge:', err);
    }
  };

  // ________BULK EDGE UPDATE________

  const handleBulkUpdateEdges = async (conns, updates) => {
    if (!conns || conns.length === 0) return;
    playSound('settingToggle');
    const oldValues = conns.map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      reason: e.reason,
    }));
    for (const edge of conns) {
      await handleUpdateEdge(edge, updates, { skipHistory: true });
    }
    pushAction({
      description: `Bulk update ${conns.length} edges`,
      undo: async () => {
        for (const old of oldValues) {
          await handleUpdateEdge(old, { weight: old.weight, reason: old.reason }, { skipHistory: true });
        }
      },
      redo: async () => {
        for (const edge of conns) {
          await handleUpdateEdge(edge, updates, { skipHistory: true });
        }
      },
    });
  };

  // ________WEAK-EDGE CONFLICT HANDLER________

  const handleWeakEdgeConvert = async (conflictData) => {
    if (!conflictData) return;
    const { weakEdges } = conflictData;
    const convertedWeights = weakEdges.map(e => ({ ...e, oldWeight: e.weight || 'weak' }));

    for (const edge of weakEdges) {
      await handleUpdateEdge(edge, { weight: 'suggestion' }, { skipHistory: true });
    }

    if (conflictData.type === 'resize') {
      const { nodesToResize, initialStates, edge: resizeEdge, currentIndexDelta } = conflictData;
      const resizeBefore = {};
      const resizeAfter = {};

      for (const nId of nodesToResize) {
        const initial = initialStates[nId];
        if (!initial) continue;

        let newStart, newDuration;
        if (resizeEdge === 'right') {
          newStart = initial.startColumn;
          newDuration = Math.max(1, initial.duration + currentIndexDelta);
        } else {
          newStart = Math.max(0, initial.startColumn + currentIndexDelta);
          const durationChange = initial.startColumn - newStart;
          newDuration = Math.max(1, initial.duration + durationChange);
        }

        resizeBefore[nId] = { startColumn: initial.startColumn, duration: initial.duration };
        resizeAfter[nId] = { startColumn: newStart, duration: newDuration };

        setNodes(prev => ({
          ...prev,
          [nId]: { ...prev[nId], startColumn: newStart, duration: newDuration },
        }));

        const durationChange = newDuration - initial.duration;
        if (durationChange !== 0) {
          try { if (persistNodeResize) await persistNodeResize(nId, durationChange); } catch (err) { console.error('Failed to change duration:', err); }
        }
        if (resizeEdge === 'left' && newStart !== initial.startColumn) {
          try { if (persistNodeMove) await persistNodeMove(nId, newStart); } catch (err) { console.error('Failed to update start column:', err); }
        }
      }

      pushAction({
        description: 'Weak edge convert + resize',
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
          for (const e of convertedWeights) {
            if (persistEdgeUpdate) await persistEdgeUpdate(e.source, e.target, { weight: e.oldWeight });
            setEdges(prev => prev.map(edge =>
              edge.source === e.source && edge.target === e.target ? { ...edge, weight: e.oldWeight } : edge
            ));
          }
        },
        redo: async () => {
          for (const e of convertedWeights) {
            if (persistEdgeUpdate) await persistEdgeUpdate(e.source, e.target, { weight: 'suggestion' });
            setEdges(prev => prev.map(edge =>
              edge.source === e.source && edge.target === e.target ? { ...edge, weight: 'suggestion' } : edge
            ));
          }
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
    } else {
      // Move path
      const { nodesToMove, initialPositions, currentDeltaIndex, rowChanges } = conflictData;

      const beforePositions = {};
      for (const nId of nodesToMove) {
        const initial = initialPositions[nId];
        if (initial) beforePositions[nId] = initial.startColumn;
      }

      const afterPositions = {};
      for (const nId of nodesToMove) {
        const initial = initialPositions[nId];
        if (!initial) continue;
        const newStart = initial.startColumn + currentDeltaIndex;
        afterPositions[nId] = newStart;
        setNodes(prev => {
          const { x, ...rest } = prev[nId]; // eslint-disable-line no-unused-vars
          return { ...prev, [nId]: { ...rest, startColumn: newStart } };
        });
        try {
          if (persistNodeMove) await persistNodeMove(nId, newStart);
        } catch (err) {
          console.error('Failed to update start column after weak edge conversion:', err);
        }
      }

      if (rowChanges) {
        for (const [nId, change] of Object.entries(rowChanges)) {
          setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], row: change.to } }));
          setRows(prev => {
            const updated = { ...prev };
            if (updated[change.from]) {
              updated[change.from] = {
                ...updated[change.from],
                nodes: (updated[change.from].nodes || []).filter(ref => String(ref.id) !== String(nId)),
              };
            }
            if (updated[change.to]) {
              updated[change.to] = {
                ...updated[change.to],
                nodes: [...(updated[change.to].nodes || []), { id: parseInt(nId) || nId }],
              };
            }
            return updated;
          });
          try {
            if (persistNodeTaskChange) await persistNodeTaskChange(nId, change.to);
          } catch (err) {
            console.error('Failed to move node row after weak edge conversion:', err);
          }
        }
      }

      pushAction({
        description: 'Weak edge convert + move',
        undo: async () => {
          for (const nId of nodesToMove) {
            const oldStart = beforePositions[nId];
            if (oldStart === undefined) continue;
            if (persistNodeMove) await persistNodeMove(nId, oldStart);
            setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: oldStart } }));
          }
          if (rowChanges) {
            for (const [nId, change] of Object.entries(rowChanges)) {
              setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], row: change.from } }));
              setRows(prev => {
                const updated = { ...prev };
                if (updated[change.to]) {
                  updated[change.to] = {
                    ...updated[change.to],
                    nodes: (updated[change.to].nodes || []).filter(ref => String(ref.id) !== String(nId)),
                  };
                }
                if (updated[change.from]) {
                  updated[change.from] = {
                    ...updated[change.from],
                    nodes: [...(updated[change.from].nodes || []), { id: parseInt(nId) || nId }],
                  };
                }
                return updated;
              });
              if (persistNodeTaskChange) await persistNodeTaskChange(nId, change.from);
            }
          }
          for (const e of convertedWeights) {
            if (persistEdgeUpdate) await persistEdgeUpdate(e.source, e.target, { weight: e.oldWeight });
            setEdges(prev => prev.map(edge =>
              edge.source === e.source && edge.target === e.target ? { ...edge, weight: e.oldWeight } : edge
            ));
          }
        },
        redo: async () => {
          for (const e of convertedWeights) {
            if (persistEdgeUpdate) await persistEdgeUpdate(e.source, e.target, { weight: 'suggestion' });
            setEdges(prev => prev.map(edge =>
              edge.source === e.source && edge.target === e.target ? { ...edge, weight: 'suggestion' } : edge
            ));
          }
          for (const nId of nodesToMove) {
            const newStart = afterPositions[nId];
            if (newStart === undefined) continue;
            if (persistNodeMove) await persistNodeMove(nId, newStart);
            setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: newStart } }));
          }
          if (rowChanges) {
            for (const [nId, change] of Object.entries(rowChanges)) {
              setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], row: change.to } }));
              setRows(prev => {
                const updated = { ...prev };
                if (updated[change.from]) {
                  updated[change.from] = {
                    ...updated[change.from],
                    nodes: (updated[change.from].nodes || []).filter(ref => String(ref.id) !== String(nId)),
                  };
                }
                if (updated[change.to]) {
                  updated[change.to] = {
                    ...updated[change.to],
                    nodes: [...(updated[change.to].nodes || []), { id: parseInt(nId) || nId }],
                  };
                }
                return updated;
              });
              if (persistNodeTaskChange) await persistNodeTaskChange(nId, change.to);
            }
          }
        },
      });
    }
  };

  return {
    handleSaveColumnPurpose,
    handleClearColumnPurpose,
    addNodeLocal,
    confirmNodeCreate,
    handleConfirmMove,
    handleConfirmDelete,
    handleDeleteSelected,
    handleCreateLane,
    handleCreateRow,
    handleSetDeadline,
    handleSuggestionOfferAccept,
    handleBulkUpdateEdges,
    handleWeakEdgeConvert,
  };
}
