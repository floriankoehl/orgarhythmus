import { useState, useRef } from 'react';

export function useDependencyUIState() {
  // Milestone selection/hover state
  const [hoveredMilestone, setHoveredMilestone] = useState(null);
  const [selectedMilestones, setSelectedMilestones] = useState(new Set());
  
  // Connection selection state
  const [selectedConnection, setSelectedConnection] = useState(null);
  
  // View mode: "inspection" (default, view only), "schedule" (move milestones), "dependency" (edit connections), or "milestone" (edit milestones)
  const [viewMode, setViewMode] = useState("inspection");
  
  // Store the base viewMode for when no modifier keys are held
  const baseViewModeRef = useRef(viewMode);
  
  // Auto-select blocking milestone on failed move
  const [autoSelectBlocking, setAutoSelectBlocking] = useState(true);
  
  // Milestone editing state
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [editingMilestoneName, setEditingMilestoneName] = useState("");

  return {
    hoveredMilestone,
    setHoveredMilestone,
    selectedMilestones,
    setSelectedMilestones,
    selectedConnection,
    setSelectedConnection,
    viewMode,
    setViewMode,
    baseViewModeRef,
    autoSelectBlocking,
    setAutoSelectBlocking,
    editingMilestoneId,
    setEditingMilestoneId,
    editingMilestoneName,
    setEditingMilestoneName,
  };
}