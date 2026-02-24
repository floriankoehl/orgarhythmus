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
    category_ids: ctx.category_ids || [],
    legend_ids: ctx.legend_ids || [],
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

export async function assignLegendToContextApi(legendId, contextId) {
  await authFetch(`${API}/user/contexts/assign_legend/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ legend_id: legendId, context_id: contextId }),
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

/* ── User-level filter presets (stored on UserShortcuts, not per-context) ── */

export async function fetchFilterPresetsApi() {
  const res = await authFetch(`${API}/user/filter-presets/`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.filter_presets || [];
}

export async function saveFilterPresetsApi(presets) {
  await authFetch(`${API}/user/filter-presets/save/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter_presets: presets }),
  });
}
