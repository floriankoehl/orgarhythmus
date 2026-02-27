import { useState, useCallback, useEffect, useRef } from "react";
import {
  fetchTasksForProject,
  createTaskForProject,
  updateTask,
  delete_task,
} from "../../../api/org_API";

/**
 * Manages task CRUD, ordering, and selection for the Task Structure page.
 *
 * Returns flat task maps keyed by id plus ordered lists for unassigned / per-team.
 */
export default function useTaskData({ projectId }) {
  const [tasks, setTasks] = useState({});           // { id: taskObj }
  const [taskOrder, setTaskOrder] = useState([]);    // ordered array of task ids (unassigned)
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
      for (const t of list) {
        map[t.id] = t;
        if (!t.team) order.push(t.id);
      }
      setTasks(map);
      setTaskOrder(order);
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
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }, [projectId]);

  // ── Assign task to team (optimistic) ──
  const assignTaskToTeam = useCallback(async (taskId, teamId) => {
    if (!projectId) return;
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
    try {
      await updateTask(projectId, taskId, { team_id: teamId });
    } catch (err) {
      console.error("Failed to assign task to team:", err);
      // Revert on failure
      await fetchTasks();
    }
  }, [projectId, fetchTasks]);

  // ── Move task within unassigned order ──
  const reorderUnassigned = useCallback((fromIdx, toIdx) => {
    setTaskOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }, []);

  // ── Derived: tasks grouped by team ──
  const tasksByTeam = useCallback(() => {
    const groups = {}; // teamId -> [taskId, ...]
    for (const [id, task] of Object.entries(tasks)) {
      const teamId = task.team?.id || task.team;
      if (teamId) {
        if (!groups[teamId]) groups[teamId] = [];
        groups[teamId].push(Number(id));
      }
    }
    return groups;
  }, [tasks]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    setTasks,
    taskOrder,
    setTaskOrder,
    loading,
    fetchTasks,
    createTask,
    updateTaskApi,
    deleteTask,
    assignTaskToTeam,
    reorderUnassigned,
    tasksByTeam,
  };
}
