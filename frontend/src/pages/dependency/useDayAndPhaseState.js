/**
 * Custom hook for managing day selection, collapsing, and phase states
 * 
 * Consolidates day and phase-related state management.
 */

import { useState, useRef } from 'react';

export function useDayAndPhaseState() {
  // Day selection and collapsing
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [collapsedDays, setCollapsedDays] = useState(new Set());
  const lastSelectedDayRef = useRef(null);
  
  // Team phase row collapse state
  const [collapsedTeamPhaseRows, setCollapsedTeamPhaseRows] = useState(new Set());
  const [collapseAllTeamPhases, setCollapseAllTeamPhases] = useState(false);
  
  return {
    // Day state
    selectedDays,
    setSelectedDays,
    collapsedDays,
    setCollapsedDays,
    lastSelectedDayRef,
    
    // Phase state
    collapsedTeamPhaseRows,
    setCollapsedTeamPhaseRows,
    collapseAllTeamPhases,
    setCollapseAllTeamPhases,
  };
}
