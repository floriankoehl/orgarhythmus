import { authFetch } from "../auth";

// ── List branches for a project ──
export async function listBranches(projectId) {
  const res = await authFetch(`/api/projects/${projectId}/branches/`);
  if (!res.ok) throw new Error("Failed to list branches");
  return res.json(); // { branches: [...] }
}

// ── Create a branch (fork from source) ──
export async function createBranch(projectId, { name, description = "", sourceBranchId }) {
  const res = await authFetch(`/api/projects/${projectId}/branches/create/`, {
    method: "POST",
    body: JSON.stringify({ name, description, source_branch_id: sourceBranchId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create branch");
  }
  return res.json(); // { created: true, branch: {...} }
}

// ── Enter demo mode — forks source into a new demo branch ──
export async function enterDemoBranch(projectId, sourceBranchId) {
  const res = await authFetch(`/api/projects/${projectId}/branches/enter-demo/`, {
    method: "POST",
    body: JSON.stringify({ source_branch_id: sourceBranchId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to enter demo mode");
  }
  return res.json(); // { created: true, branch: {...} }
}

// ── Patch a branch (e.g. update demo_index) ──
export async function patchBranch(projectId, branchId, fields) {
  const res = await authFetch(`/api/projects/${projectId}/branches/${branchId}/update/`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update branch");
  }
  return res.json(); // { branch: {...} }
}

// ── Get branch detail ──
export async function getBranch(projectId, branchId) {
  const res = await authFetch(`/api/projects/${projectId}/branches/${branchId}/`);
  if (!res.ok) throw new Error("Failed to get branch");
  return res.json(); // { branch: {...} }
}

// ── Delete a branch ──
export async function deleteBranch(projectId, branchId) {
  const res = await authFetch(`/api/projects/${projectId}/branches/${branchId}/delete/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete branch");
  }
  return res.json(); // { deleted: true }
}
