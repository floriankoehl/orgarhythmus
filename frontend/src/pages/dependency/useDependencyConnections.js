// Connection drag-to-create, click-select, delete, and milestone position helpers.
import { useState } from 'react';
import { playSound, startLoopSound, stopLoopSound } from '../../assets/sound_registry';
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
  // Callbacks
  onSuggestionOffer,
  // Settings
  defaultDepWeight = 'strong',
  // Day column layout
  dayColumnLayout,
  // Phase row offset
  getTeamPhaseRowHeight,
}) {
  const {
    projectId,
    teamContainerRef,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnections,
    setSelectedConnections,
    warningDuration,
    pushAction,
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

      const milestoneX = dayColumnLayout
        ? TEAMWIDTH + TASKWIDTH + dayColumnLayout.dayXOffset(milestone.start_index)
        : TEAMWIDTH + TASKWIDTH + milestone.start_index * DAYWIDTH;
      const phaseRowOff = getTeamPhaseRowHeight ? getTeamPhaseRowHeight(task.team) : 0;
      const milestoneTopY = teamYOff + dropHighlightOffset + headerOffset + phaseRowOff + taskYOff;
      const milestoneWidth = dayColumnLayout
        ? (() => {
            const startX = dayColumnLayout.dayXOffset(milestone.start_index);
            const endIdx = milestone.start_index + (milestone.duration || 1);
            const endX = endIdx < (dayColumnLayout.offsets?.length ?? Infinity) ? dayColumnLayout.dayXOffset(endIdx) : dayColumnLayout.totalDaysWidth;
            return endX - startX;
          })()
        : DAYWIDTH * milestone.duration;

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

    // Use dayColumnLayout for X if available, else fall back to linear formula.
    // During drag, milestone.x is set as a pixel offset for smooth visual feedback —
    // honour it so SVG connections follow the dragged milestone in real time.
    let milestoneX, milestoneWidth;
    if (milestone.x !== undefined) {
      // Dragging — use pixel position directly
      milestoneX = TEAMWIDTH + TASKWIDTH + milestone.x;
      if (dayColumnLayout) {
        const startX = dayColumnLayout.dayXOffset(milestone.start_index);
        const endIdx = milestone.start_index + (milestone.duration || 1);
        const endX = endIdx < (dayColumnLayout.offsets?.length ?? Infinity)
          ? dayColumnLayout.dayXOffset(endIdx)
          : dayColumnLayout.totalDaysWidth;
        milestoneWidth = endX - startX;
      } else {
        milestoneWidth = DAYWIDTH * milestone.duration;
      }
    } else if (dayColumnLayout) {
      milestoneX = TEAMWIDTH + TASKWIDTH + dayColumnLayout.dayXOffset(milestone.start_index);
      const endIdx = milestone.start_index + (milestone.duration || 1);
      const endX = endIdx < (dayColumnLayout.offsets?.length ?? Infinity)
        ? dayColumnLayout.dayXOffset(endIdx)
        : dayColumnLayout.totalDaysWidth;
      milestoneWidth = endX - dayColumnLayout.dayXOffset(milestone.start_index);
    } else {
      milestoneX = TEAMWIDTH + TASKWIDTH + milestone.start_index * DAYWIDTH;
      milestoneWidth = DAYWIDTH * milestone.duration;
    }
    const milestoneY = teamYOff + dropHighlightOffset + headerOffset + (getTeamPhaseRowHeight ? getTeamPhaseRowHeight(task.team) : 0) + taskYOff + taskHeightVal / 2;

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
      stopLoopSound('dragLoop');

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
            const timingViolated = sourceEndIndex >= targetMilestoneData.start_index;

            if (timingViolated && defaultDepWeight !== 'suggestion') {
              // Timing violated — offer to create as suggestion instead
              if (onSuggestionOffer) {
                onSuggestionOffer({ sourceId, targetId });
              } else {
                setBlockedMoveHighlight({
                  milestoneId: sourceId,
                  connectionSource: sourceId,
                  connectionTarget: targetId,
                });
                setTimeout(() => setBlockedMoveHighlight(null), warningDuration);
                addWarning("Cannot create dependency", "Source milestone must finish before target starts.");
              }
            } else {
              // Either timing is OK, or default weight is 'suggestion' (no constraint)
              const weightToUse = timingViolated ? 'suggestion' : defaultDepWeight;
              const defaultReason = weightToUse === 'strong' ? 'is required for' : weightToUse === 'weak' ? 'should be before' : 'could be before';
              try {
                await create_dependency(projectId, sourceId, targetId, { weight: weightToUse !== 'strong' ? weightToUse : undefined, reason: defaultReason });
                setConnections(prev => [...prev, { source: sourceId, target: targetId, weight: weightToUse, reason: defaultReason }]);
                playSound('connectionCreate');

                pushAction({
                  description: 'Create dependency',
                  undo: async () => {
                    await delete_dependency(projectId, sourceId, targetId);
                    setConnections(prev => prev.filter(c => !(c.source === sourceId && c.target === targetId)));
                  },
                  redo: async () => {
                    await create_dependency(projectId, sourceId, targetId, { weight: weightToUse !== 'strong' ? weightToUse : undefined, reason: defaultReason });
                    setConnections(prev => [...prev, { source: sourceId, target: targetId, weight: weightToUse, reason: defaultReason }]);
                  },
                });
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
    startLoopSound('dragLoop');
  };

  // ────────────────────────────────────────
  // Connection click (select)
  // ────────────────────────────────────────
  const handleConnectionClick = (e, connection) => {
    e.stopPropagation();
    setSelectedMilestones(new Set());

    if (e.ctrlKey || e.metaKey) {
      // Multi-select: toggle this connection
      setSelectedConnections(prev => {
        const exists = prev.some(c => c.source === connection.source && c.target === connection.target);
        if (exists) {
          const result = prev.filter(c => !(c.source === connection.source && c.target === connection.target));
          if (result.length === 0) playSound('milestoneDeselect');
          return result;
        } else {
          playSound('connectionSelect');
          return [...prev, connection];
        }
      });
    } else {
      // Single select: toggle or replace
      const isSame = selectedConnections.length === 1 &&
                     selectedConnections[0].source === connection.source &&
                     selectedConnections[0].target === connection.target;
      if (isSame) {
        setSelectedConnections([]);
        playSound('milestoneDeselect');
      } else {
        setSelectedConnections([connection]);
        playSound('connectionSelect');
      }
    }
  };

  // ────────────────────────────────────────
  // Delete connection
  // ────────────────────────────────────────
  const handleDeleteConnection = async (connection) => {
    // Capture full connection for undo
    const deletedConn = { ...connection };
    try {
      await delete_dependency(projectId, connection.source, connection.target);
      setConnections(prev => prev.filter(c => !(c.source === connection.source && c.target === connection.target)));
      setSelectedConnections([]);
      playSound('connectionDelete');

      pushAction({
        description: 'Delete dependency',
        undo: async () => {
          await create_dependency(projectId, deletedConn.source, deletedConn.target);
          // Restore weight/reason if they were set
          if (deletedConn.weight && deletedConn.weight !== 'strong') {
            await update_dependency(projectId, deletedConn.source, deletedConn.target, { weight: deletedConn.weight });
          }
          if (deletedConn.reason) {
            await update_dependency(projectId, deletedConn.source, deletedConn.target, { reason: deletedConn.reason });
          }
          setConnections(prev => [...prev, { source: deletedConn.source, target: deletedConn.target, weight: deletedConn.weight || 'strong', reason: deletedConn.reason || null }]);
        },
        redo: async () => {
          await delete_dependency(projectId, deletedConn.source, deletedConn.target);
          setConnections(prev => prev.filter(c => !(c.source === deletedConn.source && c.target === deletedConn.target)));
        },
      });
    } catch (err) {
      console.error("Failed to delete dependency:", err);
    }
  };

  // ────────────────────────────────────────
  // Update connection weight / reason
  // ────────────────────────────────────────
  const handleUpdateConnection = async (connection, updates, { skipHistory = false } = {}) => {
    // ── Validate weight upgrade ──
    // If upgrading weight (suggestion→weak/strong, or weak→strong), check that
    // the source milestone finishes before the target milestone starts.
    if (updates.weight) {
      const WEIGHT_ORDER = { suggestion: 0, weak: 1, strong: 2 };
      const oldWeight = connection.weight || 'strong';
      const newWeight = updates.weight;
      if ((WEIGHT_ORDER[newWeight] ?? 0) > (WEIGHT_ORDER[oldWeight] ?? 0)) {
        // It's an upgrade — validate positions
        const sourceMilestone = milestones[connection.source];
        const targetMilestone = milestones[connection.target];
        if (sourceMilestone && targetMilestone) {
          const sourceEnd = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;
          if (sourceEnd >= targetMilestone.start_index) {
            addWarning(
              `Cannot upgrade to ${newWeight}`,
              "The source milestone must finish before the target starts. Move the milestones apart first."
            );
            if (setBlockedMoveHighlight) {
              setBlockedMoveHighlight({
                milestoneId: connection.source,
                connectionSource: connection.source,
                connectionTarget: connection.target,
              });
              setTimeout(() => setBlockedMoveHighlight(null), warningDuration);
            }
            return false; // abort the update
          }
        }
      }
    }

    // Auto-update reason when weight changes and current reason is a default or empty
    const DEFAULT_REASONS = ['is required for', 'should be before', 'could be before'];
    const WEIGHT_REASON_MAP = { strong: 'is required for', weak: 'should be before', suggestion: 'could be before' };
    if (updates.weight && !updates.reason) {
      const currentReason = connection.reason;
      if (!currentReason || DEFAULT_REASONS.includes(currentReason)) {
        updates = { ...updates, reason: WEIGHT_REASON_MAP[updates.weight] || currentReason };
      }
    }

    // Capture old values for undo
    const oldValues = {};
    for (const key of Object.keys(updates)) {
      oldValues[key] = connection[key];
    }
    try {
      await update_dependency(projectId, connection.source, connection.target, updates);
      setConnections(prev => prev.map(c => {
        if (c.source === connection.source && c.target === connection.target) {
          return { ...c, ...updates };
        }
        return c;
      }));

      if (!skipHistory) {
        pushAction({
          description: 'Update dependency',
          undo: async () => {
            await update_dependency(projectId, connection.source, connection.target, oldValues);
            setConnections(prev => prev.map(c => {
              if (c.source === connection.source && c.target === connection.target) {
                return { ...c, ...oldValues };
              }
              return c;
            }));
          },
          redo: async () => {
            await update_dependency(projectId, connection.source, connection.target, updates);
            setConnections(prev => prev.map(c => {
              if (c.source === connection.source && c.target === connection.target) {
                return { ...c, ...updates };
              }
              return c;
            }));
          },
        });
      }
      return true;
    } catch (err) {
      console.error("Failed to update dependency:", err);
      return false;
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
