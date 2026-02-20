// engine3d/useCamera3D.js — Camera state, input handlers, and screen-to-floor unprojection
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CAMERA_BASE_DISTANCE,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_DEFAULT_TILT,
  CAMERA_DEFAULT_YAW,
  CAMERA_DEFAULT_SCALE,
  CAMERA_SCALE_MIN,
  CAMERA_SCALE_MAX,
  PERSPECTIVE_DEPTH,
  PERSONA_SIZE,
  PERSONA_DRAG_LIFT,
} from './constants.js';

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

  // Refs are the single source of truth for event handlers.
  // They are updated directly in handlers BEFORE calling setState.
  // No useEffect syncs — those cause async fighting with manual ref updates.
  const orbitXRef = useRef(orbitX);
  const orbitYRef = useRef(orbitY);
  const zoomRef = useRef(zoom);
  const cameraScaleRef = useRef(cameraScale);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const panZRef = useRef(panZ);

  // Orbit anchor — captured once when orbit drag starts (middle-click).
  // Stores the world-space pivot point and its initial perspective depth
  // so the camera orbits at constant distance (no zoom drift).
  const orbitAnchor = useRef(null);

  // ── Screen-to-plane unprojection ────────────────────────────────
  /** Cast ray from camera through screen point (sx, sy) onto a horizontal
   *  plane at height planeY above Y=0.  Returns { x, z } in world space,
   *  or null if ray is parallel to the plane.
   */
  const screenToFloor = (sx, sy, planeY = 0) => {
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

    const h = planeY; // height above floor
    const denom = sp * P + cp * projY;
    if (Math.abs(denom) < 1e-8) return null;

    // z3 = post-rotateY Z for ray-plane intersection at y_local = -h
    const z3 = (P * (projY - panYV + h * cp) - projY * h * sp) / denom;
    const z4 = h * sp + z3 * cp; // depth after rotateX
    const x3 = projX * (P - z4) / P - panXV;

    // Undo rotateY
    const sxW = x3 * cyw + z3 * syw;
    const szW = -x3 * syw + z3 * cyw;

    const s = cameraScaleRef.current;
    return { x: sxW / s, z: (szW - zOff) / s };
  };

  // ── World-to-screen projection (forward transform) ───────────
  /** Project a world-space floor point (wx, 0, wz) to screen coords.
   *  Returns { sx, sy, f } where f is the perspective factor, or null.
   */
  const worldToScreen = (wx, wz) => {
    const P = PERSPECTIVE_DEPTH;
    const el = viewportRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cxS = rect.left + rect.width / 2;
    const cyS = rect.top  + rect.height / 2;

    const pitch = orbitXRef.current * Math.PI / 180;
    const yaw   = orbitYRef.current * Math.PI / 180;
    const zOff  = zoomRef.current - CAMERA_BASE_DISTANCE + panZRef.current;
    const s     = cameraScaleRef.current;
    const panXV = panXRef.current;
    const panYV = panYRef.current;

    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);

    // Scale + translateZ
    const sxW = wx * s;
    const szW = wz * s + zOff;

    // RotateY(-yaw)
    const x3 = sxW * cyw - szW * syw;
    const z3 = sxW * syw + szW * cyw;

    // RotateX(-pitch):  y4 = z3 * sinPitch,  z4 = z3 * cosPitch
    const x4 = x3;
    const y4 = z3 * sp;
    const z4 = z3 * cp;

    // Translate(panX, panY)
    const x5 = x4 + panXV;
    const y5 = y4 + panYV;

    const denom = P - z4;
    if (Math.abs(denom) < 1e-6) return null;
    const f = P / denom;

    return { sx: x5 * f + cxS, sy: y5 * f + cyS, f };
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
          // Compute drag plane height (approx center of persona figure)
          const dragPlaneY = PERSONA_SIZE * 0.75 + PERSONA_DRAG_LIFT;
          // Compute hit on the persona-height plane (not floor)
          const hit = screenToFloor(e.clientX, e.clientY, dragPlaneY);
          if (hit) {
            dragAnchor.current = { floorX: hit.x, floorZ: hit.z, pid, planeY: dragPlaneY };
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
        // Capture orbit anchor at drag start (orbit mode only, not pan)
        if (!e.shiftKey) {
          const floorPt = screenToFloor(e.clientX, e.clientY);
          const dist = floorPt ? Math.sqrt(floorPt.x * floorPt.x + floorPt.z * floorPt.z) : Infinity;
          if (floorPt && dist < 5000) {
            // Store just the world-space pivot and its target screen position.
            // The orbit handler uses a forward transform (no inverse, no division
            // by cos(yaw)) to compute pan, so there is no singularity.
            orbitAnchor.current = {
              worldX: floorPt.x, worldZ: floorPt.z,
              screenX: e.clientX, screenY: e.clientY,
            };
          } else {
            orbitAnchor.current = null;
          }
        }
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
        panXRef.current += dx;
        panYRef.current += dy;
        setPanX(panXRef.current);
        setPanY(panYRef.current);
      } else {
        // ── True orbit around fixed pivot ──
        // The orbit anchor (captured at drag start) stays at a fixed screen
        // position AND a fixed perspective depth → no zoom drift.
        const anchor = orbitAnchor.current;
        const newOrbitY = orbitYRef.current - dx * 0.3;
        const newOrbitX = Math.max(5, Math.min(90, orbitXRef.current - dy * 0.3));
        orbitXRef.current = newOrbitX;
        orbitYRef.current = newOrbitY;

        if (anchor) {
          // ── Pivot-based orbit (singularity-free) ──
          // Forward-transform the pivot point at the NEW angles to find where
          // it would appear on screen without pan compensation.  Then set
          // panX/panY so it lands at its original screen position.
          //
          // This uses only multiplication & addition (no 1/cos(yaw) division),
          // so it is geometrically stable at every yaw including ±90°.
          // Zoom stays constant — only pan changes during orbit.
          const { worldX: ax, worldZ: az, screenX: anchorSX, screenY: anchorSY } = anchor;
          const P = PERSPECTIVE_DEPTH;
          const pitch = newOrbitX * Math.PI / 180;
          const yaw   = newOrbitY * Math.PI / 180;
          const s   = cameraScaleRef.current;
          const cp  = Math.cos(pitch), sp = Math.sin(pitch);
          const cyw = Math.cos(yaw),  syw = Math.sin(yaw);
          const zOff = zoomRef.current - CAMERA_BASE_DISTANCE + panZRef.current;

          // World → post-rotation coordinates (stable everywhere)
          const sxW = ax * s;
          const szW = az * s + zOff;
          const x4  = sxW * cyw - szW * syw;           // after rotateY
          const z3  = sxW * syw + szW * cyw;
          const y4  = z3 * sp;                          // after rotateX
          const z4  = z3 * cp;

          const denom = P - z4;
          if (Math.abs(denom) > 1 && denom > 0) {
            const f = P / denom;
            // Clamp f to avoid pan blow-up when pivot is very close to camera
            if (f < 50) {
              const el = viewportRef.current;
              if (el) {
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top  + rect.height / 2;
                panXRef.current = (anchorSX - cx) / f - x4;
                panYRef.current = (anchorSY - cy) / f - y4;
              }
            }
          }

          // Hard safety clamps
          const PAN_LIMIT = 5000;
          panXRef.current = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panXRef.current));
          panYRef.current = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panYRef.current));
        }

        setOrbitY(newOrbitY);
        setOrbitX(newOrbitX);
        setPanX(panXRef.current);
        setPanY(panYRef.current);
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
        orbitAnchor.current = null;
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
        panZRef.current += e.deltaY * 0.8;
        setPanZ(panZRef.current);
      } else {
        // Plain wheel → scale zoom anchored at mouse cursor
        const oldScale = cameraScaleRef.current;
        const factor = Math.exp(-e.deltaY * 0.003);
        const newScale = Math.max(CAMERA_SCALE_MIN, Math.min(CAMERA_SCALE_MAX, oldScale * factor));

        // Capture the floor point under the cursor before scaling
        const floorPt = screenToFloor(e.clientX, e.clientY);
        // Only use anchor if the floor point is at a reasonable distance
        // (avoids wild compensation when the ray grazes the floor at a shallow angle)
        const anchorDist = floorPt ? Math.sqrt(floorPt.x * floorPt.x + floorPt.z * floorPt.z) : Infinity;
        const useAnchor = floorPt && anchorDist < 5000;

        // Apply new scale
        cameraScaleRef.current = newScale;

        // Compensate pan so the cursor-point stays fixed
        if (useAnchor) {
          const projected = worldToScreen(floorPt.x, floorPt.z);
          // Only compensate when the point is in front of the camera (f > 0)
          // and at a reasonable perspective depth (f > 0.05)
          if (projected && projected.f > 0.05) {
            panXRef.current += (e.clientX - projected.sx) / projected.f;
            panYRef.current += (e.clientY - projected.sy) / projected.f;
          }
        }

        setCameraScale(newScale);
        setPanX(panXRef.current);
        setPanY(panYRef.current);
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
      } else if (e.key === 'Home') {
        // Reset camera to default view
        e.preventDefault();
        orbitXRef.current = CAMERA_DEFAULT_TILT;
        orbitYRef.current = CAMERA_DEFAULT_YAW;
        panXRef.current = 0;
        panYRef.current = 0;
        panZRef.current = 0;
        zoomRef.current = CAMERA_DEFAULT_ZOOM;
        cameraScaleRef.current = CAMERA_DEFAULT_SCALE;
        setOrbitX(CAMERA_DEFAULT_TILT);
        setOrbitY(CAMERA_DEFAULT_YAW);
        setPanX(0);
        setPanY(0);
        setPanZ(0);
        setZoom(CAMERA_DEFAULT_ZOOM);
        setCameraScale(CAMERA_DEFAULT_SCALE);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Camera state snapshot / restore ─────────────────────────
  const getCameraState = useCallback(() => ({
    orbitX: orbitXRef.current,
    orbitY: orbitYRef.current,
    panX: panXRef.current,
    panY: panYRef.current,
    panZ: panZRef.current,
    zoom: zoomRef.current,
    cameraScale: cameraScaleRef.current,
  }), []);

  const restoreCamera = useCallback((cam) => {
    if (!cam) return;
    if (cam.orbitX != null) { orbitXRef.current = cam.orbitX; setOrbitX(cam.orbitX); }
    if (cam.orbitY != null) { orbitYRef.current = cam.orbitY; setOrbitY(cam.orbitY); }
    if (cam.panX != null)  { panXRef.current = cam.panX;  setPanX(cam.panX); }
    if (cam.panY != null)  { panYRef.current = cam.panY;  setPanY(cam.panY); }
    if (cam.panZ != null)  { panZRef.current = cam.panZ;  setPanZ(cam.panZ); }
    if (cam.zoom != null)  { zoomRef.current = cam.zoom;  setZoom(cam.zoom); }
    if (cam.cameraScale != null) { cameraScaleRef.current = cam.cameraScale; setCameraScale(cam.cameraScale); }
  }, []);

  return {
    orbitX, orbitY, panX, panY, panZ, zoom, cameraScale,
    setOrbitX, setOrbitY, setPanX, setPanY, setPanZ, setZoom, setCameraScale,
    screenToFloor,
    lastMouse,
    getCameraState,
    restoreCamera,
  };
}
