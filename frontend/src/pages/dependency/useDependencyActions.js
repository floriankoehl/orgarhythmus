// Backend operations and state mutation logic for Dependencies
import {
  add_milestone,
  update_start_index,
  set_day_purpose,
  reorder_team_tasks,
} from '../../api/dependencies_api.js';
import {
  createTeamForProject,
  createTaskForProject,
} from '../../api/org_API.js';
import { isTaskVisible } from './layoutMath';
import { useDependency } from './DependencyContext.jsx';

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
    selectedConnection,
    setSelectedConnection,
    selectedMilestones,
    setSelectedMilestones,
  } = useDependency();

  // ________DAY PURPOSE HANDLERS________
  // ________________________________________

  const handleSaveDayPurpose = async () => {
    if (!dayPurposeModal) return;
    
    try {
      const result = await set_day_purpose(projectId, dayPurposeModal.dayIndex, newDayPurpose);
      if (result.success) {
        setProjectDays(prev => ({
          ...prev,
          [dayPurposeModal.dayIndex]: result.day
        }));
      }
    } catch (err) {
      console.error("Failed to save day purpose:", err);
    }
    
    setDayPurposeModal(null);
    setNewDayPurpose("");
  };

  const handleClearDayPurpose = async () => {
    if (!dayPurposeModal) return;
    
    try {
      const result = await set_day_purpose(projectId, dayPurposeModal.dayIndex, null);
      if (result.success) {
        setProjectDays(prev => ({
          ...prev,
          [dayPurposeModal.dayIndex]: result.day
        }));
      }
    } catch (err) {
      console.error("Failed to clear day purpose:", err);
    }
    
    setDayPurposeModal(null);
    setNewDayPurpose("");
  };

  // ________MILESTONE HANDLERS________
  // ________________________________________

  // Add milestone locally
  const addMilestoneLocal = async (taskId) => {
    try {
      const result = await add_milestone(projectId, taskId);
      if (result.added_milestone) {
        setMilestones(prev => ({
          ...prev,
          [result.added_milestone.id]: { ...result.added_milestone, display: "default" }
        }));
        // Update tasks to include the new milestone
        setTasks(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            milestones: [...(prev[taskId]?.milestones || []), result.added_milestone]
          }
        }));
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
        // Update the milestone with the correct start index
        await update_start_index(projectId, result.added_milestone.id, dayIndex);
        
        const newMilestone = { ...result.added_milestone, start_index: dayIndex, display: "default" };
        
        setMilestones(prev => ({
          ...prev,
          [result.added_milestone.id]: newMilestone
        }));
        
        setTasks(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            milestones: [...(prev[taskId]?.milestones || []), newMilestone]
          }
        }));
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
    } catch (err) {
      console.error("Failed to move task:", err);
    }
    
    setMoveModal(null);
  };

  // ________DELETE HANDLER________
  // ________________________________________

  // Handle delete for selected items (called from toolbar) - shows modal first
  const handleDeleteSelected = () => {
    if (selectedConnection) {
      // Show confirmation modal for dependency deletion
      setDeleteConfirmModal({
        connectionId: true,
        connectionName: `Dependency`,
        connection: selectedConnection,
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
      // Delete connection
      try {
        const connection = deleteConfirmModal.connection || selectedConnection;
        await handleDeleteConnection(connection);
        setSelectedConnection(null);
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
