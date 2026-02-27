import { authFetch, API } from "../../ideas/api/authFetch";

// ── Task Structure Views (project-scoped) ──

export async function fetchTsViewsApi(projectId) {
  const res = await authFetch(`${API}/projects/${projectId}/ts-views/`);
  const data = await res.json();
  return data?.views || [];
}

export async function createTsViewApi(projectId, name, state) {
  const res = await authFetch(`${API}/projects/${projectId}/ts-views/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, state }),
  });
  return res.json();
}

export async function getTsViewApi(viewId) {
  const res = await authFetch(`${API}/ts-views/${viewId}/`);
  return res.json();
}

export async function updateTsViewApi(viewId, payload) {
  const res = await authFetch(`${API}/ts-views/${viewId}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteTsViewApi(viewId) {
  await authFetch(`${API}/ts-views/${viewId}/delete/`, { method: "DELETE" });
}

export async function toggleDefaultTsViewApi(viewId) {
  const res = await authFetch(`${API}/ts-views/${viewId}/set-default/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

export async function getDefaultTsViewApi(projectId) {
  const res = await authFetch(`${API}/projects/${projectId}/ts-views/default/`);
  return res.json();
}
