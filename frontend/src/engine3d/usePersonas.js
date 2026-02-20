// engine3d/usePersonas.js — Protopersona state, DB CRUD, drag/snap, milestone 3D projection
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  get_all_protopersonas,
  create_protopersona,
  update_protopersona,
  delete_protopersona,
} from '../api/dependencies_api.js';
import {
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
} from '../pages/dependency/layoutMath.js';
import { computeMilestonePixelPositions } from '../pages/dependency/layoutMath.js';
import {
  PERSONA_SIZE,
  SNAP_RADIUS,
  SCROLL_Y_PAD,
  PERSONA_COLORS,
  TEAM_3D_HEIGHT,
  TASK_3D_HEIGHT,
} from './constants.js';

/**
 * usePersonas — manages protopersona tokens: DB persistence, drag/snap,
 * milestone 3D coordinate projection, and board dimension measurement.
 *
 * @param {Object} opts
 * @param {string}          opts.projectId
 * @param {number|null}     opts.days
 * @param {Array}           opts.teamOrder
 * @param {Object}          opts.teams
 * @param {Object}          opts.milestones
 * @param {Object}          opts.taskDisplaySettings3D
 * @param {Object}          opts.teamDisplaySettings
 * @param {Object}          opts.teamPhasesMap
 * @param {number}          opts.effectiveHeaderH
 * @param {number}          opts.TEAMWIDTH
 * @param {number}          opts.TASKWIDTH
 * @param {number}          opts.DAYWIDTH
 * @param {React.RefObject} opts.boardRef
 * @param {React.RefObject} opts.containerRef
 * @param {Function}        opts.screenToFloor  — (sx, sy) => { x, z } | null
 * @param {Object}          [opts.floorLayout]  — entity registry from useFloor3D
 */
