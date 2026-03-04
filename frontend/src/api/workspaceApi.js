import { authFetch } from "../auth";

// ── List workspaces for a project ──
export async function listWorkspaces(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/workspaces/`);
  if (!res.ok) throw new Error("Failed to list workspaces");
  return res.json();
}

// ── Create a new workspace ──
export async function createWorkspace(projectId, name, state) {
  const res = await authFetch(`/api/projects/${projectId}/workspaces/create/`, {
    method: "POST",
    body: JSON.stringify({ name, state }),
  });
  if (!res.ok) throw new Error("Failed to create workspace");
  return res.json();
}

// ── Get workspace by id (includes full state) ──
export async function getWorkspace(workspaceId) {
  const res = await authFetch(`/api/workspaces/${workspaceId}/`);
  if (!res.ok) throw new Error("Failed to get workspace");
  return res.json();
}

// ── Update workspace (name and/or state) ──
export async function updateWorkspace(workspaceId, data) {
  const res = await authFetch(`/api/workspaces/${workspaceId}/update/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update workspace");
  return res.json();
}

// ── Delete workspace ──
export async function deleteWorkspace(workspaceId) {
  const res = await authFetch(`/api/workspaces/${workspaceId}/delete/`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete workspace");
  return res.json();
}

// ── Toggle default workspace ──
export async function setDefaultWorkspace(workspaceId) {
  const res = await authFetch(`/api/workspaces/${workspaceId}/set-default/`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to set default workspace");
  return res.json();
}

// ── Get default workspace for a project (full state) ──
export async function getDefaultWorkspace(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/workspaces/default/`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to get default workspace");
  }
  return res.json();
}
