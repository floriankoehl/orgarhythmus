// Column-selection and column-collapse domain logic.
// Generic version of useDayManagement.js — "day" → "column".

import { useState, useRef, useCallback } from 'react';
import { playSound } from '../assets/sound_registry';

/**
 * Manages selected-column and collapsed-column state plus all related actions.
 *
 * @param {number} columnCount - Total number of columns
 * @returns All column-management state values and action callbacks
 */
export function useColumnManagement(columnCount) {
  const [selectedColumns, setSelectedColumns] = useState(new Set());
  const [collapsedColumns, setCollapsedColumns] = useState(new Set());
  const lastSelectedColumnRef = useRef(null);

  // ── Column selection ──

  const handleColumnSelect = useCallback((columnIndex, event) => {
    playSound('uiClick');
    if (event?.shiftKey && lastSelectedColumnRef.current !== null) {
      const start = Math.min(lastSelectedColumnRef.current, columnIndex);
      const end = Math.max(lastSelectedColumnRef.current, columnIndex);
      setSelectedColumns(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (event?.ctrlKey || event?.metaKey) {
      setSelectedColumns(prev => {
        const next = new Set(prev);
        if (next.has(columnIndex)) next.delete(columnIndex);
        else next.add(columnIndex);
        return next;
      });
    } else {
      setSelectedColumns(prev => {
        if (prev.size === 1 && prev.has(columnIndex)) return new Set();
        return new Set([columnIndex]);
      });
    }
    lastSelectedColumnRef.current = columnIndex;
  }, []);

  const clearColumnSelection = useCallback(() => {
    setSelectedColumns(new Set());
    lastSelectedColumnRef.current = null;
  }, []);

  // ── Column collapse / uncollapse ──

  const collapseSelectedColumns = useCallback(() => {
    if (selectedColumns.size === 0) return;
    playSound('collapse');
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      for (const d of selectedColumns) next.add(d);
      return next;
    });
    setSelectedColumns(new Set());
  }, [selectedColumns]);

  const uncollapseColumns = useCallback((columnIndices) => {
    playSound('collapse');
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      for (const d of columnIndices) next.delete(d);
      return next;
    });
  }, []);

  const uncollapseAll = useCallback(() => {
    playSound('collapse');
    setCollapsedColumns(new Set());
  }, []);

  // ── Phase-range collapse (toggle all columns inside a phase) ──

  const collapsePhaseRange = useCallback((phase) => {
    if (!phase) return;
    playSound('collapse');
    const start = phase.start_index;
    const end = start + (phase.duration || 1);
    setCollapsedColumns(prev => {
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

  // ── Focus on phase: collapse all columns OUTSIDE the given phase ──

  const focusOnPhase = useCallback((phase) => {
    if (!phase) return;
    playSound('collapse');
    const start = phase.start_index;
    const end = start + (phase.duration || 1);
    setCollapsedColumns(prev => {
      let alreadyFocused = true;
      for (let d = 0; d < columnCount; d++) {
        if (d >= start && d < end) {
          if (prev.has(d)) { alreadyFocused = false; break; }
        } else {
          if (!prev.has(d)) { alreadyFocused = false; break; }
        }
      }
      if (alreadyFocused) return new Set();
      const next = new Set();
      for (let d = 0; d < columnCount; d++) {
        if (d < start || d >= end) next.add(d);
      }
      return next;
    });
  }, [columnCount]);

  return {
    selectedColumns,
    setSelectedColumns,
    collapsedColumns,
    setCollapsedColumns,
    handleColumnSelect,
    clearColumnSelection,
    collapseSelectedColumns,
    uncollapseColumns,
    uncollapseAll,
    collapsePhaseRange,
    focusOnPhase,
  };
}
