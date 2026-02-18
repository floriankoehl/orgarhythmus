// Milestone drag, resize, click, selection, rename, delete, and day-cell click.
import { playSound } from '../../assets/sound_registry';
import {
  update_start_index,
  rename_milestone,
  delete_milestone,
  change_duration,
} from '../../api/dependencies_api.js';
import { useDependency } from './DependencyContext.jsx';
import {
  checkMilestoneOverlap,
  checkMultiMilestoneOverlap,
  validateMilestoneMove,
  validateMultiMilestoneMove,
  checkDeadlineViolation,
  checkMultiDeadlineViolation,
} from './depValidation';

/**
 * Hook for all milestone-centric interactions:
 * drag-to-move, edge-resize, click-select, double-click-rename,
 * delete, and day-cell click (milestone creation trigger).
 */
export function useDependencyMilestones({
  // Data
  milestones,
  tasks,
  connections,
  // Setters
  setMilestones,
  setTasks,
  setConnections,
  setMilestoneCreateModal,
  // Layout
  DAYWIDTH,
  // Mode
  safeMode,
  // Ref from orchestrator
  justDraggedRef,
  // Warning/feedback  (from useDependencyWarnings)
  addWarning,
  showBlockingFeedback,
}) {
  const {
    projectId,
    teamContainerRef,
    viewMode,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnection,
    setSelectedConnection,
    autoSelectBlocking,
    setEditingMilestoneId,
    setEditingMilestoneName,
  } = useDependency();

  // ────────────────────────────────────────
  // Milestone drag (move) — supports multi-select
  // ────────────────────────────────────────
  const handleMileStoneMouseDown = (e, milestoneId) => {
    if (viewMode !== "schedule" && viewMode !== "dependency") return;

    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    // Determine which milestones to move
    let milestonesToMove;
    if (selectedMilestones.has(milestoneId) && selectedMilestones.size > 1) {
      milestonesToMove = Array.from(selectedMilestones);
    } else {
      milestonesToMove = [milestoneId];
    }

    // Store initial positions
    const initialPositions = {};
    for (const mId of milestonesToMove) {
      const m = milestones[mId];
      if (m) {
        initialPositions[mId] = {
          startIndex: m.start_index,
          startVisualX: m.start_index * DAYWIDTH,
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

      const deltaIndex = Math.round(deltaX / DAYWIDTH);

      // Update visual positions smoothly for all milestones
      setMilestones(prev => {
        const updated = { ...prev };
        for (const mId of milestonesToMove) {
          const initial = initialPositions[mId];
          if (initial) {
            updated[mId] = {
              ...updated[mId],
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

      if (hasDragged) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      } else {
        // Clear visual x property
        setMilestones(prev => {
          const updated = { ...prev };
          for (const mId of milestonesToMove) {
            if (updated[mId]) {
              const { x, ...rest } = updated[mId];
              updated[mId] = rest;
            }
          }
          return updated;
        });
        return;
      }

      if (currentDeltaIndex === 0) {
        // No movement, just clear visual
        setMilestones(prev => {
          const updated = { ...prev };
          for (const mId of milestonesToMove) {
            if (updated[mId]) {
              const { x, ...rest } = updated[mId];
              updated[mId] = rest;
            }
          }
          return updated;
        });
        return;
      }

      // Validate dependency constraints
      let validation;
      if (milestonesToMove.length === 1) {
        const newStart = initialPositions[milestonesToMove[0]].startIndex + currentDeltaIndex;
        validation = validateMilestoneMove(milestones, connections, milestonesToMove[0], newStart);
      } else {
        validation = validateMultiMilestoneMove(milestones, connections, milestonesToMove, currentDeltaIndex);
      }

      // Also validate overlap constraints
      const overlapValidation = checkMultiMilestoneOverlap(milestones, tasks, milestonesToMove, currentDeltaIndex);

      // Also validate hard deadline constraints
      const deadlineValidation = checkMultiDeadlineViolation(milestones, tasks, milestonesToMove, currentDeltaIndex);

      if (!validation.valid || !overlapValidation.valid || !deadlineValidation.valid) {
        // Combine all blocking milestones
        const allBlocking = [
          ...(validation.allBlocking || []),
          ...(overlapValidation.allBlocking || []),
        ];

        // Deduplicate
        const seen = new Set();
        const uniqueBlocking = allBlocking.filter(b => {
          if (seen.has(b.blockingMilestoneId)) return false;
          seen.add(b.blockingMilestoneId);
          return true;
        });

        // Show warning with reason
        const hasDepBlocking = (validation.allBlocking || []).length > 0;
        const hasOverlapBlocking = (overlapValidation.allBlocking || []).length > 0;
        const hasDeadlineBlocking = !deadlineValidation.valid;

        if (hasDeadlineBlocking) {
          addWarning("Move blocked: exceeds hard deadline", "A milestone would be placed past its task's hard deadline.");
        } else if (hasDepBlocking && hasOverlapBlocking) {
          addWarning("Move blocked: dependency constraint & milestone overlap", "Milestones cannot overlap within a task, and dependencies must be respected.");
        } else if (hasOverlapBlocking) {
          addWarning("Move blocked: milestones would overlap", "Milestones within the same task cannot occupy the same days.");
        } else {
          addWarning("Move blocked: dependency constraint", "A connected milestone prevents this move.");
        }

        for (const { blockingMilestoneId, blockingConnection } of uniqueBlocking) {
          showBlockingFeedback(blockingMilestoneId, blockingConnection);
        }

        if (autoSelectBlocking && uniqueBlocking.length > 0) {
          setSelectedMilestones(prev => {
            const newSet = new Set(prev);
            for (const mId of milestonesToMove) {
              newSet.add(mId);
            }
            for (const { blockingMilestoneId } of uniqueBlocking) {
              newSet.add(blockingMilestoneId);
            }
            return newSet;
          });
        }

        // Revert all milestones to their original positions
        setMilestones(prev => {
          const updated = { ...prev };
          for (const mId of milestonesToMove) {
            const initial = initialPositions[mId];
            if (initial) {
              const { x, ...rest } = updated[mId];
              updated[mId] = { ...rest, start_index: initial.startIndex };
            }
          }
          return updated;
        });
        return;
      }

      // Validation passed — save for all milestones
      playSound('milestoneMove');
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (!initial) continue;

        const newStart = initial.startIndex + currentDeltaIndex;

        setMilestones(prev => {
          const { x, ...rest } = prev[mId];
          return { ...prev, [mId]: { ...rest, start_index: newStart } };
        });

        try {
          await update_start_index(projectId, mId, newStart);
        } catch (err) {
          console.error("Failed to update start index:", err);
        }
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ────────────────────────────────────────
  // Milestone edge resize — with dependency validation AND overlap check
  // When multiple milestones are selected, resize all of them
  // ────────────────────────────────────────
  const handleMilestoneEdgeResize = (e, milestoneId, edge) => {
    if (safeMode) return;
    e.stopPropagation();
    e.preventDefault();

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    // Determine which milestones to resize
    let milestonesToResize;
    if (selectedMilestones.has(milestoneId) && selectedMilestones.size > 1) {
      milestonesToResize = Array.from(selectedMilestones);
    } else {
      milestonesToResize = [milestoneId];
    }

    // Store initial state for all milestones
    const initialStates = {};
    for (const mId of milestonesToResize) {
      const m = milestones[mId];
      if (m) {
        initialStates[mId] = {
          startIndex: m.start_index,
          duration: m.duration || 1,
        };
      }
    }

    const startX = e.clientX;
    let currentIndexDelta = 0;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / DAYWIDTH);
      currentIndexDelta = indexDelta;

      setMilestones(prev => {
        const updated = { ...prev };
        for (const mId of milestonesToResize) {
          const initial = initialStates[mId];
          if (!initial) continue;

          if (edge === "right") {
            const newDuration = Math.max(1, initial.duration + indexDelta);
            updated[mId] = { ...updated[mId], duration: newDuration };
          } else if (edge === "left") {
            const newStartIndex = Math.max(0, initial.startIndex + indexDelta);
            const durationChange = initial.startIndex - newStartIndex;
            const newDuration = Math.max(1, initial.duration + durationChange);
            updated[mId] = { ...updated[mId], start_index: newStartIndex, duration: newDuration };
          }
        }
        return updated;
      });
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Validate ALL milestones being resized using tracked delta
      const allResizeBlocking = [];
      let hasOverlapViolation = false;
      let hasDepViolation = false;
      let hasDeadlineViolation = false;

      for (const mId of milestonesToResize) {
        const initial = initialStates[mId];
        if (!initial) continue;

        // Compute current values from initial + delta
        let currentStartIndex, currentDuration;
        if (edge === "right") {
          currentStartIndex = initial.startIndex;
          currentDuration = Math.max(1, initial.duration + currentIndexDelta);
        } else {
          currentStartIndex = Math.max(0, initial.startIndex + currentIndexDelta);
          const durationChange = initial.startIndex - currentStartIndex;
          currentDuration = Math.max(1, initial.duration + durationChange);
        }

        const newEndIndex = currentStartIndex + currentDuration - 1;

        // Check dependency constraints
        const outgoingConnections = connections.filter(c => c.source === mId);
        for (const conn of outgoingConnections) {
          const targetMilestone = milestones[conn.target];
          if (!targetMilestone) continue;
          if (milestonesToResize.includes(conn.target)) continue;
          if (newEndIndex >= targetMilestone.start_index) {
            allResizeBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn });
            hasDepViolation = true;
          }
        }

        const incomingConnections = connections.filter(c => c.target === mId);
        for (const conn of incomingConnections) {
          const sourceMilestone = milestones[conn.source];
          if (!sourceMilestone) continue;
          if (milestonesToResize.includes(conn.source)) continue;
          const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;
          if (sourceEndIndex >= currentStartIndex) {
            allResizeBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn });
            hasDepViolation = true;
          }
        }

        // Check overlap constraints
        const excludeSet = new Set(milestonesToResize);
        const overlapResult = checkMilestoneOverlap(milestones, tasks, mId, currentStartIndex, currentDuration, excludeSet);
        if (!overlapResult.valid) {
          for (const ov of overlapResult.overlapping) {
            allResizeBlocking.push(ov);
          }
          hasOverlapViolation = true;
        }

        // Check hard deadline constraints
        const deadlineResult = checkDeadlineViolation(milestones, tasks, mId, currentStartIndex, currentDuration);
        if (!deadlineResult.valid) {
          hasDeadlineViolation = true;
        }
      }

      if (allResizeBlocking.length > 0 || hasDeadlineViolation) {
        // Revert all milestones to original
        setMilestones(prev => {
          const updated = { ...prev };
          for (const mId of milestonesToResize) {
            const initial = initialStates[mId];
            if (initial) {
              updated[mId] = { ...updated[mId], start_index: initial.startIndex, duration: initial.duration };
            }
          }
          return updated;
        });

        // Show warning with reason
        if (hasDeadlineViolation) {
          addWarning("Resize blocked: exceeds hard deadline", "A milestone would extend past its task's hard deadline.");
        } else if (hasDepViolation && hasOverlapViolation) {
          addWarning("Resize blocked: dependency & overlap conflict", "Milestones cannot overlap within a task, and dependencies must be respected.");
        } else if (hasOverlapViolation) {
          addWarning("Resize blocked: milestones would overlap", "Milestones within the same task cannot occupy the same days.");
        } else {
          addWarning("Resize blocked: dependency constraint", "A connected milestone prevents this resize.");
        }

        // Show feedback for all blocking milestones
        for (const { blockingMilestoneId, blockingConnection } of allResizeBlocking) {
          showBlockingFeedback(blockingMilestoneId, blockingConnection);
        }
        if (autoSelectBlocking) {
          setSelectedMilestones(prev => {
            const newSet = new Set(prev);
            for (const mId of milestonesToResize) {
              newSet.add(mId);
            }
            for (const { blockingMilestoneId } of allResizeBlocking) {
              newSet.add(blockingMilestoneId);
            }
            return newSet;
          });
        }
        return;
      }

      // Validation passed — save changes for all milestones
      playSound('milestoneResize');
      for (const mId of milestonesToResize) {
        const initial = initialStates[mId];
        if (!initial) continue;

        const currentM = milestones[mId];
        if (!currentM) continue;

        const durationChange = currentM.duration - initial.duration;
        if (durationChange !== 0) {
          try {
            await change_duration(projectId, mId, durationChange);
          } catch (err) {
            console.error("Failed to change duration:", err);
          }
        }

        if (edge === "left" && currentM.start_index !== initial.startIndex) {
          try {
            await update_start_index(projectId, mId, currentM.start_index);
          } catch (err) {
            console.error("Failed to update start index:", err);
          }
        }
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ────────────────────────────────────────
  // Milestone click (selection)
  // ────────────────────────────────────────
  const handleMilestoneClick = (e, milestoneId) => {
    e.stopPropagation();

    if (justDraggedRef.current) {
      return;
    }

    setSelectedConnection(null);

    const wasSelected = selectedMilestones.has(milestoneId);

    if (e.ctrlKey || e.metaKey) {
      setSelectedMilestones(prev => {
        const newSet = new Set(prev);
        if (newSet.has(milestoneId)) {
          newSet.delete(milestoneId);
        } else {
          newSet.add(milestoneId);
        }
        return newSet;
      });
      playSound(wasSelected ? 'milestoneDeselect' : 'milestoneSelect');
    } else {
      const willDeselect = selectedMilestones.size === 1 && wasSelected;
      setSelectedMilestones(prev => {
        if (prev.size === 1 && prev.has(milestoneId)) {
          return new Set();
        }
        return new Set([milestoneId]);
      });
      playSound(willDeselect ? 'milestoneDeselect' : 'milestoneSelect');
    }
  };

  // ────────────────────────────────────────
  // Milestone delete
  // ────────────────────────────────────────
  const handleMilestoneDelete = async (milestoneId) => {
    try {
      await delete_milestone(projectId, milestoneId);
      playSound('milestoneDelete');

      setMilestones(prev => {
        const updated = { ...prev };
        delete updated[milestoneId];
        return updated;
      });

      // Remove from tasks
      setTasks(prev => {
        const updated = { ...prev };
        for (const taskId of Object.keys(updated)) {
          if (updated[taskId]?.milestones) {
            updated[taskId] = {
              ...updated[taskId],
              milestones: updated[taskId].milestones.filter(m => m.id !== milestoneId)
            };
          }
        }
        return updated;
      });

      setConnections(prev => prev.filter(c => c.source !== milestoneId && c.target !== milestoneId));

      setSelectedMilestones(prev => {
        const updated = new Set(prev);
        updated.delete(milestoneId);
        return updated;
      });

    } catch (err) {
      console.error("Failed to delete milestone:", err);
      throw err;
    }
  };

  // ────────────────────────────────────────
  // Milestone double click (rename)
  // ────────────────────────────────────────
  const handleMilestoneDoubleClick = (e, milestone) => {
    e.stopPropagation();
    setEditingMilestoneId(milestone.id);
    setEditingMilestoneName(milestone.name);
  };

  // ────────────────────────────────────────
  // Milestone rename submit
  // ────────────────────────────────────────
  const handleMilestoneRenameSubmit = async (milestoneId, editingMilestoneNameVal) => {
    if (!editingMilestoneNameVal.trim()) {
      setEditingMilestoneId(null);
      setEditingMilestoneName("");
      return;
    }

    try {
      await rename_milestone(projectId, milestoneId, editingMilestoneNameVal.trim());
      playSound('milestoneRename');

      setMilestones(prev => ({
        ...prev,
        [milestoneId]: {
          ...prev[milestoneId],
          name: editingMilestoneNameVal.trim()
        }
      }));
    } catch (err) {
      console.error("Failed to rename milestone:", err);
    }

    setEditingMilestoneId(null);
    setEditingMilestoneName("");
  };

  // ────────────────────────────────────────
  // Day cell click (trigger milestone creation modal)
  // ────────────────────────────────────────
  const handleDayCellClick = (taskId, dayIndex) => {
    setMilestoneCreateModal({ taskId, dayIndex });
  };

  return {
    handleMileStoneMouseDown,
    handleMilestoneEdgeResize,
    handleMilestoneClick,
    handleMilestoneDelete,
    handleMilestoneDoubleClick,
    handleMilestoneRenameSubmit,
    handleDayCellClick,
  };
}
