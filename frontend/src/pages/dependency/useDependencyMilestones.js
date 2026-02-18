// Milestone drag, resize, click, selection, rename, delete, and day-cell click.
import { playSound, startLoopSound, stopLoopSound } from '../../assets/sound_registry';
import {
  update_start_index,
  rename_milestone,
  delete_milestone,
  change_duration,
  add_milestone,
  create_dependency,
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
  // Day column layout for accurate pixel offsets
  dayColumnLayout,
  // Mode
  safeMode,
  // Ref from orchestrator
  justDraggedRef,
  // Warning/feedback  (from useDependencyWarnings)
  addWarning,
  showBlockingFeedback,
  // Weak dependency confirmation callback
  onWeakDepConflict,
  // Collapsed days for barrier check
  collapsedDays,
}) {
  const {
    projectId,
    teamContainerRef,
    viewMode,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnections,
    setSelectedConnections,
    autoSelectBlocking,
    setEditingMilestoneId,
    setEditingMilestoneName,
    pushAction,
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
          duration: m.duration || 1,
          startVisualX: dayColumnLayout
            ? dayColumnLayout.dayXOffset(m.start_index)
            : m.start_index * DAYWIDTH,
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
      stopLoopSound('dragLoop');

      if (hasDragged) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      } else {
        // No drag, just a click — clear visual x and return
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

      // Check day-0 boundary: no milestone can move before the project start
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (initial && initial.startIndex + currentDeltaIndex < 0) {
          addWarning("Move blocked: before day 0", "Milestones cannot be placed before the project start.");
          setMilestones(prev => {
            const updated = { ...prev };
            for (const mid of milestonesToMove) {
              const init = initialPositions[mid];
              if (init) {
                const { x, ...rest } = updated[mid];
                updated[mid] = { ...rest, start_index: init.startIndex };
              }
            }
            return updated;
          });
          return;
        }
      }

      // Check collapsed-day barrier: milestones cannot overlap collapsed days
      if (collapsedDays && collapsedDays.size > 0) {
        for (const mId of milestonesToMove) {
          const initial = initialPositions[mId];
          if (!initial) continue;
          const newStart = initial.startIndex + currentDeltaIndex;
          const duration = initial.duration || 1;
          for (let d = newStart; d < newStart + duration; d++) {
            if (collapsedDays.has(d)) {
              addWarning("Move blocked: collapsed day", "Milestones cannot be placed on collapsed days. Uncollapse the days first.");
              setMilestones(prev => {
                const updated = { ...prev };
                for (const mid of milestonesToMove) {
                  const init = initialPositions[mid];
                  if (init) {
                    const { x, ...rest } = updated[mid];
                    updated[mid] = { ...rest, start_index: init.startIndex };
                  }
                }
                return updated;
              });
              return;
            }
          }
        }
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
        const depBlocking = validation.allBlocking || [];
        const overlapBlocking = overlapValidation.allBlocking || [];
        const allBlocking = [...depBlocking, ...overlapBlocking];

        // Deduplicate
        const seen = new Set();
        const uniqueBlocking = allBlocking.filter(b => {
          if (seen.has(b.blockingMilestoneId)) return false;
          seen.add(b.blockingMilestoneId);
          return true;
        });

        const hasOverlapBlocking = overlapBlocking.length > 0;
        const hasDeadlineBlocking = !deadlineValidation.valid;

        // Categorize dependency blocking by weight
        const strongBlocking = depBlocking.filter(b => (b.weight || 'strong') === 'strong');
        const weakBlocking = depBlocking.filter(b => b.weight === 'weak');
        const suggestionBlocking = depBlocking.filter(b => b.weight === 'suggestion');

        // Hard blocks: overlap, deadline, or strong deps
        const hasHardBlock = hasOverlapBlocking || hasDeadlineBlocking || strongBlocking.length > 0;

        if (hasHardBlock) {
          // Show warning with reason (original behavior)
          if (hasDeadlineBlocking) {
            addWarning("Move blocked: exceeds hard deadline", "A milestone would be placed past its task's hard deadline.");
          } else if (strongBlocking.length > 0 && hasOverlapBlocking) {
            addWarning("Move blocked: dependency constraint & milestone overlap", "Milestones cannot overlap within a task, and dependencies must be respected.");
          } else if (hasOverlapBlocking) {
            addWarning("Move blocked: milestones would overlap", "Milestones within the same task cannot occupy the same days.");
          } else {
            addWarning("Move blocked: strong dependency constraint", "A strong dependency prevents this move.");
          }

          for (const { blockingMilestoneId, blockingConnection } of uniqueBlocking) {
            showBlockingFeedback(blockingMilestoneId, blockingConnection);
          }

          if (autoSelectBlocking && uniqueBlocking.length > 0) {
            setSelectedMilestones(prev => {
              const newSet = new Set(prev);
              for (const mId of milestonesToMove) newSet.add(mId);
              for (const { blockingMilestoneId } of uniqueBlocking) newSet.add(blockingMilestoneId);
              return newSet;
            });
          }

          // Revert all milestones
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

        // Only weak and/or suggestion blocking — no hard block
        if (weakBlocking.length > 0) {
          // Freeze: revert visually first
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

          // Show weak dep confirmation modal via callback
          if (onWeakDepConflict) {
            onWeakDepConflict({
              weakConnections: weakBlocking.map(b => b.blockingConnection),
              blockingMilestoneIds: weakBlocking.map(b => b.blockingMilestoneId),
              milestonesToMove,
              initialPositions,
              currentDeltaIndex,
              suggestionBlocking: suggestionBlocking.map(b => b.blockingConnection),
            });
          } else {
            addWarning("Move blocked: weak dependency conflict", "A weak dependency prevents this move. Cannot resolve automatically.");
          }
          return;
        }

        // Only suggestion blocking — allow the move but warn
        if (suggestionBlocking.length > 0) {
          addWarning("Suggestion dependency violated", "This move violates a suggestion dependency, but it is allowed.");
          for (const { blockingMilestoneId, blockingConnection } of suggestionBlocking) {
            showBlockingFeedback(blockingMilestoneId, blockingConnection);
          }
          // Fall through to allow the move
        }
      }

      // Validation passed — save for all milestones
      playSound('milestoneMove');
      const beforePositions = {};
      const afterPositions = {};
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (!initial) continue;
        beforePositions[mId] = initial.startIndex;
        afterPositions[mId] = initial.startIndex + currentDeltaIndex;
      }

      for (const mId of milestonesToMove) {
        const newStart = afterPositions[mId];
        if (newStart === undefined) continue;

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

      pushAction({
        description: `Move ${milestonesToMove.length} milestone(s)`,
        undo: async () => {
          for (const mId of milestonesToMove) {
            const oldStart = beforePositions[mId];
            if (oldStart === undefined) continue;
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: oldStart } }));
            await update_start_index(projectId, mId, oldStart);
          }
        },
        redo: async () => {
          for (const mId of milestonesToMove) {
            const newStart = afterPositions[mId];
            if (newStart === undefined) continue;
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: newStart } }));
            await update_start_index(projectId, mId, newStart);
          }
        },
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
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
      stopLoopSound('dragLoop');

      // Validate ALL milestones being resized using tracked delta
      const allResizeBlocking = [];
      let hasOverlapViolation = false;
      let hasDepViolation = false;
      let hasDeadlineViolation = false;

      // Pre-compute resized positions for ALL milestones so co-selected checks use new values
      const resizedPositions = {};
      for (const mId of milestonesToResize) {
        const initial = initialStates[mId];
        if (!initial) continue;
        let currentStartIndex, currentDuration;
        if (edge === "right") {
          currentStartIndex = initial.startIndex;
          currentDuration = Math.max(1, initial.duration + currentIndexDelta);
        } else {
          currentStartIndex = Math.max(0, initial.startIndex + currentIndexDelta);
          const durationChange = initial.startIndex - currentStartIndex;
          currentDuration = Math.max(1, initial.duration + durationChange);
        }
        resizedPositions[mId] = { startIndex: currentStartIndex, duration: currentDuration };
      }

      for (const mId of milestonesToResize) {
        const rp = resizedPositions[mId];
        if (!rp) continue;
        const { startIndex: currentStartIndex, duration: currentDuration } = rp;
        const newEndIndex = currentStartIndex + currentDuration - 1;

        // Check dependency constraints (outgoing)
        const outgoingConnections = connections.filter(c => c.source === mId);
        for (const conn of outgoingConnections) {
          const targetMilestone = milestones[conn.target];
          if (!targetMilestone) continue;
          // For co-selected targets, use their resized start_index instead
          const targetStart = resizedPositions[conn.target]
            ? resizedPositions[conn.target].startIndex
            : targetMilestone.start_index;
          if (newEndIndex >= targetStart) {
            allResizeBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn, weight: conn.weight || 'strong' });
            hasDepViolation = true;
          }
        }

        // Check dependency constraints (incoming)
        const incomingConnections = connections.filter(c => c.target === mId);
        for (const conn of incomingConnections) {
          const sourceMilestone = milestones[conn.source];
          if (!sourceMilestone) continue;
          // For co-selected sources, use their resized end index instead
          let sourceEndIndex;
          if (resizedPositions[conn.source]) {
            const sp = resizedPositions[conn.source];
            sourceEndIndex = sp.startIndex + sp.duration - 1;
          } else {
            sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;
          }
          if (sourceEndIndex >= currentStartIndex) {
            allResizeBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn, weight: conn.weight || 'strong' });
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
        // Categorize dep blocking by weight
        const depBlocking = allResizeBlocking.filter(b => b.blockingConnection);
        const strongResizeBlocking = depBlocking.filter(b => (b.weight || 'strong') === 'strong');
        const weakResizeBlocking = depBlocking.filter(b => b.weight === 'weak');
        const suggestionResizeBlocking = depBlocking.filter(b => b.weight === 'suggestion');

        // Hard blocks: overlap, deadline, or strong deps
        const hasHardResizeBlock = hasOverlapViolation || hasDeadlineViolation || strongResizeBlocking.length > 0;

        if (hasHardResizeBlock) {
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
            addWarning("Resize blocked: dependency constraint", "A strong dependency prevents this resize.");
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

        // Only weak and/or suggestion blocking — no hard block
        if (weakResizeBlocking.length > 0) {
          // Freeze: revert visually first
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

          // Show weak dep confirmation modal via callback
          if (onWeakDepConflict) {
            onWeakDepConflict({
              type: 'resize',
              weakConnections: weakResizeBlocking.map(b => b.blockingConnection),
              blockingMilestoneIds: weakResizeBlocking.map(b => b.blockingMilestoneId),
              milestonesToResize,
              initialStates,
              edge,
              currentIndexDelta: currentIndexDelta,
              suggestionBlocking: suggestionResizeBlocking.map(b => b.blockingConnection),
            });
          } else {
            addWarning("Resize blocked: weak dependency conflict", "A weak dependency prevents this resize. Cannot resolve automatically.");
          }
          return;
        }

        // Only suggestion blocking — allow resize but warn
        if (suggestionResizeBlocking.length > 0) {
          addWarning("Suggestion dependency violated", "This resize violates a suggestion dependency, but it is allowed.");
          for (const { blockingMilestoneId, blockingConnection } of suggestionResizeBlocking) {
            showBlockingFeedback(blockingMilestoneId, blockingConnection);
          }
          // Fall through to save
        }
      }

      // Validation passed — save changes for all milestones
      playSound('milestoneResize');
      const resizeBefore = {};
      const resizeAfter = {};

      for (const mId of milestonesToResize) {
        const initial = initialStates[mId];
        if (!initial) continue;

        const currentM = milestones[mId];
        if (!currentM) continue;

        resizeBefore[mId] = { startIndex: initial.startIndex, duration: initial.duration };
        resizeAfter[mId] = { startIndex: currentM.start_index, duration: currentM.duration };

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

      pushAction({
        description: `Resize ${milestonesToResize.length} milestone(s)`,
        undo: async () => {
          for (const mId of milestonesToResize) {
            const before = resizeBefore[mId];
            const after = resizeAfter[mId];
            if (!before || !after) continue;
            const durationDelta = before.duration - after.duration;
            if (durationDelta !== 0) await change_duration(projectId, mId, durationDelta);
            if (before.startIndex !== after.startIndex) await update_start_index(projectId, mId, before.startIndex);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: before.startIndex, duration: before.duration } }));
          }
        },
        redo: async () => {
          for (const mId of milestonesToResize) {
            const before = resizeBefore[mId];
            const after = resizeAfter[mId];
            if (!before || !after) continue;
            const durationDelta = after.duration - before.duration;
            if (durationDelta !== 0) await change_duration(projectId, mId, durationDelta);
            if (before.startIndex !== after.startIndex) await update_start_index(projectId, mId, after.startIndex);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: after.startIndex, duration: after.duration } }));
          }
        },
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    startLoopSound('dragLoop');
  };

  // ────────────────────────────────────────
  // Milestone click (selection)
  // ────────────────────────────────────────
  const handleMilestoneClick = (e, milestoneId) => {
    e.stopPropagation();

    if (justDraggedRef.current) {
      return;
    }

    setSelectedConnections([]);

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
    // Capture state for undo BEFORE deleting
    const deletedMilestone = milestones[milestoneId];
    const deletedConnections = connections.filter(c => c.source === milestoneId || c.target === milestoneId);
    const ownerTaskId = deletedMilestone?.task;

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

      // Push undo action — recreate the milestone + connections
      if (deletedMilestone) {
        pushAction({
          description: 'Delete milestone',
          undo: async () => {
            // Recreate milestone
            const result = await add_milestone(projectId, ownerTaskId, {
              name: deletedMilestone.name,
              description: deletedMilestone.description || '',
              start_index: deletedMilestone.start_index,
            });
            if (result.added_milestone) {
              const newId = result.added_milestone.id;
              const dur = (deletedMilestone.duration || 1) - 1;
              if (dur > 0) await change_duration(projectId, newId, dur);

              const restoredMs = {
                ...result.added_milestone,
                start_index: deletedMilestone.start_index,
                duration: deletedMilestone.duration || 1,
                display: deletedMilestone.display || 'default',
              };
              setMilestones(prev => ({ ...prev, [newId]: restoredMs }));
              setTasks(prev => ({
                ...prev,
                [ownerTaskId]: {
                  ...prev[ownerTaskId],
                  milestones: [...(prev[ownerTaskId]?.milestones || []), restoredMs],
                },
              }));

              // Recreate connections (mapping old ID → new ID)
              const restoredConns = [];
              for (const conn of deletedConnections) {
                const src = conn.source === milestoneId ? newId : conn.source;
                const tgt = conn.target === milestoneId ? newId : conn.target;
                try {
                  await create_dependency(projectId, src, tgt);
                  restoredConns.push({ source: src, target: tgt, weight: conn.weight || 'strong', reason: conn.reason || null });
                } catch (e) { /* skip if other milestone also deleted */ }
              }
              if (restoredConns.length > 0) {
                setConnections(prev => [...prev, ...restoredConns]);
              }
            }
          },
          redo: async () => {
            // redo = delete again — we need to find the milestone that occupies same task/position
            // Since undo created a new ID we can't predict it. Trigger a simpler approach:
            // Find milestone by task+start+name
            // This is best-effort — for robustness, just reload after redo of deletes
            // But let's try: find latest milestone matching this fingerprint
            const currentMs = Object.entries(milestones).find(([, m]) =>
              m.task === ownerTaskId &&
              m.name === deletedMilestone.name &&
              m.start_index === deletedMilestone.start_index
            );
            if (currentMs) {
              const [redoId] = currentMs;
              await delete_milestone(projectId, parseInt(redoId));
              setMilestones(prev => {
                const updated = { ...prev };
                delete updated[redoId];
                return updated;
              });
              setTasks(prev => {
                const updated = { ...prev };
                for (const taskId of Object.keys(updated)) {
                  if (updated[taskId]?.milestones) {
                    updated[taskId] = {
                      ...updated[taskId],
                      milestones: updated[taskId].milestones.filter(m => m.id !== parseInt(redoId))
                    };
                  }
                }
                return updated;
              });
              setConnections(prev => prev.filter(c => c.source !== parseInt(redoId) && c.target !== parseInt(redoId)));
            }
          },
        });
      }

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

    const oldName = milestones[milestoneId]?.name || "";
    const newName = editingMilestoneNameVal.trim();

    try {
      await rename_milestone(projectId, milestoneId, newName);
      playSound('milestoneRename');

      setMilestones(prev => ({
        ...prev,
        [milestoneId]: {
          ...prev[milestoneId],
          name: newName
        }
      }));

      pushAction({
        description: 'Rename milestone',
        undo: async () => {
          await rename_milestone(projectId, milestoneId, oldName);
          setMilestones(prev => ({ ...prev, [milestoneId]: { ...prev[milestoneId], name: oldName } }));
        },
        redo: async () => {
          await rename_milestone(projectId, milestoneId, newName);
          setMilestones(prev => ({ ...prev, [milestoneId]: { ...prev[milestoneId], name: newName } }));
        },
      });
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
