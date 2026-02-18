// Backend operations and state mutation logic for Dependencies
import {
  add_milestone,
  update_start_index,
  set_day_purpose,
  reorder_team_tasks,
  delete_milestone,
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
  };
}
