// Backend operations and state mutation logic for Dependencies
import {
  add_milestone,
  update_start_index,
  set_task_deadline,
  set_day_purpose,
  reorder_team_tasks,
  delete_milestone,
  create_dependency,
  delete_dependency_api as delete_dependency,
  update_dependency,
  change_duration,
  move_milestone_task,
} from '../../api/dependencies_api.js';
import {
  createTeamForProject,
  createTaskForProject,
} from '../../api/org_API.js';
import { isTaskVisible } from './layoutMath';
import { useDependency } from './DependencyContext.jsx';
import { playSound } from '../../assets/sound_registry';

/**
 * Custom hook for backend operations and state mutations in the Dependencies component.
 */
export function useDependencyActions({
  // Data state
  teams,
  taskDisplaySettings,
  
  // Modal state values
  dayPurposeModal,
  milestoneCreateModal,
  moveModal,
  deleteConfirmModal,
  
  // Form state values
  newDayPurpose,
  newDayPurposeTeams,
  newTeamName,
  newTeamColor,
  newTaskName,
  newTaskTeamId,
  
  // Data state setters
  setProjectDays,
  setMilestones,
  setTasks,
  setTeams,
  setReloadData,
  
  // Modal state setters
  setDayPurposeModal,
  setMilestoneCreateModal,
  setMoveModal,
  setDeleteConfirmModal,
  setIsAddingMilestone,
  
  // Form state setters
  setNewDayPurpose,
  setNewDayPurposeTeams,
  setNewTeamName,
  setNewTeamColor,
  setNewTaskName,
  setNewTaskTeamId,
  setShowCreateTeamModal,
  setShowCreateTaskModal,
  setIsCreating,
  
  // Layout helpers
  getVisibleTasks,
  
  // Interaction handlers (from useDependencyInteraction)
  handleDeleteConnection,
  handleMilestoneDelete,
  handleUpdateConnection,    // needed for handleWeakDepConvert / handleBulkUpdateConnections

  // Modal state for suggestion-offer flow
  suggestionOfferModal,
  setSuggestionOfferModal,

  // Additional data setters for service-layer handlers
  setConnections,
  
  // Computed
  safeMode,
}) {

  // Get shared state from context
  const {
    projectId,
    selectedConnections,
    setSelectedConnections,
    selectedMilestones,
    setSelectedMilestones,
    pushAction,
  } = useDependency();

  // ________DAY PURPOSE HANDLERS________
  // ________________________________________

  const handleSaveDayPurpose = async () => {
    if (!dayPurposeModal) return;
    
    // Capture old day data for undo (need to read current projectDays)
    const dayIdx = dayPurposeModal.dayIndex;
    const savePurpose = newDayPurpose;
    const savePurposeTeams = newDayPurposeTeams;

    try {
      // Capture old value before saving
      let oldPurpose = null;
      let oldPurposeTeams = null;
      setProjectDays(prev => {
        const oldDay = prev[dayIdx];
        if (oldDay) {
          oldPurpose = oldDay.purpose || null;
          oldPurposeTeams = oldDay.purpose_teams || null;
        }
        return prev;
      });

      const result = await set_day_purpose(projectId, dayIdx, savePurpose, savePurposeTeams);
      if (result.success) {
        setProjectDays(prev => ({
          ...prev,
          [dayIdx]: result.day
        }));

        pushAction({
          description: 'Set day purpose',
          undo: async () => {
            const r = await set_day_purpose(projectId, dayIdx, oldPurpose, oldPurposeTeams);
            if (r.success) setProjectDays(prev => ({ ...prev, [dayIdx]: r.day }));
          },
          redo: async () => {
            const r = await set_day_purpose(projectId, dayIdx, savePurpose, savePurposeTeams);
            if (r.success) setProjectDays(prev => ({ ...prev, [dayIdx]: r.day }));
          },
        });
      }
    } catch (err) {
      console.error("Failed to save day purpose:", err);
    }
    
    playSound('settingToggle');
    setDayPurposeModal(null);
    setNewDayPurpose("");
    setNewDayPurposeTeams(null);
  };

  const handleClearDayPurpose = async () => {
    if (!dayPurposeModal) return;
    
    const dayIdx = dayPurposeModal.dayIndex;

    try {
      // Capture old value
      let oldPurpose = null;
      let oldPurposeTeams = null;
      setProjectDays(prev => {
        const oldDay = prev[dayIdx];
        if (oldDay) {
          oldPurpose = oldDay.purpose || null;
          oldPurposeTeams = oldDay.purpose_teams || null;
        }
        return prev;
      });

      const result = await set_day_purpose(projectId, dayIdx, null, null);
      if (result.success) {
        setProjectDays(prev => ({
          ...prev,
          [dayIdx]: result.day
        }));

        pushAction({
          description: 'Clear day purpose',
          undo: async () => {
            const r = await set_day_purpose(projectId, dayIdx, oldPurpose, oldPurposeTeams);
            if (r.success) setProjectDays(prev => ({ ...prev, [dayIdx]: r.day }));
          },
          redo: async () => {
            const r = await set_day_purpose(projectId, dayIdx, null, null);
            if (r.success) setProjectDays(prev => ({ ...prev, [dayIdx]: r.day }));
          },
        });
      }
      playSound('settingToggle');
    } catch (err) {
      console.error("Failed to clear day purpose:", err);
    }
    
    setDayPurposeModal(null);
    setNewDayPurpose("");
    setNewDayPurposeTeams(null);
  };

  // ________MILESTONE HANDLERS________
  // ________________________________________

  // Add milestone locally
  const addMilestoneLocal = async (taskId) => {
    try {
      const result = await add_milestone(projectId, taskId);
      if (result.added_milestone) {
        const newId = result.added_milestone.id;
        setMilestones(prev => ({
          ...prev,
          [newId]: { ...result.added_milestone, display: "default" }
        }));
        // Update tasks to include the new milestone
        setTasks(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            milestones: [...(prev[taskId]?.milestones || []), result.added_milestone]
          }
        }));
        playSound('milestoneCreate');

        pushAction({
          description: 'Add milestone',
          undo: async () => {
            await delete_milestone(projectId, newId);
            setMilestones(prev => { const u = { ...prev }; delete u[newId]; return u; });
            setTasks(prev => ({
              ...prev,
              [taskId]: { ...prev[taskId], milestones: (prev[taskId]?.milestones || []).filter(m => m.id !== newId) }
            }));
          },
          redo: async () => {
            const r = await add_milestone(projectId, taskId);
            if (r.added_milestone) {
              setMilestones(prev => ({ ...prev, [r.added_milestone.id]: { ...r.added_milestone, display: "default" } }));
              setTasks(prev => ({
                ...prev,
                [taskId]: { ...prev[taskId], milestones: [...(prev[taskId]?.milestones || []), r.added_milestone] }
              }));
            }
          },
        });
      }
    } catch (err) {
      console.error("Failed to add milestone:", err);
    }
  };

  // Confirm milestone creation
  const confirmMilestoneCreate = async () => {
    if (!milestoneCreateModal) return;
    
    const { taskId, dayIndex } = milestoneCreateModal;
    
    try {
      const result = await add_milestone(projectId, taskId);
      if (result.added_milestone) {
        const newId = result.added_milestone.id;
        // Update the milestone with the correct start index
        await update_start_index(projectId, newId, dayIndex);
        
        const newMilestone = { ...result.added_milestone, start_index: dayIndex, display: "default" };
        
        setMilestones(prev => ({
          ...prev,
          [newId]: newMilestone
        }));
        
        setTasks(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            milestones: [...(prev[taskId]?.milestones || []), newMilestone]
          }
        }));
        playSound('milestoneCreate');

        pushAction({
          description: 'Create milestone at day',
          undo: async () => {
            await delete_milestone(projectId, newId);
            setMilestones(prev => { const u = { ...prev }; delete u[newId]; return u; });
            setTasks(prev => ({
              ...prev,
              [taskId]: { ...prev[taskId], milestones: (prev[taskId]?.milestones || []).filter(m => m.id !== newId) }
            }));
          },
          redo: async () => {
            const r = await add_milestone(projectId, taskId);
            if (r.added_milestone) {
              await update_start_index(projectId, r.added_milestone.id, dayIndex);
              const ms = { ...r.added_milestone, start_index: dayIndex, display: "default" };
              setMilestones(prev => ({ ...prev, [r.added_milestone.id]: ms }));
              setTasks(prev => ({
                ...prev,
                [taskId]: { ...prev[taskId], milestones: [...(prev[taskId]?.milestones || []), ms] }
              }));
            }
          },
        });
      }
    } catch (err) {
      console.error("Failed to create milestone:", err);
    }
    
    setMilestoneCreateModal(null);
    setIsAddingMilestone(false);
  };

  // ________TASK MOVE HANDLER________
  // ________________________________________

  // Handle confirm move (cross-team task move)
  const handleConfirmMove = async () => {
    const { taskId, sourceTeamId, targetTeamId, insertIndex } = moveModal;
    
    // Capture old state for undo
    const oldSourceTasks = [...teams[sourceTeamId].tasks];
    const oldTargetTasks = [...teams[targetTeamId].tasks];
    const oldTaskTeam = sourceTeamId; // task is currently in source team

    // Remove task from source team
    const sourceTeam = teams[sourceTeamId];
    const newSourceTasks = sourceTeam.tasks.filter(id => id !== taskId);
    
    // Add task to target team at the specified index
    const targetTeam = teams[targetTeamId];
    const visibleTasks = getVisibleTasks(targetTeamId);
    
    // Calculate actual insert position
    let actualInsertIndex = 0;
    let visibleCount = 0;
    for (let i = 0; i < targetTeam.tasks.length; i++) {
      if (isTaskVisible(targetTeam.tasks[i], taskDisplaySettings)) {
        if (visibleCount === insertIndex) {
          actualInsertIndex = i;
          break;
        }
        visibleCount++;
      }
      actualInsertIndex = i + 1;
    }
    
    const newTargetTasks = [...targetTeam.tasks];
    newTargetTasks.splice(actualInsertIndex, 0, taskId);
    
    // Update local state
    setTeams(prev => ({
      ...prev,
      [sourceTeamId]: { ...prev[sourceTeamId], tasks: newSourceTasks },
      [targetTeamId]: { ...prev[targetTeamId], tasks: newTargetTasks }
    }));
    
    // Update tasks state - update the task's team reference
    setTasks(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], team: targetTeamId }
    }));
    
    // Save to backend
    try {
      await reorder_team_tasks(projectId, taskId, targetTeamId, newTargetTasks);
      playSound('taskDragDrop');

      pushAction({
        description: 'Move task cross-team',
        undo: async () => {
          setTeams(prev => ({
            ...prev,
            [sourceTeamId]: { ...prev[sourceTeamId], tasks: oldSourceTasks },
            [targetTeamId]: { ...prev[targetTeamId], tasks: oldTargetTasks },
          }));
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], team: oldTaskTeam } }));
          await reorder_team_tasks(projectId, taskId, sourceTeamId, oldSourceTasks);
        },
        redo: async () => {
          setTeams(prev => ({
            ...prev,
            [sourceTeamId]: { ...prev[sourceTeamId], tasks: newSourceTasks },
            [targetTeamId]: { ...prev[targetTeamId], tasks: newTargetTasks },
          }));
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], team: targetTeamId } }));
          await reorder_team_tasks(projectId, taskId, targetTeamId, newTargetTasks);
        },
      });
    } catch (err) {
      console.error("Failed to move task:", err);
    }
    
    setMoveModal(null);
  };

  // ________DELETE HANDLER________
  // ________________________________________

  // Handle delete for selected items (called from toolbar) - shows modal first
  const handleDeleteSelected = () => {
    if (selectedConnections.length > 0) {
      // Show confirmation modal for dependency deletion
      setDeleteConfirmModal({
        connectionId: true,
        connectionName: `Dependency`,
        connections: [...selectedConnections],
      });
    } else if (selectedMilestones.size > 0) {
      // Show confirmation modal for milestone deletion
      const milestoneIds = Array.from(selectedMilestones);
      if (milestoneIds.length === 1) {
        const milestoneId = milestoneIds[0];
        setDeleteConfirmModal({
          milestoneId,
          milestoneName: "this milestone",
        });
      } else {
        setDeleteConfirmModal({
          milestoneIds,
        });
      }
    }
  };

  // Handle confirm delete (from modal)
  const handleConfirmDelete = async () => {
    if (deleteConfirmModal?.connectionId) {
      // Delete connection(s)
      try {
        const conns = deleteConfirmModal.connections || selectedConnections;
        for (const connection of conns) {
          await handleDeleteConnection(connection);
        }
        setSelectedConnections([]);
      } catch (err) {
        console.error("Failed to delete dependency:", err);
      }
    } else if (deleteConfirmModal?.milestoneIds) {
      // Delete multiple milestones
      for (const mId of deleteConfirmModal.milestoneIds) {
        try {
          await handleMilestoneDelete(mId);
        } catch (err) {
          console.error("Failed to delete milestone:", err);
        }
      }
      setSelectedMilestones(new Set());
    } else if (deleteConfirmModal?.milestoneId) {
      // Delete single milestone
      try {
        await handleMilestoneDelete(deleteConfirmModal.milestoneId);
      } catch (err) {
        console.error("Failed to delete milestone:", err);
      }
    }
    setDeleteConfirmModal(null);
  };

  // ________CREATE HANDLERS________
  // ________________________________________

  // Handle create team
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createTeamForProject(projectId, {
        name: newTeamName.trim(),
        color: newTeamColor,
      });
      if (result) {
        setReloadData(true);
        setShowCreateTeamModal(false);
        setNewTeamName("");
        setNewTeamColor("#facc15");
        playSound('uiClick');
      }
    } catch (err) {
      console.error("Failed to create team:", err);
    }
    setIsCreating(false);
  };

  // Handle create task
  const handleCreateTask = async () => {
    if (!newTaskName.trim() || !newTaskTeamId) return;
    setIsCreating(true);
    try {
      const result = await createTaskForProject(projectId, {
        name: newTaskName.trim(),
        team_id: newTaskTeamId,
      });
      if (result) {
        setReloadData(true);
        setShowCreateTaskModal(false);
        setNewTaskName("");
        setNewTaskTeamId(null);
        playSound('uiClick');
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    }
    setIsCreating(false);
  };

  // ________DEADLINE HANDLER________
  // ________________________________________

  const handleSetDeadline = async (taskId, deadlineDayIndex) => {
    let oldDeadline = null;
    setTasks(prev => { oldDeadline = prev[taskId]?.hard_deadline ?? null; return prev; });
    try {
      await set_task_deadline(projectId, taskId, deadlineDayIndex);
      setTasks(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], hard_deadline: deadlineDayIndex },
      }));
      playSound('milestoneMove');
      pushAction({
        description: 'Set deadline',
        undo: async () => {
          await set_task_deadline(projectId, taskId, oldDeadline);
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], hard_deadline: oldDeadline } }));
        },
        redo: async () => {
          await set_task_deadline(projectId, taskId, deadlineDayIndex);
          setTasks(prev => ({ ...prev, [taskId]: { ...prev[taskId], hard_deadline: deadlineDayIndex } }));
        },
      });
    } catch (err) {
      console.error('Failed to set deadline:', err);
    }
  };

  // ________SUGGESTION-OFFER HANDLER________
  // ________________________________________

  const handleSuggestionOfferAccept = async () => {
    if (!suggestionOfferModal) return;
    const { sourceId, targetId } = suggestionOfferModal;
    setSuggestionOfferModal(null);
    try {
      const defaultReason = 'could be before';
      await create_dependency(projectId, sourceId, targetId, { weight: 'suggestion', reason: defaultReason });
      setConnections(prev => [
        ...prev,
        { source: sourceId, target: targetId, weight: 'suggestion', reason: defaultReason },
      ]);
      pushAction({
        description: 'Create dependency (suggestion)',
        undo: async () => {
          await delete_dependency(projectId, sourceId, targetId);
          setConnections(prev => prev.filter(c => !(c.source === sourceId && c.target === targetId)));
        },
        redo: async () => {
          await create_dependency(projectId, sourceId, targetId, { weight: 'suggestion', reason: defaultReason });
          setConnections(prev => [
            ...prev,
            { source: sourceId, target: targetId, weight: 'suggestion', reason: defaultReason },
          ]);
        },
      });
    } catch (err) {
      console.error('Failed to create suggestion dependency:', err);
    }
  };

  // ________BULK CONNECTION UPDATE________
  // ________________________________________

  const handleBulkUpdateConnections = async (conns, updates) => {
    if (!conns || conns.length === 0) return;
    playSound('settingToggle');
    const oldValues = conns.map(c => ({
      source: c.source,
      target: c.target,
      weight: c.weight,
      reason: c.reason,
    }));
    for (const conn of conns) {
      await handleUpdateConnection(conn, updates, { skipHistory: true });
    }
    pushAction({
      description: `Bulk update ${conns.length} dependencies`,
      undo: async () => {
        for (const old of oldValues) {
          await handleUpdateConnection(old, { weight: old.weight, reason: old.reason }, { skipHistory: true });
        }
      },
      redo: async () => {
        for (const conn of conns) {
          await handleUpdateConnection(conn, updates, { skipHistory: true });
        }
      },
    });
  };

  // ________WEAK-DEP CONFLICT HANDLER________
  // ________________________________________

  const handleWeakDepConvert = async (conflictData) => {
    if (!conflictData) return;
    const { weakConnections } = conflictData;
    const convertedConnWeights = weakConnections.map(c => ({ ...c, oldWeight: c.weight || 'weak' }));

    for (const conn of weakConnections) {
      await handleUpdateConnection(conn, { weight: 'suggestion' }, { skipHistory: true });
    }

    if (conflictData.type === 'resize') {
      const { milestonesToResize, initialStates, edge, currentIndexDelta } = conflictData;
      const resizeBefore = {};
      const resizeAfter = {};

      for (const mId of milestonesToResize) {
        const initial = initialStates[mId];
        if (!initial) continue;

        let newStart, newDuration;
        if (edge === 'right') {
          newStart = initial.startIndex;
          newDuration = Math.max(1, initial.duration + currentIndexDelta);
        } else {
          newStart = Math.max(0, initial.startIndex + currentIndexDelta);
          const durationChange = initial.startIndex - newStart;
          newDuration = Math.max(1, initial.duration + durationChange);
        }

        resizeBefore[mId] = { startIndex: initial.startIndex, duration: initial.duration };
        resizeAfter[mId] = { startIndex: newStart, duration: newDuration };

        setMilestones(prev => ({
          ...prev,
          [mId]: { ...prev[mId], start_index: newStart, duration: newDuration },
        }));

        const durationChange = newDuration - initial.duration;
        if (durationChange !== 0) {
          try { await change_duration(projectId, mId, durationChange); } catch (err) { console.error('Failed to change duration:', err); }
        }
        if (edge === 'left' && newStart !== initial.startIndex) {
          try { await update_start_index(projectId, mId, newStart); } catch (err) { console.error('Failed to update start index:', err); }
        }
      }

      pushAction({
        description: 'Weak dep convert + resize',
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
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: c.oldWeight });
            setConnections(prev => prev.map(conn =>
              conn.source === c.source && conn.target === c.target ? { ...conn, weight: c.oldWeight } : conn
            ));
          }
        },
        redo: async () => {
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: 'suggestion' });
            setConnections(prev => prev.map(conn =>
              conn.source === c.source && conn.target === c.target ? { ...conn, weight: 'suggestion' } : conn
            ));
          }
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
    } else {
      // Move path
      const { milestonesToMove, initialPositions, currentDeltaIndex, taskChanges } = conflictData;

      const beforePositions = {};
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (initial) beforePositions[mId] = initial.startIndex;
      }

      const afterPositions = {};
      for (const mId of milestonesToMove) {
        const initial = initialPositions[mId];
        if (!initial) continue;
        const newStart = initial.startIndex + currentDeltaIndex;
        afterPositions[mId] = newStart;
        setMilestones(prev => {
          const { x, ...rest } = prev[mId]; // eslint-disable-line no-unused-vars
          return { ...prev, [mId]: { ...rest, start_index: newStart } };
        });
        try {
          await update_start_index(projectId, mId, newStart);
        } catch (err) {
          console.error('Failed to update start index after weak dep conversion:', err);
        }
      }

      if (taskChanges) {
        for (const [mId, change] of Object.entries(taskChanges)) {
          setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], task: change.to } }));
          setTasks(prev => {
            const updated = { ...prev };
            if (updated[change.from]) {
              updated[change.from] = {
                ...updated[change.from],
                milestones: (updated[change.from].milestones || []).filter(ref => String(ref.id) !== String(mId)),
              };
            }
            if (updated[change.to]) {
              updated[change.to] = {
                ...updated[change.to],
                milestones: [...(updated[change.to].milestones || []), { id: parseInt(mId) || mId }],
              };
            }
            return updated;
          });
          try {
            await move_milestone_task(projectId, mId, change.to);
          } catch (err) {
            console.error('Failed to move milestone task after weak dep conversion:', err);
          }
        }
      }

      pushAction({
        description: 'Weak dep convert + move',
        undo: async () => {
          for (const mId of milestonesToMove) {
            const oldStart = beforePositions[mId];
            if (oldStart === undefined) continue;
            await update_start_index(projectId, mId, oldStart);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: oldStart } }));
          }
          if (taskChanges) {
            for (const [mId, change] of Object.entries(taskChanges)) {
              setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], task: change.from } }));
              setTasks(prev => {
                const updated = { ...prev };
                if (updated[change.to]) {
                  updated[change.to] = {
                    ...updated[change.to],
                    milestones: (updated[change.to].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                  };
                }
                if (updated[change.from]) {
                  updated[change.from] = {
                    ...updated[change.from],
                    milestones: [...(updated[change.from].milestones || []), { id: parseInt(mId) || mId }],
                  };
                }
                return updated;
              });
              await move_milestone_task(projectId, mId, change.from);
            }
          }
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: c.oldWeight });
            setConnections(prev => prev.map(conn =>
              conn.source === c.source && conn.target === c.target ? { ...conn, weight: c.oldWeight } : conn
            ));
          }
        },
        redo: async () => {
          for (const c of convertedConnWeights) {
            await update_dependency(projectId, c.source, c.target, { weight: 'suggestion' });
            setConnections(prev => prev.map(conn =>
              conn.source === c.source && conn.target === c.target ? { ...conn, weight: 'suggestion' } : conn
            ));
          }
          for (const mId of milestonesToMove) {
            const newStart = afterPositions[mId];
            if (newStart === undefined) continue;
            await update_start_index(projectId, mId, newStart);
            setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], start_index: newStart } }));
          }
          if (taskChanges) {
            for (const [mId, change] of Object.entries(taskChanges)) {
              setMilestones(prev => ({ ...prev, [mId]: { ...prev[mId], task: change.to } }));
              setTasks(prev => {
                const updated = { ...prev };
                if (updated[change.from]) {
                  updated[change.from] = {
                    ...updated[change.from],
                    milestones: (updated[change.from].milestones || []).filter(ref => String(ref.id) !== String(mId)),
                  };
                }
                if (updated[change.to]) {
                  updated[change.to] = {
                    ...updated[change.to],
                    milestones: [...(updated[change.to].milestones || []), { id: parseInt(mId) || mId }],
                  };
                }
                return updated;
              });
              await move_milestone_task(projectId, mId, change.to);
            }
          }
        },
      });
    }
  };

  return {
    handleSaveDayPurpose,
    handleClearDayPurpose,
    addMilestoneLocal,
    confirmMilestoneCreate,
    handleConfirmMove,
    handleConfirmDelete,
    handleDeleteSelected,
    handleCreateTeam,
    handleCreateTask,
    handleSetDeadline,
    handleSuggestionOfferAccept,
    handleBulkUpdateConnections,
    handleWeakDepConvert,
  };
}
