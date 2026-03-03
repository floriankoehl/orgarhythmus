import { createContext, useContext, useCallback, useMemo, useRef, useState } from "react";

/**
 * WindowManager — a standalone, layout-agnostic orchestrator for a set of
 * floating windows.
 *
 * Responsibilities:
 * ─ Assign icon dock positions automatically from a config array (no hardcoded y-values).
 * ─ Track which windows are open / closed (passive — windows report their state).
 * ─ Provide coordination APIs: minimizeAll, openById, getIconPosition, etc.
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
 * Designed to be instantiated at any layout level (project, org, etc.) — the same
 * component, just different config.
 *
 * @param {Object[]} windows     Ordered array of { id: string } – defines dock slot order.
 * @param {number}   dockX       X coordinate for the icon dock strip (default 8).
 * @param {number}   dockStartY  Y coordinate for the first icon (default 60).
 * @param {number}   iconSpacing Vertical gap between icons (default 52).
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
  dockX = 8,
  dockStartY = 60,
  iconSpacing = 52,
}) {
  // ── Slot positions (deterministic, from config array order) ──
  const slots = useMemo(() => {
    const map = new Map();
    windows.forEach((w, i) => {
      map.set(w.id, { x: dockX, y: dockStartY + i * iconSpacing });
    });
    return map;
  }, [windows, dockX, dockStartY, iconSpacing]);

  const getIconPosition = useCallback(
    (id) => slots.get(id) || { x: dockX, y: dockStartY },
    [slots, dockX, dockStartY],
  );

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

  // ── Coordination helpers (callable from outside or from windows) ──

  /**
   * minimizeAll — every registered window will check this version counter.
   * We bump a counter; windows compare against their own snapshot to know
   * they should minimize. This avoids the manager needing direct refs to every window.
   */
  const [minimizeAllVersion, setMinimizeAllVersion] = useState(0);
  const minimizeAll = useCallback(() => {
    setMinimizeAllVersion((v) => v + 1);
  }, []);

  // ── Context value (stable unless config or open-set changes) ──
  const value = useMemo(
    () => ({
      // Config
      slots,
      windowIds: windows.map((w) => w.id),
      dockX,
      dockStartY,
      iconSpacing,

      // Queries
      getIconPosition,
      openWindows,
      isOpen: (id) => openWindows.has(id),
      windowCount: windows.length,

      // Mutations
      reportOpen,
      reportClose,
      minimizeAll,
      minimizeAllVersion,
    }),
    [
      slots, windows, dockX, dockStartY, iconSpacing,
      getIconPosition, openWindows,
      reportOpen, reportClose,
      minimizeAll, minimizeAllVersion,
    ],
  );

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}
