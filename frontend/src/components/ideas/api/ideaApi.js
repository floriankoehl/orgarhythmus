import { authFetch, API } from "./authFetch";

export async function fetchAllIdeas() {
  const res = await authFetch(`${API}/user/ideas/all/`);
  const data = await res.json();
  const list = data?.data || [];
  const obj = {};
  for (const p of list) {
    obj[p.id] = {
      placement_id: p.id,
      id: p.id,
      idea_id: p.idea?.id,
      title: p.idea?.title || "",
      headline: p.idea?.headline || "",
      description: p.idea?.description || "",
      legend_types: p.idea?.legend_types || {},
      owner: p.idea?.owner,
      owner_username: p.idea?.owner_username,
      created_at: p.idea?.created_at,
      placement_count: p.idea?.placement_count || 1,
      placement_categories: p.idea?.placement_categories || [],
      upvote_count: p.idea?.upvote_count || 0,
      comment_count: p.idea?.comment_count || 0,
      user_has_upvoted: p.idea?.user_has_upvoted || false,
      category: p.category,
      order_index: p.order_index,
    };
  }
  return { ideas: obj, order: data?.order || [], categoryOrders: data?.category_orders || {} };
}

export async function createIdeaApi(ideaName, description, headline, categoryId) {
  await authFetch(`${API}/user/ideas/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idea_name: ideaName,
      description: description || "",
      headline: headline || "",
      ...(categoryId ? { category_id: parseInt(categoryId) } : {}),
    }),
  });
}

export async function deleteIdeaApi(id) {
  await authFetch(`${API}/user/ideas/delete/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function updateIdeaTitleApi(ideaId, title) {
  await authFetch(`${API}/user/ideas/update_title/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ideaId, title }),
  });
}

export async function updateIdeaHeadlineApi(ideaId, headline) {
  await authFetch(`${API}/user/ideas/update_headline/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ideaId, headline }),
  });
}

export async function safeOrderApi(order, categoryId) {
  await authFetch(`${API}/user/ideas/safe_order/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order, category_id: categoryId }),
  });
}

export async function assignIdeaToCategoryApi(placementId, categoryId) {
  await authFetch(`${API}/user/ideas/assign_to_category/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placement_id: placementId, category_id: categoryId }),
  });
}

export async function copyIdeaApi(ideaId, categoryId) {
  await authFetch(`${API}/user/ideas/copy/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_id: ideaId, category_id: categoryId }),
  });
}

export async function pasteIdeaApi(copiedIdeaId, categoryId) {
  await authFetch(`${API}/user/ideas/copy/`, {
  });
}

export async function spinoffIdeaApi(metaIdeaId) {
  await authFetch(`${API}/user/ideas/spinoff/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_id: metaIdeaId }),
  });
}

export async function deleteMetaIdeaApi(ideaId) {
  await authFetch(`${API}/user/ideas/delete_meta/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ideaId }),
  });
}

export async function removeIdeaFromCategoryApi(placementId) {
  await authFetch(`${API}/user/ideas/remove_from_category/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placement_id: placementId }),
  });
}

export async function removeAllIdeaCategoriesApi(ideaId) {
  await authFetch(`${API}/user/ideas/remove_all_categories/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_id: ideaId }),
  });
}

export async function removeAllIdeaLegendTypesApi(ideaId) {
  await authFetch(`${API}/user/ideas/remove_all_legend_types/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_id: ideaId }),
  });
}

export async function assignIdeaLegendTypeApi(ideaId, legendId, legendTypeId) {
  await authFetch(`${API}/user/ideas/assign_legend_type/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_id: ideaId, legend_id: legendId, legend_type_id: legendTypeId }),
  });
}

export async function batchRemoveLegendTypeApi(ideaIds, legendId) {
  await authFetch(`${API}/user/ideas/batch_remove_legend_type/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea_ids: ideaIds, legend_id: legendId }),
  });
}

export async function toggleUpvoteApi(ideaId) {
  const res = await authFetch(`${API}/user/ideas/${ideaId}/upvote/`, { method: "POST" });
  return res.json();
}

export async function fetchCommentsApi(ideaId) {
  const res = await authFetch(`${API}/user/ideas/${ideaId}/comments/`);
  const data = await res.json();
  return data.comments || [];
}

export async function addCommentApi(ideaId, text) {
  const res = await authFetch(`${API}/user/ideas/${ideaId}/comments/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteCommentApi(commentId) {
  await authFetch(`${API}/user/ideas/comments/${commentId}/delete/`, { method: "DELETE" });
}

export async function fetchMetaIdeasApi() {
  const res = await authFetch(`${API}/user/ideas/meta/`);
  const data = await res.json();
  return data?.ideas || [];
}
