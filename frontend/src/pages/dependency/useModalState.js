/**
 * Custom hook for managing modal states in the dependency view
 * 
 * Consolidates all modal-related state to reduce clutter in the main component.
 */

import { useState } from 'react';

export function useModalState() {
  // Milestone creation
  const [milestoneCreateModal, setMilestoneCreateModal] = useState(null); // { taskId, dayIndex }
  const [hoveredDayCell, setHoveredDayCell] = useState(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  
  // Milestone deletion
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { milestoneId, milestoneName }
  
  // Team/Task creation
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#facc15");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskTeamId, setNewTaskTeamId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Connection editing
  const [connectionEditModal, setConnectionEditModal] = useState(null); // { source, target, weight, reason }
  const [suggestionOfferModal, setSuggestionOfferModal] = useState(null); // { sourceId, targetId }
  
  // Day purpose
  const [dayPurposeModal, setDayPurposeModal] = useState(null); // { dayIndex, currentPurpose, currentPurposeTeams }
  const [newDayPurpose, setNewDayPurpose] = useState("");
  const [newDayPurposeTeams, setNewDayPurposeTeams] = useState(null);
  
  // Phase editing
  const [phaseEditModal, setPhaseEditModal] = useState(null); // { id?, name, start_index, duration, color }
  
  return {
    // Milestone creation
    milestoneCreateModal,
    setMilestoneCreateModal,
    hoveredDayCell,
    setHoveredDayCell,
    isAddingMilestone,
    setIsAddingMilestone,
    
    // Milestone deletion
    deleteConfirmModal,
    setDeleteConfirmModal,
    
    // Team/Task creation
    showCreateTeamModal,
    setShowCreateTeamModal,
    showCreateTaskModal,
    setShowCreateTaskModal,
    newTeamName,
    setNewTeamName,
    newTeamColor,
    setNewTeamColor,
    newTaskName,
    setNewTaskName,
    newTaskTeamId,
    setNewTaskTeamId,
    isCreating,
    setIsCreating,
    
    // Connection editing
    connectionEditModal,
    setConnectionEditModal,
    suggestionOfferModal,
    setSuggestionOfferModal,
    
    // Day purpose
    dayPurposeModal,
    setDayPurposeModal,
    newDayPurpose,
    setNewDayPurpose,
    newDayPurposeTeams,
    setNewDayPurposeTeams,
    
    // Phase editing
    phaseEditModal,
    setPhaseEditModal,
  };
}
