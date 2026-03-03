import { createContext, useContext, useCallback, useMemo, useRef, useState } from "react";
import InventoryBar from "./InventoryBar";

/**
 * WindowManager — a standalone, layout-agnostic orchestrator for a set of
 * floating windows.
 *
 * Responsibilities:
 * ─ Track which windows are open / closed (passive — windows report their state).
 * ─ Provide coordination APIs: minimizeAll, requestOpen, requestMinimize, etc.
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
    openSetRef.current.add(id);
    setOpenWindows(new Set(openSetRef.current));
  }, []);

  const reportClose = useCallback((id) => {
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
    }),
    [
      windows, openWindows,
      reportOpen, reportClose,
      minimizeAll, minimizeAllVersion,
      requestOpen, requestMinimize,
      openRequests, minimizeRequests,
    ],
  );

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
      <InventoryBar />
    </WindowManagerContext.Provider>
  );
}
