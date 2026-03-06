import { authFetch, API } from "../../ideas/api/authFetch";

// ── Task Legend CRUD ──

export async function fetchTaskLegendsApi(projectId) {
  const res = await authFetch(`${API}/projects/${projectId}/task-legends/`);
  const data = await res.json();
  return data?.legends || [];
}

export async function createTaskLegendApi(projectId, name) {
  const res = await authFetch(`${API}/projects/${projectId}/task-legends/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function updateTaskLegendApi(projectId, legendId, name) {
  const res = await authFetch(`${API}/projects/${projectId}/task-legends/${legendId}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteTaskLegendApi(projectId, legendId) {
  await authFetch(`${API}/projects/${projectId}/task-legends/${legendId}/delete/`, {
    method: "DELETE",
  });
}

// ── Task Legend Type CRUD ──

export async function fetchTaskLegendTypesApi(projectId, legendId) {
  const res = await authFetch(`${API}/projects/${projectId}/task-legends/${legendId}/types/`);
  const data = await res.json();
  return data?.types || [];
}

export async function createTaskLegendTypeApi(projectId, legendId, name, color, icon) {
  const res = await authFetch(`${API}/projects/${projectId}/task-legends/${legendId}/types/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color, icon }),
  });
  return res.json();
}

export async function updateTaskLegendTypeApi(projectId, legendId, typeId, updates) {
  const res = await authFetch(`${API}/projects/${projectId}/task-legends/${legendId}/types/${typeId}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteTaskLegendTypeApi(projectId, legendId, typeId) {
  await authFetch(`${API}/projects/${projectId}/task-legends/${legendId}/types/${typeId}/delete/`, {
    method: "DELETE",
  });
}

// ── Task ↔ Legend Type Assignment ──

export async function assignTaskLegendTypeApi(projectId, taskId, legendId, legendTypeId) {
  const res = await authFetch(`${API}/projects/${projectId}/tasks/assign_legend_type/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId, legend_id: legendId, legend_type_id: legendTypeId }),
  });
  return res.json();
}

export async function batchAssignTaskLegendTypeApi(projectId, taskIds, legendId, legendTypeId) {
  const res = await authFetch(`${API}/projects/${projectId}/tasks/batch_assign_legend_type/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_ids: taskIds, legend_id: legendId, legend_type_id: legendTypeId }),
  });
  return res.json();
}

export async function batchRemoveTaskLegendTypeApi(projectId, taskIds, legendId) {
  const res = await authFetch(`${API}/projects/${projectId}/tasks/batch_remove_legend_type/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_ids: taskIds, legend_id: legendId }),
  });
  return res.json();
}

export async function removeAllTaskLegendTypesApi(projectId, taskId) {
  const res = await authFetch(`${API}/projects/${projectId}/tasks/remove_all_legend_types/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId }),
  });
  return res.json();
}
