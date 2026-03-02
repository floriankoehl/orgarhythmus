// Interaction orchestrator for the DependencyGrid.
// Composes focused sub-hooks and adds global effects (keyboard, click-outside, auto-visibility).
// Generic version — all API calls extracted into persist callbacks.

import { useRef, useEffect, useCallback, useState } from 'react';
import { playSound } from '../assets/sound_registry';
import { useGridBoardContext } from './GridBoardContext.jsx';

// Sub-hooks
import { useGridWarnings } from './useGridWarnings';
import { useDragInteractions } from './useDragInteractions';
import { useNodeInteractions } from './useNodeInteractions';
import { useEdgeInteractions } from './useEdgeInteractions';

// Pure validation re-exports (kept in return for backward compat)
import {
  checkNodeOverlap as _checkNodeOverlap,
  checkMultiNodeOverlap as _checkMultiNodeOverlap,
  validateNodeMove as _validateNodeMove,
  validateMultiNodeMove as _validateMultiNodeMove,
  computeCascadePush,
  checkDeadlineViolation,
} from './gridValidation';

/**
 * Custom hook for managing all interaction behavior in the DependencyGrid.
 * This includes keyboard handlers, drag logic, selection logic, and event handlers.
 *
 * Persist callbacks (adapter-supplied, for copy/paste and arrow-move):
 * @param {Function} params.persistNodeCreate
 * @param {Function} params.persistNodeMove
 * @param {Function} params.persistNodeResize
 * @param {Function} params.persistNodeDelete
 * @param {Function} params.persistEdgeCreate
 * @param {Function} params.persistEdgeDelete
 * @param {Function} params.persistNodeTaskChange - move node to a different row
 */
