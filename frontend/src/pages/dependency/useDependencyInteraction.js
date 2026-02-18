// Interaction orchestrator for the Dependencies page.
// Composes focused sub-hooks and adds global effects (keyboard, click-outside, auto-visibility).
// The external API (params + return shape) is unchanged — Dependencies.jsx needs zero edits.

import { useRef, useEffect } from 'react';
import { playSound } from '../../assets/sound_registry';
import { useDependency } from './DependencyContext.jsx';

// Sub-hooks
import { useDependencyWarnings } from './useDependencyWarnings';
import { useDependencyDrag } from './useDependencyDrag';
import { useDependencyMilestones } from './useDependencyMilestones';
import { useDependencyConnections } from './useDependencyConnections';

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

  // Computed
  safeMode,
}) {
  // ── Context ──
  const {
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
  } = useDependency();

  // Shared ref — used by milestone click + drag hooks to prevent click-after-drag
  const justDraggedRef = useRef(false);

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
  });

  // ________Global Keyboard Listener___________
  // ________________________________________

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === "Delete") {
        // Delete handled by actions hook
      } else if (e.key === "Escape") {
        setSelectedMilestones(new Set());
        setSelectedConnection(null);
        setEditingMilestoneId(null);
        setEditingMilestoneName("");
        setIsAddingMilestone(false);
        playSound('milestoneDeselect');
      } else if (e.key === "e" || e.key === "E") {
        setViewMode("schedule");
        baseViewModeRef.current = "schedule";
        playSound('modeSwitch');
      } else if (e.key === "d" || e.key === "D") {
        setViewMode("dependency");
        baseViewModeRef.current = "dependency";
        playSound('modeSwitch');
      } else if (e.key === "v" || e.key === "V") {
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
  }, [setMode, setViewMode]);

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
  };
}
