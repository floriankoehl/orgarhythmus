// Interaction orchestrator for the Dependencies page.
// Composes focused sub-hooks and adds global effects (keyboard, click-outside, auto-visibility).
// The external API (params + return shape) is unchanged — Dependencies.jsx needs zero edits.

import { useRef, useEffect, useCallback, useState } from 'react';
import { playSound } from '../../assets/sound_registry';
import { useDependency } from './DependencyContext.jsx';

// Sub-hooks
import { useDependencyWarnings } from './useDependencyWarnings';
import { useDependencyDrag } from './useDependencyDrag';
import { useDependencyMilestones } from './useDependencyMilestones';
import { useDependencyConnections } from './useDependencyConnections';

// API for copy/paste
import {
  add_milestone,
  update_start_index,
  change_duration,
  create_dependency,
  delete_milestone,
  delete_dependency_api as delete_dependency,
  move_milestone_task,
} from '../../api/dependencies_api.js';

// Pure validation re-exports (kept in return for backward compat)
import {
  checkMilestoneOverlap as _checkMilestoneOverlap,
  checkMultiMilestoneOverlap as _checkMultiMilestoneOverlap,
  validateMilestoneMove as _validateMilestoneMove,
  validateMultiMilestoneMove as _validateMultiMilestoneMove,
  computeCascadePush,
  checkDeadlineViolation,
} from './depValidation';

/**
 * Custom hook for managing all interaction behavior in the Dependencies component.
 * This includes keyboard handlers, drag logic, selection logic, and event handlers.
 */
