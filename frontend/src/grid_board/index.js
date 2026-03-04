// grid_board — barrel export
// Generic reusable grid board component + Milestone/Team/Task adapter.

export { default as DependencyGrid } from './DependencyGrid';
export { default as MilestoneScheduleAdapter } from './MilestoneScheduleAdapter';

// Context
export { GridBoardProvider, useGridBoardContext } from './GridBoardContext';

// Hooks
export { useColumnManagement } from './useColumnManagement';
export { useDisplaySettings } from './useDisplaySettings';
export { usePhaseManagement } from './usePhaseManagement';
export { useViewManagement } from './useViewManagement';
export { useSafetyCheck, runSafetyChecks } from './useSafetyCheck';
export { useGridInteraction } from './useGridInteraction';
export { useGridActions } from './useGridActions';
export { useGridUIState } from './useGridUIState';
export { useGridWarnings } from './useGridWarnings';
export { useDragInteractions } from './useDragInteractions';
export { useNodeInteractions } from './useNodeInteractions';
export { useEdgeInteractions } from './useEdgeInteractions';

// UI components
export { default as GridToolbar } from './GridToolbar';
export { default as GridModals } from './GridModals';
export { default as GridCanvas } from './GridCanvas';
export { default as GridWarningToast } from './GridWarningToast';
export { default as SafetyCheckPanel } from './SafetyCheckPanel';
export { default as GridRowSelectionBar } from './GridRowSelectionBar';
export { default as GridNodeLayer } from './GridNodeLayer';
export { default as GridLaneList } from './GridLaneList';
export { default as GridColumnGrid } from './GridColumnGrid';

// Utilities
export * from './types';
export * from './layoutMath';
export * from './gridValidation';
export * from './viewDefaults';
