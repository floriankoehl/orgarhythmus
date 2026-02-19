// Day-selection and day-collapse domain logic.
// Extracted from Dependencies.jsx to keep the component a thin composition root.

import { useState, useRef, useCallback } from 'react';
import { playSound } from '../../assets/sound_registry';

/**
 * Manages selected-day and collapsed-day state plus all related actions.
 *
 * @param {number} days - Total number of project days
 * @returns All day-management state values and action callbacks
 */
export function useDayManagement(days) {
  const [selectedDays, setSelectedDays] = useState(new Set());
  const [collapsedDays, setCollapsedDays] = useState(new Set());
  const lastSelectedDayRef = useRef(null);

  // ── Day selection ──

  const handleDaySelect = useCallback((dayIndex, event) => {
    playSound('uiClick');
    if (event?.shiftKey && lastSelectedDayRef.current !== null) {
      const start = Math.min(lastSelectedDayRef.current, dayIndex);
      const end = Math.max(lastSelectedDayRef.current, dayIndex);
      setSelectedDays(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (event?.ctrlKey || event?.metaKey) {
      setSelectedDays(prev => {
        const next = new Set(prev);
        if (next.has(dayIndex)) next.delete(dayIndex);
        else next.add(dayIndex);
        return next;
      });
    } else {
      setSelectedDays(prev => {
        if (prev.size === 1 && prev.has(dayIndex)) return new Set();
        return new Set([dayIndex]);
      });
    }
    lastSelectedDayRef.current = dayIndex;
  }, []);

  const clearDaySelection = useCallback(() => {
    setSelectedDays(new Set());
    lastSelectedDayRef.current = null;
  }, []);

  // ── Day collapse / uncollapse ──

  const collapseSelectedDays = useCallback(() => {
    if (selectedDays.size === 0) return;
    playSound('collapse');
    setCollapsedDays(prev => {
      const next = new Set(prev);
      for (const d of selectedDays) next.add(d);
      return next;
    });
    setSelectedDays(new Set());
  }, [selectedDays]);

  const uncollapseDays = useCallback((dayIndices) => {
    playSound('collapse');
    setCollapsedDays(prev => {
      const next = new Set(prev);
      for (const d of dayIndices) next.delete(d);
      return next;
    });
  }, []);

  const uncollapseAll = useCallback(() => {
    playSound('collapse');
    setCollapsedDays(new Set());
  }, []);

  // ── Phase-range collapse (toggle all days inside a phase) ──

  const collapsePhaseRange = useCallback((phase) => {
    if (!phase) return;
    playSound('collapse');
    const start = phase.start_index;
    const end = start + (phase.duration || 1);
    setCollapsedDays(prev => {
      const next = new Set(prev);
      let allCollapsed = true;
      for (let d = start; d < end; d++) {
        if (!prev.has(d)) { allCollapsed = false; break; }
      }
      if (allCollapsed) {
        for (let d = start; d < end; d++) next.delete(d);
      } else {
        for (let d = start; d < end; d++) next.add(d);
      }
      return next;
    });
  }, []);

  // ── Focus on phase: collapse all days OUTSIDE the given phase ──

  const focusOnPhase = useCallback((phase) => {
    if (!phase) return;
    playSound('collapse');
    const start = phase.start_index;
    const end = start + (phase.duration || 1);
    setCollapsedDays(prev => {
      let alreadyFocused = true;
      for (let d = 0; d < days; d++) {
        if (d >= start && d < end) {
          if (prev.has(d)) { alreadyFocused = false; break; }
        } else {
          if (!prev.has(d)) { alreadyFocused = false; break; }
        }
      }
      if (alreadyFocused) return new Set();
      const next = new Set();
      for (let d = 0; d < days; d++) {
        if (d < start || d >= end) next.add(d);
      }
      return next;
    });
  }, [days]);

  return {
    selectedDays,
    setSelectedDays,
    collapsedDays,
    setCollapsedDays,
    handleDaySelect,
    clearDaySelection,
    collapseSelectedDays,
    uncollapseDays,
    uncollapseAll,
    collapsePhaseRange,
    focusOnPhase,
  };
}
