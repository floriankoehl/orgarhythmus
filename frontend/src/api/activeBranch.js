/**
 * Module-level singleton for the active branch ID.
 *
 * Because API functions in org_API.js are not React components, they
 * can't use hooks. This module exposes a getter/setter that BranchContext
 * keeps in sync whenever the active branch changes.
 *
 * Usage in API functions:
 *   import { branchParam } from './activeBranch';
 *   authFetch(`/api/projects/${pid}/teams/${branchParam()}`)
 */

let _activeBranchId = null;

export const getActiveBranchId = () => _activeBranchId;

export const setActiveBranchId = (id) => {
  _activeBranchId = id ?? null;
};

/** Returns "?branch=<id>" or "" if no active branch. */
export const branchParam = (prefix = "?") => {
  return _activeBranchId != null ? `${prefix}branch=${_activeBranchId}` : "";
};

/** Returns "branch=<id>" for use inside existing query strings (use "&" prefix). */
export const branchQs = () => {
  return _activeBranchId != null ? `branch=${_activeBranchId}` : "";
};