export function useDependencyInteraction({
  // State values (non-UI)
  milestones,
  teams,
  tasks,
  teamOrder,
  connections,
  openTeamSettings,
  showFilterDropdown,
  taskDisplaySettings,
  teamDisplaySettings,

  // State setters (non-UI)
  setMode,
  setMilestones,
  setTeams,
  setTeamOrder,
  setConnections,
  setDeleteConfirmModal,
  setOpenTeamSettings,
  setShowFilterDropdown,
  setTaskDisplaySettings,
  setTeamDisplaySettings,
  setMilestoneCreateModal,
  setIsAddingMilestone,
  setTasks,

  // Layout helpers
  DAYWIDTH,
  TEAMWIDTH,
  TASKWIDTH,
  getTaskHeight,
  getTeamHeight,
  isTeamVisible,
  getVisibleTeamIndex,
  getTeamYOffset,
  getTaskYOffset,
  getVisibleTasks,
  dayColumnLayout,
  collapsedDays,

  // Computed
  safeMode,

  // Callbacks
  onSuggestionOffer,

  // Settings
  defaultDepWeight,

  // Phase row offset
  getTeamPhaseRowHeight,

  // Layout constants (includes effective HEADER_HEIGHT)
  layoutConstants,

  // Views (for keyboard shortcuts: X + key)
  savedViews = [],
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
  setCustomDayWidth,
  setCustomTaskHeightNormal,
  setCustomTaskHeightSmall,
  setHideDayHeader,
  setSoundEnabled,
  setShowEmptyTeams,
  setShowPhaseColorsInGrid,
  setHideAllDependencies,
  setHideCollapsedDependencies,
  setHideCollapsedMilestones,
  setExpandedTaskView,
  setHideGlobalPhases,
  uncollapseAll,
  setAutoSelectBlocking,
  // Visibility state values (for select-visible shortcuts)
  hideAllDependencies,
  hideCollapsedDependencies,
  hideCollapsedMilestones,
  isTeamCollapsed,
  // Quick snapshot save
  snapshots = [],
  onQuickSaveSnapshot,
  // Create modals for shortcuts
  setShowCreateTeamModal,
  setShowCreateTaskModal,
  setPhaseEditModal,
  // Default view
  onLoadDefaultView,
}) {
  // ── Context ──
  const {
    projectId,
    viewMode,
    setViewMode,
    baseViewModeRef,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnections,
    setSelectedConnections,
    autoSelectBlocking,
    setEditingMilestoneId,
    setEditingMilestoneName,
    clipboard,
    setClipboard,
    undo,
    redo,
    pushAction,
  } = useDependency();

  // Shared ref — used by milestone click + drag hooks to prevent click-after-drag
  const justDraggedRef = useRef(false);

  // ── Weak dependency conflict modal state ──
  const [weakDepModal, setWeakDepModal] = useState(null);

  // ── Warning system ──
  const {
    warningMessages,
    blockedMoveHighlight,
    setBlockedMoveHighlight,
    addWarning,
    showBlockingFeedback,
  } = useDependencyWarnings({
    milestones,
    tasks,
    taskDisplaySettings,
    teamDisplaySettings,
    setTaskDisplaySettings,
    setTeamDisplaySettings,
    hideAllDependencies,
    setHideAllDependencies,
  });

  // ── Team / task drag + marquee ──
  const {
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    taskGhost,
    setTaskGhost,
    taskDropTarget,
    setTaskDropTarget,
    moveModal,
    setMoveModal,
    marqueeRect,
    handleTeamDrag,
    handleTaskDrag,
    handleMarqueeStart,
  } = useDependencyDrag({
    milestones,
    teams,
    tasks,
    teamOrder,
    taskDisplaySettings,
    teamDisplaySettings,
    setTeams,
    setTeamOrder,
    DAYWIDTH,
    TEAMWIDTH,
    TASKWIDTH,
    getTaskHeight,
    getTeamHeight,
    isTeamVisible,
    getTeamYOffset,
    getTaskYOffset,
    getVisibleTasks,
    justDraggedRef,
    getTeamPhaseRowHeight,
    layoutConstants,
    dayColumnLayout,
    collapsedDays,
  });

  // ── Milestone interactions ──
  const {
    handleMileStoneMouseDown,
    handleMilestoneEdgeResize,
    handleMilestoneClick,
    handleMilestoneDelete,
    handleMilestoneDoubleClick,
    handleMilestoneRenameSubmit,
    handleDayCellClick,
  } = useDependencyMilestones({
    milestones,
    tasks,
    connections,
    setMilestones,
    setTasks,
    setConnections,
    setMilestoneCreateModal,
    DAYWIDTH,
    safeMode,
    justDraggedRef,
    addWarning,
    showBlockingFeedback,
    onWeakDepConflict: setWeakDepModal,
    collapsedDays,
    dayColumnLayout,
  });

  // ── Connection interactions ──
  const {
    isDraggingConnection,
    setIsDraggingConnection,
    connectionStart,
    setConnectionStart,
    connectionEnd,
    setConnectionEnd,
    handleConnectionDragStart,
    handleConnectionClick,
    handleDeleteConnection,
    handleUpdateConnection,
    findMilestoneAtPosition,
    getMilestoneHandlePosition,
  } = useDependencyConnections({
    milestones,
    teams,
    tasks,
    connections,
    taskDisplaySettings,
    setConnections,
    DAYWIDTH,
    TEAMWIDTH,
    TASKWIDTH,
    getTaskHeight,
    isTeamVisible,
    getTeamYOffset,
    getTaskYOffset,
    safeMode,
    addWarning,
    setBlockedMoveHighlight,
    onSuggestionOffer,
    defaultDepWeight,
    dayColumnLayout,
    getTeamPhaseRowHeight,
  });

  // ── Copy/Paste logic ──
  const handleCopy = useCallback(() => {
    if (selectedMilestones.size === 0) return;

    const copiedMilestones = [];
    for (const mId of selectedMilestones) {
      const m = milestones[mId];
      if (!m) continue;
      copiedMilestones.push({
        originalId: mId,
        task: m.task,
        name: m.name,
        description: m.description || "",
        start_index: m.start_index,
        duration: m.duration || 1,
        color: m.color || null,
      });
    }

    // Collect inter-connections (dependencies between selected milestones)
    const selectedSet = selectedMilestones;
    const copiedConnections = connections.filter(
      c => selectedSet.has(c.source) && selectedSet.has(c.target)
    ).map(c => ({ source: c.source, target: c.target }));

    setClipboard({ milestones: copiedMilestones, connections: copiedConnections });
    addWarning(
      `Copied ${copiedMilestones.length} milestone${copiedMilestones.length > 1 ? 's' : ''}${copiedConnections.length > 0 ? ` + ${copiedConnections.length} dep${copiedConnections.length > 1 ? 's' : ''}` : ''}`,
      "Press Ctrl+V to paste"
    );
    playSound('uiClick');
  }, [selectedMilestones, milestones, connections, setClipboard, addWarning]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || clipboard.milestones.length === 0) return;

    const copiedMilestones = clipboard.milestones;

    // Calculate offset: shift right so pasted milestones don't overlap with originals
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const m of copiedMilestones) {
      minStart = Math.min(minStart, m.start_index);
      maxEnd = Math.max(maxEnd, m.start_index + m.duration);
    }
    const offset = maxEnd - minStart + 1;

    // Map old milestone IDs to new milestone IDs (for recreating connections)
    const idMap = {};
    const newMilestoneIds = [];

    for (const m of copiedMilestones) {
      const newStartIndex = m.start_index + offset;
      try {
        const result = await add_milestone(projectId, m.task, {
          name: `${m.name} (copy)`,
          description: m.description,
          start_index: newStartIndex,
        });
        if (result.added_milestone) {
          const newId = result.added_milestone.id;
          idMap[m.originalId] = newId;
          newMilestoneIds.push(newId);

          // Set duration if > 1
          if (m.duration > 1) {
            await change_duration(projectId, newId, m.duration - 1);
          }

          // Update local state
          const newMilestone = {
            ...result.added_milestone,
            start_index: newStartIndex,
            duration: m.duration,
            display: "default",
            color: m.color,
          };
          setMilestones(prev => ({ ...prev, [newId]: newMilestone }));
          setTasks(prev => ({
            ...prev,
            [m.task]: {
              ...prev[m.task],
              milestones: [...(prev[m.task]?.milestones || []), newMilestone],
            },
          }));
        }
      } catch (err) {
        console.error("Failed to paste milestone:", err);
      }
    }

    // Recreate inter-connections between pasted milestones
    for (const conn of clipboard.connections) {
      const newSource = idMap[conn.source];
      const newTarget = idMap[conn.target];
      if (newSource && newTarget) {
        try {
          await create_dependency(projectId, newSource, newTarget);
          setConnections(prev => [...prev, { source: newSource, target: newTarget }]);
        } catch (err) {
          console.error("Failed to paste dependency:", err);
        }
      }
    }

    // Select the newly pasted milestones
    setSelectedMilestones(new Set(newMilestoneIds));
    setSelectedConnections([]);

    addWarning(
      `Pasted ${newMilestoneIds.length} milestone${newMilestoneIds.length > 1 ? 's' : ''}`,
      null
    );
    playSound('milestoneCreate');

    // Track pasted milestone IDs and their tasks for undo
    const pastedTaskMap = {};
    for (const m of copiedMilestones) {
      for (const [origId, newId] of Object.entries(idMap)) {
        if (parseInt(origId) === m.originalId) {
          pastedTaskMap[newId] = m.task;
        }
      }
    }

    pushAction({
      description: `Paste ${newMilestoneIds.length} milestone(s)`,
      undo: async () => {
        // Delete all pasted milestones (connections auto-deleted server-side)
        for (const mId of newMilestoneIds) {
          try { await delete_milestone(projectId, mId); } catch (e) { /* may already be deleted */ }
          setMilestones(prev => { const u = { ...prev }; delete u[mId]; return u; });
          const taskId = pastedTaskMap[mId];
          if (taskId) {
            setTasks(prev => ({
              ...prev,
              [taskId]: { ...prev[taskId], milestones: (prev[taskId]?.milestones || []).filter(m => m.id !== mId) }
            }));
          }
        }
        // Remove pasted connections
        setConnections(prev => prev.filter(c =>
          !newMilestoneIds.includes(c.source) && !newMilestoneIds.includes(c.target)
        ));
      },
      redo: async () => {
        // Re-paste (simplified: re-run the paste logic)
        const newIdMap2 = {};
        const newIds2 = [];
        for (const m of copiedMilestones) {
          const newStartIndex = m.start_index + offset;
          const result = await add_milestone(projectId, m.task, { name: `${m.name} (copy)`, description: m.description, start_index: newStartIndex });
          if (result.added_milestone) {
            const nId = result.added_milestone.id;
            newIdMap2[m.originalId] = nId;
            newIds2.push(nId);
            if (m.duration > 1) await change_duration(projectId, nId, m.duration - 1);
            const ms = { ...result.added_milestone, start_index: newStartIndex, duration: m.duration, display: "default", color: m.color };
            setMilestones(prev => ({ ...prev, [nId]: ms }));
            setTasks(prev => ({ ...prev, [m.task]: { ...prev[m.task], milestones: [...(prev[m.task]?.milestones || []), ms] } }));
          }
        }
        for (const conn of clipboard.connections) {
          const ns = newIdMap2[conn.source], nt = newIdMap2[conn.target];
          if (ns && nt) {
            await create_dependency(projectId, ns, nt);
            setConnections(prev => [...prev, { source: ns, target: nt }]);
          }
        }
      },
    });
  }, [clipboard, projectId, milestones, setMilestones, setTasks, setConnections, setSelectedMilestones, setSelectedConnections, addWarning, pushAction]);

  // ________Global Keyboard Listener___________
  // ________________________________________

  // Ref for X-key chord: X + <key> = load view with that shortcut
  const xKeyPendingRef = useRef(null); // holds timeout ID when X is pressed
  const xKeyActiveRef = useRef(false); // true while waiting for the second key

  // Ref for Q+W chord: Q -> W -> <key> = trigger custom shortcut
  const qwChordStage = useRef(0); // 0=idle, 1=Q pressed, 2=Q+W pressed, 3=Q+W+E pressed (snapshot chord)
  const qwChordTimerRef = useRef(null);

  // Helper: execute a shortcut action by its action key
  const executeShortcutAction = useCallback((actionKey) => {
    switch (actionKey) {
      // Original mode/toggle actions (also have direct keys, but kept for Q+W compat)
      case 'toggleToolbar': setToolbarCollapsed(prev => !prev); playSound('uiClick'); return true;
      case 'toggleHeader': setHeaderCollapsed(prev => !prev); playSound('uiClick'); return true;
      case 'focusMode': setHeaderCollapsed(prev => !prev); setToolbarCollapsed(prev => !prev); toggleFullscreen(); playSound('uiClick'); return true;
      case 'modeSchedule': setViewMode("schedule"); baseViewModeRef.current = "schedule"; playSound('modeSwitch'); return true;
      case 'modeDependency': setViewMode("dependency"); baseViewModeRef.current = "dependency"; playSound('modeSwitch'); return true;
      case 'modeInspection': setViewMode("inspection"); baseViewModeRef.current = "inspection"; playSound('modeSwitch'); return true;
      case 'modeRefactor': setRefactorMode(prev => !prev); playSound('refactorToggle'); return true;
      // Sizing
      case 'dayWidthUp': setCustomDayWidth(prev => Math.min((prev || 50) + 10, 200)); playSound('settingToggle'); return true;
      case 'dayWidthDown': setCustomDayWidth(prev => Math.max((prev || 50) - 10, 20)); playSound('settingToggle'); return true;
      case 'taskHeightUp': setCustomTaskHeightNormal(prev => Math.min((prev || 38) + 4, 80)); playSound('settingToggle'); return true;
      case 'taskHeightDown': setCustomTaskHeightNormal(prev => Math.max((prev || 38) - 4, 16)); playSound('settingToggle'); return true;
      case 'taskHeightSmallUp': setCustomTaskHeightSmall(prev => Math.min((prev || 20) + 4, 60)); playSound('settingToggle'); return true;
      case 'taskHeightSmallDown': setCustomTaskHeightSmall(prev => Math.max((prev || 20) - 4, 10)); playSound('settingToggle'); return true;
      // Visibility toggles
      case 'toggleDayHeader': setHideDayHeader(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleSound': setSoundEnabled(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleFullscreen': toggleFullscreen(); playSound('uiClick'); return true;
      case 'toggleEmptyTeams': setShowEmptyTeams(prev => !prev); playSound('settingToggle'); return true;
      case 'togglePhaseColors': setShowPhaseColorsInGrid(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleAllDeps': setHideAllDependencies(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleCollapsedDeps': setHideCollapsedDependencies(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleCollapsedMilestones': setHideCollapsedMilestones(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleExpandedTask': setExpandedTaskView(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleGlobalPhases': setHideGlobalPhases(prev => !prev); playSound('settingToggle'); return true;
      case 'toggleAutoSelect': setAutoSelectBlocking(prev => !prev); playSound('settingToggle'); return true;
      // Bulk team/task actions
      case 'collapseAllTeams': setTeamDisplaySettings(prev => {
        const u = { ...prev }; for (const tid of teamOrder) u[tid] = { ...u[tid], collapsed: true }; return u;
      }); playSound('settingToggle'); return true;
      case 'expandAllTeams': setTeamDisplaySettings(prev => {
        const u = { ...prev }; for (const tid of teamOrder) u[tid] = { ...u[tid], collapsed: false }; return u;
      }); playSound('settingToggle'); return true;
      case 'allTasksSmall': setTaskDisplaySettings(prev => {
        const u = { ...prev }; for (const tid of teamOrder) { const t = teams[tid]; if (t) for (const tk of t.tasks) u[tk] = { ...u[tk], size: 'small' }; } return u;
      }); playSound('settingToggle'); return true;
      case 'allTasksNormal': setTaskDisplaySettings(prev => {
        const u = { ...prev }; for (const tid of teamOrder) { const t = teams[tid]; if (t) for (const tk of t.tasks) u[tk] = { ...u[tk], size: 'normal' }; } return u;
      }); playSound('settingToggle'); return true;
      case 'uncollapseAllDays': if (uncollapseAll) uncollapseAll(); return true;
      // Select-all shortcuts
      case 'selectAllMilestones': setSelectedMilestones(new Set(Object.keys(milestones).map(Number))); setSelectedConnections([]); playSound('milestoneSelect'); return true;
      case 'selectAllDeps': setSelectedConnections([...connections]); setSelectedMilestones(new Set()); playSound('milestoneSelect'); return true;
      // Select visible (currently displayed) milestones / deps
      case 'selectVisibleMilestones': {
        const visibleIds = new Set();
        for (const [id, ms] of Object.entries(milestones)) {
          const task = tasks[ms.task];
          if (!task) continue;
          if (!isTeamVisible(task.team)) continue;
          if (isTeamCollapsed && isTeamCollapsed(task.team)) continue;
          if (taskDisplaySettings[ms.task]?.hidden) continue;
          if (hideCollapsedMilestones && taskDisplaySettings[ms.task]?.size === 'small') continue;
          visibleIds.add(Number(id));
        }
        setSelectedMilestones(visibleIds);
        setSelectedConnections([]);
        playSound('milestoneSelect');
        return true;
      }
      case 'selectVisibleDeps': {
        if (hideAllDependencies) { setSelectedConnections([]); return true; }
        const visibleConns = connections.filter(conn => {
          const srcMs = milestones[conn.source];
          const tgtMs = milestones[conn.target];
          if (!srcMs || !tgtMs) return false;
          const srcTask = tasks[srcMs.task];
          const tgtTask = tasks[tgtMs.task];
          if (!srcTask || !tgtTask) return false;
          if (!isTeamVisible(srcTask.team) || !isTeamVisible(tgtTask.team)) return false;
          if (hideCollapsedDependencies) {
            if (isTeamCollapsed && (isTeamCollapsed(srcTask.team) || isTeamCollapsed(tgtTask.team))) return false;
          }
          return true;
        });
        setSelectedConnections(visibleConns);
        setSelectedMilestones(new Set());
        playSound('milestoneSelect');
        return true;
      }
      // Create actions (open modals)
      case 'createTeam': if (setShowCreateTeamModal) setShowCreateTeamModal(true); playSound('uiClick'); return true;
      case 'createTask': if (setShowCreateTaskModal) setShowCreateTaskModal(true); playSound('uiClick'); return true;
      case 'createPhase': if (setPhaseEditModal) setPhaseEditModal({ mode: 'create', start_index: 0, duration: 7, name: '', color: '#3b82f6', team: null }); playSound('uiClick'); return true;
      case 'loadDefaultView': if (onLoadDefaultView) onLoadDefaultView(); return true;
      default: return false;
    }
  }, [setToolbarCollapsed, setHeaderCollapsed, toggleFullscreen, setViewMode, setRefactorMode,
      setCustomDayWidth, setCustomTaskHeightNormal, setCustomTaskHeightSmall, setHideDayHeader,
      setSoundEnabled, setShowEmptyTeams, setShowPhaseColorsInGrid, setHideAllDependencies,
      setHideCollapsedDependencies, setHideCollapsedMilestones, setExpandedTaskView,
      setTeamDisplaySettings, setTaskDisplaySettings, teamOrder, teams,
      setHideGlobalPhases, uncollapseAll, setAutoSelectBlocking,
      milestones, connections, setSelectedMilestones, setSelectedConnections,
      tasks, isTeamVisible, isTeamCollapsed, hideAllDependencies,
      hideCollapsedDependencies, hideCollapsedMilestones,
      setShowCreateTeamModal, setShowCreateTaskModal, setPhaseEditModal, onLoadDefaultView]);

  // ── Arrow key milestone movement ──
  const handleArrowMoveHorizontal = useCallback(async (direction) => {
    // direction: -1 (left) or +1 (right)
    if (selectedMilestones.size === 0) return;

    const delta = direction;
    const beforePositions = {};
    const afterPositions = {};
    const milestonesToMove = [];

    for (const mId of selectedMilestones) {
      const m = milestones[mId];
      if (!m) continue;
      const newStart = m.start_index + delta;
      if (newStart < 0) {
        playSound('error');
        return; // Can't move before day 0
      }
      beforePositions[mId] = m.start_index;
      afterPositions[mId] = newStart;
      milestonesToMove.push(mId);
    }

    if (milestonesToMove.length === 0) return;

    // Check overlap for each milestone being moved
    const excludeIds = new Set(milestonesToMove);
    for (const mId of milestonesToMove) {
      const m = milestones[mId];
      const result = _checkMilestoneOverlap(milestones, tasks, mId, afterPositions[mId], m.duration || 1, excludeIds);
      if (!result.valid) {
        playSound('error');
        return;
      }
    }

    // Check dependency constraints (predecessor/successor)
    let depResult;
    if (milestonesToMove.length === 1) {
      const mId = milestonesToMove[0];
      depResult = _validateMilestoneMove(milestones, connections, mId, afterPositions[mId]);
    } else {
      depResult = _validateMultiMilestoneMove(milestones, connections, milestonesToMove, delta);
    }

    if (depResult && !depResult.valid) {
      const strongBlockers = depResult.allBlocking.filter(b => b.weight === 'strong');
      const weakBlockers = depResult.allBlocking.filter(b => b.weight === 'weak');
      const suggestionBlockers = depResult.allBlocking.filter(b => b.weight === 'suggestion');

      // Hard block: strong dependencies
      if (strongBlockers.length > 0) {
        addWarning('Blocked', 'Move violates a dependency constraint');
        for (const b of strongBlockers) {
          showBlockingFeedback(b.blockingMilestoneId, b.blockingConnection);
        }
        if (autoSelectBlocking) {
          const blockingIds = new Set([...milestonesToMove, ...strongBlockers.map(b => b.blockingMilestoneId)]);
          setSelectedMilestones(blockingIds);
          setSelectedConnections([]);
        }
        playSound('blocked');
        return;
      }

      // Weak dependency conflict — show modal (or auto-block if prompt disabled)
      if (weakBlockers.length > 0) {
        const initialPositions = {};
        for (const mId of milestonesToMove) {
          initialPositions[mId] = { startIndex: beforePositions[mId] };
        }
        setWeakDepModal({
          weakConnections: weakBlockers.map(b => b.blockingConnection),
          blockingMilestoneIds: weakBlockers.map(b => b.blockingMilestoneId),
          milestonesToMove,
          initialPositions,
          currentDeltaIndex: delta,
          suggestionBlocking: suggestionBlockers.map(b => b.blockingConnection),
        });
        playSound('blocked');
        return;
      }

      // Only suggestion blocking — allow but warn
      if (suggestionBlockers.length > 0) {
        addWarning('Suggestion dependency violated', 'This move violates a suggestion dependency, but it is allowed.');
        for (const b of suggestionBlockers) {
          showBlockingFeedback(b.blockingMilestoneId, b.blockingConnection);
        }
        // Fall through to allow the move
      }
    }

    // Apply move
    playSound('milestoneMove');
    for (const mId of milestonesToMove) {
      const newStart = afterPositions[mId];
      setMilestones(prev => ({
        ...prev,
        [mId]: { ...prev[mId], start_index: newStart },
      }));
      try {
        await update_start_index(projectId, mId, newStart);
      } catch (err) {
        console.error("Arrow move failed:", err);
      }
    }

    pushAction({
      description: `Arrow move ${milestonesToMove.length} milestone(s)`,
      undo: async () => {
        for (const mId of milestonesToMove) {
          const oldStart = beforePositions[mId];
          setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: oldStart } }));
          await update_start_index(projectId, mId, oldStart);
        }
      },
      redo: async () => {
        for (const mId of milestonesToMove) {
          const newStart = afterPositions[mId];
          setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: newStart } }));
          await update_start_index(projectId, mId, newStart);
        }
      },
    });
  }, [selectedMilestones, milestones, tasks, connections, setMilestones, pushAction, projectId, addWarning, showBlockingFeedback, autoSelectBlocking, setSelectedMilestones, setSelectedConnections, setWeakDepModal]);

  // ── Spread selected milestones: insert 1-day gaps between consecutive ones ──
  const handleSpreadMilestones = useCallback(async () => {
    if (selectedMilestones.size < 2) {
      addWarning('Spread needs selection', 'Select at least 2 milestones to spread.');
      return;
    }

    // Gather selected milestones sorted by start_index (ties broken by id)
    const selected = [];
    for (const mId of selectedMilestones) {
      const m = milestones[mId];
      if (m) selected.push({ id: mId, start_index: m.start_index, duration: m.duration || 1 });
    }
    selected.sort((a, b) => a.start_index - b.start_index || a.id - b.id);

    // Compute proposed positions: first milestone stays, each subsequent one
    // is pushed 1 day further from where it currently sits relative to the
    // previous milestone.  This allows pressing "+" repeatedly to widen gaps
    // (1-day, 2-day, 3-day, ...).
    const proposedPositions = {};
    proposedPositions[selected[0].id] = { startIndex: selected[0].start_index, duration: selected[0].duration };

    for (let i = 1; i < selected.length; i++) {
      const prev = selected[i - 1];
      const ms = selected[i];
      const prevEnd = (proposedPositions[prev.id]?.startIndex ?? prev.start_index)
                    + (prev.duration || 1);
      // Push this milestone so it starts at least 1 day after the (possibly
      // already-pushed) previous one ends.
      const newStart = Math.max(ms.start_index + 1, prevEnd + 1);
      proposedPositions[ms.id] = { startIndex: newStart, duration: ms.duration };
    }

    // Validate: check deadlines for the moved milestones
    for (const ms of selected) {
      const pp = proposedPositions[ms.id];
      const deadlineResult = checkDeadlineViolation(milestones, tasks, ms.id, pp.startIndex, pp.duration);
      if (!deadlineResult.valid) {
        addWarning('Spread blocked: hard deadline', 'Spreading would push a milestone past its task\'s hard deadline.');
        playSound('blocked');
        return;
      }
    }

    // Use cascade to check if pushing these milestones would violate
    // any non-selected milestones (deps, overlaps)
    const cascadeResult = computeCascadePush(milestones, tasks, connections, proposedPositions);
    if (!cascadeResult.valid) {
      addWarning('Spread blocked: hard deadline', 'Cascading the spread would exceed a task\'s hard deadline.');
      playSound('blocked');
      return;
    }

    // Check if cascade pushes any non-selected milestones — if so, block
    const externalPushes = Object.keys(cascadeResult.pushes).filter(id => !selectedMilestones.has(id) && !selectedMilestones.has(Number(id)));
    if (externalPushes.length > 0) {
      addWarning('Spread blocked', 'Spreading would push non-selected milestones. Use Alt+Resize for cascade behaviour.');
      playSound('blocked');
      return;
    }

    // Check overlap for each moved milestone against non-selected milestones
    const excludeIds = new Set(selected.map(s => s.id));
    for (const ms of selected) {
      const pp = proposedPositions[ms.id];
      const overlapResult = _checkMilestoneOverlap(milestones, tasks, ms.id, pp.startIndex, pp.duration, excludeIds);
      if (!overlapResult.valid) {
        addWarning('Spread blocked: overlap', 'Spreading would cause milestones to overlap within a task.');
        playSound('blocked');
        return;
      }
    }

    // All valid — apply
    const beforePositions = {};
    const afterPositions = {};
    for (const ms of selected) {
      beforePositions[ms.id] = ms.start_index;
      afterPositions[ms.id] = proposedPositions[ms.id].startIndex;
    }

    setMilestones(prev => {
      const updated = { ...prev };
      for (const ms of selected) {
        const newStart = afterPositions[ms.id];
        updated[ms.id] = { ...updated[ms.id], start_index: newStart };
      }
      return updated;
    });

    playSound('milestoneMove');

    // Save to backend
    for (const ms of selected) {
      const newStart = afterPositions[ms.id];
      if (newStart !== beforePositions[ms.id]) {
        try {
          await update_start_index(projectId, ms.id, newStart);
        } catch (err) {
          console.error('Spread save failed:', err);
        }
      }
    }

    pushAction({
      description: `Spread ${selected.length} milestone(s)`,
      undo: async () => {
        for (const ms of selected) {
          const oldStart = beforePositions[ms.id];
          setMilestones(prev => ({ ...prev, [ms.id]: { ...prev[ms.id], start_index: oldStart } }));
          await update_start_index(projectId, ms.id, oldStart);
        }
      },
      redo: async () => {
        for (const ms of selected) {
          const newStart = afterPositions[ms.id];
          setMilestones(prev => ({ ...prev, [ms.id]: { ...prev[ms.id], start_index: newStart } }));
          await update_start_index(projectId, ms.id, newStart);
        }
      },
    });
  }, [selectedMilestones, milestones, tasks, connections, setMilestones, pushAction, projectId, addWarning]);

  const handleArrowMoveVertical = useCallback(async (direction) => {
    // direction: -1 (up) or +1 (down) — move milestone to adjacent task
    // Only works in refactor mode, only for a single selected milestone
    if (selectedMilestones.size !== 1) return;
    if (!refactorMode) return;

    const mId = Array.from(selectedMilestones)[0];
    const m = milestones[mId];
    if (!m) return;

    // Build flat ordered task list from team order
    const allTasks = [];
    for (const teamId of teamOrder) {
      const team = teams[teamId];
      if (!team) continue;
      for (const taskKey of (team.tasks || [])) {
        allTasks.push({ taskKey, teamId });
      }
    }

    const currentIdx = allTasks.findIndex(t => String(t.taskKey) === String(m.task));
    if (currentIdx === -1) return;

    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= allTasks.length) {
      playSound('error');
      return;
    }

    const targetTaskKey = allTasks[targetIdx].taskKey;
    const oldTaskKey = m.task;

    // Check overlap on target task
    const result = _checkMilestoneOverlap(milestones, tasks, mId, m.start_index, m.duration || 1, new Set([mId]));
    // Manual check on target task milestones
    const targetTask = tasks[targetTaskKey];
    if (targetTask) {
      const targetMilestones = targetTask.milestones || [];
      for (const mRef of targetMilestones) {
        const other = milestones[mRef.id];
        if (!other || mRef.id === mId) continue;
        const otherEnd = other.start_index + (other.duration || 1) - 1;
        const mEnd = m.start_index + (m.duration || 1) - 1;
        if (m.start_index <= otherEnd && mEnd >= other.start_index) {
          playSound('error');
          addWarning('Overlap', 'Cannot move — milestone would overlap on target task');
          return;
        }
      }
    }

    // Apply move optimistically
    playSound('milestoneMove');

    // Update local state: move milestone to new task
    setMilestones(prev => ({
      ...prev,
      [mId]: { ...prev[mId], task: targetTaskKey },
    }));
    // Update task milestones arrays
    setTasks(prev => {
      const updated = { ...prev };
      // Remove from old task (use String() to guard against type mismatches)
      if (updated[oldTaskKey]) {
        updated[oldTaskKey] = {
          ...updated[oldTaskKey],
          milestones: (updated[oldTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
        };
      }
      // Add to new task
      if (updated[targetTaskKey]) {
        updated[targetTaskKey] = {
          ...updated[targetTaskKey],
          milestones: [...(updated[targetTaskKey].milestones || []), { id: mId }],
        };
      }
      return updated;
    });

    try {
      await move_milestone_task(projectId, mId, targetTaskKey);
    } catch (err) {
      console.error("Arrow vertical move failed:", err);
      // Revert on failure
      setMilestones(prev => ({
        ...prev,
        [mId]: { ...prev[mId], task: oldTaskKey },
      }));
      setTasks(prev => {
        const updated = { ...prev };
        if (updated[targetTaskKey]) {
          updated[targetTaskKey] = {
            ...updated[targetTaskKey],
            milestones: (updated[targetTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
          };
        }
        if (updated[oldTaskKey]) {
          updated[oldTaskKey] = {
            ...updated[oldTaskKey],
            milestones: [...(updated[oldTaskKey].milestones || []), { id: mId }],
          };
        }
        return updated;
      });
      playSound('error');
      return;
    }

    pushAction({
      description: `Move milestone to ${direction > 0 ? 'next' : 'previous'} task`,
      undo: async () => {
        setMilestones(prev => ({
          ...prev,
          [mId]: { ...prev[mId], task: oldTaskKey },
        }));
        setTasks(prev => {
          const updated = { ...prev };
          if (updated[targetTaskKey]) {
            updated[targetTaskKey] = {
              ...updated[targetTaskKey],
              milestones: (updated[targetTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
            };
          }
          if (updated[oldTaskKey]) {
            updated[oldTaskKey] = {
              ...updated[oldTaskKey],
              milestones: [...(updated[oldTaskKey].milestones || []), { id: mId }],
            };
          }
          return updated;
        });
        await move_milestone_task(projectId, mId, oldTaskKey);
      },
      redo: async () => {
        setMilestones(prev => ({
          ...prev,
          [mId]: { ...prev[mId], task: targetTaskKey },
        }));
        setTasks(prev => {
          const updated = { ...prev };
          if (updated[oldTaskKey]) {
            updated[oldTaskKey] = {
              ...updated[oldTaskKey],
              milestones: (updated[oldTaskKey].milestones || []).filter(ref => String(ref.id) !== String(mId)),
            };
          }
          if (updated[targetTaskKey]) {
            updated[targetTaskKey] = {
              ...updated[targetTaskKey],
              milestones: [...(updated[targetTaskKey].milestones || []), { id: mId }],
            };
          }
          return updated;
        });
        await move_milestone_task(projectId, mId, targetTaskKey);
      },
    });
  }, [selectedMilestones, milestones, tasks, teams, teamOrder, refactorMode, setMilestones, setTasks, pushAction, projectId, addWarning]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const hasModifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // --- Q+W chord system: Q -> W -> <key> triggers custom shortcut ---
      // Extended: Q -> W -> E -> R triggers quick-save snapshot
      if (!hasModifier) {
        if (qwChordStage.current === 3) {
          // Stage 3: Q+W+E pressed, expecting R for quick snapshot save
          clearTimeout(qwChordTimerRef.current);
          qwChordStage.current = 0;
          if (key === 'r') {
            e.preventDefault();
            if (onQuickSaveSnapshot) onQuickSaveSnapshot();
            return;
          }
          // Not R — ignore and fall through
          return;
        }
        if (qwChordStage.current === 2) {
          // Stage 2: Q+W already pressed, now the action key
          // But if E is pressed, advance to stage 3 (snapshot chord)
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
          // Find which action has this key assigned
          for (const [actionKey, assignedKey] of Object.entries(userShortcuts)) {
            if (assignedKey && assignedKey.toLowerCase() === key) {
              executeShortcutAction(actionKey);
              return;
            }
          }
          return;
        }
        if (qwChordStage.current === 1 && key === 'w') {
          // Stage 1->2: W pressed after Q
          clearTimeout(qwChordTimerRef.current);
          qwChordStage.current = 2;
          qwChordTimerRef.current = setTimeout(() => { qwChordStage.current = 0; }, 600);
          e.preventDefault();
          return;
        }
        if (qwChordStage.current === 1 && key !== 'w') {
          // Q was pressed but next key is not W — cancel chord and process normally
          clearTimeout(qwChordTimerRef.current);
          qwChordStage.current = 0;
        }
        if (key === 'q' && qwChordStage.current === 0) {
          // Stage 0->1: Q pressed
          qwChordStage.current = 1;
          qwChordTimerRef.current = setTimeout(() => { qwChordStage.current = 0; }, 600);
          return; // swallow Q
        }
      }

      // --- X-key chord: second key pressed while X is pending ---
      if (xKeyActiveRef.current && !hasModifier && e.key !== 'x' && e.key !== 'X') {
        clearTimeout(xKeyPendingRef.current);
        xKeyActiveRef.current = false;
        xKeyPendingRef.current = null;

        const pressedKey = e.key.toLowerCase();

        // X + S or X + Y = save active view
        if (pressedKey === 's' || pressedKey === 'y') {
          e.preventDefault();
          if (onSaveView) onSaveView();
          return;
        }

        // X + D = load default view
        if (pressedKey === 'd') {
          e.preventDefault();
          if (onLoadDefaultView) onLoadDefaultView();
          return;
        }

        // X + ArrowRight = next view, X + ArrowLeft = prev view
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

        // Find a view whose shortcut matches
        const matchingView = savedViews.find(v => v.state?.viewShortcutKey === pressedKey);
        if (matchingView && onLoadView) {
          e.preventDefault();
          onLoadView(matchingView);
        }
        return;
      }

      // Copy/Paste shortcuts (Ctrl+C / Ctrl+V)
      if (hasModifier && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }
      if (hasModifier && e.key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Undo/Redo shortcuts (Ctrl+Z / Ctrl+Y)
      if (hasModifier && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (hasModifier && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Select visible milestones (Ctrl+Shift+M)
      if (hasModifier && e.shiftKey && key === 'm') {
        e.preventDefault();
        executeShortcutAction('selectVisibleMilestones');
        return;
      }
      // Select visible dependencies (Ctrl+Shift+D)
      if (hasModifier && e.shiftKey && key === 'd') {
        e.preventDefault();
        executeShortcutAction('selectVisibleDeps');
        return;
      }

      // Select all milestones (Ctrl+M)
      if (hasModifier && key === 'm') {
        e.preventDefault();
        setSelectedMilestones(new Set(Object.keys(milestones).map(Number)));
        setSelectedConnections([]);
        playSound('milestoneSelect');
        return;
      }
      // Select all dependencies (Ctrl+D)
      if (hasModifier && key === 'd') {
        e.preventDefault();
        setSelectedConnections([...connections]);
        setSelectedMilestones(new Set());
        playSound('milestoneSelect');
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        // Trigger delete for selected milestones/connections
        if (selectedConnections.length > 0) {
          setDeleteConfirmModal({
            connectionId: true,
            connectionName: 'Dependency',
            connections: [...selectedConnections],
          });
        } else if (selectedMilestones.size > 0) {
          const milestoneIds = Array.from(selectedMilestones);
          if (milestoneIds.length === 1) {
            setDeleteConfirmModal({ milestoneId: milestoneIds[0], milestoneName: 'this milestone' });
          } else {
            setDeleteConfirmModal({ milestoneIds });
          }
        }
      } else if (e.key === "Escape") {
        setSelectedMilestones(new Set());
        setSelectedConnections([]);
        setEditingMilestoneId(null);
        setEditingMilestoneName("");
        setIsAddingMilestone(false);
        playSound('milestoneDeselect');
      } else if (e.key === 'ArrowLeft' && selectedMilestones.size > 0) {
        e.preventDefault();
        handleArrowMoveHorizontal(-1);
      } else if (e.key === 'ArrowRight' && selectedMilestones.size > 0) {
        e.preventDefault();
        handleArrowMoveHorizontal(1);
      } else if (e.key === 'ArrowUp' && selectedMilestones.size > 0 && refactorMode) {
        e.preventDefault();
        handleArrowMoveVertical(-1);
      } else if (e.key === 'ArrowDown' && selectedMilestones.size > 0 && refactorMode) {
        e.preventDefault();
        handleArrowMoveVertical(1);
      } else if (!hasModifier && (e.key === "e" || e.key === "E")) {
        setViewMode("schedule");
        baseViewModeRef.current = "schedule";
        playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "d" || e.key === "D")) {
        setViewMode("dependency");
        baseViewModeRef.current = "dependency";
        playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "v" || e.key === "V")) {
        // V = switch to inspection mode (no chord)
        setViewMode("inspection");
        baseViewModeRef.current = "inspection";
        playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "x" || e.key === "X")) {
        // Start X-key chord: wait briefly for a second key (X+S save, X+<key> load view)
        xKeyActiveRef.current = true;
        xKeyPendingRef.current = setTimeout(() => {
          xKeyActiveRef.current = false;
          xKeyPendingRef.current = null;
        }, 500);
      } else if (!hasModifier && (e.key === "r" || e.key === "R")) {
        setRefactorMode(prev => !prev);
        playSound('refactorToggle');
      } else if (!hasModifier && (e.key === "s" || e.key === "S")) {
        // Toggle toolbar
        setToolbarCollapsed(prev => !prev);
        playSound('uiClick');
      } else if (!hasModifier && (e.key === "h" || e.key === "H")) {
        // Toggle header
        setHeaderCollapsed(prev => !prev);
        playSound('uiClick');
      } else if (!hasModifier && (e.key === "f" || e.key === "F")) {
        // Focus mode: toggle header + toolbar + fullscreen
        setHeaderCollapsed(prev => !prev);
        setToolbarCollapsed(prev => !prev);
        toggleFullscreen();
        playSound('uiClick');
      } else if (e.key === '+' || e.key === '=') {
        // Spread selected milestones (insert 1-day gaps)
        if (selectedMilestones.size >= 2) {
          e.preventDefault();
          handleSpreadMilestones();
        }
      }
    };
    const handleKeyUp = (e) => {
      // No temporary mode switching needed
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      // Cleanup pending X-key timer on unmount
      if (xKeyPendingRef.current) clearTimeout(xKeyPendingRef.current);
      if (qwChordTimerRef.current) clearTimeout(qwChordTimerRef.current);
    };
  }, [setMode, setViewMode, handleCopy, handlePaste, undo, redo, savedViews, onLoadView, onSaveView, onNextView, onPrevView, setRefactorMode, setToolbarCollapsed, setHeaderCollapsed, toggleFullscreen, userShortcuts, executeShortcutAction, selectedMilestones, selectedConnections, setDeleteConfirmModal, milestones, connections, setSelectedMilestones, setSelectedConnections, onQuickSaveSnapshot, handleArrowMoveHorizontal, handleArrowMoveVertical, refactorMode, handleSpreadMilestones]);

  // Close team settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const btn = document.getElementById(`team-settings-btn-${openTeamSettings}`);
      const dropdown = document.querySelector('[data-team-settings-dropdown]');
      if (btn && !btn.contains(e.target) && (!dropdown || !dropdown.contains(e.target))) {
        setOpenTeamSettings(null);
      }
    };
    if (openTeamSettings) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openTeamSettings, setOpenTeamSettings]);

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

  // When autoSelectBlocking is active, ensure selected milestones stay visible
  useEffect(() => {
    if (!autoSelectBlocking || selectedMilestones.size === 0) return;

    for (const milestoneId of selectedMilestones) {
      const milestone = milestones[milestoneId];
      if (!milestone) continue;

      const task = tasks[milestone.task];
      if (!task) continue;

      const teamId = task.team;

      setTeamDisplaySettings(prev => {
        if (!prev[teamId]?.hidden) return prev;
        return { ...prev, [teamId]: { ...prev[teamId], hidden: false } };
      });

      setTaskDisplaySettings(prev => {
        if (!prev[milestone.task]?.hidden) return prev;
        return { ...prev, [milestone.task]: { ...prev[milestone.task], hidden: false } };
      });

      setTeamDisplaySettings(prev => {
        if (!prev[teamId]?.collapsed) return prev;
        return { ...prev, [teamId]: { ...prev[teamId], collapsed: false } };
      });
    }
  }, [autoSelectBlocking, selectedMilestones, milestones, tasks, setTaskDisplaySettings, setTeamDisplaySettings]);

  // ── Backward-compatible validation wrappers (close over current data) ──
  const validateMilestoneMove = (milestoneId, newStartIndex) =>
    _validateMilestoneMove(milestones, connections, milestoneId, newStartIndex);

  const validateMultiMilestoneMove = (milestoneIds, deltaIndex) =>
    _validateMultiMilestoneMove(milestones, connections, milestoneIds, deltaIndex);

  const checkMilestoneOverlap = (milestoneId, newStartIndex, newDuration, excludeIds) =>
    _checkMilestoneOverlap(milestones, tasks, milestoneId, newStartIndex, newDuration, excludeIds);

  const checkMultiMilestoneOverlap = (milestoneIds, deltaIndex) =>
    _checkMultiMilestoneOverlap(milestones, tasks, milestoneIds, deltaIndex);

  return {
    // Transient state
    ghost,
    setGhost,
    dropIndex,
    setDropIndex,
    taskGhost,
    setTaskGhost,
    taskDropTarget,
    setTaskDropTarget,
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
    handleTeamDrag,
    handleTaskDrag,
    handleMileStoneMouseDown,
    handleMilestoneEdgeResize,

    // Selection handlers
    handleMilestoneClick,
    handleConnectionClick,

    // Milestone handlers
    handleMilestoneDelete,
    handleMilestoneDoubleClick,
    handleMilestoneRenameSubmit,
    handleDayCellClick,

    // Connection handlers
    handleConnectionDragStart,
    handleDeleteConnection,
    handleUpdateConnection,

    // Validation functions
    validateMilestoneMove,
    validateMultiMilestoneMove,
    checkMilestoneOverlap,
    checkMultiMilestoneOverlap,

    // Position helpers
    findMilestoneAtPosition,
    getMilestoneHandlePosition,

    // Feedback
    showBlockingFeedback,
    addWarning,

    // Weak dependency conflict modal
    weakDepModal,
    setWeakDepModal,
  };
}
