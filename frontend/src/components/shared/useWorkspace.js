import { useState, useCallback, useEffect, useRef } from "react";
import { useWindowManager } from "./WindowManager";
import {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  setDefaultWorkspace,
  getDefaultWorkspace,
} from "../../api/workspaceApi";
import { playSound } from "../../assets/sound_registry";

/**
 * useWorkspace — manages workspace CRUD for the project.
 *
 * A workspace is a snapshot of *all* floating window states combined.
 * It's project-scoped (shared across team members).
 *
 * Uses the WindowManager's collectAllStates / applyAllStates to gather and
 * restore window positions, sizes, view modes, etc.
 *
 * Includes slide-out / slide-in transition animation and name flash overlay
 * (same pattern as useViewManagement in the dependency grid).
 */
export default function useWorkspace({ projectId }) {
  const manager = useWindowManager();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  // ── Slide transition animation state ──
  const [wsTransition, setWsTransition] = useState(null); // null | 'out' | 'in-start' | 'in'
  const wsTransitionRef = useRef(null);

  // ── Flash overlay (workspace name) ──
  const [wsFlashName, setWsFlashName] = useState(null);
  const wsFlashTimerRef = useRef(null);
  const wsFlashCounterRef = useRef(0);

  // ── Fetch all workspaces for the project ──
  const fetchAll = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await listWorkspaces(projectId);
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      console.error("Failed to fetch workspaces", err);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Animated load helper (mirrors useViewManagement.handleLoadView) ──
  const animatedLoad = useCallback(async (workspaceId, name) => {
    if (!manager) return;

    setWsTransition("out");
    if (wsTransitionRef.current) clearTimeout(wsTransitionRef.current);

    wsTransitionRef.current = setTimeout(async () => {
      // Apply state
      try {
        if (workspaceId == null) {
          // "Default" — no workspace, just clear tracking
          setActiveWorkspaceId(null);
          setActiveWorkspaceName(null);
        } else {
          const data = await getWorkspace(workspaceId);
          if (data?.state) {
            manager.applyAllStates(data.state);
          }
          setActiveWorkspaceId(workspaceId);
          setActiveWorkspaceName(name || data?.name || "Workspace");
        }
      } catch (err) {
        console.error("Failed to load workspace", err);
      }

      // Flash name
      const displayName = name || "Default";
      if (wsFlashTimerRef.current) clearTimeout(wsFlashTimerRef.current);
      wsFlashCounterRef.current += 1;
      setWsFlashName({ name: displayName, key: wsFlashCounterRef.current });
      wsFlashTimerRef.current = setTimeout(() => setWsFlashName(null), 1200);

      // Slide in
      setWsTransition("in-start");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWsTransition("in");
          wsTransitionRef.current = setTimeout(() => setWsTransition(null), 280);
        });
      });
      playSound("viewLoad");
    }, 220);
  }, [manager]);

  // ── Save current state as a new workspace ──
  const saveWorkspace = useCallback(async (name) => {
    if (!projectId || !manager) return;
    const state = manager.collectAllStates();
    try {
      const data = await createWorkspace(projectId, name || "Untitled", state);
      await fetchAll();
      setActiveWorkspaceId(data?.workspace?.id || null);
      setActiveWorkspaceName(name || "Untitled");
      playSound("ideaOpen");
    } catch (err) {
      console.error("Failed to save workspace", err);
    }
  }, [projectId, manager, fetchAll]);

  // ── Quick-save current workspace (overwrite active) ──
  const quickSave = useCallback(async () => {
    if (!manager) return;
    if (activeWorkspaceId) {
      // Overwrite current
      const state = manager.collectAllStates();
      try {
        await updateWorkspace(activeWorkspaceId, { state });
        await fetchAll();
        playSound("viewSave");
      } catch (err) {
        console.error("Failed to quick-save workspace", err);
      }
    } else {
      // No active workspace — save as new with timestamp
      const name = `Workspace ${new Date().toLocaleTimeString()}`;
      await saveWorkspace(name);
    }
  }, [manager, activeWorkspaceId, fetchAll, saveWorkspace]);

  // ── Update an existing workspace's state (overwrite) ──
  const overwriteWorkspace = useCallback(async (workspaceId) => {
    if (!manager) return;
    const state = manager.collectAllStates();
    try {
      await updateWorkspace(workspaceId, { state });
      await fetchAll();
      playSound("ideaOpen");
    } catch (err) {
      console.error("Failed to update workspace", err);
    }
  }, [manager, fetchAll]);

  // ── Rename a workspace ──
  const renameWorkspace = useCallback(async (workspaceId, name) => {
    try {
      await updateWorkspace(workspaceId, { name });
      await fetchAll();
      if (workspaceId === activeWorkspaceId) setActiveWorkspaceName(name);
    } catch (err) {
      console.error("Failed to rename workspace", err);
    }
  }, [fetchAll, activeWorkspaceId]);

  // ── Load a workspace (with animation) ──
  const loadWorkspace = useCallback(async (workspaceId) => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    await animatedLoad(workspaceId, ws?.name);
  }, [workspaces, animatedLoad]);

  // ── Cycle next / prev workspace (with animation) ──
  const nextWorkspace = useCallback(() => {
    if (workspaces.length === 0) return;
    const currentIdx = activeWorkspaceId
      ? workspaces.findIndex((w) => w.id === activeWorkspaceId)
      : -1;
    const nextIdx = (currentIdx + 1) % workspaces.length;
    const ws = workspaces[nextIdx];
    animatedLoad(ws.id, ws.name);
  }, [workspaces, activeWorkspaceId, animatedLoad]);

  const prevWorkspace = useCallback(() => {
    if (workspaces.length === 0) return;
    const currentIdx = activeWorkspaceId
      ? workspaces.findIndex((w) => w.id === activeWorkspaceId)
      : -1;
    const prevIdx = (currentIdx - 1 + workspaces.length) % workspaces.length;
    const ws = workspaces[prevIdx];
    animatedLoad(ws.id, ws.name);
  }, [workspaces, activeWorkspaceId, animatedLoad]);

  // ── Delete a workspace ──
  const removeWorkspace = useCallback(async (workspaceId) => {
    try {
      await deleteWorkspace(workspaceId);
      if (workspaceId === activeWorkspaceId) {
        setActiveWorkspaceId(null);
        setActiveWorkspaceName(null);
      }
      await fetchAll();
    } catch (err) {
      console.error("Failed to delete workspace", err);
    }
  }, [fetchAll, activeWorkspaceId]);

  // ── Toggle default ──
  const toggleDefault = useCallback(async (workspaceId) => {
    try {
      await setDefaultWorkspace(workspaceId);
      await fetchAll();
    } catch (err) {
      console.error("Failed to set default workspace", err);
    }
  }, [fetchAll]);

  // ── Load default workspace on mount ──
  const loadDefault = useCallback(async () => {
    if (!projectId || !manager) return;
    try {
      const data = await getDefaultWorkspace(projectId);
      if (data?.state) {
        manager.applyAllStates(data.state);
        setActiveWorkspaceId(data.id);
        setActiveWorkspaceName(data.name);
      }
    } catch (_) { /* no default — that's fine */ }
  }, [projectId, manager]);

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspaceName,
    showPanel, setShowPanel,
    workspaceName, setWorkspaceName,
    editingId, setEditingId,
    editingName, setEditingName,
    // Transition animation
    wsTransition,
    wsFlashName,
    // Actions
    fetchAll,
    saveWorkspace,
    quickSave,
    overwriteWorkspace,
    renameWorkspace,
    loadWorkspace,
    removeWorkspace,
    toggleDefault,
    loadDefault,
    nextWorkspace,
    prevWorkspace,
  };
}
