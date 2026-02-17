// interaction logic for dependencies timeline
import { useRef, useState, useEffect } from 'react';
import {
  update_start_index,
  rename_milestone,
  safe_team_order,
  reorder_team_tasks,
  create_dependency,
  delete_dependency_api as delete_dependency,
  delete_milestone,
  change_duration,
} from '../../api/dependencies_api.js';
import { isTaskVisible } from './layoutMath';
import { useDependency } from './DependencyContext.jsx';
import {
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
} from './layoutMath';

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
  // Get UI state from context
  const {
    projectId,
    teamContainerRef,
    viewMode,
    setViewMode,
    baseViewModeRef,
    selectedConnection,
    setSelectedConnection,
    selectedMilestones,
    setSelectedMilestones,
    autoSelectBlocking,
    setEditingMilestoneId,
    setEditingMilestoneName,
    warningDuration,
  } = useDependency();
  // Transient interaction state
  const justDraggedRef = useRef(false);
  const [ghost, setGhost] = useState(null);
  const [dropIndex, _setDropIndex] = useState(null);
  const dropIndexRef = useRef(null);
  const setDropIndex = (val) => { dropIndexRef.current = val; _setDropIndex(val); };
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [connectionEnd, setConnectionEnd] = useState({ x: 0, y: 0 });
  const [taskGhost, setTaskGhost] = useState(null);
  const [taskDropTarget, _setTaskDropTarget] = useState(null);
  const taskDropTargetRef = useRef(null);
  const setTaskDropTarget = (val) => { taskDropTargetRef.current = val; _setTaskDropTarget(val); };
  const [moveModal, setMoveModal] = useState(null);
  const [blockedMoveHighlight, setBlockedMoveHighlight] = useState(null);
  
  // Marquee (lasso) selection state
  const [marqueeRect, setMarqueeRect] = useState(null); // { x, y, width, height } in container coords
  
  // Warning messages state (Feature 5)
  const [warningMessages, setWarningMessages] = useState([]);
  const warningIdCounter = useRef(0);

  // Helper to add a warning message
  const addWarning = (message, details = null) => {
    const id = ++warningIdCounter.current;
    setWarningMessages(prev => [...prev, { id, message, details, timestamp: Date.now() }]);
  };

  // ________Global Event Listener___________
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
      } else if (e.key === "e" || e.key === "E") {
        setViewMode("schedule");
        baseViewModeRef.current = "schedule";
      } else if (e.key === "d" || e.key === "D") {
        setViewMode("dependency");
        baseViewModeRef.current = "dependency";
      } else if (e.key === "v" || e.key === "V") {
        setViewMode("inspection");
        baseViewModeRef.current = "inspection";
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

  // ________Overlap Check Helper___________
  // ________________________________________

  /**
   * Check if a milestone would overlap with other milestones in the same task.
   * Returns { valid: true } or { valid: false, overlapping: [...milestoneIds] }
   * 
   * @param {string} milestoneId - The milestone being moved/resized
   * @param {number} newStartIndex - The new start index
   * @param {number} newDuration - The new duration
   * @param {Set} excludeIds - Set of milestone IDs to exclude from check (e.g. milestones being moved together)
   */
  const checkMilestoneOverlap = (milestoneId, newStartIndex, newDuration, excludeIds = new Set()) => {
    const milestone = milestones[milestoneId];
    if (!milestone) return { valid: true };

    const taskId = milestone.task;
    const task = tasks[taskId];
    if (!task) return { valid: true };

    const newEnd = newStartIndex + newDuration - 1;
    const overlapping = [];

    // Check all milestones in the same task
    const taskMilestones = task.milestones || [];
    for (const mRef of taskMilestones) {
      if (mRef.id === milestoneId) continue;
      if (excludeIds.has(mRef.id)) continue;

      const other = milestones[mRef.id];
      if (!other) continue;

      const otherStart = other.start_index;
      const otherEnd = otherStart + (other.duration || 1) - 1;

      // Overlap check: two ranges [newStartIndex, newEnd] and [otherStart, otherEnd]
      if (newStartIndex <= otherEnd && newEnd >= otherStart) {
        overlapping.push({
          blockingMilestoneId: mRef.id,
          blockingConnection: null, // No connection, it's an overlap
          reason: 'overlap',
        });
      }
    }

    if (overlapping.length > 0) {
      return { valid: false, overlapping };
    }
    return { valid: true };
  };

  /**
   * Check overlap for multiple milestones being moved by the same delta.
   * Each milestone checks against non-moving milestones in its task.
   */
  const checkMultiMilestoneOverlap = (milestoneIds, deltaIndex) => {
    const movingSet = new Set(milestoneIds);
    const allOverlapping = [];

    for (const milestoneId of milestoneIds) {
      const milestone = milestones[milestoneId];
      if (!milestone) continue;

      const newStart = milestone.start_index + deltaIndex;
      const newDuration = milestone.duration || 1;
      
      const result = checkMilestoneOverlap(milestoneId, newStart, newDuration, movingSet);
      if (!result.valid) {
        allOverlapping.push(...result.overlapping);
      }
    }

    if (allOverlapping.length > 0) {
      const seen = new Set();
      const unique = allOverlapping.filter(b => {
        if (seen.has(b.blockingMilestoneId)) return false;
        seen.add(b.blockingMilestoneId);
        return true;
      });
      return { valid: false, allBlocking: unique };
    }
    return { valid: true };
  };

  // Handle team drag — allowed in all modes (reordering is non-destructive)
  const handleTeamDrag = (e, teamId, orderIndex) => {
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const team = teams[teamId];
    if (!team) return;

    const startY = e.clientY;
    let currentOrderIndex = orderIndex;

    setGhost({
      id: teamId,
      name: team.name,
      color: team.color,
      y: e.clientY - containerRect.top,
    });
    setDropIndex(orderIndex);

    const onMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - containerRect.top;
      setGhost(prev => prev ? { ...prev, y: deltaY } : null);

      // Per-team overhead: drop highlight area + header line
      const perTeamOverhead =
        TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2 +
        TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      let cumulativeY = 0;
      let newDropIndex = 0;
      const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
      
      for (let i = 0; i < visibleTeams.length; i++) {
        const tid = visibleTeams[i];
        const totalH = perTeamOverhead + getTeamHeight(tid);
        if (deltaY < cumulativeY + totalH / 2) {
          newDropIndex = i;
          break;
        }
        cumulativeY += totalH;
        newDropIndex = i + 1;
      }
      setDropIndex(newDropIndex);
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
      const currentVisibleIndex = visibleTeams.indexOf(teamId);
      const finalDropIndex = dropIndexRef.current;

      if (finalDropIndex !== null && finalDropIndex !== currentVisibleIndex) {
        const newVisibleTeams = visibleTeams.filter(tid => tid !== teamId);
        newVisibleTeams.splice(finalDropIndex, 0, teamId);

        const hiddenTeams = teamOrder.filter(tid => !isTeamVisible(tid));
        const newOrder = [...newVisibleTeams, ...hiddenTeams];

        setTeamOrder(newOrder);
        try {
          await safe_team_order(projectId, newOrder);
        } catch (err) {
          console.error("Failed to save team order:", err);
        }
      }

      setGhost(null);
      setDropIndex(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle task drag — allowed in all modes (reordering is non-destructive)
  const handleTaskDrag = (e, taskId, teamId, taskIndex) => {
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const task = tasks[taskId];
    if (!task) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const taskHeight = getTaskHeight(taskId, taskDisplaySettings);

    setTaskGhost({
      taskKey: taskId,
      teamKey: teamId,
      name: task.name,
      height: taskHeight,
      width: TASKWIDTH,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    });

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - containerRect.left;
      const y = moveEvent.clientY - containerRect.top;
      setTaskGhost(prev => prev ? { ...prev, x, y } : null);

      // Find target team and insert position
      let targetTeamId = null;
      let insertIndex = 0;

      for (const tid of teamOrder) {
        if (!isTeamVisible(tid)) continue;
        const teamYOff = getTeamYOffset(tid);
        const teamH = getTeamHeight(tid);
        
        if (y >= teamYOff && y <= teamYOff + teamH) {
          targetTeamId = tid;
          const visibleTasks = getVisibleTasks(tid);
          let taskCumY = teamYOff;
          
          for (let i = 0; i < visibleTasks.length; i++) {
            const th = getTaskHeight(visibleTasks[i], taskDisplaySettings);
            if (y < taskCumY + th / 2) {
              insertIndex = i;
              break;
            }
            taskCumY += th;
            insertIndex = i + 1;
          }
          break;
        }
      }

      if (targetTeamId) {
        setTaskDropTarget({ teamId: targetTeamId, insertIndex });
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const finalTaskDropTarget = taskDropTargetRef.current;
      if (finalTaskDropTarget) {
        const { teamId: targetTeamId, insertIndex } = finalTaskDropTarget;

        if (targetTeamId === teamId) {
          // Same team reorder
          const visibleTasks = getVisibleTasks(teamId);
          const currentIndex = visibleTasks.indexOf(taskId);
          
          if (currentIndex !== -1 && insertIndex !== currentIndex) {
            const newOrder = [...visibleTasks];
            newOrder.splice(currentIndex, 1);
            const adjustedIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex;
            newOrder.splice(adjustedIndex, 0, taskId);

            // Rebuild full order including hidden tasks
            const team = teams[teamId];
            const hiddenTasks = team.tasks.filter(tid => !isTaskVisible(tid, taskDisplaySettings));
            const fullOrder = [...newOrder, ...hiddenTasks];

            setTeams(prev => ({
              ...prev,
              [teamId]: { ...prev[teamId], tasks: fullOrder }
            }));

            try {
              await reorder_team_tasks(projectId, taskId, teamId, fullOrder);
            } catch (err) {
              console.error("Failed to reorder tasks:", err);
            }
          }
        } else {
          // Cross-team move — show modal
          setMoveModal({
            taskId,
            sourceTeamId: teamId,
            targetTeamId,
            insertIndex,
          });
        }
      }

      setTaskGhost(null);
      setTaskDropTarget(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle milestone mouse down (drag) - supports moving multiple selected milestones
  // Allowed in schedule and dependency modes
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
        validation = validateMilestoneMove(milestonesToMove[0], newStart);
      } else {
        validation = validateMultiMilestoneMove(milestonesToMove, currentDeltaIndex);
      }

      // Also validate overlap constraints
      const overlapValidation = checkMultiMilestoneOverlap(milestonesToMove, currentDeltaIndex);

      if (!validation.valid || !overlapValidation.valid) {
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

        // Show warning with reason (Feature 5)
        const hasDepBlocking = (validation.allBlocking || []).length > 0;
        const hasOverlapBlocking = (overlapValidation.allBlocking || []).length > 0;
        
        if (hasDepBlocking && hasOverlapBlocking) {
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

  // Handle milestone delete
  const handleMilestoneDelete = async (milestoneId) => {
    try {
      await delete_milestone(projectId, milestoneId);

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

  // Handle milestone click (selection)
  const handleMilestoneClick = (e, milestoneId) => {
    e.stopPropagation();
    
    if (justDraggedRef.current) {
      return;
    }

    setSelectedConnection(null);
    
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
    } else {
      setSelectedMilestones(prev => {
        if (prev.size === 1 && prev.has(milestoneId)) {
          return new Set();
        }
        return new Set([milestoneId]);
      });
    }
  };

  // Check if a move would violate dependencies
  const validateMilestoneMove = (milestoneId, newStartIndex) => {
    const milestone = milestones[milestoneId];
    if (!milestone) return { valid: true };

    const allBlocking = [];

    const incomingConnections = connections.filter(c => c.target === milestoneId);
    
    for (const conn of incomingConnections) {
      const sourceMilestone = milestones[conn.source];
      if (!sourceMilestone) continue;
      
      const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;
      
      if (sourceEndIndex >= newStartIndex) {
        allBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn });
      }
    }

    const outgoingConnections = connections.filter(c => c.source === milestoneId);
    const newEndIndex = newStartIndex + (milestone.duration || 1) - 1;

    for (const conn of outgoingConnections) {
      const targetMilestone = milestones[conn.target];
      if (!targetMilestone) continue;
      
      if (newEndIndex >= targetMilestone.start_index) {
        allBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn });
      }
    }
    
    if (allBlocking.length > 0) {
      const seen = new Set();
      const unique = allBlocking.filter(b => {
        if (seen.has(b.blockingMilestoneId)) return false;
        seen.add(b.blockingMilestoneId);
        return true;
      });
      return {
        valid: false,
        allBlocking: unique,
        blockingConnection: unique[0].blockingConnection,
        blockingMilestoneId: unique[0].blockingMilestoneId,
      };
    }
    return { valid: true };
  };

  // Check if moving multiple milestones by a delta would be valid
  const validateMultiMilestoneMove = (milestoneIds, deltaIndex) => {
    const movingSet = new Set(milestoneIds);
    const allBlocking = [];
    
    for (const milestoneId of milestoneIds) {
      const milestone = milestones[milestoneId];
      if (!milestone) continue;
      
      const newStartIndex = milestone.start_index + deltaIndex;
      if (newStartIndex < 0) {
        return { valid: false, reason: "Cannot move before project start", blockingMilestoneIds: [milestoneId], allBlocking: [] };
      }
      
      const incomingConnections = connections.filter(c => c.target === milestoneId);
      
      for (const conn of incomingConnections) {
        if (movingSet.has(conn.source)) continue;
        
        const sourceMilestone = milestones[conn.source];
        if (!sourceMilestone) continue;
        
        const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;
        
        if (sourceEndIndex >= newStartIndex) {
          allBlocking.push({ blockingMilestoneId: conn.source, blockingConnection: conn });
        }
      }

      const outgoingConnections = connections.filter(c => c.source === milestoneId);
      const newEndIndex = newStartIndex + (milestone.duration || 1) - 1;

      for (const conn of outgoingConnections) {
        if (movingSet.has(conn.target)) continue;
        
        const targetMilestone = milestones[conn.target];
        if (!targetMilestone) continue;
        
        if (newEndIndex >= targetMilestone.start_index) {
          allBlocking.push({ blockingMilestoneId: conn.target, blockingConnection: conn });
        }
      }
    }
    
    if (allBlocking.length > 0) {
      const seen = new Set();
      const unique = allBlocking.filter(b => {
        if (seen.has(b.blockingMilestoneId)) return false;
        seen.add(b.blockingMilestoneId);
        return true;
      });
      return {
        valid: false,
        allBlocking: unique,
        blockingConnection: unique[0].blockingConnection,
        blockingMilestoneId: unique[0].blockingMilestoneId,
      };
    }
    return { valid: true };
  };

  // Show blocking feedback with temporary expansion of hidden/collapsed items
  const showBlockingFeedback = (blockingMilestoneId, connectionId) => {
    const milestone = milestones[blockingMilestoneId];
    if (!milestone) return;
    
    const taskId = milestone.task;
    const task = tasks[taskId];
    if (!task) return;
    
    const teamId = task.team;
    
    const originalState = {
      taskHidden: taskDisplaySettings[taskId]?.hidden || false,
      taskSize: taskDisplaySettings[taskId]?.size || 'normal',
      teamCollapsed: teamDisplaySettings[teamId]?.collapsed || false,
      teamHidden: teamDisplaySettings[teamId]?.hidden || false,
    };
    
    if (originalState.teamHidden) {
      setTeamDisplaySettings(prev => ({
        ...prev,
        [teamId]: { ...prev[teamId], hidden: false }
      }));
    }
    if (originalState.teamCollapsed) {
      setTeamDisplaySettings(prev => ({
        ...prev,
        [teamId]: { ...prev[teamId], collapsed: false }
      }));
    }
    if (originalState.taskHidden) {
      setTaskDisplaySettings(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], hidden: false }
      }));
    }
    if (originalState.taskSize === 'small') {
      setTaskDisplaySettings(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], size: 'normal' }
      }));
    }
    
    setBlockedMoveHighlight({
      milestoneId: blockingMilestoneId,
      connectionSource: connectionId?.source,
      connectionTarget: connectionId?.target,
    });
    
    if (autoSelectBlocking) {
      setTimeout(() => {
        setBlockedMoveHighlight(null);
      }, warningDuration);
    } else {
      setTimeout(() => {
        setBlockedMoveHighlight(null);
        
        if (originalState.teamHidden) {
          setTeamDisplaySettings(prev => ({
            ...prev,
            [teamId]: { ...prev[teamId], hidden: true }
          }));
        }
        if (originalState.teamCollapsed) {
          setTeamDisplaySettings(prev => ({
            ...prev,
            [teamId]: { ...prev[teamId], collapsed: true }
          }));
        }
        if (originalState.taskHidden) {
          setTaskDisplaySettings(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], hidden: true }
          }));
        }
        if (originalState.taskSize === 'small') {
          setTaskDisplaySettings(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], size: 'small' }
          }));
        }
      }, warningDuration);
    }
  };

  // Handle milestone double click (rename)
  const handleMilestoneDoubleClick = (e, milestone) => {
    e.stopPropagation();
    setEditingMilestoneId(milestone.id);
    setEditingMilestoneName(milestone.name);
  };

  // Handle milestone rename submit
  const handleMilestoneRenameSubmit = async (milestoneId, editingMilestoneNameVal) => {
    if (!editingMilestoneNameVal.trim()) {
      setEditingMilestoneId(null);
      setEditingMilestoneName("");
      return;
    }

    try {
      await rename_milestone(projectId, milestoneId, editingMilestoneNameVal.trim());
      
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

  // Handle milestone edge resize — with dependency validation AND overlap check
  // Feature 3: When multiple milestones are selected, resize all of them
  const handleMilestoneEdgeResize = (e, milestoneId, edge) => {
    if (safeMode) return;
    e.stopPropagation();
    e.preventDefault();

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    // Determine which milestones to resize (Feature 3)
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

      // Validate ALL milestones being resized using tracked delta (not stale closure)
      const allResizeBlocking = [];
      let hasOverlapViolation = false;
      let hasDepViolation = false;

      for (const mId of milestonesToResize) {
        const initial = initialStates[mId];
        if (!initial) continue;

        // Compute current values from initial + delta (avoids stale closure issue)
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

        // Check overlap constraints (Feature 4)
        const excludeSet = new Set(milestonesToResize);
        const overlapResult = checkMilestoneOverlap(mId, currentStartIndex, currentDuration, excludeSet);
        if (!overlapResult.valid) {
          for (const ov of overlapResult.overlapping) {
            allResizeBlocking.push(ov);
          }
          hasOverlapViolation = true;
        }
      }

      if (allResizeBlocking.length > 0) {
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

        // Show warning with reason (Feature 5)
        if (hasDepViolation && hasOverlapViolation) {
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

  // ________Marquee (Lasso) Selection___________
  // ________________________________________

  /**
   * Start a marquee selection drag on the canvas background.
   * Called from onMouseDown on the teamContainerRef.
   * Only activates when clicking on empty space (not on milestones/UI).
   */
  const handleMarqueeStart = (e) => {
    // Only left-click
    if (e.button !== 0) return;
    
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    const scrollLeft = teamContainerRef.current.parentElement?.scrollLeft || 0;
    const startX = e.clientX - containerRect.left + scrollLeft;
    const startY = e.clientY - containerRect.top;
    
    setMarqueeRect({ x: startX, y: startY, width: 0, height: 0 });
    
    const DRAG_THRESHOLD = 4;
    let hasDragged = false;
    let lastMoveX = startX;
    let lastMoveY = startY;
    
    const onMouseMove = (moveEvent) => {
      const sl = teamContainerRef.current?.parentElement?.scrollLeft || 0;
      const currentX = moveEvent.clientX - containerRect.left + sl;
      const currentY = moveEvent.clientY - containerRect.top;
      
      lastMoveX = currentX;
      lastMoveY = currentY;
      
      const dx = currentX - startX;
      const dy = currentY - startY;
      
      if (!hasDragged && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      hasDragged = true;
      
      setMarqueeRect({
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(dx),
        height: Math.abs(dy),
      });
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      if (!hasDragged) {
        setMarqueeRect(null);
        return;
      }
      
      const rect = {
        x: Math.min(startX, lastMoveX),
        y: Math.min(startY, lastMoveY),
        width: Math.abs(lastMoveX - startX),
        height: Math.abs(lastMoveY - startY),
      };
      
      // Hit-test all visible milestones
      const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
      
      const newSelection = new Set();
      
      for (const [id, milestone] of Object.entries(milestones)) {
        const mId = parseInt(id);
        const task = tasks[milestone.task];
        if (!task) continue;
        
        const team = teams[task.team];
        if (!team || !isTeamVisible(task.team)) continue;
        if (!isTaskVisible(milestone.task, taskDisplaySettings)) continue;
        
        // Skip milestones in collapsed teams
        const teamSettings = teamDisplaySettings[task.team];
        if (teamSettings?.collapsed) continue;
        
        const taskHeightVal = getTaskHeight(milestone.task, taskDisplaySettings);
        const teamYOff = getTeamYOffset(task.team);
        const taskYOff = getTaskYOffset(milestone.task, task.team);
        
        const milestoneX = TEAMWIDTH + TASKWIDTH + milestone.start_index * DAYWIDTH;
        const milestoneY = teamYOff + dropHighlightOffset + headerOffset + taskYOff + 2;
        const milestoneW = DAYWIDTH * (milestone.duration || 1);
        const milestoneH = taskHeightVal - 4;
        
        // AABB intersection check
        if (
          milestoneX < rect.x + rect.width &&
          milestoneX + milestoneW > rect.x &&
          milestoneY < rect.y + rect.height &&
          milestoneY + milestoneH > rect.y
        ) {
          newSelection.add(mId);
        }
      }
      
      if (newSelection.size > 0) {
        if (e.ctrlKey || e.metaKey) {
          // Add to existing selection
          setSelectedMilestones(prev => {
            const merged = new Set(prev);
            for (const mId of newSelection) merged.add(mId);
            return merged;
          });
        } else {
          setSelectedMilestones(newSelection);
        }
        setSelectedConnection(null);
        // Prevent the page-wrapper onClick from clearing selection
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      }
      
      setMarqueeRect(null);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle day cell click (create milestone)
  const handleDayCellClick = (taskId, dayIndex) => {
    setMilestoneCreateModal({ taskId, dayIndex });
  };

  // Connection handling
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
                setConnections(prev => [...prev, { source: sourceId, target: targetId }]);
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

  // Find milestone at position
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

  // Get milestone handle position
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

  // Handle connection click
  const handleConnectionClick = (e, connection) => {
    e.stopPropagation();
    setSelectedMilestones(new Set());
    
    if (selectedConnection?.source === connection.source && selectedConnection?.target === connection.target) {
      setSelectedConnection(null);
    } else {
      setSelectedConnection(connection);
    }
  };

  // Handle delete connection
  const handleDeleteConnection = async (connection) => {
    try {
      await delete_dependency(projectId, connection.source, connection.target);
      setConnections(prev => prev.filter(c => !(c.source === connection.source && c.target === connection.target)));
      setSelectedConnection(null);
    } catch (err) {
      console.error("Failed to delete dependency:", err);
    }
  };

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

    // Warning messages (Feature 5)
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
