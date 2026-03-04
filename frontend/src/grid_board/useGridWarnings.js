// Warning messages and blocking feedback for the grid interaction system.
// Generic version of useDependencyWarnings.js — "milestone" → "node", "task" → "row", "team" → "lane".

import { useState, useRef } from 'react';
import { playSound } from '../assets/sound_registry';
import { useGridBoardContext } from './GridBoardContext.jsx';

/**
 * Hook managing warning toasts and the "blocking feedback" animation
 * that temporarily reveals hidden/collapsed nodes to show conflicts.
 */
export function useGridWarnings({
  nodes,
  rows,
  rowDisplaySettings,
  laneDisplaySettings,
  setRowDisplaySettings,
  setLaneDisplaySettings,
  hideAllEdges,
  setHideAllEdges,
}) {
  const { autoSelectBlocking, warningDuration } = useGridBoardContext();

  // Warning toast state
  const [warningMessages, setWarningMessages] = useState([]);
  const warningIdCounter = useRef(0);

  // Blocking highlight state
  const [blockedMoveHighlight, setBlockedMoveHighlight] = useState(null);

  /** Add a warning message (auto-fading toast). */
  const addWarning = (message, details = null) => {
    const id = ++warningIdCounter.current;
    setWarningMessages(prev => [...prev, { id, message, details, timestamp: Date.now() }]);
    playSound('warning');
  };

  /**
   * Show blocking feedback with temporary expansion of hidden/collapsed items.
   * Temporarily reveals the blocking node, highlights it, then reverts after warningDuration.
   */
  const showBlockingFeedback = (blockingNodeId, edgeId) => {
    const node = nodes[blockingNodeId];
    if (!node) return;

    const rowId = node.row;
    const row = rows[rowId];
    if (!row) return;

    const laneId = row.lane;

    const originalState = {
      rowHidden: rowDisplaySettings[rowId]?.hidden || false,
      rowSize: rowDisplaySettings[rowId]?.size || 'normal',
      laneCollapsed: laneDisplaySettings[laneId]?.collapsed || false,
      laneHidden: laneDisplaySettings[laneId]?.hidden || false,
      edgesHidden: hideAllEdges || false,
    };

    // Temporarily reveal all edges if they are hidden
    if (originalState.edgesHidden) {
      setHideAllEdges(false);
    }

    if (originalState.laneHidden) {
      setLaneDisplaySettings(prev => ({
        ...prev,
        [laneId]: { ...prev[laneId], hidden: false }
      }));
    }
    if (originalState.laneCollapsed) {
      setLaneDisplaySettings(prev => ({
        ...prev,
        [laneId]: { ...prev[laneId], collapsed: false }
      }));
    }
    if (originalState.rowHidden) {
      setRowDisplaySettings(prev => ({
        ...prev,
        [rowId]: { ...prev[rowId], hidden: false }
      }));
    }
    if (originalState.rowSize === 'small') {
      setRowDisplaySettings(prev => ({
        ...prev,
        [rowId]: { ...prev[rowId], size: 'normal' }
      }));
    }

    setBlockedMoveHighlight({
      nodeId: blockingNodeId,
      edgeSource: edgeId?.source,
      edgeTarget: edgeId?.target,
    });

    if (autoSelectBlocking) {
      setTimeout(() => {
        setBlockedMoveHighlight(null);
        // Restore hidden edges after feedback
        if (originalState.edgesHidden) {
          setHideAllEdges(true);
        }
      }, warningDuration);
    } else {
      setTimeout(() => {
        setBlockedMoveHighlight(null);

        if (originalState.laneHidden) {
          setLaneDisplaySettings(prev => ({
            ...prev,
            [laneId]: { ...prev[laneId], hidden: true }
          }));
        }
        if (originalState.laneCollapsed) {
          setLaneDisplaySettings(prev => ({
            ...prev,
            [laneId]: { ...prev[laneId], collapsed: true }
          }));
        }
        if (originalState.rowHidden) {
          setRowDisplaySettings(prev => ({
            ...prev,
            [rowId]: { ...prev[rowId], hidden: true }
          }));
        }
        if (originalState.rowSize === 'small') {
          setRowDisplaySettings(prev => ({
            ...prev,
            [rowId]: { ...prev[rowId], size: 'small' }
          }));
        }
        // Restore hidden edges after feedback
        if (originalState.edgesHidden) {
          setHideAllEdges(true);
        }
      }, warningDuration);
    }
  };

  return {
    warningMessages,
    blockedMoveHighlight,
    setBlockedMoveHighlight,
    addWarning,
    showBlockingFeedback,
  };
}
