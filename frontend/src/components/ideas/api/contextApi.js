import { authFetch, API } from "./authFetch";

export async function fetchContextsApi() {
  const res = await authFetch(`${API}/user/contexts/`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(ctx => ({
    id: ctx.id,
    name: ctx.name,
    color: ctx.color || null,
    is_default: ctx.is_default || false,
    is_public: ctx.is_public || false,
    adopted: ctx.adopted || false,
    owner_username: ctx.owner_username || null,
    owner_id: ctx.owner_id || null,
    category_ids: ctx.category_ids || [],
    legend_ids: ctx.legend_ids || [],
    idea_ids: ctx.idea_ids || [],
    project_ids: ctx.project_ids || [],
    included_projects: ctx.included_projects || [],
    contributing_users: ctx.contributing_users || [],
    filter_state: ctx.filter_state || null,
  }));
}

export async function saveContextFilterStateApi(contextId, filterState) {
  await authFetch(`${API}/user/contexts/set_filter_state/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context_id: contextId,
      filter_state: filterState,
    }),
  });
}

export async function setContextColorApi(contextId, color) {
  await authFetch(`${API}/user/contexts/set_color/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context_id: contextId, color }),
  });
}

export async function assignCategoryToContextApi(categoryId, contextId) {
  await authFetch(`${API}/user/contexts/assign_category/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_id: categoryId, context_id: contextId }),
  });
}

export async function setContextPositionApi(contextId, x, y) {
  await authFetch(`${API}/user/contexts/set_position/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: parseInt(contextId), x, y }),
  });
}

export async function setContextAreaApi(contextId, width, height) {
  await authFetch(`${API}/user/contexts/set_area/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: parseInt(contextId), width, height }),
  });
}

/* ── Context ↔ Idea endpoints ── */

export async function assignIdeaToContextApi(ideaId, contextId) {
  await authFetch(`${API}/user/contexts/assign_idea/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_id: ideaId, context_id: contextId }),
  });
}

export async function removeIdeaFromContextApi(ideaId, contextId) {
  await authFetch(`${API}/user/contexts/remove_idea/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_id: ideaId, context_id: contextId }),
  });
}

export async function saveContextIdeaOrderApi(contextId, ideaIds) {
  await authFetch(`${API}/user/contexts/save_idea_order/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context_id: contextId, idea_ids: ideaIds }),
  });
}

/* ── Context ↔ Project endpoints ── */

export async function assignProjectToContextApi(projectId, contextId) {
  await authFetch(`${API}/user/contexts/assign_project/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, context_id: contextId }),
  });
}

export async function removeProjectFromContextApi(projectId, contextId) {
  await authFetch(`${API}/user/contexts/remove_project/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, context_id: contextId }),
  });
}

export async function fetchContextProjectsApi(contextId) {
  const res = await authFetch(`${API}/user/contexts/${contextId}/projects/`);
  if (!res.ok) return [];
  return res.json();
}

/* ── Public contexts browsing ── */

export async function fetchAllPublicContextsApi() {
  const res = await authFetch(`${API}/contexts/public/`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.contexts || [];
}

/* ── Project's linked contexts ── */

export async function fetchProjectContextsApi(projectId) {
  const res = await authFetch(`${API}/projects/${projectId}/contexts/`);
  if (!res.ok) return [];
  return res.json();
}