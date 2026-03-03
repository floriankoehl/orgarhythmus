import { createContext, useContext, useCallback, useMemo, useRef, useState } from "react";
import InventoryBar from "./InventoryBar";
import OrbitMode from "./OrbitMode";

/**
 * WindowManager — a standalone, layout-agnostic orchestrator for a set of
 * floating windows.
 *
 * Responsibilities:
 * ─ Track which windows are open / closed (passive — windows report their state).
 * ─ Provide coordination APIs: minimizeAll, requestOpen, requestMinimize, etc.
 * ─ Workspace state collection/application via per-window collectors/appliers.
 * ─ Render the InventoryBar (bottom-center hotbar with all window icons).
 *
 * The icon dock positions are no longer used for standalone floating icons —
 * the InventoryBar owns all icon rendering. Individual windows hide their own
 * floating icons when `managed` is true.
 *
 * Usage:
 *   <WindowManager windows={[{ id: 'schedule' }, { id: 'calendar' }]}>
 *     <ScheduleWindow />
 *     <CalendarWindow />
 *   </WindowManager>
 *
 * Each child floating-window passes its `id` to `useFloatingWindow({ id })`.
 * The hook detects the nearest WindowManager context and integrates automatically.
 *
 * @param {Object[]} windows     Ordered array of { id: string } – defines slot order in the inventory bar.
 * @param {React.ReactNode} children  The floating-window components.
 */

// ── Context ──────────────────────────────────────────────────────────────────

const WindowManagerContext = createContext(null);

export function useWindowManager() {
  return useContext(WindowManagerContext);
}

// ── Provider component ───────────────────────────────────────────────────────

export default function WindowManager({
  children,
  windows = [],
}) {
  // ── Open / close tracking (windows report via reportOpen / reportClose) ──
  const openSetRef = useRef(new Set());
  const [openWindows, setOpenWindows] = useState(() => new Set());

  const reportOpen = useCallback((id) => {
    if (openSetRef.current.has(id)) return; // already tracked — avoid needless re-render
    openSetRef.current.add(id);
    setOpenWindows(new Set(openSetRef.current));
  }, []);

  const reportClose = useCallback((id) => {
    if (!openSetRef.current.has(id)) return; // already removed — avoid needless re-render
    openSetRef.current.delete(id);
    setOpenWindows(new Set(openSetRef.current));
  }, []);

  // ── Coordination: minimizeAll ──
  const [minimizeAllVersion, setMinimizeAllVersion] = useState(0);
  const minimizeAll = useCallback(() => {
    setMinimizeAllVersion((v) => v + 1);
  }, []);

  // ── Coordination: per-window open requests (InventoryBar → window) ──
  const [openRequests, setOpenRequests] = useState({});
  const requestOpen = useCallback((id) => {
    setOpenRequests((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, []);

  // ── Coordination: per-window minimize requests (InventoryBar → window) ──
  const [minimizeRequests, setMinimizeRequests] = useState({});
  const requestMinimize = useCallback((id) => {
    setMinimizeRequests((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, []);

  // ── Coordination: per-window open-full-screen requests (OrbitMode → window) ──
  const [openFullScreenRequests, setOpenFullScreenRequests] = useState({});
  const requestOpenFullScreen = useCallback((id) => {
    setOpenFullScreenRequests((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, []);

  // ── Derived: orbit mode when no windows are open ──
  const allCollapsed = openWindows.size === 0;

  // ── Workspace: per-window state collectors & appliers ──
  const stateCollectorsRef = useRef({});   // { [windowId]: () => stateObj }
  const stateAppliersRef = useRef({});     // { [windowId]: (state) => void }

  // ── View savers: per-window "save current view" callbacks ──
  const viewSaversRef = useRef({});        // { [windowId]: () => Promise<void> }

  const registerCollector = useCallback((id, fn) => {
    stateCollectorsRef.current[id] = fn;
  }, []);
  const unregisterCollector = useCallback((id) => {
    delete stateCollectorsRef.current[id];
  }, []);
  const registerApplier = useCallback((id, fn) => {
    stateAppliersRef.current[id] = fn;
  }, []);
  const unregisterApplier = useCallback((id) => {
    delete stateAppliersRef.current[id];
  }, []);

  const registerViewSaver = useCallback((id, fn) => {
    viewSaversRef.current[id] = fn;
  }, []);
  const unregisterViewSaver = useCallback((id) => {
    delete viewSaversRef.current[id];
  }, []);

  /** Trigger "save current view" for a set of window ids. */
  const saveViews = useCallback(async (ids) => {
    const promises = [];
    for (const id of ids) {
      const saver = viewSaversRef.current[id];
      if (saver) {
        try { promises.push(saver()); } catch (_) { /* skip */ }
      }
    }
    await Promise.allSettled(promises);
  }, []);

  /** Collect all window states → { [windowId]: stateObj } */
  const collectAllStates = useCallback(() => {
    const states = {};
    for (const [id, fn] of Object.entries(stateCollectorsRef.current)) {
      try { states[id] = fn(); } catch (_) { /* skip broken collectors */ }
    }
    return { version: 1, windows: states };
  }, []);

  /** Apply a workspace state object to all windows. */
  const applyAllStates = useCallback((workspaceState) => {
    const windowStates = workspaceState?.windows || {};
    for (const [id, state] of Object.entries(windowStates)) {
      const applier = stateAppliersRef.current[id];
      if (applier) {
        try { applier(state); } catch (_) { /* skip broken appliers */ }
      }
    }
  }, []);

  // ── Context value ──
  const value = useMemo(
    () => ({
      // Config
      windowIds: windows.map((w) => w.id),
      windowCount: windows.length,

      // Queries
      openWindows,
      isOpen: (id) => openWindows.has(id),

      // Mutations – reporting
      reportOpen,
      reportClose,

      // Mutations – coordination
      minimizeAll,
      minimizeAllVersion,
      requestOpen,
      requestMinimize,
      openRequests,
      minimizeRequests,
      requestOpenFullScreen,
      openFullScreenRequests,
      allCollapsed,

      // Workspace state registry
      registerCollector,
      unregisterCollector,
      registerApplier,
      unregisterApplier,
      collectAllStates,
      applyAllStates,

      // View saver registry
      registerViewSaver,
      unregisterViewSaver,
      saveViews,
    }),
    [
      windows, openWindows,
      reportOpen, reportClose,
      minimizeAll, minimizeAllVersion,
      requestOpen, requestMinimize,
      openRequests, minimizeRequests,
      requestOpenFullScreen, openFullScreenRequests,
      allCollapsed,
      registerCollector, unregisterCollector,
      registerApplier, unregisterApplier,
      collectAllStates, applyAllStates,
      registerViewSaver, unregisterViewSaver, saveViews,
    ],
  );

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
      {allCollapsed && <OrbitMode />}
      <InventoryBar />
    </WindowManagerContext.Provider>
  );
}
