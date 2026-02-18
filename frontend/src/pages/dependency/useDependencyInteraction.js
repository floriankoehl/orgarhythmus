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
} from '../../api/dependencies_api.js';

// Pure validation re-exports (kept in return for backward compat)
import {
  checkMilestoneOverlap as _checkMilestoneOverlap,
  checkMultiMilestoneOverlap as _checkMultiMilestoneOverlap,
  validateMilestoneMove as _validateMilestoneMove,
  validateMultiMilestoneMove as _validateMultiMilestoneMove,
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
}) {
  // ── Context ──
  const {
    projectId,
    viewMode,
    setViewMode,
    baseViewModeRef,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnection,
    setSelectedConnection,
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
    setSelectedConnection(null);

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
  }, [clipboard, projectId, milestones, setMilestones, setTasks, setConnections, setSelectedMilestones, setSelectedConnection, addWarning, pushAction]);

  // ________Global Keyboard Listener___________
  // ________________________________________

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const hasModifier = e.ctrlKey || e.metaKey;

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

      if (e.key === "Delete") {
        // Delete handled by actions hook
      } else if (e.key === "Escape") {
        setSelectedMilestones(new Set());
        setSelectedConnection(null);
        setEditingMilestoneId(null);
        setEditingMilestoneName("");
        setIsAddingMilestone(false);
        playSound('milestoneDeselect');
      } else if (!hasModifier && (e.key === "e" || e.key === "E")) {
        setViewMode("schedule");
        baseViewModeRef.current = "schedule";
        playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "d" || e.key === "D")) {
        setViewMode("dependency");
        baseViewModeRef.current = "dependency";
        playSound('modeSwitch');
      } else if (!hasModifier && (e.key === "v" || e.key === "V")) {
        setViewMode("inspection");
        baseViewModeRef.current = "inspection";
        playSound('modeSwitch');
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
    };
  }, [setMode, setViewMode, handleCopy, handlePaste, undo, redo]);

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
