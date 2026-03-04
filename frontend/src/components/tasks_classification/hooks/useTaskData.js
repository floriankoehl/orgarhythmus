import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchTasksForProject,
  createTaskForProject,
  updateTask,
  delete_task,
  toggleCriterion,
} from "../../../api/org_API";
import { reorder_team_tasks as reorderTeamTasksApi } from "../../../api/dependencies_api";

/**
 * Manages task CRUD, ordering, and selection for the Task Structure page.
 *
 * Returns flat task maps keyed by id plus ordered lists for unassigned / per-team.
 */
export default function useTaskData({ projectId }) {
  const [tasks, setTasks] = useState({});           // { id: taskObj }
  const [taskOrder, setTaskOrder] = useState([]);    // ordered array of task ids (unassigned)
  const [teamTaskOrder, setTeamTaskOrder] = useState({});  // { teamId: [taskId, ...] }
  const [loading, setLoading] = useState(false);

  // ── Fetch all tasks for project ──
  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetchTasksForProject(projectId);
      const list = Array.isArray(res) ? res : (res.tasks || res || []);
      const map = {};
      const order = [];
      const tto = {};  // teamId -> [taskId, ...] sorted by order_index
      for (const t of list) {
        map[t.id] = t;
        const teamId = t.team?.id || t.team;
        if (!teamId) {
          order.push(t.id);
        } else {
          if (!tto[teamId]) tto[teamId] = [];
          tto[teamId].push(t);
        }
      }
      // Sort each team's tasks by order_index then convert to id arrays
      for (const tid of Object.keys(tto)) {
        tto[tid].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        tto[tid] = tto[tid].map((t) => t.id);
      }
      setTasks(map);
      setTaskOrder(order);
      setTeamTaskOrder(tto);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
    setLoading(false);
  }, [projectId]);

  // ── Create task ──
  const createTask = useCallback(async (payload) => {
    if (!projectId) return null;
    try {
      const res = await createTaskForProject(projectId, payload);
      const task = res.task || res;
      setTasks((prev) => ({ ...prev, [task.id]: task }));
      if (!task.team) {
        setTaskOrder((prev) => [...prev, task.id]);
      }
      return task;
    } catch (err) {
      console.error("Failed to create task:", err);
      return null;
    }
  }, [projectId]);

  // ── Update task ──
  const updateTaskApi = useCallback(async (taskId, payload) => {
    if (!projectId) return null;
    try {
      const res = await updateTask(projectId, taskId, payload);
      const updated = res.task || res;
      setTasks((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...updated } }));
      return updated;
    } catch (err) {
      console.error("Failed to update task:", err);
      return null;
    }
  }, [projectId]);

  // ── Delete task ──
  const deleteTask = useCallback(async (taskId) => {
    if (!projectId) return;
    try {
      await delete_task(projectId, taskId);
      setTasks((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setTaskOrder((prev) => prev.filter((id) => id !== taskId));
      setTeamTaskOrder((prev) => {
        const next = {};
        for (const [tid, ids] of Object.entries(prev)) {
          const filtered = ids.filter((id) => id !== taskId);
          if (filtered.length) next[tid] = filtered;
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }, [projectId]);

  // ── Assign task to team (optimistic) ──
  const assignTaskToTeam = useCallback(async (taskId, teamId) => {
    if (!projectId) return;
    // Get old team before optimistic update
    const oldTeamId = tasks[taskId]?.team?.id || tasks[taskId]?.team;
    // Optimistic update
    setTasks((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], team: teamId ? { id: teamId } : null },
    }));
    if (!teamId) {
      setTaskOrder((prev) => prev.includes(taskId) ? prev : [...prev, taskId]);
    } else {
      setTaskOrder((prev) => prev.filter((id) => id !== taskId));
    }
    // Update teamTaskOrder
    setTeamTaskOrder((prev) => {
      const next = { ...prev };
      // Remove from old team
      if (oldTeamId && next[oldTeamId]) {
        next[oldTeamId] = next[oldTeamId].filter((id) => id !== taskId);
        if (next[oldTeamId].length === 0) delete next[oldTeamId];
      }
      // Add to new team
      if (teamId) {
        if (!next[teamId]) next[teamId] = [];
        if (!next[teamId].includes(taskId)) next[teamId] = [...next[teamId], taskId];
      }
      return next;
    });
    try {
      await updateTask(projectId, taskId, { team_id: teamId });
    } catch (err) {
      console.error("Failed to assign task to team:", err);
      // Revert on failure
      await fetchTasks();
    }
  }, [projectId, fetchTasks, tasks]);

  // ── Move task within unassigned order ──
  const reorderUnassigned = useCallback((fromIdx, toIdx) => {
    setTaskOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }, []);

  // ── Reorder task within a team (optimistic + persist) ──
  const reorderTeamTasks = useCallback(async (teamId, taskId, fromIdx, toIdx) => {
    if (!projectId || fromIdx === toIdx) return;
    // Optimistic update
    let newOrder;
    setTeamTaskOrder((prev) => {
      const arr = [...(prev[teamId] || [])];
      const [item] = arr.splice(fromIdx, 1);
      const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
      arr.splice(insertAt, 0, item);
      newOrder = arr;
      return { ...prev, [teamId]: arr };
    });
    // Persist to backend
    try {
      await reorderTeamTasksApi(projectId, taskId, teamId, newOrder);
    } catch (err) {
      console.error("Failed to reorder team tasks:", err);
      // Revert on failure
      await fetchTasks();
    }
  }, [projectId, fetchTasks]);

  // ── Derived: tasks grouped by team (respects teamTaskOrder) ──
  const tasksByTeam = useCallback(() => {
    // Start with the persisted order
    const groups = {};
    for (const [tid, ids] of Object.entries(teamTaskOrder)) {
      // Only include ids that still exist in tasks and still belong to this team
      groups[tid] = ids.filter((id) => {
        const t = tasks[id];
        return t && (String(t.team?.id || t.team) === String(tid));
      });
    }
    // Add any tasks not yet in teamTaskOrder (newly assigned)
    for (const [id, task] of Object.entries(tasks)) {
      const teamId = task.team?.id || task.team;
      if (teamId) {
        if (!groups[teamId]) groups[teamId] = [];
        if (!groups[teamId].includes(Number(id))) {
          groups[teamId].push(Number(id));
        }
      }
    }
    return groups;
  }, [tasks, teamTaskOrder]);

  // ── Toggle acceptance criterion done state ──
  const toggleCriterionApi = useCallback(async (taskId, criterionId) => {
    if (!projectId) return null;
    try {
      const updated = await toggleCriterion(projectId, taskId, criterionId);
      // Update the criterion in the local task object
      setTasks((prev) => {
        const task = prev[taskId];
        if (!task) return prev;
        const criteria = (task.acceptance_criteria || []).map((c) =>
          c.id === criterionId ? { ...c, done: updated.done } : c
        );
        return { ...prev, [taskId]: { ...task, acceptance_criteria: criteria } };
      });
      return updated;
    } catch (err) {
      console.error("Failed to toggle criterion:", err);
      return null;
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    setTasks,
    taskOrder,
    setTaskOrder,
    teamTaskOrder,
    setTeamTaskOrder,
    loading,
    fetchTasks,
    createTask,
    updateTaskApi,
    deleteTask,
    assignTaskToTeam,
    reorderUnassigned,
    reorderTeamTasks,
    tasksByTeam,
    toggleCriterionApi,
  };
}
