import { authFetch, API } from "./authFetch";

export async function fetchFormationsApi() {
  const res = await authFetch(`${API}/user/formations/`);
  const data = await res.json();
  return data?.formations || [];
}

export async function saveFormationApi(name, state) {
  await authFetch(`${API}/user/formations/create/`, {
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

export async function loadDefaultFormationApi() {
  const res = await authFetch(`${API}/user/formations/default/`);
  return res.json();
}
