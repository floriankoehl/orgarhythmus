// Connection drag-to-create, click-select, delete, and milestone position helpers.
import { useState } from 'react';
import { playSound } from '../../assets/sound_registry';
import {
  create_dependency,
  delete_dependency_api as delete_dependency,
  update_dependency,
} from '../../api/dependencies_api.js';
import { isTaskVisible } from './layoutMath';
import {
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
} from './layoutMath';
import { useDependency } from './DependencyContext.jsx';

/**
 * Hook for dependency-connection interactions:
 * drag from milestone handles to create connections,
 * click to select, delete, and position helpers for SVG paths.
 */
export function useDependencyConnections({
  // Data
  milestones,
  teams,
  tasks,
  connections,
  taskDisplaySettings,
  // Setters
  setConnections,
  // Layout
  DAYWIDTH,
  TEAMWIDTH,
  TASKWIDTH,
  getTaskHeight,
  isTeamVisible,
  getTeamYOffset,
  getTaskYOffset,
  // Mode
  safeMode,
  // Warning/feedback (from useDependencyWarnings)
  addWarning,
  setBlockedMoveHighlight,
}) {
  const {
    projectId,
    teamContainerRef,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnection,
    setSelectedConnection,
    warningDuration,
  } = useDependency();

  // ── Connection drag state ──
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [connectionEnd, setConnectionEnd] = useState({ x: 0, y: 0 });

  // ────────────────────────────────────────
  // Find milestone at position (hit-test)
  // ────────────────────────────────────────
  const findMilestoneAtPosition = (x, y) => {
    for (const [id, milestone] of Object.entries(milestones)) {
      const task = tasks[milestone.task];
      if (!task) continue;

      const team = teams[task.team];
      if (!team || !isTeamVisible(task.team)) continue;
      if (!isTaskVisible(milestone.task, taskDisplaySettings)) continue;

      const taskHeightVal = getTaskHeight(milestone.task, taskDisplaySettings);
      const teamYOff = getTeamYOffset(task.team);
      const taskYOff = getTaskYOffset(milestone.task, task.team);
      const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      const milestoneX = TEAMWIDTH + TASKWIDTH + milestone.start_index * DAYWIDTH;
      const milestoneTopY = teamYOff + dropHighlightOffset + headerOffset + taskYOff;
      const milestoneWidth = DAYWIDTH * milestone.duration;

      if (
        x >= milestoneX - 10 &&
        x <= milestoneX + milestoneWidth + 10 &&
        y >= milestoneTopY &&
        y <= milestoneTopY + taskHeightVal
      ) {
        return { id: parseInt(id), ...milestone };
      }
    }
    return null;
  };

  // ────────────────────────────────────────
  // Get milestone handle position (for SVG connection paths)
  // ────────────────────────────────────────
  const getMilestoneHandlePosition = (milestoneId, handleType) => {
    const milestone = milestones[milestoneId];
    if (!milestone) return null;

    const task = tasks[milestone.task];
    if (!task) return null;

    const team = teams[task.team];
    if (!team || !isTeamVisible(task.team)) return null;
    if (!isTaskVisible(milestone.task, taskDisplaySettings)) return null;

    const taskHeightVal = getTaskHeight(milestone.task, taskDisplaySettings);
    const teamYOff = getTeamYOffset(task.team);
    const taskYOff = getTaskYOffset(milestone.task, task.team);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

    const milestoneX = TEAMWIDTH + TASKWIDTH + (milestone.x ?? milestone.start_index * DAYWIDTH);
    const milestoneY = teamYOff + dropHighlightOffset + headerOffset + taskYOff + taskHeightVal / 2;
    const milestoneWidth = DAYWIDTH * milestone.duration;

    if (handleType === "source") {
      return { x: milestoneX + milestoneWidth, y: milestoneY };
    } else {
      return { x: milestoneX, y: milestoneY };
    }
  };

  // ────────────────────────────────────────
  // Connection drag start (create connection by dragging between handles)
  // ────────────────────────────────────────
  const handleConnectionDragStart = (e, milestoneId, handleType) => {
    if (safeMode) return;
    e.stopPropagation();
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const initialX = e.clientX - containerRect.left;
    const initialY = e.clientY - containerRect.top;

    setConnectionStart({
      milestoneId,
      handleType,
      x: initialX,
      y: initialY,
    });
    setConnectionEnd({ x: initialX, y: initialY });
    setIsDraggingConnection(true);

    let rafId = null;

    const onMouseMove = (moveEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const currentRect = teamContainerRef.current?.getBoundingClientRect();
        if (!currentRect) { rafId = null; return; }

        setConnectionEnd({
          x: moveEvent.clientX - currentRect.left,
          y: moveEvent.clientY - currentRect.top,
        });
        rafId = null;
      });
    };

    const onMouseUp = async (upEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      const currentRect = teamContainerRef.current?.getBoundingClientRect();
      if (!currentRect) {
        setIsDraggingConnection(false);
        setConnectionStart(null);
        return;
      }

      const targetMilestone = findMilestoneAtPosition(
        upEvent.clientX - currentRect.left,
        upEvent.clientY - currentRect.top
      );

      if (targetMilestone && targetMilestone.id !== milestoneId) {
        const sourceId = handleType === "source" ? milestoneId : targetMilestone.id;
        const targetId = handleType === "source" ? targetMilestone.id : milestoneId;

        const exists = connections.some(c => c.source === sourceId && c.target === targetId);
        const reverseExists = connections.some(c => c.source === targetId && c.target === sourceId);

        if (!exists && !reverseExists) {
          const sourceMilestone = milestones[sourceId];
          const targetMilestoneData = milestones[targetId];

          if (sourceMilestone && targetMilestoneData) {
            const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;

            if (sourceEndIndex >= targetMilestoneData.start_index) {
              setBlockedMoveHighlight({
                milestoneId: sourceId,
                connectionSource: sourceId,
                connectionTarget: targetId,
              });
              setTimeout(() => setBlockedMoveHighlight(null), warningDuration);
              addWarning("Cannot create dependency", "Source milestone must finish before target starts.");
            } else {
              try {
                await create_dependency(projectId, sourceId, targetId);
                setConnections(prev => [...prev, { source: sourceId, target: targetId, weight: 'strong', reason: null }]);
                playSound('connectionCreate');
              } catch (err) {
                console.error("Failed to create dependency:", err);
              }
            }
          }
        } else {
          addWarning("Dependency already exists", exists ? "This exact dependency already exists." : "A reverse dependency already exists (would create cycle).");
        }
      }

      setIsDraggingConnection(false);
      setConnectionStart(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ────────────────────────────────────────
  // Connection click (select)
  // ────────────────────────────────────────
  const handleConnectionClick = (e, connection) => {
    e.stopPropagation();
    setSelectedMilestones(new Set());

    if (selectedConnection?.source === connection.source && selectedConnection?.target === connection.target) {
      setSelectedConnection(null);
      playSound('milestoneDeselect');
    } else {
      setSelectedConnection(connection);
      playSound('connectionSelect');
    }
  };

  // ────────────────────────────────────────
  // Delete connection
  // ────────────────────────────────────────
  const handleDeleteConnection = async (connection) => {
    try {
      await delete_dependency(projectId, connection.source, connection.target);
      setConnections(prev => prev.filter(c => !(c.source === connection.source && c.target === connection.target)));
      setSelectedConnection(null);
      playSound('connectionDelete');
    } catch (err) {
      console.error("Failed to delete dependency:", err);
    }
  };

  // ────────────────────────────────────────
  // Update connection weight / reason
  // ────────────────────────────────────────
  const handleUpdateConnection = async (connection, updates) => {
    try {
      await update_dependency(projectId, connection.source, connection.target, updates);
      setConnections(prev => prev.map(c => {
        if (c.source === connection.source && c.target === connection.target) {
          return { ...c, ...updates };
        }
        return c;
      }));
    } catch (err) {
      console.error("Failed to update dependency:", err);
    }
  };

  return {
    // Connection drag state
    isDraggingConnection,
    setIsDraggingConnection,
    connectionStart,
    setConnectionStart,
    connectionEnd,
    setConnectionEnd,
    // Handlers
    handleConnectionDragStart,
    handleConnectionClick,
    handleDeleteConnection,
    handleUpdateConnection,
    // Position helpers
    findMilestoneAtPosition,
    getMilestoneHandlePosition,
  };
}
