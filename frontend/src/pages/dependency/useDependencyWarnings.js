// Warning messages and blocking feedback for the dependency interaction system.
import { useState, useRef } from 'react';
import { playSound } from '../../assets/sound_registry';
import { useDependency } from './DependencyContext.jsx';

/**
 * Hook managing warning toasts and the "blocking feedback" animation
 * that temporarily reveals hidden/collapsed milestones to show conflicts.
 */
export function useDependencyWarnings({
  milestones,
  tasks,
  taskDisplaySettings,
  teamDisplaySettings,
  setTaskDisplaySettings,
  setTeamDisplaySettings,
}) {
  const { autoSelectBlocking, warningDuration } = useDependency();

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
   * Temporarily reveals the blocking milestone, highlights it, then reverts after warningDuration.
   */
  const showBlockingFeedback = (blockingMilestoneId, connectionId) => {
    const milestone = milestones[blockingMilestoneId];
    if (!milestone) return;

    const taskId = milestone.task;
    const task = tasks[taskId];
    if (!task) return;

    const teamId = task.team;

    const originalState = {
      taskHidden: taskDisplaySettings[taskId]?.hidden || false,
      taskSize: taskDisplaySettings[taskId]?.size || 'normal',
      teamCollapsed: teamDisplaySettings[teamId]?.collapsed || false,
      teamHidden: teamDisplaySettings[teamId]?.hidden || false,
    };

    if (originalState.teamHidden) {
      setTeamDisplaySettings(prev => ({
        ...prev,
        [teamId]: { ...prev[teamId], hidden: false }
      }));
    }
    if (originalState.teamCollapsed) {
      setTeamDisplaySettings(prev => ({
        ...prev,
        [teamId]: { ...prev[teamId], collapsed: false }
      }));
    }
    if (originalState.taskHidden) {
      setTaskDisplaySettings(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], hidden: false }
      }));
    }
    if (originalState.taskSize === 'small') {
      setTaskDisplaySettings(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], size: 'normal' }
      }));
    }

    setBlockedMoveHighlight({
      milestoneId: blockingMilestoneId,
      connectionSource: connectionId?.source,
      connectionTarget: connectionId?.target,
    });

    if (autoSelectBlocking) {
      setTimeout(() => {
        setBlockedMoveHighlight(null);
      }, warningDuration);
    } else {
      setTimeout(() => {
        setBlockedMoveHighlight(null);

        if (originalState.teamHidden) {
          setTeamDisplaySettings(prev => ({
            ...prev,
            [teamId]: { ...prev[teamId], hidden: true }
          }));
        }
        if (originalState.teamCollapsed) {
          setTeamDisplaySettings(prev => ({
            ...prev,
            [teamId]: { ...prev[teamId], collapsed: true }
          }));
        }
        if (originalState.taskHidden) {
          setTaskDisplaySettings(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], hidden: true }
          }));
        }
        if (originalState.taskSize === 'small') {
          setTaskDisplaySettings(prev => ({
            ...prev,
            [taskId]: { ...prev[taskId], size: 'small' }
          }));
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
