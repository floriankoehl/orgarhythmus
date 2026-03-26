import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  listBranches,
  createBranch as apiCreateBranch,
  deleteBranch as apiDeleteBranch,
  enterDemoBranch as apiEnterDemo,
  patchBranch as apiPatchBranch,
} from "../api/branchApi";
import { authFetch } from "../auth";
import { setActiveBranchId as syncActiveBranchId } from "../api/activeBranch";
import { triggerManualRefresh } from "../api/dataEvents";

const BranchContext = createContext(null);

/**
 * BranchProvider — scoped to a single project.
 *
 * Provides:
 *   branches           — array of branch objects from backend
 *   activeBranchId     — currently selected branch id (null = not loaded)
 *   activeBranch       — the full branch object for activeBranchId
 *   mainBranchId       — id of the is_main branch
 *   isMainBranch       — true if activeBranchId === mainBranchId
 *   isDemoMode         — true if activeBranch.is_demo
 *   demoIndex          — activeBranch.demo_index (null when not a demo branch)
 *   setActiveBranchId(id)              — switch active branch (persists to localStorage)
 *   createBranch({ name, description, sourceBranchId }) — fork a branch
 *   deleteBranch(branchId)             — delete a non-main branch
 *   enterDemoMode()                    — fork active branch into a demo branch and switch
 *   exitDemoMode()                     — switch back to source_branch (demo branch is kept)
 *   stepDemoIndex(delta)               — move demo_index forward/backward by delta
 *   reloadBranches()                   — re-fetch branch list
 *   loading            — true while initial fetch is in progress
 *   projectMetric      — project.metric ('days' | 'hours' | 'months')
 *   projectStartDate   — project.start_date (ISO string or null)
 */
export function BranchProvider({ projectId, children }) {
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchIdState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projectMetric, setProjectMetric] = useState("days");
  const [projectStartDate, setProjectStartDate] = useState(null);

  const storageKey = `branch_${projectId}`;

  // ── Load branches and restore persisted active branch ──────────────────────
  const reloadBranches = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await listBranches(projectId);
      const list = data.branches || [];
      setBranches(list);

      const mainBranch = list.find((b) => b.is_main);
      const storedId = localStorage.getItem(storageKey);
      const storedBranch = storedId ? list.find((b) => String(b.id) === storedId) : null;

      // Use stored branch if it still exists, else fall back to main
      const resolved = storedBranch || mainBranch || list[0] || null;
      if (resolved) {
        setActiveBranchIdState(resolved.id);
        localStorage.setItem(storageKey, String(resolved.id));
      }
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, storageKey]);

  useEffect(() => {
    reloadBranches();
  }, [reloadBranches]);

  // ── Fetch project metric + start_date ──────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    authFetch(`/api/projects/${projectId}/`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setProjectMetric(data.metric || "days");
          setProjectStartDate(data.start_date || null);
        }
      })
      .catch(() => {});
  }, [projectId]);

  // Keep module-level singleton in sync whenever activeBranchId changes
  useEffect(() => {
    syncActiveBranchId(activeBranchId);
  }, [activeBranchId]);

  // ── Switch active branch ───────────────────────────────────────────────────
  const setActiveBranchId = useCallback((id) => {
    setActiveBranchIdState(id);
    syncActiveBranchId(id);
    localStorage.setItem(storageKey, String(id));
    triggerManualRefresh();
  }, [storageKey]);

  // ── Create (fork) a branch ─────────────────────────────────────────────────
  const createBranch = useCallback(async ({ name, description = "", sourceBranchId }) => {
    const data = await apiCreateBranch(projectId, { name, description, sourceBranchId });
    const newBranch = data.branch;
    setBranches((prev) => [...prev, newBranch]);
    return newBranch;
  }, [projectId]);

  // ── Delete a branch ────────────────────────────────────────────────────────
  const deleteBranch = useCallback(async (branchId) => {
    await apiDeleteBranch(projectId, branchId);
    setBranches((prev) => prev.filter((b) => b.id !== branchId));
    if (activeBranchId === branchId) {
      const mainBranch = branches.find((b) => b.is_main && b.id !== branchId);
      if (mainBranch) setActiveBranchId(mainBranch.id);
    }
  }, [projectId, activeBranchId, branches, setActiveBranchId]);

  // ── Enter demo mode ────────────────────────────────────────────────────────
  // Forks the active branch into a new demo branch and switches to it.
  const enterDemoMode = useCallback(async () => {
    if (!activeBranchId) return;
    const data = await apiEnterDemo(projectId, activeBranchId);
    const newBranch = data.branch;
    setBranches((prev) => [...prev, newBranch]);
    setActiveBranchId(newBranch.id);
    return newBranch;
  }, [projectId, activeBranchId, setActiveBranchId]);

  // ── Exit demo mode ─────────────────────────────────────────────────────────
  // Switches back to the source branch. The demo branch is kept so the user
  // can re-enter it later via the BranchSwitcher.
  const exitDemoMode = useCallback(() => {
    const activeBranch = branches.find((b) => b.id === activeBranchId);
    if (!activeBranch?.is_demo) return;

    // Prefer source_branch; fall back to main
    const sourceId = activeBranch.source_branch;
    const target = sourceId
      ? branches.find((b) => b.id === sourceId)
      : branches.find((b) => b.is_main);

    if (target) setActiveBranchId(target.id);
  }, [activeBranchId, branches, setActiveBranchId]);

  // ── Step demo index ────────────────────────────────────────────────────────
  // Moves demo_index by `delta` (±1 etc.) and persists to backend.
  const stepDemoIndex = useCallback(async (delta) => {
    const activeBranch = branches.find((b) => b.id === activeBranchId);
    if (!activeBranch?.is_demo) return;

    const newIndex = (activeBranch.demo_index ?? 0) + delta;
    const safeIndex = Math.max(0, newIndex);

    // Optimistic local update
    setBranches((prev) =>
      prev.map((b) => b.id === activeBranchId ? { ...b, demo_index: safeIndex } : b)
    );

    try {
      await apiPatchBranch(projectId, activeBranchId, { demo_index: safeIndex });
    } catch (err) {
      console.error("Failed to update demo_index:", err);
      // Roll back optimistic update on failure
      setBranches((prev) =>
        prev.map((b) => b.id === activeBranchId ? { ...b, demo_index: activeBranch.demo_index } : b)
      );
    }
  }, [projectId, activeBranchId, branches]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const mainBranchId  = branches.find((b) => b.is_main)?.id ?? null;
  const isMainBranch  = activeBranchId !== null && activeBranchId === mainBranchId;
  const activeBranch  = branches.find((b) => b.id === activeBranchId) ?? null;
  const isDemoMode    = activeBranch?.is_demo ?? false;
  const demoIndex     = activeBranch?.demo_index ?? null;

  return (
    <BranchContext.Provider value={{
      branches,
      activeBranchId,
      activeBranch,
      mainBranchId,
      isMainBranch,
      isDemoMode,
      demoIndex,
      projectMetric,
      projectStartDate,
      setActiveBranchId,
      createBranch,
      deleteBranch,
      enterDemoMode,
      exitDemoMode,
      stepDemoIndex,
      reloadBranches,
      loading,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
