// interaction logic for dependencies timeline
import { useEffect, useRef, useState } from 'react';
import {
  TEAMWIDTH,
  TASKWIDTH,
  HEADER_HEIGHT,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  isTaskVisible,
} from './layoutMath';
import {
  safe_team_order,
  reorder_team_tasks,
  update_start_index,
  delete_milestone,
  rename_milestone,
  change_duration,
  create_dependency,
  delete_dependency_api,
} from '../../api/dependencies_api';
import { useDependency } from './DependencyContext.jsx';

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
  teamFilter,
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
  setTeamFilter,
  setTaskDisplaySettings,
  setTeamDisplaySettings,
  setMilestoneCreateModal,
  setIsAddingMilestone,
  setTasks,
  
  // Layout helpers
  DAYWIDTH,
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
  } = useDependency();
  // Transient interaction state
  const justDraggedRef = useRef(false); // Prevents click handler from firing after drag ends
  const [ghost, setGhost] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [connectionEnd, setConnectionEnd] = useState({ x: 0, y: 0 });
  const [taskGhost, setTaskGhost] = useState(null);
  const [taskDropTarget, setTaskDropTarget] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [blockedMoveHighlight, setBlockedMoveHighlight] = useState(null);

  // ________Global Event Listener___________
  // ________________________________________

  useEffect(() => {
    const down = (e) => {
      // Shift => temporarily switch to edit (schedule) mode
      if (e.shiftKey && !e.altKey) {
        setMode("drag")
        if (baseViewModeRef.current !== "schedule") {
          setViewMode("schedule");
        }
      }
      // Alt => temporarily switch to dependency mode
      else if (e.altKey && !e.shiftKey) {
        setMode("connect")
        if (baseViewModeRef.current !== "dependency") {
          setViewMode("dependency");
        }
      }
      // Escape key - clear selections and close modals
      else if (e.key === "Escape") {
        setSelectedMilestones(new Set());
        setSelectedConnection(null);
        setOpenTeamSettings(null);
        setShowFilterDropdown(false);
      }
    }

    const up = (e) => {
      setMode("drag")
      // Restore original mode when modifier keys are released
      if (!e.shiftKey && !e.altKey) {
        setViewMode(baseViewModeRef.current);
      }
    }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [viewMode, setMode, setViewMode])

  // Close team settings when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenTeamSettings(null);
    };
    if (openTeamSettings !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openTeamSettings, setOpenTeamSettings]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is outside the filter area
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
    
    // For each selected milestone, ensure its team and task are visible
    for (const milestoneId of selectedMilestones) {
      const milestone = milestones[milestoneId];
      if (!milestone) continue;
      
      const task = tasks[milestone.task];
      if (!task) continue;
      
      const teamId = task.team;
      
      // Ensure team is in filter (add it if filter is active and team isn't included)
      setTeamFilter(prev => {
        if (prev.length === 0) return prev; // No filter active
        if (prev.includes(teamId)) return prev; // Already included
        return [...prev, teamId];
      });
      
      // Ensure task is visible (not hidden)
      setTaskDisplaySettings(prev => {
        if (!prev[milestone.task]?.hidden) return prev;
        return {
          ...prev,
          [milestone.task]: { ...prev[milestone.task], hidden: false }
        };
      });
      
      // Ensure team is not collapsed
      setTeamDisplaySettings(prev => {
        if (!prev[teamId]?.collapsed) return prev;
        return {
          ...prev,
          [teamId]: { ...prev[teamId], collapsed: false }
        };
      });
    }
  }, [autoSelectBlocking, selectedMilestones, milestones, tasks, setTeamFilter, setTaskDisplaySettings, setTeamDisplaySettings]);

  // Handle team drag
  const handleTeamDrag = (e, teamId, orderIndex) => {
    if (safeMode) return;
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const team = teams[teamId];
    const teamHeight = getTeamHeight(teamId);
    const startY = e.clientY;

    // Track current drop index in closure variable
    let currentDropIndex = null;

    setGhost({
      id: teamId,
      name: team.name,
      color: team.color,
      height: teamHeight,
      y: e.clientY - containerRect.top,
    });

    const onMouseMove = (moveEvent) => {
      const y = moveEvent.clientY - containerRect.top;
      setGhost(prev => prev ? { ...prev, y } : null);

      // Calculate drop index
      let accumulatedHeight = HEADER_HEIGHT;
      let newDropIndex = 0;
      
      for (let i = 0; i < teamOrder.length; i++) {
        const tid = teamOrder[i];
        if (!isTeamVisible(tid)) continue;
        
        const dropHighlightHeight = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
        const tHeight = getTeamHeight(tid);
        const midPoint = accumulatedHeight + dropHighlightHeight + tHeight / 2;
        
        if (y < midPoint) {
          currentDropIndex = newDropIndex;
          setDropIndex(newDropIndex);
          return;
        }
        
        accumulatedHeight += dropHighlightHeight + tHeight;
        newDropIndex++;
      }
      currentDropIndex = newDropIndex;
      setDropIndex(newDropIndex);
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Get visible index for the dragged team
      const visibleOrderIndex = getVisibleTeamIndex(teamId);

      if (currentDropIndex !== null && currentDropIndex !== visibleOrderIndex) {
        // Build new order based on visible teams
        const visibleTeams = teamOrder.filter(tid => isTeamVisible(tid));
        const hiddenTeams = teamOrder.filter(tid => !isTeamVisible(tid));
        
        // Remove the dragged team from visible teams
        const draggedTeamIdx = visibleTeams.indexOf(teamId);
        visibleTeams.splice(draggedTeamIdx, 1);
        
        // Insert at new position
        const insertAt = currentDropIndex > draggedTeamIdx ? currentDropIndex - 1 : currentDropIndex;
        visibleTeams.splice(insertAt, 0, teamId);
        
        // Reconstruct full order: visible teams first, then hidden
        const newOrder = [...visibleTeams, ...hiddenTeams];
        
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

  // Handle task drag
  const handleTaskDrag = (e, taskId, teamId, taskIndex) => {
    if (safeMode) return;
    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const task = tasks[taskId];
    const taskHeight = getTaskHeight(taskId, taskDisplaySettings);

    // Track current drop target in closure variable
    let currentDropTarget = null;

    setTaskGhost({
      taskKey: taskId,
      fromTeamId: teamId,
      name: task?.name || 'Task',
      height: taskHeight,
      width: TASKWIDTH,
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    });

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - containerRect.left;
      const y = moveEvent.clientY - containerRect.top;
      setTaskGhost(prev => prev ? { ...prev, x, y } : null);

      // Find which team we're over
      let accumulatedHeight = HEADER_HEIGHT;
      for (const tid of teamOrder) {
        if (!isTeamVisible(tid)) continue;
        
        const dropHighlightHeight = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
        const tHeight = getTeamHeight(tid);
        const teamTop = accumulatedHeight + dropHighlightHeight;
        const teamBottom = teamTop + tHeight;
        
        if (y >= teamTop && y < teamBottom) {
          // We're over this team, find insert index
          const visibleTasks = getVisibleTasks(tid);
          let insertIndex = 0;
          let taskAccHeight = 0;
          const relativeY = y - teamTop;
          
          for (let i = 0; i < visibleTasks.length; i++) {
            const tHeight = getTaskHeight(visibleTasks[i], taskDisplaySettings);
            if (relativeY < taskAccHeight + tHeight / 2) {
              break;
            }
            taskAccHeight += tHeight;
            insertIndex = i + 1;
          }
          
          currentDropTarget = { teamId: tid, insertIndex };
          setTaskDropTarget({ teamId: tid, insertIndex });
          return;
        }
        
        accumulatedHeight += dropHighlightHeight + tHeight;
      }
      currentDropTarget = null;
      setTaskDropTarget(null);
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (currentDropTarget) {
        const { teamId: targetTeamId, insertIndex } = currentDropTarget;
        const sourceTeamId = teamId; // Use the closure variable, not state
        
        if (targetTeamId !== sourceTeamId) {
          // Cross-team move - show confirmation modal
          setMoveModal({
            taskId,
            taskName: task?.name,
            sourceTeamId,
            sourceTeamName: teams[sourceTeamId]?.name,
            targetTeamId,
            targetTeamName: teams[targetTeamId]?.name,
            insertIndex,
          });
        } else {
          // Same team reorder
          const team = teams[targetTeamId];
          const visibleTasks = getVisibleTasks(targetTeamId);
          const currentIndex = visibleTasks.indexOf(taskId);
          
          if (currentIndex !== insertIndex && currentIndex !== insertIndex - 1) {
            const newOrder = [...team.tasks];
            const taskCurrentIndex = newOrder.indexOf(taskId);
            newOrder.splice(taskCurrentIndex, 1);
            
            // Calculate actual insert position
            let actualInsertIndex = 0;
            let visibleCount = 0;
            for (let i = 0; i < team.tasks.length; i++) {
              if (team.tasks[i] === taskId) continue;
              if (isTaskVisible(team.tasks[i], taskDisplaySettings)) {
                if (visibleCount === insertIndex) {
                  actualInsertIndex = i;
                  break;
                }
                visibleCount++;
              }
              actualInsertIndex = i + 1;
            }
            
            newOrder.splice(actualInsertIndex, 0, taskId);
            
            setTeams(prev => ({
              ...prev,
              [targetTeamId]: { ...prev[targetTeamId], tasks: newOrder }
            }));
            
            try {
              await reorder_team_tasks(projectId, taskId, targetTeamId, newOrder);
            } catch (err) {
              console.error("Failed to reorder tasks:", err);
            }
          }
        }
      }

      setTaskGhost(null);
      setTaskDropTarget(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle milestone mouse down (drag) - supports moving multiple selected milestones
  // Only allowed in schedule mode
  const handleMileStoneMouseDown = (e, milestoneId) => {
    if (viewMode !== "schedule") return;

    e.preventDefault();
    const containerRect = teamContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    // Determine which milestones to move
    // If the clicked milestone is in the selection, move all selected
    // Otherwise, just move this one milestone
    const milestonesToMove = selectedMilestones.has(milestoneId) && selectedMilestones.size > 0
      ? Array.from(selectedMilestones)
      : [milestoneId];

    // Store initial positions of all milestones being moved
    const initialPositions = {};
    for (const mId of milestonesToMove) {
      const m = milestones[mId];
      if (m) {
        initialPositions[mId] = {
          startIndex: m.start_index,
          startVisualX: m.start_index * DAYWIDTH
        };
      }
    }

    const startX = e.clientX;
    
    // Track the delta index for validation
    let currentDeltaIndex = 0;
    let lastValidDeltaIndex = 0;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
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
      
      // Set flag to prevent click handler from firing after drag
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 0);

      // Calculate target positions for validation
      const targetPositions = {};
      let minNewIndex = Infinity;
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (initial) {
          const newIndex = Math.max(0, initial.startIndex + currentDeltaIndex);
          targetPositions[mId] = newIndex;
          minNewIndex = Math.min(minNewIndex, newIndex);
        }
      }

      // Ensure we don't go below 0
      if (minNewIndex < 0) {
        currentDeltaIndex = currentDeltaIndex - minNewIndex;
        for (const mId of Object.keys(targetPositions)) {
          targetPositions[mId] = Math.max(0, targetPositions[mId]);
        }
      }

      // Validate the move for all milestones
      const validation = validateMultiMilestoneMove(milestonesToMove, currentDeltaIndex);
      
      if (!validation.valid) {
        // Move is blocked - show feedback and optionally auto-select blocking milestone
        if (validation.blockingMilestoneId) {
          // Show visual feedback if there's a blocking connection
          if (validation.blockingConnection) {
            showBlockingFeedback(validation.blockingMilestoneId, validation.blockingConnection);
          }
          
          // Auto-select the blocking milestone along with the milestones being moved (if enabled)
          if (autoSelectBlocking) {
            setSelectedMilestones(prev => {
              const newSet = new Set(prev);
              // Add all milestones that were being moved
              for (const mId of milestonesToMove) {
                newSet.add(mId);
              }
              // Add the blocking milestone
              newSet.add(validation.blockingMilestoneId);
              return newSet;
            });
          }
        }
        
        // Revert all milestones to their original positions
        setMilestones(prev => {
          const updated = { ...prev };
          for (const mId of milestonesToMove) {
            const initial = initialPositions[mId];
            if (initial) {
              updated[mId] = {
                ...updated[mId],
                x: undefined, // Clear visual X
              };
            }
          }
          return updated;
        });
        return;
      }

      // Move is valid - snap all milestones to their final positions
      setMilestones(prev => {
        const updated = { ...prev };
        for (const mId of milestonesToMove) {
          const initial = initialPositions[mId];
          if (initial) {
            const newIndex = Math.max(0, initial.startIndex + currentDeltaIndex);
            updated[mId] = {
              ...updated[mId],
              start_index: newIndex,
              x: undefined, // Clear visual X so it uses start_index * DAYWIDTH
            };
          }
        }
        return updated;
      });

      // Save all changes if any position changed
      const savePromises = [];
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (initial) {
          const newIndex = Math.max(0, initial.startIndex + currentDeltaIndex);
          if (newIndex !== initial.startIndex) {
            savePromises.push(
              update_start_index(projectId, mId, newIndex).catch(err => {
                console.error(`Failed to update milestone ${mId} position:`, err);
              })
            );
          }
        }
      }
      
      if (savePromises.length > 0) {
        await Promise.all(savePromises);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle milestone delete
  const handleMilestoneDelete = async (milestoneId) => {
    if (!milestoneId) {
      console.error("No milestone ID provided for deletion");
      return;
    }
    
    try {
      await delete_milestone(projectId, milestoneId);
      
      // Remove from milestones state
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

      // Remove connections involving this milestone
      setConnections(prev => prev.filter(c => c.source !== milestoneId && c.target !== milestoneId));
      
      // Clear selection if deleted milestone was selected
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

  // Handle milestone click (selection) - supports multi-select with Ctrl/Cmd
  const handleMilestoneClick = (e, milestoneId) => {
    e.stopPropagation();
    
    // Skip click handling if we just finished dragging (prevents resetting selection after blocked move)
    if (justDraggedRef.current) {
      return;
    }
    
    if (e.ctrlKey || e.metaKey) {
      // Multi-select: toggle this milestone in selection
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
      // Single click: select only this milestone (or deselect if already selected alone)
      setSelectedMilestones(prev => {
        if (prev.size === 1 && prev.has(milestoneId)) {
          return new Set();
        }
        return new Set([milestoneId]);
      });
    }
  };

  // Check if a move would violate incoming dependencies
  // Returns { valid: true } or { valid: false, blockingConnection, blockingMilestone }
  const validateMilestoneMove = (milestoneId, newStartIndex) => {
    // Find all incoming connections (where this milestone is the target)
    const incomingConnections = connections.filter(c => c.target === milestoneId);
    
    for (const conn of incomingConnections) {
      const sourceMilestone = milestones[conn.source];
      if (!sourceMilestone) continue;
      
      // Source must finish (end) before target starts
      // Source end day = source.start_index + source.duration - 1
      // Target start day = newStartIndex
      // For valid dependency: source end < target start
      const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;
      
      if (sourceEndIndex >= newStartIndex) {
        return {
          valid: false,
          blockingConnection: conn,
          blockingMilestoneId: conn.source,
          reason: `Dependency from "${sourceMilestone.name}" must finish before this milestone can start`
        };
      }
    }
    
    return { valid: true };
  };

  // Check if moving multiple milestones by a delta would be valid
  // Skip checking dependencies where the source milestone is also being moved
  const validateMultiMilestoneMove = (milestoneIds, deltaIndex) => {
    const movingSet = new Set(milestoneIds);
    
    for (const milestoneId of milestoneIds) {
      const milestone = milestones[milestoneId];
      if (!milestone) continue;
      
      const newStartIndex = milestone.start_index + deltaIndex;
      if (newStartIndex < 0) {
        return { valid: false, reason: "Cannot move before project start", blockingMilestoneId: milestoneId };
      }
      
      // Check incoming connections, but skip ones where source is also moving
      const incomingConnections = connections.filter(c => c.target === milestoneId);
      
      for (const conn of incomingConnections) {
        // Skip if source milestone is also being moved (dependency will move with it)
        if (movingSet.has(conn.source)) continue;
        
        const sourceMilestone = milestones[conn.source];
        if (!sourceMilestone) continue;
        
        // Source must finish (end) before target starts
        const sourceEndIndex = sourceMilestone.start_index + (sourceMilestone.duration || 1) - 1;
        
        if (sourceEndIndex >= newStartIndex) {
          return {
            valid: false,
            blockingConnection: conn,
            blockingMilestoneId: conn.source,
            reason: `Dependency from "${sourceMilestone.name}" must finish before this milestone can start`
          };
        }
      }
    }
    return { valid: true };
  };

  // Show blocking feedback with temporary expansion of hidden/collapsed items and filter clearing
  const showBlockingFeedback = (blockingMilestoneId, connectionId) => {
    const milestone = milestones[blockingMilestoneId];
    if (!milestone) return;
    
    const taskId = milestone.task;
    const task = tasks[taskId];
    if (!task) return;
    
    const teamId = task.team;
    
    // Store original states (including filter)
    const originalState = {
      taskHidden: taskDisplaySettings[taskId]?.hidden || false,
      taskSize: taskDisplaySettings[taskId]?.size || 'normal',
      teamCollapsed: teamDisplaySettings[teamId]?.collapsed || false,
      teamFilterActive: teamFilter.length > 0 && !teamFilter.includes(teamId),
      originalTeamFilter: [...teamFilter],
    };
    
    // Temporarily show the milestone - clear filter if it's hiding this team
    if (originalState.teamFilterActive) {
      // Add this team temporarily to the filter so it becomes visible
      setTeamFilter(prev => [...prev, teamId]);
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
    if (originalState.teamCollapsed) {
      setTeamDisplaySettings(prev => ({
        ...prev,
        [teamId]: { ...prev[teamId], collapsed: false }
      }));
    }
    
    // Set the highlight state
    setBlockedMoveHighlight({
      milestoneId: blockingMilestoneId,
      connectionSource: connectionId?.source,
      connectionTarget: connectionId?.target,
    });
    
    // Restore original state after 2 seconds
    setTimeout(() => {
      setBlockedMoveHighlight(null);
      
      if (originalState.teamFilterActive) {
        setTeamFilter(originalState.originalTeamFilter);
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
      if (originalState.teamCollapsed) {
        setTeamDisplaySettings(prev => ({
          ...prev,
          [teamId]: { ...prev[teamId], collapsed: true }
        }));
      }
    }, 2000);
  };

  // Handle milestone double click (rename)
  const handleMilestoneDoubleClick = (e, milestone) => {
    e.stopPropagation();
    setEditingMilestoneId(milestone.id);
    setEditingMilestoneName(milestone.name);
  };

  // Handle milestone rename submit
  const handleMilestoneRenameSubmit = async (milestoneId, editingMilestoneName) => {
    if (!editingMilestoneName.trim()) {
      setEditingMilestoneId(null);
      setEditingMilestoneName("");
      return;
    }

    try {
      await rename_milestone(projectId, milestoneId, editingMilestoneName.trim());
      
      setMilestones(prev => ({
        ...prev,
        [milestoneId]: {
          ...prev[milestoneId],
          name: editingMilestoneName.trim()
        }
      }));
    } catch (err) {
      console.error("Failed to rename milestone:", err);
    }

    setEditingMilestoneId(null);
    setEditingMilestoneName("");
  };

  // Handle milestone edge resize
  const handleMilestoneEdgeResize = (e, milestoneId, edge) => {
    if (safeMode) return;
    e.stopPropagation();
    e.preventDefault();

    const milestone = milestones[milestoneId];
    if (!milestone) return;

    const startX = e.clientX;
    const startDuration = milestone.duration;
    const startIndex = milestone.start_index;

    // Track current values in closure variables
    let currentDuration = startDuration;
    let currentStartIndex = startIndex;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const indexDelta = Math.round(deltaX / DAYWIDTH);

      if (edge === "right") {
        currentDuration = Math.max(1, startDuration + indexDelta);
        setMilestones(prev => ({
          ...prev,
          [milestoneId]: { ...prev[milestoneId], duration: currentDuration }
        }));
      } else if (edge === "left") {
        currentStartIndex = Math.max(0, startIndex + indexDelta);
        const durationChange = startIndex - currentStartIndex;
        currentDuration = Math.max(1, startDuration + durationChange);
        setMilestones(prev => ({
          ...prev,
          [milestoneId]: { 
            ...prev[milestoneId], 
            start_index: currentStartIndex,
            duration: currentDuration 
          }
        }));
      }
    };

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Save duration change if it changed
      const durationChange = currentDuration - startDuration;
      if (durationChange !== 0) {
        try {
          await change_duration(projectId, milestoneId, durationChange);
        } catch (err) {
          console.error("Failed to change duration:", err);
        }
      }

      // Save start index change if it changed (only for left edge)
      if (edge === "left" && currentStartIndex !== startIndex) {
        try {
          await update_start_index(projectId, milestoneId, currentStartIndex);
        } catch (err) {
          console.error("Failed to update start index:", err);
        }
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Handle day cell click (create milestone)
  const handleDayCellClick = (taskId, dayIndex) => {
    // Show confirmation modal instead of creating directly
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

    // Set both start and end to the same initial position to avoid jump to (0,0)
    setConnectionStart({
      milestoneId,
      handleType,
      x: initialX,
      y: initialY,
    });
    setConnectionEnd({ x: initialX, y: initialY });
    setIsDraggingConnection(true);

    // Use requestAnimationFrame for smoother updates
    let rafId = null;
    let lastX = initialX;
    let lastY = initialY;

    const onMouseMove = (moveEvent) => {
      // Re-get container rect in case it moved (scrolling, etc.)
      const currentRect = teamContainerRef.current?.getBoundingClientRect();
      if (!currentRect) return;
      
      lastX = moveEvent.clientX - currentRect.left;
      lastY = moveEvent.clientY - currentRect.top;
      
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          setConnectionEnd({ x: lastX, y: lastY });
          rafId = null;
        });
      }
    };

    const onMouseUp = async (upEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Re-get container rect for accurate position calculation
      const currentRect = teamContainerRef.current?.getBoundingClientRect();
      if (!currentRect) {
        setIsDraggingConnection(false);
        setConnectionStart(null);
        return;
      }

      // Find if we're over a milestone handle
      const targetMilestone = findMilestoneAtPosition(
        upEvent.clientX - currentRect.left,
        upEvent.clientY - currentRect.top
      );

      if (targetMilestone && targetMilestone.id !== milestoneId) {
        const sourceId = handleType === "source" ? milestoneId : targetMilestone.id;
        const targetId = handleType === "source" ? targetMilestone.id : milestoneId;

        // Check if connection already exists
        const exists = connections.some(c => c.source === sourceId && c.target === targetId);
        if (!exists) {
          try {
            await create_dependency(projectId, sourceId, targetId);
            setConnections(prev => [...prev, { source: sourceId, target: targetId }]);
          } catch (err) {
            console.error("Failed to create dependency:", err);
          }
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

      const taskHeight = getTaskHeight(milestone.task, taskDisplaySettings);
      const teamYOffset = getTeamYOffset(task.team);
      const taskYOffset = getTaskYOffset(milestone.task, task.team);
      const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      const milestoneX = TEAMWIDTH + TASKWIDTH + milestone.start_index * DAYWIDTH;
      // Calculate actual top Y position (not center)
      const milestoneTopY = teamYOffset + dropHighlightOffset + headerOffset + taskYOffset;
      const milestoneWidth = DAYWIDTH * milestone.duration;

      if (
        x >= milestoneX - 10 &&
        x <= milestoneX + milestoneWidth + 10 &&
        y >= milestoneTopY &&
        y <= milestoneTopY + taskHeight
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

    const taskHeight = getTaskHeight(milestone.task, taskDisplaySettings);
    const teamYOffset = getTeamYOffset(task.team);
    const taskYOffset = getTaskYOffset(milestone.task, task.team);
    const dropHighlightOffset = TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    const headerOffset = TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

    const milestoneX = TEAMWIDTH + TASKWIDTH + (milestone.x ?? milestone.start_index * DAYWIDTH);
    const milestoneY = teamYOffset + dropHighlightOffset + headerOffset + taskYOffset + taskHeight / 2;
    const milestoneWidth = DAYWIDTH * milestone.duration;

    if (handleType === "source") {
      return { x: milestoneX + milestoneWidth, y: milestoneY };
    } else {
      return { x: milestoneX, y: milestoneY };
    }
  };

  // Handle connection click - just select/deselect
  const handleConnectionClick = (e, connection) => {
    e.stopPropagation();
    if (selectedConnection?.source === connection.source && selectedConnection?.target === connection.target) {
      setSelectedConnection(null);
    } else {
      setSelectedConnection(connection);
    }
  };

  // Handle delete connection
  const handleDeleteConnection = async (connection) => {
    if (!connection) {
      console.error("No connection provided for deletion");
      return;
    }
    
    try {
      await delete_dependency_api(projectId, connection.source, connection.target);
      
      // Remove from connections state
      setConnections(prev => prev.filter(c => 
        !(c.source === connection.source && c.target === connection.target)
      ));
      
      // Clear selection
      setSelectedConnection(null);
    } catch (err) {
      console.error("Failed to delete dependency:", err);
      throw err;
    }
  };

  // Return all handlers
  return {
    // Transient interaction state
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
    
    // Position helpers
    findMilestoneAtPosition,
    getMilestoneHandlePosition,
    
    // Feedback
    showBlockingFeedback,
  };
}
