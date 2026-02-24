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