export function useGridInteraction({
  // State values (non-UI)
  nodes,
  lanes,
  rows,
  laneOrder,
  edges,
  openLaneSettings,
  showFilterDropdown,
  rowDisplaySettings,
  laneDisplaySettings,

  // State setters (non-UI)
  setMode,
  setNodes,
  setLanes,
  setLaneOrder,
  setEdges,
  setDeleteConfirmModal,
  setOpenLaneSettings,
  setShowFilterDropdown,
  setRowDisplaySettings,
  setLaneDisplaySettings,
  setNodeCreateModal,
  setIsAddingNode,
  setRows,

  // Layout helpers
  COLUMNWIDTH,
  LANEWIDTH,
  ROWLABELWIDTH,
  getRowHeight,
  getLaneHeight,
  isLaneVisible,
  getVisibleLaneIndex,
  getLaneYOffset,
  getRowYOffset,
  getVisibleRows,
  columnLayout,
  collapsedColumns,

  // Computed
  safeMode,

  // Callbacks
  onSuggestionOffer,

  // Settings
  defaultEdgeWeight,

  // Phase row offset
  getLanePhaseRowHeight,

  // Layout constants (includes effective HEADER_HEIGHT)
  layoutConstants,

  // Views (for keyboard shortcuts: X + key)
  savedViews = [],
  viewShortcuts = {},
  onLoadView,
  onSaveView,
  onNextView,
  onPrevView,
  // Refactor mode
  refactorMode,
  setRefactorMode,
  // Toggle shortcuts
  setToolbarCollapsed,
  setHeaderCollapsed,
  toggleFullscreen,
  // User shortcuts
  userShortcuts = {},
  // Q+W shortcut action setters
  setCustomColumnWidth,
  setCustomRowHeightNormal,
  setCustomRowHeightSmall,
  setHideColumnHeader,
  setSoundEnabled,
  setShowEmptyLanes,
  setShowPhaseColorsInGrid,
  setHideAllEdges,
  setHideCollapsedEdges,
  setHideCollapsedNodes,
  setExpandedRowView,
  setHideGlobalPhases,
  uncollapseAll,
  setAutoSelectBlocking,
  // Visibility state values (for select-visible shortcuts)
  hideAllEdges,
  hideCollapsedEdges,
  hideCollapsedNodes,
  isLaneCollapsed,
  // Quick snapshot save
  snapshots = [],
  onQuickSaveSnapshot,
  // Create modals for shortcuts
  setShowCreateLaneModal,
  setShowCreateRowModal,
  setPhaseEditModal,
  // Default view
  onLoadDefaultView,

  // ── Persist callbacks (adapter-supplied) ──
  persistNodeCreate,
  persistNodeMove,
  persistNodeResize,
  persistNodeDelete,
  persistNodeRename,
  persistEdgeCreate,
  persistEdgeDelete,
  persistEdgeUpdate,
  persistNodeTaskChange,
  persistLaneOrder,
  persistRowOrder,
}) {
  // ── Context ──
  const {
    viewMode,
    setViewMode,
    baseViewModeRef,
    selectedNodes,
    setSelectedNodes,
    selectedEdges,
    setSelectedEdges,
    autoSelectBlocking,
    setEditingNodeId,
    setEditingNodeName,
    clipboard,
    setClipboard,
    undo,
    redo,
    pushAction,
  } = useGridBoardContext();

  // Shared ref — used by node click + drag hooks to prevent click-after-drag
  const justDraggedRef = useRef(false);

  // ── Weak edge conflict modal state ──
  const [weakEdgeModal, setWeakEdgeModal] = useState(null);

  // ── Warning system ──
  const {
    warningMessages,
    blockedMoveHighlight,
    setBlockedMoveHighlight,
    addWarning,
    showBlockingFeedback,
  } = useGridWarnings({
    nodes,
    rows,
    rowDisplaySettings,
    laneDisplaySettings,
    setRowDisplaySettings,
    setLaneDisplaySettings,
    hideAllEdges,
    setHideAllEdges,
  });

  // ── Lane / row drag + marquee ──
  const {
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    rowGhost,
    setRowGhost,
    rowDropTarget,
    setRowDropTarget,
    moveModal,
    setMoveModal,
    marqueeRect,
    handleLaneDrag,
    handleRowDrag,
    handleMarqueeStart,
  } = useDragInteractions({
    nodes,
    lanes,
    rows,
    laneOrder,
    rowDisplaySettings,
    laneDisplaySettings,
    setLanes,
    setLaneOrder,
    COLUMNWIDTH,
    LANEWIDTH,
    ROWLABELWIDTH,
    getRowHeight,
    getLaneHeight,
    isLaneVisible,
    getLaneYOffset,
    getRowYOffset,
    getVisibleRows,
    justDraggedRef,
    getLanePhaseRowHeight,
    layoutConstants,
    columnLayout,
    collapsedColumns,
    // Persist callbacks
    persistLaneOrder,
    persistRowOrder,
  });

  // ── Node interactions ──
  const {
    handleNodeMouseDown,
    handleNodeEdgeResize,
    handleNodeClick,
    handleNodeDelete,
    handleNodeDoubleClick,
    handleNodeRenameSubmit,
    handleColumnCellClick,
  } = useNodeInteractions({
    nodes,
    rows,
    edges,
    setNodes,
    setRows,
    setEdges,
    setNodeCreateModal,
    COLUMNWIDTH,
    safeMode,
    justDraggedRef,
    addWarning,
    showBlockingFeedback,
    onWeakEdgeConflict: setWeakEdgeModal,
    collapsedColumns,
    columnLayout,
    // Persist callbacks
    persistNodeMove,
    persistNodeResize,
    persistNodeRename,
    persistNodeDelete,
    persistNodeCreate,
    persistEdgeCreate,
  });

  // ── Edge interactions ──
  const {
    isDraggingEdge: isDraggingConnection,
    setIsDraggingEdge: setIsDraggingConnection,
    edgeStart: connectionStart,
    setEdgeStart: setConnectionStart,
    edgeEnd: connectionEnd,
    setEdgeEnd: setConnectionEnd,
    handleEdgeDragStart,
    handleEdgeClick,
    handleDeleteEdge,
    handleUpdateEdge,
    findNodeAtPosition,
    getNodeHandlePosition,
  } = useEdgeInteractions({
    nodes,
    lanes,
    rows,
    edges,
    rowDisplaySettings,
    setEdges,
    COLUMNWIDTH,
    LANEWIDTH,
    ROWLABELWIDTH,
    getRowHeight,
    isLaneVisible,
    getLaneYOffset,
    getRowYOffset,
    safeMode,
    addWarning,
    setBlockedMoveHighlight,
    onSuggestionOffer,
    defaultEdgeWeight,
    columnLayout,
    getLanePhaseRowHeight,
    // Persist callbacks
    persistEdgeCreate,
    persistEdgeDelete,
    persistEdgeUpdate,
  });

  // ── Copy/Paste logic ──
  const handleCopy = useCallback(() => {
    if (selectedNodes.size === 0) return;

    const copiedNodes = [];
    for (const nId of selectedNodes) {
      const n = nodes[nId];
      if (!n) continue;
      copiedNodes.push({
        originalId: nId,
        row: n.row,
        name: n.name,
        description: n.description || "",
        startColumn: n.startColumn,
        duration: n.duration || 1,
        color: n.color || null,
      });
    }

    // Collect inter-edges (edges between selected nodes)
    const selectedSet = selectedNodes;
    const copiedEdges = edges.filter(
      e => selectedSet.has(e.source) && selectedSet.has(e.target)
    ).map(e => ({ source: e.source, target: e.target }));

    setClipboard({ nodes: copiedNodes, edges: copiedEdges });
    addWarning(
      `Copied ${copiedNodes.length} node${copiedNodes.length > 1 ? 's' : ''}${copiedEdges.length > 0 ? ` + ${copiedEdges.length} edge${copiedEdges.length > 1 ? 's' : ''}` : ''}`,
      "Press Ctrl+V to paste"
    );
    playSound('uiClick');
  }, [selectedNodes, nodes, edges, setClipboard, addWarning]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || !clipboard.nodes || clipboard.nodes.length === 0) return;

    const copiedNodes = clipboard.nodes;

    // Calculate offset: shift right so pasted nodes don't overlap with originals
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const n of copiedNodes) {
      minStart = Math.min(minStart, n.startColumn);
      maxEnd = Math.max(maxEnd, n.startColumn + n.duration);
    }
    const offset = maxEnd - minStart + 1;

    const idMap = {};
    const newNodeIds = [];

    for (const n of copiedNodes) {
      const newStartColumn = n.startColumn + offset;
      try {
        const created = persistNodeCreate
          ? await persistNodeCreate(n.row, {
              name: `${n.name} (copy)`,
              description: n.description,
              startColumn: newStartColumn,
              duration: n.duration,
              color: n.color,
            })
          : null;

        if (created) {
          const newId = created.id;
          idMap[n.originalId] = newId;
          newNodeIds.push(newId);

          const newNode = {
            ...created,
            startColumn: newStartColumn,
            duration: n.duration,
            display: "default",
            color: n.color,
          };
          setNodes(prev => ({ ...prev, [newId]: newNode }));
          setRows(prev => ({
            ...prev,
            [n.row]: {
              ...prev[n.row],
              nodes: [...(prev[n.row]?.nodes || []), newNode],
            },
          }));
        }
      } catch (err) {
        console.error("Failed to paste node:", err);
      }
    }

    // Recreate inter-edges between pasted nodes
    for (const edge of clipboard.edges) {
      const newSource = idMap[edge.source];
      const newTarget = idMap[edge.target];
      if (newSource && newTarget) {
        try {
          if (persistEdgeCreate) await persistEdgeCreate(newSource, newTarget);
          setEdges(prev => [...prev, { source: newSource, target: newTarget }]);
        } catch (err) {
          console.error("Failed to paste edge:", err);
        }
      }
    }

    // Select the newly pasted nodes
    setSelectedNodes(new Set(newNodeIds));
    setSelectedEdges([]);

    addWarning(
      `Pasted ${newNodeIds.length} node${newNodeIds.length > 1 ? 's' : ''}`,
      null
    );
    playSound('milestoneCreate');

    // Track pasted node IDs and their rows for undo
    const pastedRowMap = {};
    for (const n of copiedNodes) {
      for (const [origId, newId] of Object.entries(idMap)) {
        if (parseInt(origId) === n.originalId) {
          pastedRowMap[newId] = n.row;
        }
      }
    }

    pushAction({
      description: `Paste ${newNodeIds.length} node(s)`,
      undo: async () => {
        for (const nId of newNodeIds) {
          try { if (persistNodeDelete) await persistNodeDelete(nId); } catch (e) { /* may already be deleted */ }
          setNodes(prev => { const u = { ...prev }; delete u[nId]; return u; });
          const rowId = pastedRowMap[nId];
          if (rowId) {
            setRows(prev => ({
              ...prev,
              [rowId]: { ...prev[rowId], nodes: (prev[rowId]?.nodes || []).filter(n => n.id !== nId) }
            }));
          }
        }
        setEdges(prev => prev.filter(e =>
          !newNodeIds.includes(e.source) && !newNodeIds.includes(e.target)
        ));
      },
      redo: async () => {
        // Re-paste (simplified)
        const newIdMap2 = {};
        const newIds2 = [];
        for (const n of copiedNodes) {
          const newStartColumn = n.startColumn + offset;
          const created = persistNodeCreate
            ? await persistNodeCreate(n.row, { name: `${n.name} (copy)`, description: n.description, startColumn: newStartColumn, duration: n.duration, color: n.color })
            : null;
          if (created) {
            newIdMap2[n.originalId] = created.id;
            newIds2.push(created.id);
            const ns = { ...created, startColumn: newStartColumn, duration: n.duration, display: "default", color: n.color };
            setNodes(prev => ({ ...prev, [created.id]: ns }));
            setRows(prev => ({ ...prev, [n.row]: { ...prev[n.row], nodes: [...(prev[n.row]?.nodes || []), ns] } }));
          }
        }
        for (const edge of clipboard.edges) {
          const ns = newIdMap2[edge.source], nt = newIdMap2[edge.target];
          if (ns && nt) {
            if (persistEdgeCreate) await persistEdgeCreate(ns, nt);
            setEdges(prev => [...prev, { source: ns, target: nt }]);
          }
        }
      },
    });
  }, [clipboard, nodes, setNodes, setRows, setEdges, setSelectedNodes, setSelectedEdges, addWarning, pushAction, persistNodeCreate, persistNodeDelete, persistEdgeCreate]);

  // ________Global Keyboard Listener___________

  // Ref for X-key chord
  const xKeyPendingRef = useRef(null);
  const xKeyActiveRef = useRef(false);
  const xChordFirstKeyRef = useRef(null);
  const xChordTimerRef = useRef(null);

  // Ref for Q+W chord
  const qwChordStage = useRef(0);
  const qwChordTimerRef = useRef(null);

  // Helper: execute a shortcut action by its action key
  const executeShortcutAction = useCallback((actionKey) => {
    switch (actionKey) {
      case 'toggleToolbar': setToolbarCollapsed(prev => !prev); playSound('uiClick'); return true;
      case 'toggleHeader': setHeaderCollapsed(prev => !prev); playSound('uiClick'); return true;
      case 'focusMode': setHeaderCollapsed(prev => !prev); setToolbarCollapsed(prev => !prev); toggleFullscreen(); playSound('uiClick'); return true;
      case 'modeSchedule': setViewMode("schedule"); baseViewModeRef.current = "schedule"; playSound('modeSwitch'); return true;
      case 'modeDependency': setViewMode("dependency"); baseViewModeRef.current = "dependency"; playSound('modeSwitch'); return true;
      case 'modeInspection': setViewMode("inspection"); baseViewModeRef.current = "inspection"; playSound('modeSwitch'); return true;
      case 'modeRefactor': setRefactorMode(prev => !prev); playSound('refactorToggle'); return true;
      // Sizing
      case 'dayWidthUp': setCustomColumnWidth(prev => Math.min((prev || 50) + 10, 200)); playSound('settingToggle'); return true;
      case 'dayWidthDown': setCustomColumnWidth(prev => Math.max((prev || 50) - 10, 20)); playSound('settingToggle'); return true;
      case 'taskHeightUp': setCustomRowHeightNormal(prev => Math.min((prev || 38) + 4, 80)); playSound('settingToggle'); return true;
      case 'taskHeightDown': setCustomRowHeightNormal(prev => Math.max((prev || 38) - 4, 16)); playSound('settingToggle'); return true;
      case 'taskHeightSmallUp': setCustomRowHeightSmall(prev => Math.min((prev || 20) + 4, 60)); playSound('settingToggle'); return true;
      case 'taskHeightSmallDown': setCustomRowHeightSmall(prev => Math.max((prev || 20) - 4, 10)); playSound('settingToggle'); return true;
      // Visibility toggles
      case 'toggleDayHeader': setHideColumnHeader(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleSound': setSoundEnabled(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleFullscreen': toggleFullscreen(); playSound('uiClick'); return true;
      case 'toggleEmptyTeams': setShowEmptyLanes(prev => !prev); playSound('settingToggle'); return true;
      case 'togglePhaseColors': setShowPhaseColorsInGrid(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleAllDeps': setHideAllEdges(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleCollapsedDeps': setHideCollapsedEdges(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleCollapsedMilestones': setHideCollapsedNodes(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleExpandedTask': setExpandedRowView(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleGlobalPhases': setHideGlobalPhases(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleAutoSelect': setAutoSelectBlocking(prev => !prev); playSound('settingToggle'); return true;
      // Bulk lane/row actions
      case 'collapseAllTeams': setLaneDisplaySettings(prev => {
        const u = { ...prev }; for (const lid of laneOrder) u[lid] = { ...u[lid], collapsed: true }; return u;
      }); playSound('settingToggle'); return true;
      case 'expandAllTeams': setLaneDisplaySettings(prev => {
        const u = { ...prev }; for (const lid of laneOrder) u[lid] = { ...u[lid], collapsed: false }; return u;
      }); playSound('settingToggle'); return true;
      case 'allTasksSmall': setRowDisplaySettings(prev => {
        const u = { ...prev }; for (const lid of laneOrder) { const l = lanes[lid]; if (l) for (const rk of l.rows) u[rk] = { ...u[rk], size: 'small' }; } return u;
      }); playSound('settingToggle'); return true;
      case 'allTasksNormal': setRowDisplaySettings(prev => {
        const u = { ...prev }; for (const lid of laneOrder) { const l = lanes[lid]; if (l) for (const rk of l.rows) u[rk] = { ...u[rk], size: 'normal' }; } return u;
      }); playSound('settingToggle'); return true;
      case 'uncollapseAllDays': if (uncollapseAll) uncollapseAll(); return true;
      // Select-all shortcuts
      case 'selectAllMilestones': setSelectedNodes(new Set(Object.keys(nodes).map(Number))); setSelectedEdges([]); playSound('milestoneSelect'); return true;
      case 'selectAllDeps': setSelectedEdges([...edges]); setSelectedNodes(new Set()); playSound('milestoneSelect'); return true;
      // Select visible nodes / edges
      case 'selectVisibleMilestones': {
        const visibleIds = new Set();
        for (const [id, nd] of Object.entries(nodes)) {
          const row = rows[nd.row];
          if (!row) continue;
          if (!isLaneVisible(row.lane)) continue;
          if (isLaneCollapsed && isLaneCollapsed(row.lane)) continue;
          if (rowDisplaySettings[nd.row]?.hidden) continue;
          if (hideCollapsedNodes && rowDisplaySettings[nd.row]?.size === 'small') continue;
          visibleIds.add(Number(id));
        }
        setSelectedNodes(visibleIds);
        setSelectedEdges([]);
        playSound('milestoneSelect');
        return true;
      }
      case 'selectVisibleDeps': {
        if (hideAllEdges) { setSelectedEdges([]); return true; }
        const visibleEdges = edges.filter(edge => {
          const srcNd = nodes[edge.source];
          const tgtNd = nodes[edge.target];
          if (!srcNd || !tgtNd) return false;
          const srcRow = rows[srcNd.row];
          const tgtRow = rows[tgtNd.row];
          if (!srcRow || !tgtRow) return false;
          if (!isLaneVisible(srcRow.lane) || !isLaneVisible(tgtRow.lane)) return false;
          if (hideCollapsedEdges) {
            if (isLaneCollapsed && (isLaneCollapsed(srcRow.lane) || isLaneCollapsed(tgtRow.lane))) return false;
          }
          return true;
        });
        setSelectedEdges(visibleEdges);
        setSelectedNodes(new Set());
        playSound('milestoneSelect');
        return true;
      }
      // Create actions (open modals)
      case 'createTeam': if (setShowCreateLaneModal) setShowCreateLaneModal(true); playSound('uiClick'); return true;
      case 'createTask': if (setShowCreateRowModal) setShowCreateRowModal(true); playSound('uiClick'); return true;
      case 'createPhase': if (setPhaseEditModal) setPhaseEditModal({ mode: 'create', start_index: 0, duration: 7, name: '', color: '#3b82f6', lane: null }); playSound('uiClick'); return true;
      case 'loadDefaultView': if (onLoadDefaultView) onLoadDefaultView(); return true;
      default: return false;
    }
  }, [setToolbarCollapsed, setHeaderCollapsed, toggleFullscreen, setViewMode, setRefactorMode,
      setCustomColumnWidth, setCustomRowHeightNormal, setCustomRowHeightSmall, setHideColumnHeader,
      setSoundEnabled, setShowEmptyLanes, setShowPhaseColorsInGrid, setHideAllEdges,
      setHideCollapsedEdges, setHideCollapsedNodes, setExpandedRowView,
      setLaneDisplaySettings, setRowDisplaySettings, laneOrder, lanes,
      setHideGlobalPhases, uncollapseAll, setAutoSelectBlocking,
      nodes, edges, setSelectedNodes, setSelectedEdges,
      rows, isLaneVisible, isLaneCollapsed, hideAllEdges,
      hideCollapsedEdges, hideCollapsedNodes,
      setShowCreateLaneModal, setShowCreateRowModal, setPhaseEditModal, onLoadDefaultView,
      baseViewModeRef]);

  // ── Arrow key node movement ──
  const handleArrowMoveHorizontal = useCallback(async (direction) => {
    if (selectedNodes.size === 0) return;

    const delta = direction;
    const beforePositions = {};
    const afterPositions = {};
    const nodesToMove = [];

    for (const nId of selectedNodes) {
      const n = nodes[nId];
      if (!n) continue;
      const newStart = n.startColumn + delta;
      if (newStart < 0) {
        playSound('error');
        return;
      }
      beforePositions[nId] = n.startColumn;
      afterPositions[nId] = newStart;
      nodesToMove.push(nId);
    }

    if (nodesToMove.length === 0) return;

    // Check overlap
    const excludeIds = new Set(nodesToMove);
    for (const nId of nodesToMove) {
      const n = nodes[nId];
      const result = _checkNodeOverlap(nodes, rows, nId, afterPositions[nId], n.duration || 1, excludeIds);
      if (!result.valid) {
        playSound('error');
        return;
      }
    }

    // Check edge constraints
    let edgeResult;
    if (nodesToMove.length === 1) {
      edgeResult = _validateNodeMove(nodes, edges, nodesToMove[0], afterPositions[nodesToMove[0]]);
    } else {
      edgeResult = _validateMultiNodeMove(nodes, edges, nodesToMove, delta);
    }

    if (edgeResult && !edgeResult.valid) {
      const strongBlockers = edgeResult.allBlocking.filter(b => b.weight === 'strong');
      const weakBlockers = edgeResult.allBlocking.filter(b => b.weight === 'weak');
      const suggestionBlockers = edgeResult.allBlocking.filter(b => b.weight === 'suggestion');

      if (strongBlockers.length > 0) {
        addWarning('Blocked', 'Move violates an edge constraint');
        for (const b of strongBlockers) {
          showBlockingFeedback(b.blockingNodeId, b.blockingEdge);
        }
        if (autoSelectBlocking) {
          const blockingIds = new Set([...nodesToMove, ...strongBlockers.map(b => b.blockingNodeId)]);
          setSelectedNodes(blockingIds);
          setSelectedEdges([]);
        }
        playSound('blocked');
        return;
      }

      if (weakBlockers.length > 0) {
        const initialPositions = {};
        for (const nId of nodesToMove) {
          initialPositions[nId] = { startColumn: beforePositions[nId] };
        }
        setWeakEdgeModal({
          weakEdges: weakBlockers.map(b => b.blockingEdge),
          blockingNodeIds: weakBlockers.map(b => b.blockingNodeId),
          nodesToMove,
          initialPositions,
          currentDeltaIndex: delta,
          suggestionBlocking: suggestionBlockers.map(b => b.blockingEdge),
        });
        playSound('blocked');
        return;
      }

      if (suggestionBlockers.length > 0) {
        addWarning('Suggestion edge violated', 'This move violates a suggestion edge, but it is allowed.');
        for (const b of suggestionBlockers) {
          showBlockingFeedback(b.blockingNodeId, b.blockingEdge);
        }
      }
    }

    // Apply move
    playSound('milestoneMove');
    for (const nId of nodesToMove) {
      const newStart = afterPositions[nId];
      setNodes(prev => ({
        ...prev,
        [nId]: { ...prev[nId], startColumn: newStart },
      }));
      try {
        if (persistNodeMove) await persistNodeMove(nId, newStart);
      } catch (err) {
        console.error("Arrow move failed:", err);
      }
    }

    pushAction({
      description: `Arrow move ${nodesToMove.length} node(s)`,
      undo: async () => {
        for (const nId of nodesToMove) {
          const oldStart = beforePositions[nId];
          setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: oldStart } }));
          if (persistNodeMove) await persistNodeMove(nId, oldStart);
        }
      },
      redo: async () => {
        for (const nId of nodesToMove) {
          const newStart = afterPositions[nId];
          setNodes(prev => ({ ...prev, [nId]: { ...prev[nId], startColumn: newStart } }));
          if (persistNodeMove) await persistNodeMove(nId, newStart);
        }
      },
    });
  }, [selectedNodes, nodes, rows, edges, setNodes, pushAction, addWarning, showBlockingFeedback, autoSelectBlocking, setSelectedNodes, setSelectedEdges, setWeakEdgeModal, persistNodeMove]);

  // ── Spread selected nodes ──
  const handleSpreadNodes = useCallback(async () => {
    if (selectedNodes.size < 2) {
      addWarning('Spread needs selection', 'Select at least 2 nodes to spread.');
      return;
    }

    const selected = [];
    for (const nId of selectedNodes) {
      const n = nodes[nId];
      if (n) selected.push({ id: nId, startColumn: n.startColumn, duration: n.duration || 1 });
    }
    selected.sort((a, b) => a.startColumn - b.startColumn || a.id - b.id);

    const proposedPositions = {};
    proposedPositions[selected[0].id] = { startColumn: selected[0].startColumn, duration: selected[0].duration };

    for (let i = 1; i < selected.length; i++) {
      const prev = selected[i - 1];
      const nd = selected[i];
      const prevEnd = (proposedPositions[prev.id]?.startColumn ?? prev.startColumn) + (prev.duration || 1);
      const newStart = Math.max(nd.startColumn + 1, prevEnd + 1);
      proposedPositions[nd.id] = { startColumn: newStart, duration: nd.duration };
    }

    // Validate deadlines
    for (const nd of selected) {
      const pp = proposedPositions[nd.id];
      const deadlineResult = checkDeadlineViolation(nodes, rows, nd.id, pp.startColumn, pp.duration);
      if (!deadlineResult.valid) {
        addWarning('Spread blocked: hard deadline', 'Spreading would push a node past its row\'s hard deadline.');
        playSound('blocked');
        return;
      }
    }

    // Cascade check
    const cascadeResult = computeCascadePush(nodes, rows, edges, proposedPositions);
    if (!cascadeResult.valid) {
      addWarning('Spread blocked: hard deadline', 'Cascading the spread would exceed a row\'s hard deadline.');
      playSound('blocked');
      return;
    }

    const externalPushes = Object.keys(cascadeResult.pushes).filter(id => !selectedNodes.has(id) && !selectedNodes.has(Number(id)));
    if (externalPushes.length > 0) {
      addWarning('Spread blocked', 'Spreading would push non-selected nodes. Use Alt+Resize for cascade behaviour.');
      playSound('blocked');
      return;
    }

    // Check overlap
    const excludeIds = new Set(selected.map(s => s.id));
    for (const nd of selected) {
      const pp = proposedPositions[nd.id];
      const overlapResult = _checkNodeOverlap(nodes, rows, nd.id, pp.startColumn, pp.duration, excludeIds);
      if (!overlapResult.valid) {
        addWarning('Spread blocked: overlap', 'Spreading would cause nodes to overlap within a row.');
        playSound('blocked');
        return;
      }
    }

    // Apply
    const beforePositions = {};
    const afterPositions = {};
    for (const nd of selected) {
      beforePositions[nd.id] = nd.startColumn;
      afterPositions[nd.id] = proposedPositions[nd.id].startColumn;
    }

    setNodes(prev => {
      const updated = { ...prev };
      for (const nd of selected) {
        updated[nd.id] = { ...updated[nd.id], startColumn: afterPositions[nd.id] };
      }
      return updated;
    });

    playSound('milestoneMove');

    for (const nd of selected) {
      const newStart = afterPositions[nd.id];
      if (newStart !== beforePositions[nd.id]) {
        try {
          if (persistNodeMove) await persistNodeMove(nd.id, newStart);
        } catch (err) {
          console.error('Spread save failed:', err);
        }
      }
    }

    pushAction({
      description: `Spread ${selected.length} node(s)`,
      undo: async () => {
        for (const nd of selected) {
          const oldStart = beforePositions[nd.id];
          setNodes(prev => ({ ...prev, [nd.id]: { ...prev[nd.id], startColumn: oldStart } }));
          if (persistNodeMove) await persistNodeMove(nd.id, oldStart);
        }
      },
      redo: async () => {
        for (const nd of selected) {
          const newStart = afterPositions[nd.id];
          setNodes(prev => ({ ...prev, [nd.id]: { ...prev[nd.id], startColumn: newStart } }));
          if (persistNodeMove) await persistNodeMove(nd.id, newStart);
        }
      },
    });
  }, [selectedNodes, nodes, rows, edges, setNodes, pushAction, addWarning, persistNodeMove]);

  // ── Vertical arrow (move to adjacent row — refactor mode only) ──
  const handleArrowMoveVertical = useCallback(async (direction) => {
    if (selectedNodes.size !== 1) return;
    if (!refactorMode) return;

    const nId = Array.from(selectedNodes)[0];
    const n = nodes[nId];
    if (!n) return;

    // Build flat ordered row list from lane order
    const allRows = [];
    for (const laneId of laneOrder) {
      const lane = lanes[laneId];
      if (!lane) continue;
      for (const rowKey of (lane.rows || [])) {
        allRows.push({ rowKey, laneId });
      }
    }

    const currentIdx = allRows.findIndex(r => String(r.rowKey) === String(n.row));
    if (currentIdx === -1) return;

    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= allRows.length) {
      playSound('error');
      return;
    }

    const targetRowKey = allRows[targetIdx].rowKey;
    const oldRowKey = n.row;

    // Check overlap on target row
    const targetRow = rows[targetRowKey];
    if (targetRow) {
      const targetNodes = targetRow.nodes || [];
      for (const nRef of targetNodes) {
        const other = nodes[nRef.id];
        if (!other || nRef.id === nId) continue;
        const otherEnd = other.startColumn + (other.duration || 1) - 1;
        const nEnd = n.startColumn + (n.duration || 1) - 1;
        if (n.startColumn <= otherEnd && nEnd >= other.startColumn) {
          playSound('error');
          addWarning('Overlap', 'Cannot move — node would overlap on target row');
          return;
        }
      }
    }

    playSound('milestoneMove');

    setNodes(prev => ({
      ...prev,
      [nId]: { ...prev[nId], row: targetRowKey },
    }));
    setRows(prev => {
      const updated = { ...prev };
      if (updated[oldRowKey]) {
        updated[oldRowKey] = {
          ...updated[oldRowKey],
          nodes: (updated[oldRowKey].nodes || []).filter(ref => String(ref.id) !== String(nId)),
        };
      }
      if (updated[targetRowKey]) {
        updated[targetRowKey] = {
          ...updated[targetRowKey],
          nodes: [...(updated[targetRowKey].nodes || []), { id: nId }],
        };
      }
      return updated;
    });

    try {
      if (persistNodeTaskChange) await persistNodeTaskChange(nId, targetRowKey);
    } catch (err) {
      console.error("Arrow vertical move failed:", err);
      // Revert on failure
      setNodes(prev => ({
        ...prev,
        [nId]: { ...prev[nId], row: oldRowKey },
      }));
      setRows(prev => {
        const updated = { ...prev };
        if (updated[targetRowKey]) {
          updated[targetRowKey] = {
            ...updated[targetRowKey],
            nodes: (updated[targetRowKey].nodes || []).filter(ref => String(ref.id) !== String(nId)),
          };
        }
        if (updated[oldRowKey]) {
          updated[oldRowKey] = {
            ...updated[oldRowKey],
            nodes: [...(updated[oldRowKey].nodes || []), { id: nId }],
          };
        }
        return updated;
      });
      playSound('error');
      return;
    }

    pushAction({
      description: `Move node to ${direction > 0 ? 'next' : 'previous'} row`,
      undo: async () => {
        setNodes(prev => ({
          ...prev,
          [nId]: { ...prev[nId], row: oldRowKey },
        }));
        setRows(prev => {
          const updated = { ...prev };
          if (updated[targetRowKey]) {
            updated[targetRowKey] = {
              ...updated[targetRowKey],
              nodes: (updated[targetRowKey].nodes || []).filter(ref => String(ref.id) !== String(nId)),
            };
          }
          if (updated[oldRowKey]) {
            updated[oldRowKey] = {
              ...updated[oldRowKey],
              nodes: [...(updated[oldRowKey].nodes || []), { id: nId }],
            };
          }
          return updated;
        });
        if (persistNodeTaskChange) await persistNodeTaskChange(nId, oldRowKey);
      },
      redo: async () => {
        setNodes(prev => ({
          ...prev,
          [nId]: { ...prev[nId], row: targetRowKey },
        }));
        setRows(prev => {
          const updated = { ...prev };
          if (updated[oldRowKey]) {
            updated[oldRowKey] = {
              ...updated[oldRowKey],
              nodes: (updated[oldRowKey].nodes || []).filter(ref => String(ref.id) !== String(nId)),
            };
          }
          if (updated[targetRowKey]) {
            updated[targetRowKey] = {
              ...updated[targetRowKey],
              nodes: [...(updated[targetRowKey].nodes || []), { id: nId }],
            };
          }
          return updated;
        });
        if (persistNodeTaskChange) await persistNodeTaskChange(nId, targetRowKey);
      },
    });
  }, [selectedNodes, nodes, rows, lanes, laneOrder, refactorMode, setNodes, setRows, pushAction, addWarning, persistNodeTaskChange]);

  // ── Keyboard effect ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const hasModifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // --- Q+W chord system ---
      if (!hasModifier) {
        if (qwChordStage.current === 3) {
          clearTimeout(qwChordTimerRef.current);
          qwChordStage.current = 0;
          if (key === 'r') {
            e.preventDefault();
            if (onQuickSaveSnapshot) onQuickSaveSnapshot();
            return;
          }
          return;
        }
        if (qwChordStage.current === 2) {
          if (key === 'e') {
            clearTimeout(qwChordTimerRef.current);
            qwChordStage.current = 3;
            qwChordTimerRef.current = setTimeout(() => { qwChordStage.current = 0; }, 600);
            e.preventDefault();
            return;
          }
          clearTimeout(qwChordTimerRef.current);
          qwChordStage.current = 0;
          e.preventDefault();
          for (const [actionKey, assignedKey] of Object.entries(userShortcuts)) {
            if (assignedKey && assignedKey.toLowerCase() === key) {
              executeShortcutAction(actionKey);
              return;
            }
          }
          return;
        }
        if (qwChordStage.current === 1 && key === 'w') {
          clearTimeout(qwChordTimerRef.current);
          qwChordStage.current = 2;
          qwChordTimerRef.current = setTimeout(() => { qwChordStage.current = 0; }, 600);
          e.preventDefault();
          return;
        }
        if (qwChordStage.current === 1 && key !== 'w') {
          clearTimeout(qwChordTimerRef.current);
          qwChordStage.current = 0;
        }
        if (key === 'q' && qwChordStage.current === 0) {
          qwChordStage.current = 1;
          qwChordTimerRef.current = setTimeout(() => { qwChordStage.current = 0; }, 600);
          return;
        }
      }

      // --- X-key chord: waiting for optional second key ---
      if (xChordFirstKeyRef.current && !hasModifier && e.key !== 'x' && e.key !== 'X') {
        const firstKey = xChordFirstKeyRef.current;
        clearTimeout(xChordTimerRef.current);
        xChordFirstKeyRef.current = null;
        xChordTimerRef.current = null;

        const secondKey = e.key.toLowerCase();
        for (const [viewId, keys] of Object.entries(viewShortcuts)) {
          if (keys.length === 2 && keys[0] === firstKey && keys[1] === secondKey) {
            const matchingView = savedViews.find(v => String(v.id) === String(viewId));
            if (matchingView && onLoadView) {
              e.preventDefault();
              onLoadView(matchingView);
            }
            return;
          }
        }
        for (const [viewId, keys] of Object.entries(viewShortcuts)) {
          if (keys.length === 1 && keys[0] === firstKey) {
            const matchingView = savedViews.find(v => String(v.id) === String(viewId));
            if (matchingView && onLoadView) {
              e.preventDefault();
              onLoadView(matchingView);
            }
            return;
          }
        }
        return;
      }

      // --- X-key chord: second key ---
      if (xKeyActiveRef.current && !hasModifier && e.key !== 'x' && e.key !== 'X') {
        clearTimeout(xKeyPendingRef.current);
        xKeyActiveRef.current = false;
        xKeyPendingRef.current = null;

        const pressedKey = e.key.toLowerCase();

        if (pressedKey === 's' || pressedKey === 'y') {
          e.preventDefault();
          if (onSaveView) onSaveView();
          return;
        }
        if (pressedKey === 'd') {
          e.preventDefault();
          if (onLoadDefaultView) onLoadDefaultView();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (onNextView) onNextView();
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (onPrevView) onPrevView();
          return;
        }

        const hasTwoKeyMatch = Object.entries(viewShortcuts).some(
          ([, keys]) => keys.length === 2 && keys[0] === pressedKey
        );

        if (hasTwoKeyMatch) {
          e.preventDefault();
          xChordFirstKeyRef.current = pressedKey;
          xChordTimerRef.current = setTimeout(() => {
            for (const [viewId, keys] of Object.entries(viewShortcuts)) {
              if (keys.length === 1 && keys[0] === pressedKey) {
                const matchingView = savedViews.find(v => String(v.id) === String(viewId));
                if (matchingView && onLoadView) onLoadView(matchingView);
                break;
              }
            }
            xChordFirstKeyRef.current = null;
            xChordTimerRef.current = null;
          }, 500);
          return;
        }

        for (const [viewId, keys] of Object.entries(viewShortcuts)) {
          if (keys.length === 1 && keys[0] === pressedKey) {
            const matchingView = savedViews.find(v => String(v.id) === String(viewId));
            if (matchingView && onLoadView) {
              e.preventDefault();
              onLoadView(matchingView);
            }
            return;
          }
          if (keys.length === 2 && keys[0] === pressedKey) {
            return;
          }
        }
        return;
      }

      // Copy/Paste
      if (hasModifier && e.key === 'c') { e.preventDefault(); handleCopy(); return; }
      if (hasModifier && e.key === 'v') { e.preventDefault(); handlePaste(); return; }

      // Undo/Redo
      if (hasModifier && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (hasModifier && e.key === 'y') { e.preventDefault(); redo(); return; }

      // Select visible nodes (Ctrl+Shift+M)
      if (hasModifier && e.shiftKey && key === 'm') { e.preventDefault(); executeShortcutAction('selectVisibleMilestones'); return; }
      if (hasModifier && e.shiftKey && key === 'd') { e.preventDefault(); executeShortcutAction('selectVisibleDeps'); return; }

      // Select all nodes (Ctrl+M)
      if (hasModifier && key === 'm') {
        e.preventDefault();
        setSelectedNodes(new Set(Object.keys(nodes).map(Number)));
        setSelectedEdges([]);
        playSound('milestoneSelect');
        return;
      }
      if (hasModifier && key === 'd') {
        e.preventDefault();
        setSelectedEdges([...edges]);
        setSelectedNodes(new Set());
        playSound('milestoneSelect');
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdges.length > 0) {
          setDeleteConfirmModal({
            edgeId: true,
            edgeName: 'Edge',
            edges: [...selectedEdges],
          });
        } else if (selectedNodes.size > 0) {
          const nodeIds = Array.from(selectedNodes);
          if (nodeIds.length === 1) {
            setDeleteConfirmModal({ nodeId: nodeIds[0], nodeName: 'this node' });
          } else {
            setDeleteConfirmModal({ nodeIds });
          }
        }
      } else if (e.key === "Escape") {
        setSelectedNodes(new Set());
        setSelectedEdges([]);
        setEditingNodeId(null);
        setEditingNodeName("");
        setIsAddingNode(false);
        playSound('milestoneDeselect');
      } else if (e.key === 'ArrowLeft' && selectedNodes.size > 0) {
        e.preventDefault();
        handleArrowMoveHorizontal(-1);
      } else if (e.key === 'ArrowRight' && selectedNodes.size > 0) {
        e.preventDefault();
        handleArrowMoveHorizontal(1);
      } else if (e.key === 'ArrowUp' && selectedNodes.size > 0 && refactorMode) {
        e.preventDefault();
        handleArrowMoveVertical(-1);
      } else if (e.key === 'ArrowDown' && selectedNodes.size > 0 && refactorMode) {
        e.preventDefault();
        handleArrowMoveVertical(1);
      } else if (!hasModifier && (e.key === "e" || e.key === "E")) {
        setViewMode("schedule"); baseViewModeRef.current = "schedule"; playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "d" || e.key === "D")) {
        setViewMode("dependency"); baseViewModeRef.current = "dependency"; playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "v" || e.key === "V")) {
        setViewMode("inspection"); baseViewModeRef.current = "inspection"; playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "x" || e.key === "X")) {
        xKeyActiveRef.current = true;
        xKeyPendingRef.current = setTimeout(() => {
          xKeyActiveRef.current = false;
          xKeyPendingRef.current = null;
        }, 500);
      } else if (!hasModifier && (e.key === "r" || e.key === "R")) {
        setRefactorMode(prev => !prev); playSound('refactorToggle');
      } else if (!hasModifier && (e.key === "s" || e.key === "S")) {
        setToolbarCollapsed(prev => !prev); playSound('uiClick');
      } else if (!hasModifier && (e.key === "h" || e.key === "H")) {
        setHeaderCollapsed(prev => !prev); playSound('uiClick');
      } else if (!hasModifier && (e.key === "f" || e.key === "F")) {
        setHeaderCollapsed(prev => !prev); setToolbarCollapsed(prev => !prev); toggleFullscreen(); playSound('uiClick');
      } else if (e.key === '+' || e.key === '=') {
        if (selectedNodes.size >= 2) { e.preventDefault(); handleSpreadNodes(); }
      }
    };

    const handleKeyUp = () => {};
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      if (xKeyPendingRef.current) clearTimeout(xKeyPendingRef.current);
      if (xChordTimerRef.current) clearTimeout(xChordTimerRef.current);
      if (qwChordTimerRef.current) clearTimeout(qwChordTimerRef.current);
    };
  }, [setMode, setViewMode, handleCopy, handlePaste, undo, redo, savedViews, viewShortcuts, onLoadView, onSaveView, onNextView, onPrevView, setRefactorMode, setToolbarCollapsed, setHeaderCollapsed, toggleFullscreen, userShortcuts, executeShortcutAction, selectedNodes, selectedEdges, setDeleteConfirmModal, nodes, edges, setSelectedNodes, setSelectedEdges, onQuickSaveSnapshot, handleArrowMoveHorizontal, handleArrowMoveVertical, refactorMode, handleSpreadNodes, baseViewModeRef, setEditingNodeId, setEditingNodeName, setIsAddingNode]);

  // Close lane settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const btn = document.getElementById(`lane-settings-btn-${openLaneSettings}`);
      const dropdown = document.querySelector('[data-lane-settings-dropdown]');
      if (btn && !btn.contains(e.target) && (!dropdown || !dropdown.contains(e.target))) {
        setOpenLaneSettings(null);
      }
    };
    if (openLaneSettings) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openLaneSettings, setOpenLaneSettings]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const filterArea = document.querySelector('[data-filter-dropdown]');
      if (filterArea && !filterArea.contains(e.target)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showFilterDropdown, setShowFilterDropdown]);

  // Auto-visibility: when autoSelectBlocking is active, ensure selected nodes are visible
  useEffect(() => {
    if (!autoSelectBlocking || selectedNodes.size === 0) return;

    for (const nodeId of selectedNodes) {
      const node = nodes[nodeId];
      if (!node) continue;

      const row = rows[node.row];
      if (!row) continue;

      const laneId = row.lane;

      setLaneDisplaySettings(prev => {
        if (!prev[laneId]?.hidden) return prev;
        return { ...prev, [laneId]: { ...prev[laneId], hidden: false } };
      });

      setRowDisplaySettings(prev => {
        if (!prev[node.row]?.hidden) return prev;
        return { ...prev, [node.row]: { ...prev[node.row], hidden: false } };
      });

      setLaneDisplaySettings(prev => {
        if (!prev[laneId]?.collapsed) return prev;
        return { ...prev, [laneId]: { ...prev[laneId], collapsed: false } };
      });
    }
  }, [autoSelectBlocking, selectedNodes, nodes, rows, setRowDisplaySettings, setLaneDisplaySettings]);

  // ── Backward-compatible validation wrappers ──
  const validateNodeMove = (nodeId, newStartColumn) =>
    _validateNodeMove(nodes, edges, nodeId, newStartColumn);

  const validateMultiNodeMove = (nodeIds, deltaIndex) =>
    _validateMultiNodeMove(nodes, edges, nodeIds, deltaIndex);

  const checkNodeOverlap = (nodeId, newStartColumn, newDuration, excludeIds) =>
    _checkNodeOverlap(nodes, rows, nodeId, newStartColumn, newDuration, excludeIds);

  const checkMultiNodeOverlap = (nodeIds, deltaIndex) =>
    _checkMultiNodeOverlap(nodes, rows, nodeIds, deltaIndex);

  return {
    // Transient state
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    rowGhost,
    setRowGhost,
    rowDropTarget,
    setRowDropTarget,
    isDraggingConnection,
    setIsDraggingConnection,
    connectionStart,
    setConnectionStart,
    connectionEnd,
    setConnectionEnd,
    justDraggedRef,
    moveModal,
    setMoveModal,
    blockedMoveHighlight,
    setBlockedMoveHighlight,

    // Marquee selection
    marqueeRect,
    handleMarqueeStart,

    // Warning messages
    warningMessages,

    // Drag handlers
    handleLaneDrag,
    handleRowDrag,
    handleNodeMouseDown,
    handleNodeEdgeResize,

    // Selection handlers
    handleNodeClick,
    handleEdgeClick,

    // Node handlers
    handleNodeDelete,
    handleNodeDoubleClick,
    handleNodeRenameSubmit,
    handleColumnCellClick,

    // Edge handlers
    handleConnectionDragStart: handleEdgeDragStart,
    handleDeleteEdge,
    handleUpdateEdge,

    // Validation functions
    validateNodeMove,
    validateMultiNodeMove,
    checkNodeOverlap,
    checkMultiNodeOverlap,

    // Position helpers
    findNodeAtPosition,
    getNodeHandlePosition,

    // Feedback
    showBlockingFeedback,
    addWarning,

    // Weak edge conflict modal
    weakEdgeModal,
    setWeakEdgeModal,
  };
}
