/**
 * Custom hook for managing saved views, snapshots, and view transitions
 * 
 * Consolidates view persistence and animation state.
 */

import { useState, useRef } from 'react';

export function useViewState() {
  // View transition animation
  const [viewTransition, setViewTransition] = useState(null); // 'out' | 'in-start' | 'in' | null
  const viewTransitionRef = useRef(null);
  const [viewFlashName, setViewFlashName] = useState(null);
  const viewFlashTimerRef = useRef(null);
  const viewFlashCounterRef = useRef(0);
  
  // Saved views (frontend state snapshots)
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState(null); // null = Default view
  const [activeViewName, setActiveViewName] = useState("Default");
  
  // Project snapshots (full data + view state backups)
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  
  // Popup close signal
  const [popupCloseSignal, setPopupCloseSignal] = useState(0);
  
  return {
    // View transitions
    viewTransition,
    setViewTransition,
    viewTransitionRef,
    viewFlashName,
    setViewFlashName,
    viewFlashTimerRef,
    viewFlashCounterRef,
    
    // Saved views
    savedViews,
    setSavedViews,
    activeViewId,
    setActiveViewId,
    activeViewName,
    setActiveViewName,
    
    // Snapshots
    snapshots,
    setSnapshots,
    snapshotsLoading,
    setSnapshotsLoading,
    
    // Popup control
    popupCloseSignal,
    setPopupCloseSignal,
  };
}
