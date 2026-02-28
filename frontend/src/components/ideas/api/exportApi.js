import { authFetch, API } from "./authFetch";

/**
 * Download a full JSON backup of IdeaBin data.
 * @param {number|null} contextId  – pass a context id for context-scoped export, or null for global
 */
export async function exportIdeabinApi(contextId) {
  const url = contextId
    ? `${API}/ideabin/export/?context_id=${contextId}`
    : `${API}/ideabin/export/`;

  const res = await authFetch(url);
  if (!res.ok) throw new Error("Export failed");
  return res.json();
}

/**
 * Import / restore a previously exported IdeaBin JSON backup.
 * @param {File} file       – the JSON file to upload
 * @param {number|null} contextId – optional context id for context-scoped restore
 * @returns {Promise<object>}     – { status, message } or { error }
 */
export async function importIdeabinApi(file, contextId) {
  const url = contextId
    ? `${API}/ideabin/import/?context_id=${contextId}`
    : `${API}/ideabin/import/`;

  const form = new FormData();
  form.append("file", file);

  const token = localStorage.getItem("access_token");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Import failed");
  return data;
}


// ─── Category-level export / import ─────────────────────

/**
 * Export a single category + its ideas as simple JSON.
 * @param {number} categoryId
 * @returns {Promise<{ category_name: string, ideas: Array }>}
 */
export async function exportCategoryApi(categoryId) {
  const res = await authFetch(`${API}/user/categories/${categoryId}/export/`);
  if (!res.ok) throw new Error("Category export failed");
  return res.json();
}

/**
 * Export multiple categories at once.
 * @param {number[]} categoryIds
 * @returns {Promise<{ categories: Array<{ category_name: string, ideas: Array }> }>}
 */
export async function exportMultipleCategoriesApi(categoryIds) {
  const res = await authFetch(`${API}/user/categories/export-multi/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_ids: categoryIds }),
  });
  if (!res.ok) throw new Error("Multi-category export failed");
  return res.json();
}

/**
 * Import a category from JSON (creates a new category + ideas).
 * @param {object|File} jsonOrFile  – parsed JSON object, or a File
 * @param {number|null} contextId   – optional context to place the new category into
 * @returns {Promise<{ status, message, category_id }>}
 */
export async function importCategoryApi(jsonOrFile, contextId) {
  const url = contextId
    ? `${API}/user/categories/import/?context_id=${contextId}`
    : `${API}/user/categories/import/`;

  // If it's a File, use multipart
  if (jsonOrFile instanceof File) {
    const form = new FormData();
    form.append("file", jsonOrFile);

    const token = localStorage.getItem("access_token");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Import failed");
    return data;
  }

  // Otherwise send as JSON body
  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jsonOrFile),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Import failed");
  return data;
}


/**
 * Insert ideas into an existing category from JSON.
 * @param {number} categoryId           – target category id
 * @param {object} jsonData             – { ideas: [{ title, description }, ...] }
 * @param {number|null} contextId       – optional context id for context-scoped placement
 * @returns {Promise<{ status, message, category_id, ideas_created }>}
 */
export async function insertIdeasIntoCategoryApi(categoryId, jsonData, contextId) {
  const url = contextId
    ? `${API}/user/categories/${categoryId}/insert-ideas/?context_id=${contextId}`
    : `${API}/user/categories/${categoryId}/insert-ideas/`;

  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jsonData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Insert failed");
  return data;
}
