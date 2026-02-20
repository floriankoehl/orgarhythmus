// useCamera3D.js — Camera state, input handlers, and screen-to-floor unprojection
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import {
  CAMERA_BASE_DISTANCE,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_DEFAULT_TILT,
  CAMERA_DEFAULT_YAW,
  CAMERA_DEFAULT_SCALE,
  CAMERA_SCALE_MIN,
  CAMERA_SCALE_MAX,
  PERSPECTIVE_DEPTH,
} from './assignment3DConstants.js';

/**
 * useCamera3D — manages orbit, pan, zoom/scale state + mouse/wheel input.
 *
 * @param {Object} opts
 * @param {React.RefObject} opts.viewportRef       — ref to the perspective viewport div
 * @param {React.RefObject} opts.draggingPersona   — ref whose .current = persona id being dragged (or null)
 * @param {React.RefObject} opts.dragAnchor        — ref with drag anchor info
 * @param {Function}        opts.onPersonaDragStart — (pid, clientX, clientY) called on left-click of [data-persona-id]
 * @param {Function}        opts.onPersonaDragMove  — (clientX, clientY) called on mousemove while dragging persona
 * @param {Function}        opts.onPersonaDragEnd   — (e) called on mouseup while dragging persona
 * @param {Function}        opts.handleNextView     — ref-stable callback for next view (keyboard shortcut)
 * @param {Function}        opts.handlePrevView     — ref-stable callback for prev view (keyboard shortcut)
 */
