// Display-settings domain logic: task/team size and visibility toggles.
// Extracted from Dependencies.jsx to keep the component a thin composition root.

import { useCallback } from 'react';
import { playSound } from '../../assets/sound_registry';
import { isTaskVisible } from './layoutMath';

/**
 * Provides all task/team display-toggle actions.
 * State (taskDisplaySettings / teamDisplaySettings) lives in the caller and is
 * passed in; only the setter functions are needed here.
 */
export function useDisplaySettings({
  teams,
  teamOrder,
  taskDisplaySettings,
  setTaskDisplaySettings,
  teamDisplaySettings,
  setTeamDisplaySettings,
}) {
  // ── Task size ──

  const toggleTaskSize = useCallback((taskId) => {
    playSound('collapse');
    setTaskDisplaySettings(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        size: prev[taskId]?.size === 'small' ? 'normal' : 'small',
      },
    }));
  }, [setTaskDisplaySettings]);

  const setTeamTasksSmall = useCallback((teamId) => {
    const team = teams[teamId];
    if (!team) return;
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        updated[taskId] = { ...updated[taskId], size: 'small' };
      }
      return updated;
    });
  }, [teams, setTaskDisplaySettings]);

  const setTeamTasksNormal = useCallback((teamId) => {
    const team = teams[teamId];
    if (!team) return;
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        updated[taskId] = { ...updated[taskId], size: 'normal' };
      }
      return updated;
    });
  }, [teams, setTaskDisplaySettings]);

  // ── Task visibility ──

  const toggleTaskVisibility = useCallback((taskId) => {
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = {
        ...prev,
        [taskId]: { ...prev[taskId], hidden: !prev[taskId]?.hidden },
      };
      // Auto-collapse team when all tasks become hidden
      for (const tid of teamOrder) {
        const team = teams[tid];
        if (!team || !team.tasks.includes(taskId)) continue;
        const allHidden = team.tasks.every(t => updated[t]?.hidden);
        setTeamDisplaySettings(prev2 => ({
          ...prev2,
          [tid]: { ...prev2[tid], collapsed: allHidden },
        }));
        break;
      }
      return updated;
    });
  }, [teamOrder, teams, setTaskDisplaySettings, setTeamDisplaySettings]);

  const showAllTeamTasks = useCallback((teamId) => {
    const team = teams[teamId];
    if (!team) return;
    playSound('collapse');
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of team.tasks) {
        updated[taskId] = { ...updated[taskId], hidden: false };
      }
      return updated;
    });
    setTeamDisplaySettings(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], collapsed: false },
    }));
  }, [teams, setTaskDisplaySettings, setTeamDisplaySettings]);

  // ── Team visibility ──

  const toggleTeamVisibility = useCallback((teamId) => {
    playSound('teamFilter');
    setTeamDisplaySettings(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], hidden: !prev[teamId]?.hidden },
    }));
  }, [setTeamDisplaySettings]);

  const showAllHiddenTeams = useCallback(() => {
    playSound('collapse');
    setTeamDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        updated[teamId] = { ...updated[teamId], hidden: false };
      }
      return updated;
    });
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const taskId of Object.keys(prev)) {
        updated[taskId] = { ...updated[taskId], hidden: false };
      }
      return updated;
    });
  }, [teamOrder, setTeamDisplaySettings, setTaskDisplaySettings]);

  // ── Team collapse ──

  const toggleTeamCollapsed = useCallback((teamId) => {
    const wasCollapsed = teamDisplaySettings[teamId]?.collapsed;
    setTeamDisplaySettings(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], collapsed: !prev[teamId]?.collapsed },
    }));
    playSound('collapse');
    if (wasCollapsed) {
      const team = teams[teamId];
      if (team) {
        setTaskDisplaySettings(prev => {
          const updated = { ...prev };
          for (const taskId of team.tasks) {
            updated[taskId] = { ...updated[taskId], hidden: false };
          }
          return updated;
        });
      }
    }
  }, [teams, teamDisplaySettings, setTeamDisplaySettings, setTaskDisplaySettings]);

  const collapseAllTeams = useCallback(() => {
    setTeamDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        updated[teamId] = { ...updated[teamId], collapsed: true };
      }
      return updated;
    });
    playSound('collapse');
  }, [teamOrder, setTeamDisplaySettings]);

  const expandAllTeams = useCallback(() => {
    setTeamDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        updated[teamId] = { ...updated[teamId], collapsed: false };
      }
      return updated;
    });
    setTaskDisplaySettings(prev => {
      const updated = { ...prev };
      for (const teamId of teamOrder) {
        const team = teams[teamId];
        if (team) {
          for (const taskId of team.tasks) {
            updated[taskId] = { ...updated[taskId], hidden: false };
          }
        }
      }
      return updated;
    });
    playSound('collapse');
  }, [teamOrder, teams, setTeamDisplaySettings, setTaskDisplaySettings]);

  // ── Derived predicates ──

  const allVisibleTasksSmall = useCallback((teamId) => {
    const team = teams[teamId];
    if (!team) return false;
    const visibleTasks = team.tasks.filter(tid => isTaskVisible(tid, taskDisplaySettings));
    if (visibleTasks.length === 0) return false;
    return visibleTasks.every(tid => taskDisplaySettings[tid]?.size === 'small');
  }, [teams, taskDisplaySettings]);

  const teamHasHiddenTasks = useCallback((teamId) => {
    const team = teams[teamId];
    if (!team) return false;
    return team.tasks.some(tid => taskDisplaySettings[tid]?.hidden);
  }, [teams, taskDisplaySettings]);

  return {
    toggleTaskSize,
    setTeamTasksSmall,
    setTeamTasksNormal,
    toggleTaskVisibility,
    showAllTeamTasks,
    toggleTeamVisibility,
    showAllHiddenTeams,
    toggleTeamCollapsed,
    collapseAllTeams,
    expandAllTeams,
    allVisibleTasksSmall,
    teamHasHiddenTasks,
  };
}
