// Display-settings domain logic: row/lane size and visibility toggles.
// Generic version of useDisplaySettings.js — "task" → "row", "team" → "lane".

import { useCallback } from 'react';
import { playSound } from '../assets/sound_registry';
import { isRowVisible } from './layoutMath';

/**
 * Provides all row/lane display-toggle actions.
 * State (rowDisplaySettings / laneDisplaySettings) lives in the caller and is
 * passed in; only the setter functions are needed here.
 */
export function useDisplaySettings({
  lanes,
  laneOrder,
  rowDisplaySettings,
  setRowDisplaySettings,
  laneDisplaySettings,
  setLaneDisplaySettings,
}) {
  // ── Row size ──

  const toggleRowSize = useCallback((rowId) => {
    playSound('collapse');
    setRowDisplaySettings(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        size: prev[rowId]?.size === 'small' ? 'normal' : 'small',
      },
    }));
  }, [setRowDisplaySettings]);

  const setLaneRowsSmall = useCallback((laneId) => {
    const lane = lanes[laneId];
    if (!lane) return;
    playSound('collapse');
    setRowDisplaySettings(prev => {
      const updated = { ...prev };
      for (const rowId of lane.rows) {
        updated[rowId] = { ...updated[rowId], size: 'small' };
      }
      return updated;
    });
  }, [lanes, setRowDisplaySettings]);

  const setLaneRowsNormal = useCallback((laneId) => {
    const lane = lanes[laneId];
    if (!lane) return;
    playSound('collapse');
    setRowDisplaySettings(prev => {
      const updated = { ...prev };
      for (const rowId of lane.rows) {
        updated[rowId] = { ...updated[rowId], size: 'normal' };
      }
      return updated;
    });
  }, [lanes, setRowDisplaySettings]);

  // ── Row visibility ──

  const toggleRowVisibility = useCallback((rowId) => {
    playSound('collapse');
    setRowDisplaySettings(prev => {
      const updated = {
        ...prev,
        [rowId]: { ...prev[rowId], hidden: !prev[rowId]?.hidden },
      };
      // Auto-collapse lane when all rows become hidden
      for (const lid of laneOrder) {
        const lane = lanes[lid];
        if (!lane || !lane.rows.includes(rowId)) continue;
        const allHidden = lane.rows.every(r => updated[r]?.hidden);
        setLaneDisplaySettings(prev2 => ({
          ...prev2,
          [lid]: { ...prev2[lid], collapsed: allHidden },
        }));
        break;
      }
      return updated;
    });
  }, [laneOrder, lanes, setRowDisplaySettings, setLaneDisplaySettings]);

  const showAllLaneRows = useCallback((laneId) => {
    const lane = lanes[laneId];
    if (!lane) return;
    playSound('collapse');
    setRowDisplaySettings(prev => {
      const updated = { ...prev };
      for (const rowId of lane.rows) {
        updated[rowId] = { ...updated[rowId], hidden: false };
      }
      return updated;
    });
    setLaneDisplaySettings(prev => ({
      ...prev,
      [laneId]: { ...prev[laneId], collapsed: false },
    }));
  }, [lanes, setRowDisplaySettings, setLaneDisplaySettings]);

  // ── Lane visibility ──

  const toggleLaneVisibility = useCallback((laneId) => {
    playSound('teamFilter');
    setLaneDisplaySettings(prev => ({
      ...prev,
      [laneId]: { ...prev[laneId], hidden: !prev[laneId]?.hidden },
    }));
  }, [setLaneDisplaySettings]);

  const showAllHiddenLanes = useCallback(() => {
    playSound('collapse');
    setLaneDisplaySettings(prev => {
      const updated = { ...prev };
      for (const laneId of laneOrder) {
        updated[laneId] = { ...updated[laneId], hidden: false };
      }
      return updated;
    });
    setRowDisplaySettings(prev => {
      const updated = { ...prev };
      for (const rowId of Object.keys(prev)) {
        updated[rowId] = { ...updated[rowId], hidden: false };
      }
      return updated;
    });
  }, [laneOrder, setLaneDisplaySettings, setRowDisplaySettings]);

  // ── Lane collapse ──

  const toggleLaneCollapsed = useCallback((laneId) => {
    const wasCollapsed = laneDisplaySettings[laneId]?.collapsed;
    setLaneDisplaySettings(prev => ({
      ...prev,
      [laneId]: { ...prev[laneId], collapsed: !prev[laneId]?.collapsed },
    }));
    playSound('collapse');
    if (wasCollapsed) {
      const lane = lanes[laneId];
      if (lane) {
        setRowDisplaySettings(prev => {
          const updated = { ...prev };
          for (const rowId of lane.rows) {
            updated[rowId] = { ...updated[rowId], hidden: false };
          }
          return updated;
        });
      }
    }
  }, [lanes, laneDisplaySettings, setLaneDisplaySettings, setRowDisplaySettings]);

  const collapseAllLanes = useCallback(() => {
    setLaneDisplaySettings(prev => {
      const updated = { ...prev };
      for (const laneId of laneOrder) {
        updated[laneId] = { ...updated[laneId], collapsed: true };
      }
      return updated;
    });
    playSound('collapse');
  }, [laneOrder, setLaneDisplaySettings]);

  const expandAllLanes = useCallback(() => {
    setLaneDisplaySettings(prev => {
      const updated = { ...prev };
      for (const laneId of laneOrder) {
        updated[laneId] = { ...updated[laneId], collapsed: false };
      }
      return updated;
    });
    setRowDisplaySettings(prev => {
      const updated = { ...prev };
      for (const laneId of laneOrder) {
        const lane = lanes[laneId];
        if (lane) {
          for (const rowId of lane.rows) {
            updated[rowId] = { ...updated[rowId], hidden: false };
          }
        }
      }
      return updated;
    });
    playSound('collapse');
  }, [laneOrder, lanes, setLaneDisplaySettings, setRowDisplaySettings]);

  // ── Derived predicates ──

  const allVisibleRowsSmall = useCallback((laneId) => {
    const lane = lanes[laneId];
    if (!lane) return false;
    const visibleRows = lane.rows.filter(rid => isRowVisible(rid, rowDisplaySettings));
    if (visibleRows.length === 0) return false;
    return visibleRows.every(rid => rowDisplaySettings[rid]?.size === 'small');
  }, [lanes, rowDisplaySettings]);

  const laneHasHiddenRows = useCallback((laneId) => {
    const lane = lanes[laneId];
    if (!lane) return false;
    return lane.rows.some(rid => rowDisplaySettings[rid]?.hidden);
  }, [lanes, rowDisplaySettings]);

  return {
    toggleRowSize,
    setLaneRowsSmall,
    setLaneRowsNormal,
    toggleRowVisibility,
    showAllLaneRows,
    toggleLaneVisibility,
    showAllHiddenLanes,
    toggleLaneCollapsed,
    collapseAllLanes,
    expandAllLanes,
    allVisibleRowsSmall,
    laneHasHiddenRows,
  };
}