export function useCamera3D({
  viewportRef,
  draggingPersona,
  dragAnchor,
  onPersonaDragMove,
  onPersonaDragEnd,
  handleNextView,
  handlePrevView,
}) {
  // ── Camera state ───────────────────────────────────────────────
  const [orbitX, setOrbitX] = useState(CAMERA_DEFAULT_TILT);
  const [orbitY, setOrbitY] = useState(CAMERA_DEFAULT_YAW);
  const [panX, setPanX]     = useState(0);
  const [panY, setPanY]     = useState(0);
  const [panZ, setPanZ]     = useState(0);
  const [zoom, setZoom]     = useState(CAMERA_DEFAULT_ZOOM);
  const [cameraScale, setCameraScale] = useState(CAMERA_DEFAULT_SCALE);

  const isDragging = useRef(false);
  const isPanning  = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });

  // Keep camera values in refs so event handlers always see current values
  const orbitXRef = useRef(orbitX);
  const orbitYRef = useRef(orbitY);
  const zoomRef = useRef(zoom);
  const cameraScaleRef = useRef(cameraScale);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const panZRef = useRef(panZ);
  useEffect(() => { orbitXRef.current = orbitX; }, [orbitX]);
  useEffect(() => { orbitYRef.current = orbitY; }, [orbitY]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { cameraScaleRef.current = cameraScale; }, [cameraScale]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);
  useEffect(() => { panZRef.current = panZ; }, [panZ]);

  // ── Screen-to-floor unprojection ───────────────────────────────
  /** Cast ray from camera through screen point (sx, sy) onto Y=0 floor.
   *  Returns { x, z } in world space, or null if ray is parallel to floor.
   */
  const screenToFloor = (sx, sy) => {
    const P = PERSPECTIVE_DEPTH;
    const el = viewportRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cxS = rect.left + rect.width / 2;
    const cyS = rect.top  + rect.height / 2;

    const pitch = orbitXRef.current * Math.PI / 180;
    const yaw   = orbitYRef.current * Math.PI / 180;
    const zOff  = zoomRef.current - CAMERA_BASE_DISTANCE + panZRef.current;
    const panXV = panXRef.current;
    const panYV = panYRef.current;

    const projX = sx - cxS;
    const projY = sy - cyS;

    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    if (Math.abs(sp) < 1e-6) return null;

    const cotP = cp / sp;
    const denom = 1 + cotP * projY / P;
    if (Math.abs(denom) < 1e-8) return null;

    const rz = cotP * (projY - panYV) / denom;
    const ry = rz * sp / cp;
    const rx = projX * (P - rz) / P - panXV;

    const ux = rx;
    const uz = ry * sp + rz * cp;

    const qx = ux * cyw + uz * syw;
    const qz = -ux * syw + uz * cyw;

    const s = cameraScaleRef.current;
    return { x: qx / s, z: (qz - zOff) / s };
  };

  // ── Mouse / wheel event handlers ──────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      // Left click on a persona = start dragging it
      if (e.button === 0) {
        const personaEl = e.target.closest('[data-persona-id]');
        if (personaEl) {
          e.preventDefault();
          e.stopPropagation();
          const pid = Number(personaEl.dataset.personaId);
          draggingPersona.current = pid;
          lastMouse.current = { x: e.clientX, y: e.clientY };
          // Compute floor hit point at mouse-down position
          const hit = screenToFloor(e.clientX, e.clientY);
          if (hit) {
            dragAnchor.current = { floorX: hit.x, floorZ: hit.z, pid };
          }
          // Notify parent (sets draggingId state for lift animation)
          onPersonaDragMove(e);
          return;
        }
      }
      // Middle mouse = orbit, Right mouse = pan
      if (e.button === 1) {
        e.preventDefault();
        isDragging.current = true;
        isPanning.current  = e.shiftKey;
        lastMouse.current  = { x: e.clientX, y: e.clientY };
      } else if (e.button === 2) {
        e.preventDefault();
        isDragging.current = true;
        isPanning.current  = true;
        lastMouse.current  = { x: e.clientX, y: e.clientY };
      }
    };

    const onMove = (e) => {
      // Persona drag — ray-plane intersection
      if (draggingPersona.current != null && dragAnchor.current) {
        onPersonaDragMove(e);
        return;
      }
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      if (isPanning.current) {
        setPanX((prev) => prev + dx);
        setPanY((prev) => prev + dy);
      } else {
        setOrbitY((prev) => prev - dx * 0.3);
        setOrbitX((prev) => Math.max(5, Math.min(90, prev - dy * 0.3)));
      }
    };

    const onUp = (e) => {
      if (e.button === 0 && draggingPersona.current != null) {
        onPersonaDragEnd(e);
        return;
      }
      if (e.button === 1 || e.button === 2) {
        isDragging.current = false;
        isPanning.current  = false;
      }
    };

    const onContextMenu = (e) => e.preventDefault();

    // Scroll wheel = scale zoom (toward cursor), Shift+wheel = navigate along Z-axis
    const onWheel = (e) => {
      const inside = e.target.closest('[data-board-scroll]');
      if (inside) return;
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+wheel → navigate along the world Z-axis
        setPanZ((prev) => prev + e.deltaY * 0.8);
      } else {
        // Plain wheel → scale zoom toward cursor position
        const el = viewportRef.current;
        const rect = el?.getBoundingClientRect();
        const vpCX = rect ? rect.left + rect.width / 2 : 0;
        const vpCY = rect ? rect.top  + rect.height / 2 : 0;
        // Cursor offset from viewport center (screen-space)
        const dx = e.clientX - vpCX;
        const dy = e.clientY - vpCY;

        const oldScale = cameraScaleRef.current;
        const factor = Math.exp(-e.deltaY * 0.003);
        const newScale = Math.max(CAMERA_SCALE_MIN, Math.min(CAMERA_SCALE_MAX, oldScale * factor));
        const ratio = newScale / oldScale;

        setCameraScale(newScale);
        // Adjust pan so the world-point under the cursor stays fixed
        setPanX((prev) => dx - (dx - prev) * ratio);
        setPanY((prev) => dy - (dy - prev) * ratio);
      }
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('wheel', onWheel, { passive: false });
    const preventScroll = (e) => { if (e.button === 1) e.preventDefault(); };
    window.addEventListener('auxclick', preventScroll);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('auxclick', preventScroll);
    };
  }, []);

  // ── Keyboard shortcuts: X = cycle views, ←/→ = prev/next ─────
  const handleNextViewRef = useRef(handleNextView);
  const handlePrevViewRef = useRef(handlePrevView);
  useEffect(() => { handleNextViewRef.current = handleNextView; }, [handleNextView]);
  useEffect(() => { handlePrevViewRef.current = handlePrevView; }, [handlePrevView]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        handleNextViewRef.current();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextViewRef.current();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevViewRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    orbitX, orbitY, panX, panY, panZ, zoom, cameraScale,
    setOrbitX, setOrbitY, setPanX, setPanY, setPanZ, setZoom, setCameraScale,
    screenToFloor,
    lastMouse,
  };
}
