import { useRef, useState, useCallback, useEffect } from "react";
import { playSound } from "../../assets/sound_registry";
import { getNextZIndex } from "./windowZIndex";
import { useWindowManager } from "./WindowManager";

/**
 * Generic floating-window hook — manages position, size, icon position,
 * maximize/minimize, z-index focus, and all drag/resize handlers.
 *
 * When used inside a <WindowManager> and an `id` is provided, the hook
 * automatically integrates:
 *   – open/close state is reported to the manager
 *   – the manager's `minimizeAll` signal is respected
 *   – the manager's `requestOpen` / `requestMinimize` signals are respected
 *   – returns `managed = true` so the component can hide its own floating icon
 *     (the InventoryBar takes over icon rendering)
 *
 * Falls back to standalone behaviour (hardcoded `defaultIcon`) when no
 * manager is present — fully backward-compatible.
 *
 * @param {Object}  opts
 * @param {string}  [opts.id]          unique id — required for manager integration
 * @param {string}  opts.openSound     sound key on open  (default "ideaOpen")
 * @param {string}  opts.closeSound    sound key on close (default "ideaClose")
 * @param {Object}  opts.defaultIcon   fallback icon pos  (default {x:8, y:8})
 * @param {Object}  opts.minSize       {w, h}             (default {w:290, h:220})
 * @param {React.RefObject} [opts.focusRef]  ref to focus after open
 */
