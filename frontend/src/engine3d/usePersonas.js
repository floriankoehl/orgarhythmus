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
  PERSONA_DRAG_LIFT,
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
 * Persona state shape:
 *   { id, name, color, x, z, milestoneIds: [int], teamIds: [int], taskIds: [int] }
 *
 * Assignments are additive: assigning to a milestone keeps team/task assignments,
 * and vice versa. Ghost personas are rendered for team/task slab assignments.
 * Clicking a ghost spawns a draggable copy that can be dropped on a milestone.
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

  // Stable ref for screenToFloor (the fn prop changes reference each render)
  const screenToFloorFnRef = useRef(screenToFloor);
  useEffect(() => { screenToFloorFnRef.current = screenToFloor; }, [screenToFloor]);

  // Spawn drag: clicking a ghost creates a draggable copy to assign to a milestone
  const [spawnDrag, setSpawnDrag] = useState(null); // { personaId, x, z } | null
  const spawnDragRef = useRef(null);

  /** Map raw API record to internal shape */
  const apiToLocal = (p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    x: p.x,
    z: p.z,
    milestoneIds: Array.isArray(p.milestones) ? p.milestones : (p.milestones ? [p.milestones] : []),
    teamIds: Array.isArray(p.teams) ? p.teams : [],
    taskIds: Array.isArray(p.tasks) ? p.tasks : [],
  });

  // Load protopersonas from DB on mount
  useEffect(() => {
    if (!projectId) return;
    get_all_protopersonas(projectId)
      .then((data) => {
        const loaded = (data || []).map(apiToLocal);
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
        halfX: slotH / 2,
        halfZ: slotW / 2,
      };
    });
  }, [days, teamOrder, teams, milestones, taskDisplaySettings3D, teamDisplaySettings, teamPhasesMap, effectiveHeaderH, boardDims, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

  const milestone3DRef = useRef(milestone3D);
  useEffect(() => { milestone3DRef.current = milestone3D; }, [milestone3D]);

  const floorLayoutRef = useRef(floorLayout);
  useEffect(() => { floorLayoutRef.current = floorLayout; }, [floorLayout]);

  /** Find closest milestone within SNAP_RADIUS using rectangular distance */
  const findNearestMilestone = (x, z) => {
    let best = null;
    let bestDist = SNAP_RADIUS;
    for (const m of milestone3DRef.current) {
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
   * Returns { teamId, taskId } or null.
   */
  const findSlabAt = (x, z, pad = 0) => {
    const layout = floorLayoutRef.current;
    if (!layout || !layout.teams) return null;

    // 1) task slabs first (more specific)
    for (const teamSlab of layout.teams) {
      const inX = x >= Math.min(teamSlab.worldXStart, teamSlab.worldXEnd) - pad &&
                  x <= Math.max(teamSlab.worldXStart, teamSlab.worldXEnd) + pad;
      if (!inX) continue;
      for (const taskSlab of teamSlab.tasks) {
        const inTX = x >= Math.min(taskSlab.worldXStart, taskSlab.worldXEnd) - pad &&
                     x <= Math.max(taskSlab.worldXStart, taskSlab.worldXEnd) + pad;
        const inTZ = z >= Math.min(taskSlab.nameWorldZStart, taskSlab.nameWorldZEnd) - pad &&
                     z <= Math.max(taskSlab.nameWorldZStart, taskSlab.nameWorldZEnd) + pad;
        if (inTX && inTZ) return { teamId: teamSlab.teamId, taskId: taskSlab.taskId };
      }
    }
    // 2) team slabs
    for (const teamSlab of layout.teams) {
      const inX = x >= Math.min(teamSlab.worldXStart, teamSlab.worldXEnd) - pad &&
                  x <= Math.max(teamSlab.worldXStart, teamSlab.worldXEnd) + pad;
      const inZ = z >= Math.min(teamSlab.nameWorldZStart, teamSlab.nameWorldZEnd) - pad &&
                  z <= Math.max(teamSlab.nameWorldZStart, teamSlab.nameWorldZEnd) + pad;
      if (inX && inZ) return { teamId: teamSlab.teamId, taskId: null };
    }
    return null;
  };

  // ── Filter personas by visible milestones AND re-snap positions ─
  // Personas with only team/task assignments are shown as ghosts (not in draggable list).
  // Personas with milestone assignments → snap to milestone.
  // Personas with no assignments → keep x/z (free-floating).
  useEffect(() => {
    if (!allPersonas.length) { setPersonas([]); return; }
    const msMap = new Map(milestone3D.map((m) => [m.id, m]));

    // Count how many personas sit on each milestone (for stacking offset)
    const countOnMs = {};

    const repositioned = allPersonas
      // Only render as draggable if on milestone OR free-floating (no team/task)
      .filter((p) => p.milestoneIds.length > 0 || (p.teamIds.length === 0 && p.taskIds.length === 0))
      .map((p) => {
        // If persona has milestones, snap to the first visible one
        if (p.milestoneIds.length > 0) {
          const firstVisibleMsId = p.milestoneIds.find((mid) => msMap.has(mid));
          if (firstVisibleMsId != null) {
            const ms = msMap.get(firstVisibleMsId);
            const idx = countOnMs[firstVisibleMsId] || 0;
            countOnMs[firstVisibleMsId] = idx + 1;
            const spacing = PERSONA_SIZE + 4;
            return { ...p, x: ms.worldX, z: ms.worldZ + idx * spacing };
          }
        }
        return p;
      });
    setPersonas(repositioned);
  }, [milestone3D, allPersonas, floorLayout]);

  // ── Ghost personas: static visual on team/task slabs ──────────
  // One ghost per team/task assignment per persona, positioned at slab center.
  const ghostPersonas = useMemo(() => {
    if (!floorLayout || !floorLayout.teams) return [];

    // Build O(1) lookup maps to avoid nested linear searches
    const teamSlabMap = new Map(
      floorLayout.teams.map((ts) => [String(ts.teamId), ts])
    );
    const taskSlabMap = new Map();
    for (const ts of floorLayout.teams) {
      for (const tk of ts.tasks) {
        taskSlabMap.set(String(tk.taskId), tk);
      }
    }

    const ghosts = [];
    for (const p of allPersonas) {
      // Ghost for each team assignment
      for (const teamId of p.teamIds) {
        const teamSlab = teamSlabMap.get(String(teamId));
        if (teamSlab) {
          ghosts.push({
            id: `ghost-team-${p.id}-${teamId}`,
            personaId: p.id,
            persona: p,
            x: (teamSlab.worldXStart + teamSlab.worldXEnd) / 2,
            z: (teamSlab.nameWorldZStart + teamSlab.nameWorldZEnd) / 2,
            standOnH: TEAM_3D_HEIGHT,
          });
        }
      }
      // Ghost for each task assignment
      for (const taskId of p.taskIds) {
        const taskSlab = taskSlabMap.get(String(taskId));
        if (taskSlab) {
          ghosts.push({
            id: `ghost-task-${p.id}-${taskId}`,
            personaId: p.id,
            persona: p,
            x: (taskSlab.worldXStart + taskSlab.worldXEnd) / 2,
            z: (taskSlab.nameWorldZStart + taskSlab.nameWorldZEnd) / 2,
            standOnH: TASK_3D_HEIGHT,
          });
        }
      }
    }
    return ghosts;
  }, [allPersonas, floorLayout]);

  // ── Drag anchor ────────────────────────────────────────────────
  const dragAnchor = useRef(null);

  /** Called by camera hook on persona mousedown / mousemove */
  const onPersonaDragMove = useCallback((e) => {
    const pid = draggingPersona.current;
    if (pid == null) return;
    setDraggingId(pid);
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
   *  Assignments are now ADDITIVE: dropping on milestone adds to milestoneIds
   *  (keeps team/task); dropping on slab adds team/task (keeps milestones). */
  const onPersonaDragEnd = useCallback((e) => {
    const pid = draggingPersona.current;
    draggingPersona.current = null;
    setDraggingId(null);
    dragAnchor.current = null;
    if (pid == null) return;

    setPersonas((prev) => {
      const countOnMs = {};
      for (const pp of prev) {
        if (pp.milestoneIds.length > 0 && pp.id !== pid) {
          for (const mid of pp.milestoneIds) {
            countOnMs[mid] = (countOnMs[mid] || 0) + 1;
          }
        }
      }
      return prev.map((p) => {
        if (p.id !== pid) return p;

        const hitX = p.x;
        const hitZ = p.z;

        // 1) Try milestone snap first — ADD to existing milestoneIds, keep team/task
        const nearest = findNearestMilestone(hitX, hitZ);
        if (nearest) {
          const idx = countOnMs[nearest.id] || 0;
          const spacing = PERSONA_SIZE + 4;
          const newX = nearest.worldX;
          const newZ = nearest.worldZ + idx * spacing;
          const newMilestoneIds = [...new Set([...p.milestoneIds, nearest.id])];
          update_protopersona(projectId, p.id, {
            x: newX, z: newZ,
            milestones: newMilestoneIds,
            teams: p.teamIds,
            tasks: p.taskIds,
          }).catch((err) => console.error('Failed to update persona:', err));
          const updated = { ...p, x: newX, z: newZ, milestoneIds: newMilestoneIds };
          setAllPersonas((all) => all.map((a) => (a.id === pid ? updated : a)));
          return updated;
        }

        // 2) Try team/task slab snap — ADD team/task, keep milestones
        //    Also auto-assign team when assigning to a task.
        const SLAB_SNAP_PAD = 25;
        const slab = findSlabAt(hitX, hitZ, SLAB_SNAP_PAD);
        if (slab) {
          const newTeamIds = [...new Set([...p.teamIds, ...(slab.teamId ? [slab.teamId] : [])])];
          const newTaskIds = [...new Set([...p.taskIds, ...(slab.taskId ? [slab.taskId] : [])])];
          update_protopersona(projectId, p.id, {
            x: hitX, z: hitZ,
            milestones: p.milestoneIds,
            teams: newTeamIds,
            tasks: newTaskIds,
          }).catch((err) => console.error('Failed to update persona:', err));
          const updated = { ...p, x: hitX, z: hitZ, teamIds: newTeamIds, taskIds: newTaskIds };
          setAllPersonas((all) => all.map((a) => (a.id === pid ? updated : a)));
          return updated;
        }

        // 3) Free placement — keep existing assignments, just update position
        update_protopersona(projectId, p.id, {
          x: p.x, z: p.z,
          milestones: p.milestoneIds,
          teams: p.teamIds,
          tasks: p.taskIds,
        }).catch((err) => console.error('Failed to update persona:', err));
        const updated = { ...p };
        setAllPersonas((all) => all.map((a) => (a.id === pid ? updated : a)));
        return updated;
      });
    });
  }, [projectId]);

  // ── Ghost spawn drag ───────────────────────────────────────────
  /** Called when user clicks a ghost persona on a slab.
   *  Starts a drag that, when dropped on a milestone, adds that milestone
   *  to the persona's assignments without removing team/task. */
  const startGhostSpawn = useCallback((personaId, clientX, clientY) => {
    const hit = screenToFloorFnRef.current
      ? screenToFloorFnRef.current(clientX, clientY, PERSONA_SIZE * 0.5)
      : null;
    const drag = {
      personaId,
      x: hit ? hit.x : 0,
      z: hit ? hit.z : 0,
    };
    spawnDragRef.current = drag;
    setSpawnDrag({ ...drag });
  }, []);

  // Window listeners for spawn drag mouse move / up
  useEffect(() => {
    const onMove = (e) => {
      if (!spawnDragRef.current) return;
      const hit = screenToFloorFnRef.current
        ? screenToFloorFnRef.current(e.clientX, e.clientY, PERSONA_SIZE * 0.5)
        : null;
      if (!hit) return;
      const drag = { ...spawnDragRef.current, x: hit.x, z: hit.z };
      spawnDragRef.current = drag;
      setSpawnDrag({ ...drag });
    };

    const onUp = () => {
      const drag = spawnDragRef.current;
      spawnDragRef.current = null;
      setSpawnDrag(null);
      if (!drag) return;

      // Find nearest milestone and ADD it (keep team/task)
      const nearest = findNearestMilestone(drag.x, drag.z);
      if (!nearest) return;

      setAllPersonas((all) => {
        const persona = all.find((p) => p.id === drag.personaId);
        if (!persona) return all;
        const newMilestoneIds = [...new Set([...persona.milestoneIds, nearest.id])];
        update_protopersona(projectId, drag.personaId, {
          milestones: newMilestoneIds,
          teams: persona.teamIds,
          tasks: persona.taskIds,
          x: nearest.worldX,
          z: nearest.worldZ,
        }).catch((err) => console.error('Failed to update persona from ghost spawn:', err));
        return all.map((p) => (p.id === drag.personaId ? { ...persona, milestoneIds: newMilestoneIds, x: nearest.worldX, z: nearest.worldZ } : p));
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [projectId]);

  /** Spawn a new persona near the origin and persist to DB */
  const addPersona = useCallback(async () => {
    const tempId = Date.now();
    const idx = allPersonas.length;
    const color = PERSONA_COLORS[idx % PERSONA_COLORS.length];
    const name = `P${idx + 1}`;
    const x = idx * 40 - 60;
    const z = -100;

    const tempPersona = { id: tempId, name, color, x, z, milestoneIds: [], teamIds: [], taskIds: [] };
    setPersonas((prev) => [...prev, tempPersona]);
    setAllPersonas((prev) => [...prev, tempPersona]);

    try {
      const created = await create_protopersona(projectId, { name, color, x, z, milestones: [], teams: [], tasks: [] });
      const dbPersona = apiToLocal(created);
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
    ghostPersonas,
    spawnDrag,
    startGhostSpawn,
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