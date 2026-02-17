import { useDependency } from './DependencyContext.jsx';

// Thin accessor layer - UI state is owned by DependencyContext
export function useDependencyUIState() {
  const {
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
    warningDuration,
    setWarningDuration,
    editingMilestoneId,
    setEditingMilestoneId,
    editingMilestoneName,
    setEditingMilestoneName,
  } = useDependency();

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
    warningDuration,
    setWarningDuration,
    editingMilestoneId,
    setEditingMilestoneId,
    editingMilestoneName,
    setEditingMilestoneName,
  };
}