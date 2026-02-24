import { authFetch, API } from "./authFetch";

export async function fetchFormationsApi(contextId) {
  const res = await authFetch(`${API}/user/contexts/${contextId}/formations/`);
  const data = await res.json();
  return data?.formations || [];
}

export async function saveFormationApi(contextId, name, state) {
  await authFetch(`${API}/user/contexts/${contextId}/formations/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, state }),
  });
}

export async function updateFormationStateApi(formationId, state) {
  await authFetch(`${API}/user/formations/${formationId}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
}

export async function renameFormationApi(formationId, name) {
  await authFetch(`${API}/user/formations/${formationId}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function loadFormationApi(formationId) {
  const res = await authFetch(`${API}/user/formations/${formationId}/`);
  return res.json();
}

export async function deleteFormationApi(formationId) {
  await authFetch(`${API}/user/formations/${formationId}/delete/`, { method: "DELETE" });
}

export async function toggleDefaultFormationApi(formationId) {
  const res = await authFetch(`${API}/user/formations/${formationId}/set-default/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

export async function loadDefaultFormationApi(contextId) {
  const res = await authFetch(`${API}/user/contexts/${contextId}/formations/default/`);
  return res.json();
}

// ── Default context ──

export async function getDefaultContextApi() {
  const res = await authFetch(`${API}/user/contexts/default/`);
  return res.json();
}

export async function toggleDefaultContextApi(contextId) {
  const res = await authFetch(`${API}/user/contexts/${contextId}/set-default/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}
