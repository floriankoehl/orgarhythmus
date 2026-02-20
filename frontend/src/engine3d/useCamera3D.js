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
          if (floorPt && dist < 2000) {
            // Compute initial z4 (depth after rotations) for this anchor.
            // During orbit we adjust zoom to keep z4 constant, which keeps
            // the perspective magnification factor f = P/(P-z4) constant,
            // i.e. the anchor stays the same apparent size (true orbit).
            const P0  = PERSPECTIVE_DEPTH;
            const p0  = orbitXRef.current * Math.PI / 180;
            const y0  = orbitYRef.current * Math.PI / 180;
            const s0  = cameraScaleRef.current;
            const zOff0 = zoomRef.current - CAMERA_BASE_DISTANCE + panZRef.current;
            const sxW0  = floorPt.x * s0;
            const szW0  = floorPt.z * s0 + zOff0;
            const z3_0  = sxW0 * Math.sin(y0) + szW0 * Math.cos(y0);
            const z4_0  = z3_0 * Math.cos(p0);

            orbitAnchor.current = {
              worldX: floorPt.x, worldZ: floorPt.z,
              screenX: e.clientX, screenY: e.clientY,
              z4Init: z4_0,
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
        panXRef.current = Math.max(-3000, Math.min(3000, panXRef.current + dx));
        panYRef.current = Math.max(-3000, Math.min(3000, panYRef.current + dy));
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
          // ── True-distance orbit ──
          // 1) Adjust zoom so the anchor stays at the SAME depth (z4),
          //    keeping the perspective magnification factor f constant.
          // 2) Then compute panX/panY so the anchor stays at its screen position.
          const { worldX: ax, worldZ: az, screenX: anchorSX, screenY: anchorSY, z4Init } = anchor;
          const P = PERSPECTIVE_DEPTH;
          const pitch = newOrbitX * Math.PI / 180;
          const yaw   = newOrbitY * Math.PI / 180;
          const s   = cameraScaleRef.current;
          const cp  = Math.cos(pitch), sp = Math.sin(pitch);
          const cyw = Math.cos(yaw),  syw = Math.sin(yaw);

          // ── Step 1: zoom compensation ──
          // z4 = cp * (ax*s*syw + (az*s + zOff)*cyw)
          // Solve for zOff that keeps z4 = z4Init:
          //   zOff = (z4Init - cp*s*(ax*syw + az*cyw)) / (cp*cyw)
          // This has a singularity when |cp*cyw| → 0 (yaw ≈ ±90° or pitch ≈ 90°).
          // We smoothly fade out the compensation near the singularity.
          let zOff = zoomRef.current - CAMERA_BASE_DISTANCE + panZRef.current;
          const cpCyw = cp * cyw;
          if (Math.abs(cpCyw) > 0.08) {
            const targetZOff = (z4Init - cp * s * (ax * syw + az * cyw)) / cpCyw;
            // Smooth blend: full compensation when |cpCyw| > 0.25, zero at 0.08
            const blend = Math.min(1, (Math.abs(cpCyw) - 0.08) / 0.17);
            const candidateZOff = zOff * (1 - blend) + targetZOff * blend;
            // Only apply if the result is reasonable
            if (Math.abs(candidateZOff) < 3000) {
              zOff = candidateZOff;
              zoomRef.current = Math.max(-500, Math.min(3000, zOff + CAMERA_BASE_DISTANCE - panZRef.current));
              // Recalculate zOff after clamping
              zOff = zoomRef.current - CAMERA_BASE_DISTANCE + panZRef.current;
            }
          }

          // ── Step 2: pan compensation ──
          // Forward-transform the pivot at the new angles + adjusted zoom
          // to find where it lands, then set panX/panY to pin it.
          const sxW = ax * s;
          const szW = az * s + zOff;
          const x4  = sxW * cyw - szW * syw;
          const z3  = sxW * syw + szW * cyw;
          const y4  = z3 * sp;
          const z4  = z3 * cp;

          const denom = P - z4;
          if (Math.abs(denom) > 1 && denom > 0) {
            const f = P / denom;
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
          const PAN_LIMIT = 3000;
          panXRef.current = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panXRef.current));
          panYRef.current = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panYRef.current));
        }

        setOrbitY(newOrbitY);
        setOrbitX(newOrbitX);
        setPanX(panXRef.current);
        setPanY(panYRef.current);
        setZoom(zoomRef.current);
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
        panZRef.current = Math.max(-1500, Math.min(1500, panZRef.current + e.deltaY * 0.8));
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
        const useAnchor = floorPt && anchorDist < 2000;

        // Apply new scale
        cameraScaleRef.current = newScale;

        // Compensate pan so the cursor-point stays fixed.
        // Cap at f < 4 — at higher f the point is near the camera plane and
        // the projection is too sensitive for reliable correction.
        if (useAnchor) {
          const projected = worldToScreen(floorPt.x, floorPt.z);
          if (projected && projected.f > 0.1 && projected.f < 4) {
            panXRef.current += (e.clientX - projected.sx) / projected.f;
            panYRef.current += (e.clientY - projected.sy) / projected.f;
          }
        }

        // Hard clamps on pan
        const PAN_LIMIT = 3000;
        panXRef.current = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panXRef.current));
        panYRef.current = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, panYRef.current));

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
    // Validate & clamp all values to prevent corrupt state from blowing up
    const clamp = (v, min, max, def) => {
      if (v == null || !Number.isFinite(v)) return def;
      return Math.max(min, Math.min(max, v));
    };
    const ox = clamp(cam.orbitX, 5, 90, CAMERA_DEFAULT_TILT);
    const oy = clamp(cam.orbitY, -720, 720, CAMERA_DEFAULT_YAW);
    const px = clamp(cam.panX, -3000, 3000, 0);
    const py = clamp(cam.panY, -3000, 3000, 0);
    const pz = clamp(cam.panZ, -1500, 1500, 0);
    const zm = clamp(cam.zoom, -500, 3000, CAMERA_DEFAULT_ZOOM);
    const sc = clamp(cam.cameraScale, CAMERA_SCALE_MIN, CAMERA_SCALE_MAX, CAMERA_DEFAULT_SCALE);
    orbitXRef.current = ox; setOrbitX(ox);
    orbitYRef.current = oy; setOrbitY(oy);
    panXRef.current = px;   setPanX(px);
    panYRef.current = py;   setPanY(py);
    panZRef.current = pz;   setPanZ(pz);
    zoomRef.current = zm;   setZoom(zm);
    cameraScaleRef.current = sc; setCameraScale(sc);
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
