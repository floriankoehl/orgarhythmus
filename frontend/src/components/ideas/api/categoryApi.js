import { authFetch, API } from "./authFetch";

export async function fetchCategories() {
  const res = await authFetch(`${API}/user/categories/`);
  const data = await res.json();
  const all = data.categories || [];
  const serialized = {};
  for (const c of all) {
    const minW = Math.max(80, c.name.length * 9 + 60);
    serialized[c.id] = {
      id: c.id, name: c.name, x: c.x, y: c.y,
      width: Math.max(c.width, minW), height: c.height,
      z_index: c.z_index || 0, archived: c.archived || false,
      is_public: c.is_public || false,
      adopted: c.adopted || false,
      owner_username: c.owner_username || null,
      filter_config: c.filter_config || null,
    };
  }
  return serialized;
}

export async function createCategoryApi(name, isPublic) {
  const res = await authFetch(`${API}/user/categories/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, is_public: isPublic }),
  });
  return res.json();
}

export async function setPositionCategory(id, pos) {
  await authFetch(`${API}/user/categories/set_position/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, position: pos }),
  });
}

export async function setAreaCategory(id, width, height) {
  await authFetch(`${API}/user/categories/set_area/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, width, height }),
  });
}

export async function bringToFrontCategory(id) {
  await authFetch(`${API}/user/categories/bring_to_front/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function deleteCategoryApi(id) {
  return authFetch(`${API}/user/categories/delete/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function mergeCategoriesApi(sourceId, targetId) {
  return authFetch(`${API}/user/categories/merge/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_id: parseInt(sourceId), target_id: parseInt(targetId) }),
  });
}

export async function renameCategoryApi(id, newName) {
  await authFetch(`${API}/user/categories/rename/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name: newName }),
  });
}

export async function toggleArchiveCategory(id) {
  const res = await authFetch(`${API}/user/categories/toggle_archive/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.json();
}

export async function togglePublicCategory(id) {
  const res = await authFetch(`${API}/user/categories/toggle_public/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.json();
}

export async function dropAdoptedCategoryApi(id) {
  await authFetch(`${API}/categories/${id}/drop/`, { method: "DELETE" });
}

export async function createCategoryWithIdeas(name, ideaIds, contextId, filterConfig) {
  const res = await authFetch(`${API}/user/categories/create_with_ideas/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name || "Filtered Ideas",
      idea_ids: ideaIds,
      context_id: contextId || null,
      filter_config: filterConfig || null,
    }),
  });
  return res.json();
}

export async function syncCategoryIdeas(categoryId, ideaIds, removeOld = false) {
  const res = await authFetch(`${API}/user/categories/sync_ideas/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category_id: categoryId,
      idea_ids: ideaIds,
      remove_old: removeOld,
    }),
  });
  return res.json();
}

export async function updateCategoryFilterConfig(categoryId, filterConfig) {
  const res = await authFetch(`${API}/user/categories/update_filter_config/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category_id: categoryId,
      filter_config: filterConfig,
    }),
  });
  return res.json();
}
