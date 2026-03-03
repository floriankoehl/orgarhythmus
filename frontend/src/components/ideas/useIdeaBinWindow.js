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
export default function useIdeaBinWindow(headlineInputRef) {
  // ── Manager integration (optional) ──
  const manager = useWindowManager();
  const managed = !!(manager);
  const defaultIcon = managed
    ? manager.getIconPosition("ideaBin")
    : STANDALONE_ICON;

  const [isOpen, setIsOpen] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth - 16, h: window.innerHeight - 68 });
  const [iconPos, setIconPos] = useState(() => ({ ...defaultIcon }));
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaxState, setPreMaxState] = useState(null);
  const [zIndex, setZIndex] = useState(() => getNextZIndex());
  const windowRef = useRef(null);
  const iconRef = useRef(null);

  // ── Report open/close to manager ──
  useEffect(() => {
    if (!managed) return;
    if (isOpen) manager.reportOpen("ideaBin");
    else manager.reportClose("ideaBin");
  }, [isOpen, managed, manager]);

  // ── React to manager's minimizeAll signal ──
  const lastMinAllRef = useRef(manager?.minimizeAllVersion ?? 0);
  useEffect(() => {
    if (!managed) return;
    const ver = manager.minimizeAllVersion;
    if (ver > lastMinAllRef.current && isOpen) {
      setIconPos({ ...defaultIcon });
      setIsOpen(false);
      setIsMaximized(false);
      setPreMaxState(null);
      playSound("ideaClose");
    }
    lastMinAllRef.current = ver;
  }, [managed, manager?.minimizeAllVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Bring this window to front (call on mousedown / focus) */
  const bringToFront = useCallback(() => {
    setZIndex(getNextZIndex());
  }, []);

  const openWindow = useCallback(() => {
    setWindowPos({
      x: Math.max(0, Math.min(iconPos.x - windowSize.w + 48, window.innerWidth - windowSize.w)),
      y: Math.max(0, Math.min(iconPos.y - windowSize.h + 48, window.innerHeight - windowSize.h)),
    });
    setIsOpen(true);
    setZIndex(getNextZIndex());
    playSound('ideaOpen');
    setTimeout(() => headlineInputRef.current?.focus(), 100);
  }, [iconPos, windowSize, headlineInputRef]);

  const minimizeWindow = useCallback(() => {
    // Collapse to top-left corner (over header)
    // Collapse to dock position (manager-aware or standalone)
    setIconPos({ ...defaultIcon });
    setIsOpen(false);
    setIsMaximized(false);
    setPreMaxState(null);
    playSound('ideaClose');
  }, [defaultIcon]);

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      if (preMaxState) {
        setWindowPos(preMaxState.pos);
        setWindowSize(preMaxState.size);
      }
      setIsMaximized(false);
      setPreMaxState(null);
    } else {
      setPreMaxState({ pos: { ...windowPos }, size: { ...windowSize } });
      setWindowPos({ x: 4, y: 60 });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - 68 });
      setIsMaximized(true);
    }
  }, [isMaximized, preMaxState, windowPos, windowSize]);

  // ── Keep maximized window in sync with browser viewport size ──
  useEffect(() => {
    if (!isMaximized) return;
    const onResize = () => {
      setWindowPos({ x: 4, y: 60 });
      setWindowSize({ w: window.innerWidth - 8, h: window.innerHeight - 68 });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMaximized]);

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
    // Auto-unmaximize when dragging
    if (isMaximized) {
      setIsMaximized(false);
      setPreMaxState(null);
    }
    const startX = e.clientX - windowPos.x;
    const startY = e.clientY - windowPos.y;

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
    // Auto-unmaximize when resizing
    if (isMaximized) {
      setIsMaximized(false);
      setPreMaxState(null);
    }
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
    // Auto-unmaximize when resizing
    if (isMaximized) {
      setIsMaximized(false);
      setPreMaxState(null);
    }
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
  };
}