export function usePersonas({
  projectId,
  days,
  teamOrder,
  teams,
  milestones,
  taskDisplaySettings3D,
  teamDisplaySettings,
  teamPhasesMap,
  effectiveHeaderH,
  TEAMWIDTH,
  TASKWIDTH,
  DAYWIDTH,
  boardRef,
  containerRef,
  screenToFloor,
  floorLayout,
}) {
  // ── Persona state ──────────────────────────────────────────────
  const [personas, setPersonas] = useState([]);
  const [allPersonas, setAllPersonas] = useState([]);
  const draggingPersona = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  // Load protopersonas from DB on mount
  useEffect(() => {
    if (!projectId) return;
    get_all_protopersonas(projectId)
      .then((data) => {
        const loaded = (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          x: p.x,
          z: p.z,
          milestoneId: p.milestone || null,
        }));
        setAllPersonas(loaded);
        setPersonas(loaded);
      })
      .catch((err) => console.error('Failed to load protopersonas:', err));
  }, [projectId]);

  // ── Board dimensions (for milestone coordinate mapping) ────────
  const [boardDims, setBoardDims] = useState({ w: 1400, h: 600, offsetX: 0, offsetY: 0 });
  useLayoutEffect(() => {
    if (boardRef.current && containerRef.current) {
      let top = 0, left = 0;
      let el = containerRef.current;
      while (el && el !== boardRef.current) {
        top  += el.offsetTop;
        left += el.offsetLeft;
        el = el.offsetParent;
      }
      setBoardDims({
        w: boardRef.current.offsetWidth,
        h: boardRef.current.offsetHeight,
        offsetX: left,
        offsetY: top,
      });
    }
  }, [days, teamOrder, teams, taskDisplaySettings3D, teamPhasesMap, teamDisplaySettings, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

  // ── Milestone 3D positions ────────────────────────────────────
  const milestone3D = useMemo(() => {
    if (!days) return [];
    const W = boardDims.w;
    const H = boardDims.h;
    const oX = boardDims.offsetX;
    const oY = boardDims.offsetY;
    const positioned = computeMilestonePixelPositions({
      teamOrder, teams, milestones,
      taskDisplaySettings: taskDisplaySettings3D,
      teamDisplaySettings,
      teamPhasesMap, effectiveHeaderH,
      TEAMWIDTH, TASKWIDTH, DAYWIDTH,
      TASKHEIGHT_SMALL: DEFAULT_TASKHEIGHT_SMALL,
      TASKHEIGHT_NORMAL: DEFAULT_TASKHEIGHT_NORMAL,
    });
    return positioned.map((m) => {
      const slotW = Math.max((m.duration || 1) * DAYWIDTH, PERSONA_SIZE + 10);
      const slotH = PERSONA_SIZE + 10;
      return {
        ...m,
        worldX: (m.y + m.h / 2 + oY + SCROLL_Y_PAD) - H / 2,
        worldZ: W / 2 - (m.x + m.w / 2 + oX),
        // World-space half-extents for rectangular hitbox
        halfX: slotH / 2,   // pedestal height → world X extent
        halfZ: slotW / 2,   // pedestal width  → world Z extent
      };
    });
  }, [days, teamOrder, teams, milestones, taskDisplaySettings3D, teamDisplaySettings, teamPhasesMap, effectiveHeaderH, boardDims, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

  const milestone3DRef = useRef(milestone3D);
  useEffect(() => { milestone3DRef.current = milestone3D; }, [milestone3D]);

  // Keep a ref so snap functions see the latest layout
  const floorLayoutRef = useRef(floorLayout);
  useEffect(() => { floorLayoutRef.current = floorLayout; }, [floorLayout]);

  /** Find closest milestone within SNAP_RADIUS using rectangular distance */
  const findNearestMilestone = (x, z) => {
    let best = null;
    let bestDist = SNAP_RADIUS;
    for (const m of milestone3DRef.current) {
      // Distance to nearest point on the milestone rectangle (0 if inside)
      const dx = Math.max(0, Math.abs(m.worldX - x) - (m.halfX || 0));
      const dz = Math.max(0, Math.abs(m.worldZ - z) - (m.halfZ || 0));
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }
    return best;
  };

  /**
   * Find the team or task slab that contains the world point (x, z).
   * Only checks the name-column Z extents (where the 3D boxes are).
   * Returns { teamId, taskId } or null.
   *
   * Note: team and task name columns occupy different Z ranges
   * (team col: boardX 0→TEAMWIDTH, task col: boardX TEAMWIDTH→TEAMWIDTH+TASKWIDTH)
   * so we check them independently — task slabs first (more specific), then team slabs.
   *
   * @param {number} x      — world X
   * @param {number} z      — world Z
   * @param {number} [pad]  — extra padding (px) added to all slab edges for hit-testing
   */
  const findSlabAt = (x, z, pad = 0) => {
    const layout = floorLayoutRef.current;
    if (!layout || !layout.teams) return null;

    // 1) Check task slabs first (more specific match)
    for (const teamSlab of layout.teams) {
      const inX = x >= Math.min(teamSlab.worldXStart, teamSlab.worldXEnd) - pad &&
                  x <= Math.max(teamSlab.worldXStart, teamSlab.worldXEnd) + pad;
      if (!inX) continue;
      for (const taskSlab of teamSlab.tasks) {
        const inTX = x >= Math.min(taskSlab.worldXStart, taskSlab.worldXEnd) - pad &&
                     x <= Math.max(taskSlab.worldXStart, taskSlab.worldXEnd) + pad;
        const inTZ = z >= Math.min(taskSlab.nameWorldZStart, taskSlab.nameWorldZEnd) - pad &&
                     z <= Math.max(taskSlab.nameWorldZStart, taskSlab.nameWorldZEnd) + pad;
        if (inTX && inTZ) {
          return { teamId: teamSlab.teamId, taskId: taskSlab.taskId };
        }
      }
    }

    // 2) Check team slabs (team name column has its own Z range)
    for (const teamSlab of layout.teams) {
      const inX = x >= Math.min(teamSlab.worldXStart, teamSlab.worldXEnd) - pad &&
                  x <= Math.max(teamSlab.worldXStart, teamSlab.worldXEnd) + pad;
      const inZ = z >= Math.min(teamSlab.nameWorldZStart, teamSlab.nameWorldZEnd) - pad &&
                  z <= Math.max(teamSlab.nameWorldZStart, teamSlab.nameWorldZEnd) + pad;
      if (inX && inZ) {
        return { teamId: teamSlab.teamId, taskId: null };
      }
    }

    return null;
  };

  // ── Filter personas by visible milestones AND re-snap positions ─
  useEffect(() => {
    if (!allPersonas.length) { setPersonas([]); return; }
    const msMap = new Map(milestone3D.map((m) => [m.id, m]));
    const visibleMsIds = new Set(msMap.keys());

    // Count how many personas sit on each milestone (for stacking offset)
    const countOnMs = {};
    const visible = allPersonas.filter(
      (p) => p.milestoneId == null || visibleMsIds.has(p.milestoneId)
    );

    // Re-snap every persona that is attached to a milestone
    // (personas on slabs keep their stored x/z and just propagate teamId/taskId)
    const repositioned = visible.map((p) => {
      if (p.milestoneId != null) {
        const ms = msMap.get(p.milestoneId);
        if (!ms) return p;
        const idx = countOnMs[p.milestoneId] || 0;
        countOnMs[p.milestoneId] = idx + 1;
        const spacing = PERSONA_SIZE + 4;
        return { ...p, x: ms.worldX, z: ms.worldZ + idx * spacing, onTeamId: null, onTaskId: null };
      }
      // For slab-bound personas, re-check if they're still on a slab
      // Use padding for forgiving hit-testing (coordinates may be slightly
      // offset from exact slab bounds due to perspective projection).
      if (p.onTeamId || p.onTaskId) {
        const slab = findSlabAt(p.x, p.z, 15);
        if (slab) {
          return { ...p, onTeamId: slab.teamId, onTaskId: slab.taskId };
        }
        return { ...p, onTeamId: null, onTaskId: null };
      }
      return p;
    });
    setPersonas(repositioned);
  }, [milestone3D, allPersonas, floorLayout]);

  // ── Drag anchor ────────────────────────────────────────────────
  const dragAnchor = useRef(null);

  /** Called by camera hook on persona mousedown / mousemove */
  const onPersonaDragMove = useCallback((e) => {
    const pid = draggingPersona.current;
    if (pid == null) return;
    // Set reactive dragging state on first call (mousedown)
    setDraggingId(pid);
    // Compute floor hit
    // Use the same plane height as the mousedown anchor for consistent drag
    const planeY = dragAnchor.current.planeY || 0;
    const hit = screenToFloor(e.clientX, e.clientY, planeY);
    if (hit && dragAnchor.current) {
      const anchor = dragAnchor.current;
      const deltaX = hit.x - anchor.floorX;
      const deltaZ = hit.z - anchor.floorZ;
      setPersonas((prev) =>
        prev.map((p) => {
          if (p.id !== pid) return p;
          if (anchor.personaX === undefined) {
            anchor.personaX = p.x;
            anchor.personaZ = p.z;
          }
          return { ...p, x: anchor.personaX + deltaX, z: anchor.personaZ + deltaZ };
        })
      );
    }
  }, [screenToFloor]);

  /** Called by camera hook on mouseup while dragging a persona.
   *  Uses the persona's own stored position for slab hit-testing (not the
   *  floor-plane cursor projection, which is offset due to perspective).
   */
  const onPersonaDragEnd = useCallback((e) => {
    const pid = draggingPersona.current;
    draggingPersona.current = null;
    setDraggingId(null);
    dragAnchor.current = null;
    if (pid == null) return;

    setPersonas((prev) => {
      const countOnMs = {};
      for (const pp of prev) {
        if (pp.milestoneId != null && pp.id !== pid) {
          countOnMs[pp.milestoneId] = (countOnMs[pp.milestoneId] || 0) + 1;
        }
      }
      return prev.map((p) => {
        if (p.id !== pid) return p;

        // Use the persona's own coordinates for hit-testing.
        // During drag, these track the elevated plane intersection — but they
        // share the same world x/z system as the slabs, so a persona at
        // (x, height, z) is directly above slab (x, 0, z).
        const hitX = p.x;
        const hitZ = p.z;

        // 1) Try milestone snap first (uses its own rectangular hitbox)
        const nearest = findNearestMilestone(hitX, hitZ);
        if (nearest) {
          const idx = countOnMs[nearest.id] || 0;
          const spacing = PERSONA_SIZE + 4;
          const zOffset = idx * spacing;
          const newX = nearest.worldX;
          const newZ = nearest.worldZ + zOffset;
          update_protopersona(projectId, p.id, { x: newX, z: newZ, milestone: nearest.id })
            .catch((err) => console.error('Failed to update persona:', err));
          const updated = { ...p, x: newX, z: newZ, milestoneId: nearest.id, onTeamId: null, onTaskId: null };
          setAllPersonas((all) => all.map((a) => (a.id === pid ? updated : a)));
          return updated;
        }

        // 2) Try team/task slab snap (with generous padding for perspective-forgiving hit-testing)
        const SLAB_SNAP_PAD = 25;
        const slab = findSlabAt(hitX, hitZ, SLAB_SNAP_PAD);
        if (slab) {
          update_protopersona(projectId, p.id, { x: hitX, z: hitZ, milestone: null })
            .catch((err) => console.error('Failed to update persona:', err));
          const updated = { ...p, x: hitX, z: hitZ, milestoneId: null, onTeamId: slab.teamId, onTaskId: slab.taskId };
          setAllPersonas((all) => all.map((a) => (a.id === pid ? updated : a)));
          return updated;
        }

        // 3) Free placement
        update_protopersona(projectId, p.id, { x: p.x, z: p.z, milestone: null })
          .catch((err) => console.error('Failed to update persona:', err));
        const updated = { ...p, milestoneId: null, onTeamId: null, onTaskId: null };
        setAllPersonas((all) => all.map((a) => (a.id === pid ? updated : a)));
        return updated;
      });
    });
  }, [projectId]);

  /** Spawn a new persona near the origin and persist to DB */
  const addPersona = useCallback(async () => {
    const tempId = Date.now();
    const idx = allPersonas.length;
    const color = PERSONA_COLORS[idx % PERSONA_COLORS.length];
    const name = `P${idx + 1}`;
    const x = idx * 40 - 60;
    const z = -100;

    const tempPersona = { id: tempId, name, color, x, z, milestoneId: null };
    setPersonas((prev) => [...prev, tempPersona]);
    setAllPersonas((prev) => [...prev, tempPersona]);

    try {
      const created = await create_protopersona(projectId, { name, color, x, z, milestone: null });
      const dbPersona = { id: created.id, name: created.name, color: created.color, x: created.x, z: created.z, milestoneId: created.milestone || null };
      setPersonas((prev) => prev.map((p) => (p.id === tempId ? dbPersona : p)));
      setAllPersonas((prev) => prev.map((p) => (p.id === tempId ? dbPersona : p)));
    } catch (err) {
      console.error('Failed to create persona:', err);
      setPersonas((prev) => prev.filter((p) => p.id !== tempId));
      setAllPersonas((prev) => prev.filter((p) => p.id !== tempId));
    }
  }, [projectId, allPersonas.length]);

  /** Delete a persona by id and remove from DB */
  const removePersona = useCallback(async (id) => {
    setPersonas((prev) => prev.filter((p) => p.id !== id));
    setAllPersonas((prev) => prev.filter((p) => p.id !== id));
    try {
      await delete_protopersona(projectId, id);
    } catch (err) {
      console.error('Failed to delete persona:', err);
    }
  }, [projectId]);

  return {
    personas,
    allPersonas,
    draggingPersona,
    draggingId,
    setDraggingId,
    dragAnchor,
    boardDims,
    milestone3D,
    addPersona,
    removePersona,
    onPersonaDragMove,
    onPersonaDragEnd,
  };
}