export default function useFloatingWindow(opts = {}) {
  const {
    id,
    openSound = "ideaOpen",
    closeSound = "ideaClose",
    defaultIcon: defaultIconFallback = { x: 8, y: 8 },
    minSize = { w: 290, h: 220 },
    focusRef,
  } = opts;

  // ── Manager integration (optional) ──
  const manager = useWindowManager();
  const managed = !!(manager && id);

  // Stable ref to manager.commitLayout (avoids stale closures in drag handlers)
  const commitLayoutRef = useRef(null);
  useEffect(() => { commitLayoutRef.current = manager?.commitLayout; });

  // Resolve default icon position: fallback for standalone; managed mode
  // no longer uses dock positions (InventoryBar owns icons).
  const defaultIcon = defaultIconFallback;

  const MIN_W = minSize.w;
  const MIN_H = minSize.h;

  const [isOpen, setIsOpen] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({
    w: window.innerWidth - 16,
    h: window.innerHeight - 68,
  });
  const [iconPos, setIconPos] = useState(() => ({ ...defaultIcon }));
  const [isMaximized, setIsMaximized] = useState(false);
  const [zIndex, setZIndex] = useState(() => getNextZIndex());
  const windowRef = useRef(null);
  const iconRef = useRef(null);

  // ── Extra state extensions for workspace integration ──
  const extraCollectorRef = useRef(null);
  const extraApplierRef = useRef(null);

  /** Let the window component register an extra state collector (e.g. Calendar's viewMode). */
  const setExtraStateCollector = useCallback((fn) => { extraCollectorRef.current = fn; }, []);
  /** Let the window component register an extra state applier. */
  const setExtraStateApplier = useCallback((fn) => { extraApplierRef.current = fn; }, []);

  // Refs that stay current for the collector closure
  const stateRef = useRef({ isOpen: false, windowPos: { x: 0, y: 0 }, windowSize: { w: 0, h: 0 }, isMaximized: false });
  useEffect(() => {
    stateRef.current = { isOpen, windowPos, windowSize, isMaximized };
  }, [isOpen, windowPos, windowSize, isMaximized]);

  // Stable collect/apply functions for workspace registry
  const collectState = useCallback(() => ({
    is_open: stateRef.current.isOpen,
    window_pos: stateRef.current.windowPos,
    window_size: stateRef.current.windowSize,
    is_maximized: stateRef.current.isMaximized,
    ...(extraCollectorRef.current?.() || {}),
  }), []);

  const applyState = useCallback((state) => {
    if (!state) return;
    if (state.window_pos) setWindowPos(state.window_pos);
    if (state.window_size) setWindowSize(state.window_size);
    if (state.is_maximized !== undefined) setIsMaximized(state.is_maximized);
    if (state.is_open !== undefined) setIsOpen(state.is_open);
    extraApplierRef.current?.(state);
  }, []);

  // ── Custom size tracking (persists across maximize/minimize cycles) ──
  const customSizeRef = useRef({
    pos: { x: 0, y: 0 },
    size: { w: window.innerWidth - 16, h: window.innerHeight - 68 },
  });

  // Continuously track custom (non-maximized) size
  useEffect(() => {
    if (isOpen && !isMaximized) {
      customSizeRef.current = { pos: { ...windowPos }, size: { ...windowSize } };
    }
  }, [windowPos, windowSize, isMaximized, isOpen]);

  // ── Report open/close to manager ──
  useEffect(() => {
    if (!managed) return;
    if (isOpen) manager.reportOpen(id);
    else manager.reportClose(id);
    // On unmount, ensure we deregister from openWindows
    return () => { if (managed && manager) manager.reportClose(id); };
  }, [isOpen, managed, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Register state collector/applier with WindowManager for workspaces ──
  useEffect(() => {
    if (!managed) return;
    manager.registerCollector(id, collectState);
    manager.registerApplier(id, applyState);
    return () => {
      manager.unregisterCollector(id);
      manager.unregisterApplier(id);
    };
  }, [managed, id, collectState, applyState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's minimizeAll signal ──
  const lastMinAllRef = useRef(manager?.minimizeAllVersion ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.minimizeAllVersion;
    if (ver > lastMinAllRef.current && isOpen) {
      // Trigger minimize
      setIconPos({ ...defaultIcon });
      setIsOpen(false);
      setIsMaximized(false);
      playSound(closeSound);
    }
    lastMinAllRef.current = ver;
  }, [managed, manager?.minimizeAllVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestOpen signal ──
  const lastOpenReqRef = useRef(manager?.openRequests?.[id] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.openRequests?.[id] ?? 0;
    if (ver > lastOpenReqRef.current && !isOpen) {
      // Restore custom size, centered on screen
      const cs = customSizeRef.current;
      setWindowSize({ ...cs.size });
      setWindowPos({
        x: Math.max(4, (window.innerWidth - cs.size.w) / 2),
        y: Math.max(4, (window.innerHeight - cs.size.h) / 2 - 30),
      });
      setIsOpen(true);
      setIsMaximized(false);
      setZIndex(getNextZIndex());
      playSound(openSound);
      if (focusRef) setTimeout(() => focusRef.current?.focus(), 100);
    }
    lastOpenReqRef.current = ver;
  }, [managed, manager?.openRequests, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestMinimize signal ──
  const lastMinReqRef = useRef(manager?.minimizeRequests?.[id] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.minimizeRequests?.[id] ?? 0;
    if (ver > lastMinReqRef.current && isOpen) {
      setIconPos({ ...defaultIcon });
      setIsOpen(false);
      setIsMaximized(false);
      playSound(closeSound);
    }
    lastMinReqRef.current = ver;
  }, [managed, manager?.minimizeRequests, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestOpenFullScreen signal ──
  const lastFullReqRef = useRef(manager?.openFullScreenRequests?.[id] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.openFullScreenRequests?.[id] ?? 0;
    if (ver > lastFullReqRef.current && !isOpen) {
      const topY = managed ? 4 : 60;
      const bottomReserve = managed ? 80 : 68;
      setWindowPos({ x: 4, y: topY });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - bottomReserve });
      setIsOpen(true);
      setIsMaximized(true);
      setZIndex(getNextZIndex());
      playSound(openSound);
      if (focusRef) setTimeout(() => focusRef.current?.focus(), 100);
    }
    lastFullReqRef.current = ver;
  }, [managed, manager?.openFullScreenRequests, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestFocus signal ──
  const lastFocusReqRef = useRef(manager?.focusRequests?.[id] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.focusRequests?.[id] ?? 0;
    if (ver > lastFocusReqRef.current) {
      if (!isOpen) {
        const cs = customSizeRef.current;
        setWindowSize({ ...cs.size });
        setWindowPos({
          x: Math.max(4, (window.innerWidth - cs.size.w) / 2),
          y: Math.max(4, (window.innerHeight - cs.size.h) / 2 - 30),
        });
        setIsOpen(true);
        setIsMaximized(false);
        playSound(openSound);
        if (focusRef) setTimeout(() => focusRef.current?.focus(), 100);
      }
      setZIndex(getNextZIndex());
    }
    lastFocusReqRef.current = ver;
  }, [managed, manager?.focusRequests, id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Bring this window to front (call on mousedown / focus) */
  const bringToFront = useCallback(() => {
    setZIndex(getNextZIndex());
  }, []);

  // ── Open / minimise / maximise ──
  const openWindow = useCallback(() => {
    const cs = customSizeRef.current;
    setWindowSize({ ...cs.size });
    setWindowPos({
      x: Math.max(0, Math.min(iconPos.x - cs.size.w + 48, window.innerWidth - cs.size.w)),
      y: Math.max(0, Math.min(iconPos.y - cs.size.h + 48, window.innerHeight - cs.size.h)),
    });
    setIsOpen(true);
    setIsMaximized(false);
    setZIndex(getNextZIndex());
    playSound(openSound);
    if (focusRef) setTimeout(() => focusRef.current?.focus(), 100);
  }, [iconPos, openSound, focusRef]);

  const minimizeWindow = useCallback(() => {
    setIconPos({ ...defaultIcon });
    setIsOpen(false);
    setIsMaximized(false);
    playSound(closeSound);
  }, [closeSound, defaultIcon]);

  const toggleMaximize = useCallback(() => {
    const topY = managed ? 4 : 60;
    const bottomReserve = managed ? 80 : 68;
    if (isMaximized) {
      // Restore to last custom size
      const cs = customSizeRef.current;
      setWindowPos({ ...cs.pos });
      setWindowSize({ ...cs.size });
      setIsMaximized(false);
    } else {
      // Go fullscreen (customSizeRef already tracks current state)
      setWindowPos({ x: 4, y: topY });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - bottomReserve });
      setIsMaximized(true);
    }
    commitLayoutRef.current?.();
  }, [isMaximized, managed]);

  // ── Keep maximized window in sync with viewport ──
  useEffect(() => {
    if (!isMaximized) return;
    const topY = managed ? 4 : 60;
    const bottomReserve = managed ? 80 : 68;
    const onResize = () => {
      setWindowPos({ x: 4, y: topY });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - bottomReserve });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMaximized, managed]);

  // ── Icon drag (direct DOM for performance) ──
  const handleIconDrag = useCallback((e) => {
    e.preventDefault();
    const el = iconRef.current;
    if (!el) return;
    const startX = e.clientX - iconPos.x;
    const startY = e.clientY - iconPos.y;
    let moved = false;
    let curX = iconPos.x;
    let curY = iconPos.y;

    el.style.transition = "none";

    const onMove = (ev) => {
      moved = true;
      curX = Math.max(0, Math.min(ev.clientX - startX, window.innerWidth - 56));
      curY = Math.max(0, Math.min(ev.clientY - startY, window.innerHeight - 56));
      el.style.left = curX + "px";
      el.style.top = curY + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      el.style.transition = "";
      setIconPos({ x: curX, y: curY });
      if (!moved) openWindow();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [iconPos, openWindow]);

  // ── Window title-bar drag ──
  const handleWindowDrag = useCallback((e) => {
    e.preventDefault();
    let startPosX, startPosY;

    if (isMaximized) {
      // Auto-unmaximize: restore custom size, centered on cursor
      const cs = customSizeRef.current;
      startPosX = Math.max(0, Math.min(e.clientX - cs.size.w / 2, window.innerWidth - cs.size.w));
      startPosY = Math.max(0, e.clientY - 12);
      setWindowPos({ x: startPosX, y: startPosY });
      setWindowSize({ ...cs.size });
      setIsMaximized(false);
    } else {
      startPosX = windowPos.x;
      startPosY = windowPos.y;
    }

    const startX = e.clientX - startPosX;
    const startY = e.clientY - startPosY;

    const onMove = (ev) => {
      setWindowPos({
        x: Math.max(0, Math.min(ev.clientX - startX, window.innerWidth - 100)),
        y: Math.max(0, Math.min(ev.clientY - startY, window.innerHeight - 40)),
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      commitLayoutRef.current?.();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [isMaximized, windowPos]);

  // ── Window resize (corner handle) ──
  const handleWindowResize = useCallback((e) => {
    e.preventDefault();
    if (isMaximized) setIsMaximized(false);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = windowSize.w;
    const startH = windowSize.h;

    const onMove = (ev) => {
      setWindowSize({
        w: Math.max(MIN_W, startW + (ev.clientX - startX)),
        h: Math.max(MIN_H, startH + (ev.clientY - startY)),
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      commitLayoutRef.current?.();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowSize, isMaximized, MIN_W, MIN_H]);

  // ── Edge resize ──
  const handleEdgeResize = useCallback((e, edge) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMaximized) setIsMaximized(false);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...windowPos };
    const startSize = { ...windowSize };

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newX = startPos.x, newY = startPos.y;
      let newW = startSize.w, newH = startSize.h;

      if (edge.includes("right"))  newW = Math.max(MIN_W, startSize.w + dx);
      if (edge.includes("bottom")) newH = Math.max(MIN_H, startSize.h + dy);
      if (edge.includes("left"))   { newW = Math.max(MIN_W, startSize.w - dx); newX = startPos.x + startSize.w - newW; }
      if (edge.includes("top"))    { newH = Math.max(MIN_H, startSize.h - dy); newY = startPos.y + startSize.h - newH; }

      setWindowPos({ x: newX, y: newY });
      setWindowSize({ w: newW, h: newH });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      commitLayoutRef.current?.();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowPos, windowSize, isMaximized, MIN_W, MIN_H]);

  return {
    isOpen, setIsOpen,
    windowPos, setWindowPos,
    windowSize, setWindowSize,
    iconPos, setIconPos,
    isMaximized, setIsMaximized,
    zIndex, bringToFront,
    windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag,
    handleWindowResize, handleEdgeResize,
    /** true when inside a WindowManager — the InventoryBar owns icon rendering */
    managed,
    /** Register extra state collector for workspace (call once from the window component) */
    setExtraStateCollector,
    /** Register extra state applier for workspace (call once from the window component) */
    setExtraStateApplier,
  };
}
