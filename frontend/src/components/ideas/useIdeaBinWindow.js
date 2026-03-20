import { useRef, useState, useCallback, useEffect } from "react";
import { playSound } from "../../assets/sound_registry";
import { getNextZIndex } from "../shared/windowZIndex";
import { useWindowManager } from "../shared/WindowManager";

// ───────────────────── Constants ─────────────────────
const MIN_W = 290;
const MIN_H = 220;
const DEFAULT_W = 340;
const DEFAULT_H = 460;

/** Default icon position when not managed by a WindowManager. */
const STANDALONE_ICON = { x: 8, y: 8 };

/**
 * Manages IdeaBin floating-window state:
 * position, size, icon position, maximize/minimize, and all drag/resize handlers.
 *
 * When inside a <WindowManager> the icon dock position comes automatically from
 * the manager config (id = "ideaBin"). Outside a manager it falls back to STANDALONE_ICON.
 */
export default function useIdeaBinWindow(headlineInputRef, instanceId = "ideaBin") {
  // ── Manager integration (optional) ──
  const manager = useWindowManager();
  const managed = !!(manager);
  const defaultIcon = STANDALONE_ICON;

  const [isOpen, setIsOpen] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth - 16, h: window.innerHeight - 68 });
  const [iconPos, setIconPos] = useState(() => ({ ...defaultIcon }));
  const [isMaximized, setIsMaximized] = useState(false);
  const [zIndex, setZIndex] = useState(() => getNextZIndex());
  const windowRef = useRef(null);
  const iconRef = useRef(null);

  // ── Extra state extensions for workspace integration ──
  const extraCollectorRef = useRef(null);
  const extraApplierRef = useRef(null);
  const setExtraStateCollector = useCallback((fn) => { extraCollectorRef.current = fn; }, []);
  const setExtraStateApplier = useCallback((fn) => { extraApplierRef.current = fn; }, []);

  // Refs that stay current for the collector closure
  const stateRef = useRef({ isOpen: false, windowPos: { x: 0, y: 0 }, windowSize: { w: 0, h: 0 }, isMaximized: false });
  useEffect(() => {
    stateRef.current = { isOpen, windowPos, windowSize, isMaximized };
  }, [isOpen, windowPos, windowSize, isMaximized]);

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
    if (isOpen) manager.reportOpen(instanceId);
    else manager.reportClose(instanceId);
    return () => { if (managed && manager) manager.reportClose(instanceId); };
  }, [isOpen, managed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Register state collector/applier with WindowManager for workspaces ──
  useEffect(() => {
    if (!managed) return;
    manager.registerCollector(instanceId, collectState);
    manager.registerApplier(instanceId, applyState);
    return () => {
      manager.unregisterCollector(instanceId);
      manager.unregisterApplier(instanceId);
    };
  }, [managed, collectState, applyState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's minimizeAll signal ──
  const lastMinAllRef = useRef(manager?.minimizeAllVersion ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.minimizeAllVersion;
    if (ver > lastMinAllRef.current && isOpen) {
      setIconPos({ ...defaultIcon });
      setIsOpen(false);
      setIsMaximized(false);
      playSound("ideaClose");
    }
    lastMinAllRef.current = ver;
  }, [managed, manager?.minimizeAllVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestOpen signal ──
  const lastOpenReqRef = useRef(manager?.openRequests?.[instanceId] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.openRequests?.[instanceId] ?? 0;
    if (ver > lastOpenReqRef.current && !isOpen) {
      const cs = customSizeRef.current;
      setWindowSize({ ...cs.size });
      setWindowPos({
        x: Math.max(4, (window.innerWidth - cs.size.w) / 2),
        y: Math.max(4, (window.innerHeight - cs.size.h) / 2 - 30),
      });
      setIsOpen(true);
      setIsMaximized(false);
      setZIndex(getNextZIndex());
      playSound("ideaOpen");
      setTimeout(() => headlineInputRef.current?.focus(), 100);
    }
    lastOpenReqRef.current = ver;
  }, [managed, manager?.openRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestMinimize signal ──
  const lastMinReqRef = useRef(manager?.minimizeRequests?.[instanceId] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.minimizeRequests?.[instanceId] ?? 0;
    if (ver > lastMinReqRef.current && isOpen) {
      setIconPos({ ...defaultIcon });
      setIsOpen(false);
      setIsMaximized(false);
      playSound("ideaClose");
    }
    lastMinReqRef.current = ver;
  }, [managed, manager?.minimizeRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestOpenFullScreen signal ──
  const lastFullReqRef = useRef(manager?.openFullScreenRequests?.[instanceId] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.openFullScreenRequests?.[instanceId] ?? 0;
    if (ver > lastFullReqRef.current && !isOpen) {
      const topY = managed ? 4 : 60;
      const bottomReserve = managed ? 80 : 68;
      setWindowPos({ x: 4, y: topY });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - bottomReserve });
      setIsOpen(true);
      setIsMaximized(true);
      setZIndex(getNextZIndex());
      playSound("ideaOpen");
      setTimeout(() => headlineInputRef.current?.focus(), 100);
    }
    lastFullReqRef.current = ver;
  }, [managed, manager?.openFullScreenRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to manager's per-window requestFocus signal ──
  const lastFocusReqRef = useRef(manager?.focusRequests?.[instanceId] ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.focusRequests?.[instanceId] ?? 0;
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
        playSound("ideaOpen");
        setTimeout(() => headlineInputRef.current?.focus(), 100);
      }
      setZIndex(getNextZIndex());
    }
    lastFocusReqRef.current = ver;
  }, [managed, manager?.focusRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Bring this window to front (call on mousedown / focus) */
  const bringToFront = useCallback(() => {
    setZIndex(getNextZIndex());
  }, []);

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
    playSound('ideaOpen');
    setTimeout(() => headlineInputRef.current?.focus(), 100);
  }, [iconPos, headlineInputRef]);

  const minimizeWindow = useCallback(() => {
    setIconPos({ ...defaultIcon });
    setIsOpen(false);
    setIsMaximized(false);
    playSound('ideaClose');
  }, [defaultIcon]);

  const toggleMaximize = useCallback(() => {
    const topY = managed ? 4 : 60;
    const bottomReserve = managed ? 80 : 68;
    if (isMaximized) {
      const cs = customSizeRef.current;
      setWindowPos({ ...cs.pos });
      setWindowSize({ ...cs.size });
      setIsMaximized(false);
    } else {
      setWindowPos({ x: 4, y: topY });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - bottomReserve });
      setIsMaximized(true);
    }
  }, [isMaximized, managed]);

  // ── Keep maximized window in sync with browser viewport size ──
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

    // Disable CSS transitions during drag for instant feedback
    el.style.transition = 'none';

    const onMove = (ev) => {
      moved = true;
      curX = Math.max(0, Math.min(ev.clientX - startX, window.innerWidth - 56));
      curY = Math.max(0, Math.min(ev.clientY - startY, window.innerHeight - 56));
      el.style.left = curX + 'px';
      el.style.top = curY + 'px';
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      el.style.transition = '';
      // Sync React state once
      setIconPos({ x: curX, y: curY });
      if (!moved) openWindow();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [iconPos, openWindow]);

  // ── Window title bar drag ──
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
        x: Math.max(0, Math.min(ev.clientX - startX, window.innerWidth - 60)),
        y: Math.max(0, Math.min(ev.clientY - startY, window.innerHeight - 40)),
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowPos, isMaximized]);

  // ── Window resize (bottom-right corner) ──
  const handleWindowResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
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
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowSize, isMaximized]);

  // ── Window resize edges ──
  const handleEdgeResize = useCallback((e, edge) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMaximized) setIsMaximized(false);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = windowSize.w;
    const startH = windowSize.h;
    const startPosX = windowPos.x;
    const startPosY = windowPos.y;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const resizeRight = edge.includes("right");
      const resizeLeft = edge.includes("left");
      const resizeBottom = edge.includes("bottom");
      const resizeTop = edge.includes("top");

      if (resizeRight) {
        setWindowSize(s => ({ ...s, w: Math.max(MIN_W, startW + dx) }));
      }
      if (resizeLeft) {
        const newW = Math.max(MIN_W, startW - dx);
        setWindowSize(s => ({ ...s, w: newW }));
        setWindowPos(p => ({ ...p, x: startPosX + startW - newW }));
      }
      if (resizeBottom) {
        setWindowSize(s => ({ ...s, h: Math.max(MIN_H, startH + dy) }));
      }
      if (resizeTop) {
        const newH = Math.max(MIN_H, startH - dy);
        setWindowSize(s => ({ ...s, h: newH }));
        setWindowPos(p => ({ ...p, y: startPosY + startH - newH }));
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [windowSize, windowPos, isMaximized]);

  return {
    isOpen, setIsOpen,
    windowPos, setWindowPos, windowSize, setWindowSize,
    iconPos,
    isMaximized, setIsMaximized,
    zIndex, bringToFront,
    windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag, handleWindowResize, handleEdgeResize,
    managed,
    setExtraStateCollector,
    setExtraStateApplier,
  };
}
