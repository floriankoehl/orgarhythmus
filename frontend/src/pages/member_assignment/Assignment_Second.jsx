// Assignment_Second.jsx — Visual replica of the Dependencies page
// ═══════════════════════════════════════════════════════════════════
//
// This renders an exact visual copy of the 2D Dependencies Gantt chart
// surface: scroll container, day header, team/task sidebar, day grid,
// milestones — all using the same layout constants. Buttons and
// interactions are NOT wired up; this is a display-only surface.
//
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetch_project_details,
  fetch_project_teams,
  fetch_project_tasks,
  get_all_milestones,
  get_project_days,
  get_all_phases,
} from '../../api/dependencies_api.js';
import {
  DEFAULT_TASKHEIGHT_NORMAL,
  DEFAULT_TASKHEIGHT_SMALL,
  TASKWIDTH as DEFAULT_TASKWIDTH,
  TEAMWIDTH as DEFAULT_TEAMWIDTH,
  DEFAULT_DAYWIDTH,
  HEADER_HEIGHT,
  TEAM_DRAG_HIGHLIGHT_HEIGHT,
  MARIGN_BETWEEN_DRAG_HIGHLIGHT,
  TEAM_HEADER_LINE_HEIGHT,
  TEAM_HEADER_GAP,
  TEAM_COLLAPSED_HEIGHT,
  TEAM_PHASE_ROW_HEIGHT,
  DAY_NAME_WIDTH_THRESHOLD,
  daysBetween,
  lightenColor,
  getTaskHeight as getTaskHeightBase,
  getVisibleTasks,
  getTaskYOffset as getTaskYOffsetBase,
  isTaskVisible,
  getRawTeamHeight,
  computeMilestonePixelPositions,
} from '../dependency/layoutMath.js';

// ── Phase header height ──────────────────────────────────────────
const PHASE_HEADER_HEIGHT = 26;

// ── 3D Camera & Scene Constants ──────────────────────────────────
//
// Coordinate system (right-hand):
//   +X → right,          −X → left
//   +Y → up,             −Y → down
//   +Z → toward viewer,  −Z → into screen
//
// The board lies flat on the XZ ground plane (Y = 0).
// The camera orbits around the world origin on a spherical shell
// defined by pitch (orbitX), yaw (orbitY), and a radial distance.
//
const CAMERA_BASE_DISTANCE  = 600;   // px — radial distance from origin when zoom = 0
const CAMERA_DEFAULT_ZOOM   = 500;   // px — default zoom offset (reduces distance)
const CAMERA_DEFAULT_TILT   = 30;    // deg — default vertical pitch (looking down)
const CAMERA_DEFAULT_YAW    = 30;    // deg — default horizontal rotation
const CAMERA_ZOOM_MIN       = -800;  // px — minimum zoom (farthest away)
const CAMERA_ZOOM_MAX       = 600;   // px — maximum zoom (closest)
const PERSPECTIVE_DEPTH     = 1800;  // px — CSS perspective value
// FLOOR_SIZE is computed dynamically from the board content dimensions

// ── Protopersona defaults ────────────────────────────────────────
const PERSONA_SIZE          = 25;    // px — cube side length
const SNAP_RADIUS           = 40;    // px — max distance to snap to a milestone
const MILESTONE_3D_HEIGHT   = 8;    // px — how far milestone pedestals rise above the XZ floor (+Y)
const BOARD_3D_HEIGHT       = 14;   // px — thickness of the board/floor slab
const SCROLL_Y_PAD          = 16;   // px — extra height on the scroll container (contentHeight + 16) that
                                     //      causes a visual Y-offset due to the double scaleY(-1) flip
const PERSONA_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#4ade80',
  '#22d3ee', '#818cf8', '#e879f9', '#f472b6',
];

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

/** Build day labels from project start date + day metadata */
function buildDayLabels(numDays, startDate, projectDays) {
  const labels = [];
  const d = new Date(startDate);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < numDays; i++) {
    const curr = new Date(d);
    curr.setDate(curr.getDate() + i);
    const dayOfWeek = curr.getDay();
    const meta = projectDays[i] || {};
    labels.push({
      dateStr: `${curr.getDate()}.${curr.getMonth() + 1}`,
      dayNameShort: dayNames[dayOfWeek],
      isSunday: dayOfWeek === 0,
      purpose: meta.purpose || null,
      purposeTeams: meta.purpose_teams || null,
    });
  }
  return labels;
}

// ── Layout helpers bound to default constants ────────────────────
// These thin wrappers delegate to the shared layoutMath functions so that
// all position logic lives in one canonical module.

/** Get task height from display settings (uses layout defaults) */
function getTaskHeight(taskId, taskDisplaySettings) {
  return getTaskHeightBase(taskId, taskDisplaySettings, DEFAULT_TASKHEIGHT_SMALL, DEFAULT_TASKHEIGHT_NORMAL);
}

/** Get Y offset for a task within its team (uses layout defaults) */
function getTaskYOffset(taskId, team, taskDisplaySettings) {
  return getTaskYOffsetBase(
    taskId,
    team,
    isTaskVisible,
    (id, ds) => getTaskHeightBase(id, ds, DEFAULT_TASKHEIGHT_SMALL, DEFAULT_TASKHEIGHT_NORMAL),
    taskDisplaySettings,
  );
}

/** Get team row height including optional phase row (uses layout defaults) */
function getTeamRowHeight(team, taskDisplaySettings, teamPhaseRowH = 0) {
  if (!team) return TEAM_COLLAPSED_HEIGHT;
  const rawH = getRawTeamHeight(team, taskDisplaySettings, DEFAULT_TASKHEIGHT_SMALL, DEFAULT_TASKHEIGHT_NORMAL);
  return Math.max(rawH, TEAM_COLLAPSED_HEIGHT) + teamPhaseRowH;
}

/** Calculate total content height */
function calcContentHeight(teamOrder, teams, taskDisplaySettings, effectiveHeaderH, teamPhasesMap) {
  let h = effectiveHeaderH;
  for (const tid of teamOrder) {
    h += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    h += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
    const phaseH = (teamPhasesMap[tid] && teamPhasesMap[tid].length > 0) ? TEAM_PHASE_ROW_HEIGHT : 0;
    h += getTeamRowHeight(teams[tid], taskDisplaySettings, phaseH);
  }
  // Final drop indicator area
  h += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
  return h;
}

// ══════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════

export default function AssignmentSecond() {
  const { projectId } = useParams();
  const containerRef = useRef(null);
  const boardRef = useRef(null);

  // ── Data state ─────────────────────────────────────────────────
  const [days, setDays] = useState(null);
  const [projectStartDate, setProjectStartDate] = useState(null);
  const [projectDays, setProjectDays] = useState({});
  const [teamOrder, setTeamOrder] = useState([]);
  const [teams, setTeams] = useState({});
  const [tasks, setTasks] = useState({});
  const [milestones, setMilestones] = useState({});
  const [phases, setPhases] = useState([]);
  const [taskDisplaySettings, setTaskDisplaySettings] = useState({});
  const [loading, setLoading] = useState(true);

  // ── Layout constants (using defaults for now) ──────────────────
  const TEAMWIDTH = DEFAULT_TEAMWIDTH;
  const TASKWIDTH = DEFAULT_TASKWIDTH;
  const DAYWIDTH = DEFAULT_DAYWIDTH;

  // ── Fetch data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        // Project details → days count
        const resProj = await fetch_project_details(projectId);
        const project = resProj.project;
        const numDays = daysBetween(project.start_date, project.end_date);
        setDays(numDays);
        setProjectStartDate(new Date(project.start_date));

        // Project days metadata (purposes, sundays)
        try {
          const resDays = await get_project_days(projectId);
          setProjectDays(resDays.days || {});
        } catch { setProjectDays({}); }

        // Teams
        const resTeams = await fetch_project_teams(projectId);
        const newTeamOrder = [];
        const teamObj = {};
        for (const t of resTeams.teams) {
          newTeamOrder.push(t.id);
          teamObj[t.id] = { ...t, tasks: [] };
        }

        // Tasks
        const resTasks = await fetch_project_tasks(projectId);
        const initTaskDisplay = {};
        for (const tid in teamObj) {
          const taskIds = resTasks.taskOrder?.[String(tid)] || [];
          teamObj[tid].tasks = taskIds;
          for (const id of taskIds) {
            initTaskDisplay[id] = { size: 'normal', hidden: false };
          }
        }
        // Unassigned
        const unassigned = resTasks.taskOrder?.['null'] || [];
        if (unassigned.length > 0) {
          const UID = '__unassigned__';
          teamObj[UID] = { id: UID, name: 'Unassigned', color: '#94a3b8', tasks: unassigned, _virtual: true };
          newTeamOrder.push(UID);
          for (const id of unassigned) {
            initTaskDisplay[id] = { size: 'normal', hidden: false };
          }
        }

        // Milestones
        const resMilestones = await get_all_milestones(projectId);
        const msObj = {};
        if (Array.isArray(resMilestones.milestones)) {
          for (const m of resMilestones.milestones) {
            msObj[m.id] = { ...m };
          }
        }

        // Phases
        try {
          const resPhases = await get_all_phases(projectId);
          setPhases(resPhases.phases || []);
        } catch { setPhases([]); }

        setTeamOrder(newTeamOrder);
        setTeams(teamObj);
        setTasks(resTasks.tasks);
        setMilestones(msObj);
        setTaskDisplaySettings(initTaskDisplay);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // ── Derived layout values ──────────────────────────────────────
  const dayLabels = useMemo(() => {
    if (!days || !projectStartDate) return [];
    return buildDayLabels(days, projectStartDate, projectDays);
  }, [days, projectStartDate, projectDays]);

  const teamPhasesMap = useMemo(() => {
    const map = {};
    for (const tid of teamOrder) map[tid] = [];
    for (const p of phases) {
      if (p.team != null && map[p.team]) {
        map[p.team].push(p);
      }
    }
    return map;
  }, [teamOrder, phases]);

  const globalPhases = useMemo(() => phases.filter((p) => p.team == null), [phases]);
  const hasGlobalPhases = globalPhases.length > 0;
  const showGlobalPhases = hasGlobalPhases;
  const showDayHeader = true;

  const effectiveHeaderH = (showDayHeader ? HEADER_HEIGHT : 0) + (showGlobalPhases ? PHASE_HEADER_HEIGHT : 0);
  const totalDaysWidth = (days || 0) * DAYWIDTH;
  const totalWidth = TEAMWIDTH + TASKWIDTH + totalDaysWidth;

  const contentHeight = useMemo(() => {
    if (!days) return 400;
    return calcContentHeight(teamOrder, teams, taskDisplaySettings, effectiveHeaderH, teamPhasesMap);
  }, [teamOrder, teams, taskDisplaySettings, effectiveHeaderH, teamPhasesMap, days]);

  // Board width now matches the full chart (no overflow scroll)
  const boardW = totalWidth + 48;  // content + left/right padding (24+24)

  // ── Hide headers on mount (same as original Assignment page) ──
  useEffect(() => {
    const orgaH = document.querySelector('[data-orga-header]');
    const projH = document.querySelector('[data-project-header]');
    const orgaM = document.querySelector('[data-orga-main]');
    if (orgaH) orgaH.style.display = 'none';
    if (projH) projH.style.display = 'none';
    if (orgaM) orgaM.style.marginTop = '0';
    document.body.style.overflow = 'hidden';
    return () => {
      if (orgaH) orgaH.style.display = '';
      if (projH) projH.style.display = '';
      if (orgaM) orgaM.style.marginTop = '';
      document.body.style.overflow = '';
    };
  }, []);

  // ── 3D camera controls ─────────────────────────────────────────
  // Middle-mouse drag           = orbit (rotate scene)
  // Right-mouse drag            = pan   (translate scene)
  // Scroll wheel                = zoom  (move closer / farther)
  const [orbitX, setOrbitX] = useState(CAMERA_DEFAULT_TILT);  // vertical pitch (5–90°)
  const [orbitY, setOrbitY] = useState(CAMERA_DEFAULT_YAW);   // horizontal yaw
  const [panX, setPanX]     = useState(0);                     // screen-space pan X (px)
  const [panY, setPanY]     = useState(0);                     // screen-space pan Y (px)
  const [zoom, setZoom]     = useState(CAMERA_DEFAULT_ZOOM);   // distance offset (px)
  const isDragging = useRef(false);
  const isPanning  = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });

  // Keep camera values in refs so event handlers always see current values
  const orbitXRef = useRef(orbitX);
  const orbitYRef = useRef(orbitY);
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  useEffect(() => { orbitXRef.current = orbitX; }, [orbitX]);
  useEffect(() => { orbitYRef.current = orbitY; }, [orbitY]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  // ── Protopersonas ──────────────────────────────────────────────
  // Simple client-side-only persona tokens on the XZ floor.
  // Each has { id, name, color, x (world X), z (world Z), milestoneId? }.
  const [personas, setPersonas] = useState([]);
  const draggingPersona = useRef(null);  // id of persona being dragged
  const nextPersonaId   = useRef(1);

  // Board element dimensions (for milestone coordinate mapping)
  // Walk offsetTop/offsetLeft from containerRef up to boardRef to get
  // layout-space offsets (unaffected by CSS 3D transforms).
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
  }, [days, teamOrder, teams, taskDisplaySettings, teamPhasesMap]);

  // Floor dimensions — match the board so the floor represents the whole chart.
  // The board transform Ry(90)·Rx(90) maps:  board height → world X,  board width → world Z.
  // The floor transform rotateX(90) maps:     floor width → world X,  floor height → world Z.
  // So: floorW (X) = boardH, floorH (Z) = boardW.
  // boardH = boardDims.h (measured after render), fallback to contentHeight + 180 estimate.
  const floorW = boardDims.h || (contentHeight + 180);  // world X extent
  const floorH = boardW;                                  // world Z extent

  // ── Milestone 3D positions ────────────────────────────────────
  // 2D pixel positions are computed by the shared computeMilestonePixelPositions
  // from layoutMath.js (the single source of truth for milestone layout).
  // This useMemo is a pure projection layer: it receives already-computed
  // 2D coordinates and converts them to 3D world coordinates via the
  // board's CSS transform:  Ry(90) · Rx(90) · translate(-50%,-50%)
  //   worldX = (centerY + offsetY) − H/2
  //   worldZ = W/2 − (centerX + offsetX)
  // where W,H = board element's rendered dimensions,
  // offsetX/Y = distance from board top-left to inner content top-left.
  const milestone3D = useMemo(() => {
    if (!days) return [];
    const W = boardDims.w;
    const H = boardDims.h;
    const oX = boardDims.offsetX;
    const oY = boardDims.offsetY;
    // Get 2D positions from the canonical layout module
    const positioned = computeMilestonePixelPositions({
      teamOrder, teams, milestones, taskDisplaySettings,
      teamPhasesMap, effectiveHeaderH,
      TEAMWIDTH, TASKWIDTH, DAYWIDTH,
    });
    // Apply coordinate transformation: 2D content-space → 3D world-space
    // The double scaleY(-1) (scroll container + inner container) with the
    // scroll container being SCROLL_Y_PAD px taller than the content shifts
    // the visual Y position by +SCROLL_Y_PAD relative to the layout position.
    return positioned.map((m) => ({
      ...m,
      worldX: (m.y + m.h / 2 + oY + SCROLL_Y_PAD) - H / 2,
      worldZ: W / 2 - (m.x + m.w / 2 + oX),
    }));
  }, [days, teamOrder, teams, milestones, taskDisplaySettings, teamPhasesMap, effectiveHeaderH, boardDims, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

  /** Find closest milestone within SNAP_RADIUS */
  const findNearestMilestone = (x, z) => {
    let best = null;
    let bestDist = SNAP_RADIUS;
    for (const m of milestone3DRef.current) {
      const dx = m.worldX - x;
      const dz = m.worldZ - z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }
    return best;
  };

  // Keep milestone3D in a ref so onUp handler always sees current positions
  const milestone3DRef = useRef(milestone3D);
  useEffect(() => { milestone3DRef.current = milestone3D; }, [milestone3D]);

  /** Spawn a new persona near the origin */
  const addPersona = () => {
    const id = nextPersonaId.current++;
    const color = PERSONA_COLORS[(id - 1) % PERSONA_COLORS.length];
    setPersonas((prev) => [
      ...prev,
      { id, name: `P${id}`, color, x: (id - 1) * 40 - 60, z: -100, milestoneId: null },
    ]);
  };

  /** Delete a persona by id */
  const removePersona = (id) => {
    setPersonas((prev) => prev.filter((p) => p.id !== id));
  };

  // Perspective-correct screen-to-floor unprojection.
  // Closed-form: given CSS chain perspective(P).translate(pan).Rx(-p).Ry(-y).Tz(zOff),
  // solves for (worldX, worldZ) on the Y=0 floor plane.

  const viewportRef = useRef(null);

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
    const zOff  = zoomRef.current - CAMERA_BASE_DISTANCE;
    const panXV = panXRef.current;
    const panYV = panYRef.current;

    // Projected coords relative to perspective origin
    const projX = sx - cxS;
    const projY = sy - cyS;

    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    if (Math.abs(sp) < 1e-6) return null;

    // Closed-form unprojection onto CSS Y=0 floor plane.
    // From the CSS transform chain:
    //   perspective(P) . translate(pan) . Rx(-pitch) . Ry(-yaw) . Tz(zOff)
    // The floor constraint (wy=0) gives r.z = r.y * cot(pitch),
    // and projection gives r.y = projY*(P-r.z)/P - panY.
    // Solving: r.z = cot(p)*(projY - panY) / (1 + cot(p)*projY/P)
    const cotP = cp / sp;
    const denom = 1 + cotP * projY / P;
    if (Math.abs(denom) < 1e-8) return null;

    const rz = cotP * (projY - panYV) / denom;
    const ry = rz * sp / cp;
    const rx = projX * (P - rz) / P - panXV;

    // Invert Rx(pitch): u = Rx(p) * r
    const ux = rx;
    const uz = ry * sp + rz * cp;

    // Invert Ry(-yaw): apply Ry(yaw) to get world XZ from view XZ
    const qx = ux * cyw + uz * syw;
    const qz = -ux * syw + uz * cyw;

    return { x: qx, z: qz - zOff };
  };

  // Store an anchor point when drag starts: where on the floor the initial
  // click landed, and what the persona’s position was at that moment.
  const dragAnchor = useRef(null);  // { floorX, floorZ, personaX, personaZ }

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
            // Find current persona position
            // We read from the DOM dataset or find in state
            // Use a callback-ref pattern: store the anchor
            dragAnchor.current = { floorX: hit.x, floorZ: hit.z, pid };
          }
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
        const hit = screenToFloor(e.clientX, e.clientY);
        if (hit) {
          const anchor = dragAnchor.current;
          const deltaX = hit.x - anchor.floorX;
          const deltaZ = hit.z - anchor.floorZ;
          const pid = draggingPersona.current;
          setPersonas((prev) =>
            prev.map((p) => {
              if (p.id !== pid) return p;
              // On first move, capture the persona’s original position
              if (anchor.personaX === undefined) {
                anchor.personaX = p.x;
                anchor.personaZ = p.z;
              }
              return { ...p, x: anchor.personaX + deltaX, z: anchor.personaZ + deltaZ };
            })
          );
        }
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
        // Snap to nearest milestone if close enough
        const pid = draggingPersona.current;
        draggingPersona.current = null;
        dragAnchor.current = null;
        setPersonas((prev) => {
          // Count how many personas are already snapped to each milestone
          const countOnMs = {};
          for (const pp of prev) {
            if (pp.milestoneId != null && pp.id !== pid) {
              countOnMs[pp.milestoneId] = (countOnMs[pp.milestoneId] || 0) + 1;
            }
          }
          return prev.map((p) => {
            if (p.id !== pid) return p;
            const nearest = findNearestMilestone(p.x, p.z);
            if (nearest) {
              // Offset along the milestone's Z axis so multiple personas sit side by side
              const idx = countOnMs[nearest.id] || 0;
              const spacing = PERSONA_SIZE + 4;
              const zOffset = idx * spacing;
              return { ...p, x: nearest.worldX, z: nearest.worldZ + zOffset, milestoneId: nearest.id };
            }
            return { ...p, milestoneId: null };
          });
        });
        return;
      }
      if (e.button === 1 || e.button === 2) {
        isDragging.current = false;
        isPanning.current  = false;
      }
    };
    // Prevent context menu on right-click
    const onContextMenu = (e) => e.preventDefault();

    // Scroll wheel = zoom
    const onWheel = (e) => {
      const inside = e.target.closest('[data-board-scroll]');
      if (inside) return;
      e.preventDefault();
      setZoom((prev) => Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, prev - e.deltaY * 0.8)));
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

  // ── Loading state ──────────────────────────────────────────────
  if (loading || !days) {
    return (
      <div className="flex items-center justify-center w-full" style={{ height: '100dvh', background: 'linear-gradient(160deg, #f8f9fb 0%, #f6f7fa 50%, #f7f6f5 100%)' }}>
        <span className="text-sm text-slate-400 animate-pulse">Loading…</span>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  //
  // CSS 3D transform hierarchy (orbit camera simulation):
  //
  //   Layer 1 — Viewport (this div)
  //     Sets perspective depth and centers the vanishing point.
  //
  //   Layer 2 — Camera orbit
  //     Anchored at viewport center (top:50%, left:50%).
  //     Pan:   translateX/Y — moves look-at point in screen space
  //     Pitch: rotateX(−orbitX) — tilts camera down (negative = look down)
  //     Yaw:   rotateY(−orbitY) — spins camera around vertical axis
  //
  //   Layer 3 — Camera distance
  //     translateZ(zoom − BASE_DISTANCE) — pushes scene along view axis.
  //     zoom = 0 → full distance; zoom = BASE_DISTANCE → at origin.
  //
  //   Layer 4 — World content (gizmo, floor, board)
  //     Everything positioned at world origin (0,0,0).
  //     Floor: rotateX(90°) to lie on XZ plane, centered via translate(-50%,-50%)
  //     Board: rotateX(90°) rotateY(90°) — page top → −X, bottom → +X
  //
  //   Effective camera distance at defaults:
  //     CAMERA_DEFAULT_ZOOM − CAMERA_BASE_DISTANCE = 500 − 600 = −100px
  //     (camera is 100px in front of origin, looking at it)
  //
  return (
    <div
      ref={viewportRef}
      className="w-full select-none"
      style={{
        height: '100dvh',
        background: '#ffffff',
        perspective: `${PERSPECTIVE_DEPTH}px`,
        perspectiveOrigin: '50% 50%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Debug HUD — orbit/pan/zoom values ── */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px', zIndex: 999,
        background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '8px 12px',
        borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6',
        pointerEvents: 'none',
      }}>
        <div>orbitX: <span style={{ color: '#f87171' }}>{orbitX.toFixed(1)}°</span> (vertical tilt)</div>
        <div>orbitY: <span style={{ color: '#4ade80' }}>{orbitY.toFixed(1)}°</span> (horizontal)</div>
        <div>zoom:  <span style={{ color: '#60a5fa' }}>{zoom.toFixed(0)}px</span></div>
        <div>pan:   <span style={{ color: '#fbbf24' }}>{panX.toFixed(0)}, {panY.toFixed(0)}</span></div>
        <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
          Middle-drag = orbit | Right-drag = pan | Scroll = zoom
        </div>
        <div style={{ marginTop: '4px', fontSize: '10px', color: '#c084fc' }}>
          board: {boardDims.w}×{boardDims.h} | oX:{boardDims.offsetX} oY:{boardDims.offsetY}
        </div>
        <div style={{ fontSize: '10px', color: '#67e8f9' }}>
          floor: {floorW}×{floorH} | content: {totalWidth}×{contentHeight}
        </div>
      </div>

      {/* ── Layer 2: Camera orbit ──
           Anchored at viewport center. Rotations simulate the camera
           orbiting on a sphere around the world origin.
           Pan offsets translate the scene in screen space.
      ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transformStyle: 'preserve-3d',
          transform: [
            `translateX(${panX}px)`,         // screen-space pan X
            `translateY(${panY}px)`,         // screen-space pan Y
            `rotateX(${-orbitX}deg)`,        // pitch (negative = look down)
            `rotateY(${-orbitY}deg)`,        // yaw
          ].join(' '),
        }}
      >
        {/* ── Layer 3: Camera distance ──
             Pushes the scene along the (already rotated) Z axis.
             Effective distance = CAMERA_BASE_DISTANCE − zoom.
        ── */}
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: `translateZ(${zoom - CAMERA_BASE_DISTANCE}px)`,
            position: 'relative',
          }}
        >
            {/* ── 3D Axis Gizmo — shows ±X (red), ±Y (green), ±Z (blue) ── */}
            <div style={{ position: 'absolute', top: 0, left: 0, transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
              {/* ── X axis (red) ── */}
              {/* +X ray — right */}
              <div style={{ position: 'absolute', width: '300px', height: '4px', background: 'linear-gradient(90deg, #ff3333, #ff3333 80%, transparent)', transform: 'translateY(-2px)', boxShadow: '0 0 8px rgba(255,50,50,0.6)' }} />
              <div style={{ position: 'absolute', left: '305px', top: '-14px', color: '#ff3333', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 10px rgba(255,50,50,0.8)' }}>+X</div>
              {/* −X ray — left (faded) */}
              <div style={{ position: 'absolute', width: '300px', height: '3px', background: 'linear-gradient(270deg, rgba(255,80,80,0.5), transparent)', transform: 'translate(-300px, -1.5px)' }} />
              <div style={{ position: 'absolute', left: '-335px', top: '-12px', color: 'rgba(255,80,80,0.6)', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 6px rgba(255,50,50,0.4)' }}>−X</div>

              {/* ── Y axis (green) ── */}
              {/* +Y ray — up */}
              <div style={{ position: 'absolute', width: '4px', height: '300px', background: 'linear-gradient(0deg, #33ff33, #33ff33 80%, transparent)', transform: 'translate(-2px, -300px)', boxShadow: '0 0 8px rgba(50,255,50,0.6)' }} />
              <div style={{ position: 'absolute', left: '-12px', top: '-328px', color: '#33ff33', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 10px rgba(50,255,50,0.8)' }}>+Y</div>
              {/* −Y ray — down (faded) */}
              <div style={{ position: 'absolute', width: '3px', height: '300px', background: 'linear-gradient(180deg, rgba(50,255,50,0.5), transparent)', transform: 'translate(-1.5px, 0)' }} />
              <div style={{ position: 'absolute', left: '-12px', top: '305px', color: 'rgba(50,255,50,0.6)', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 6px rgba(50,255,50,0.4)' }}>−Y</div>

              {/* ── Z axis (blue) — rotateX(90deg) so it extends toward viewer ── */}
              {/* +Z ray — toward viewer */}
              <div style={{ position: 'absolute', width: '4px', height: '300px', background: 'linear-gradient(0deg, #3399ff, #3399ff 80%, transparent)', transform: 'translate(-2px, 0) rotateX(90deg)', transformOrigin: 'top center', boxShadow: '0 0 8px rgba(50,150,255,0.6)' }} />
              <div style={{ position: 'absolute', left: '10px', color: '#3399ff', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 10px rgba(50,150,255,0.8)', transform: 'translateZ(305px)', transformOrigin: 'center center' }}>+Z</div>
              {/* −Z ray — into screen (faded) */}
              <div style={{ position: 'absolute', width: '3px', height: '300px', background: 'linear-gradient(180deg, rgba(30,144,255,0.5), transparent)', transform: 'translate(-1.5px, 0) rotateX(-90deg)', transformOrigin: 'top center' }} />
              <div style={{ position: 'absolute', left: '10px', color: 'rgba(30,144,255,0.6)', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 6px rgba(50,150,255,0.4)', transform: 'translateZ(-310px)', transformOrigin: 'center center' }}>−Z</div>

              {/* Origin dot */}
              <div style={{ position: 'absolute', width: '12px', height: '12px', borderRadius: '50%', background: 'white', transform: 'translate(-6px, -6px)', boxShadow: '0 0 12px rgba(255,255,255,1), 0 0 4px rgba(255,255,255,0.9)' }} />
            </div>

            {/* ── Layer 4b: Floor plane — XZ grid at Y=0 ──
                 An 800×800 div rotated 90° around X to lie flat on XZ.
                 translate(-50%,-50%) centers it on the world origin.
            ── */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${floorW}px`,
                height: `${floorH}px`,
                transform: 'translate(-50%, -50%) rotateX(90deg)',
                transformOrigin: 'center center',
                transformStyle: 'preserve-3d',
                background: '#f8f9fb',
                backgroundImage: `
                  linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
                border: '1px solid rgba(0,0,0,0.1)',
                pointerEvents: 'none',
              }}
            >
              {/* Floor label */}
              <div style={{ position: 'absolute', bottom: '8px', right: '8px', color: 'rgba(0,0,0,0.2)', fontSize: '12px', fontFamily: 'monospace' }}>XZ floor</div>

              {/* Floor side faces — give the board slab visual thickness */}
              {/* Bottom edge (local Y = floorH) */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: `${floorH}px`,
                width: `${floorW}px`,
                height: `${BOARD_3D_HEIGHT}px`,
                transform: 'rotateX(90deg)',
                transformOrigin: 'top left',
                background: 'linear-gradient(180deg, #e2e4e8, #d1d3d8)',
                borderBottom: '1px solid rgba(0,0,0,0.12)',
              }} />
              {/* Top edge (local Y = 0) */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${floorW}px`,
                height: `${BOARD_3D_HEIGHT}px`,
                transform: 'rotateX(90deg)',
                transformOrigin: 'top left',
                background: 'linear-gradient(180deg, #e8eaee, #dcdee3)',
                borderBottom: '1px solid rgba(0,0,0,0.1)',
              }} />
              {/* Right edge (local X = floorW) */}
              <div style={{
                position: 'absolute',
                left: `${floorW}px`,
                top: 0,
                width: `${BOARD_3D_HEIGHT}px`,
                height: `${floorH}px`,
                transform: 'rotateY(-90deg)',
                transformOrigin: 'top left',
                background: 'linear-gradient(180deg, #dfe1e6, #cfd1d6)',
                borderRight: '1px solid rgba(0,0,0,0.12)',
              }} />
              {/* Left edge (local X = 0) */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${BOARD_3D_HEIGHT}px`,
                height: `${floorH}px`,
                transform: 'rotateY(-90deg)',
                transformOrigin: 'top left',
                background: 'linear-gradient(180deg, #e5e7ec, #d5d7dc)',
                borderRight: '1px solid rgba(0,0,0,0.1)',
              }} />
            </div>

            {/* ── Layer 4c: Board — the 2D Gantt page on the XZ floor ──
                 Transform breakdown (CSS applies right-to-left):
                   1. translate(-50%,-50%)  — center the board at origin
                   2. rotateX(90°)          — tilt from XY plane into XZ
                   3. rotateY(90°)          — rotate so page-top → −X
                 Result mapping (2D page axis → 3D world axis):
                   page left   → +Z (toward viewer)
                   page right  → −Z (into screen)
                   page top    → −X (world left)
                   page bottom → +X (world right)
            ── */}
            <div
              ref={boardRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${boardW}px`,  // full chart width + left/right padding
                transform: [
                  'rotateY(90deg)',            // step 3: page-top → −X
                  'rotateX(90deg)',            // step 2: XY plane → XZ plane
                  'translate(-50%, -50%)',     // step 1: center on origin
                ].join(' '),
                transformOrigin: '0 0',
                transformStyle: 'preserve-3d',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                boxShadow: '0 5px 40px rgba(0,0,0,0.6)',
                pointerEvents: 'none',  // don't block persona clicks
              }}
            >
              <div
                style={{
                  padding: '24px 24px 0 24px',
                  background: 'linear-gradient(160deg, #f8f9fb 0%, #f6f7fa 50%, #f7f6f5 100%)',
                  borderRadius: '12px 12px 0 0',
                }}
              >
                {/* ── Toolbar placeholder ──────────────────────────── */}
                <ToolbarPlaceholder />
              </div>

          {/* ── Canvas ─────────────────────────────────────────── */}
          <div
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflow: 'hidden',
              background: 'linear-gradient(160deg, #f8f9fb 0%, #f6f7fa 50%, #f7f6f5 100%)',
              padding: '0 24px 24px 24px',
              borderRadius: '0 0 12px 12px',
            }}
          >
      {/* Outer scroll container — scaleY(-1) flips scrollbar to top */}
      <div
        data-board-scroll
        style={{ height: `${contentHeight + 16}px`, transform: 'scaleY(-1)', flex: '1 1 auto', minHeight: 0 }}
        className="overflow-x-hidden overflow-y-hidden rounded-xl border border-slate-200 shadow-sm"
        onWheel={(e) => {
          if (e.shiftKey && e.deltaY !== 0) {
            e.preventDefault();
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        {/* Inner container — flip back */}
        <div
          ref={containerRef}
          style={{ width: `${totalWidth}px`, height: `${contentHeight}px`, transform: 'scaleY(-1)' }}
          className="relative"
        >
          {/* ── Header Row ────────────────────────────────────── */}
          <div className="flex flex-col" style={{ height: `${effectiveHeaderH}px`, position: 'relative', zIndex: 50 }}>

            {/* Global phase header (26px) */}
            {showGlobalPhases && (
              <div className="flex" style={{ height: `${PHASE_HEADER_HEIGHT}px` }}>
                <div
                  className="bg-slate-50 border-b border-r border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-400"
                  style={{ width: `${TEAMWIDTH + TASKWIDTH}px`, height: `${PHASE_HEADER_HEIGHT}px`, position: 'sticky', left: 0, zIndex: 51 }}
                >
                  Phases
                </div>
                <div className="relative border-b border-slate-200" style={{ width: `${totalDaysWidth}px`, height: `${PHASE_HEADER_HEIGHT}px` }}>
                  {globalPhases.map((phase) => {
                    const phaseX = phase.start_index * DAYWIDTH;
                    const phaseW = phase.duration * DAYWIDTH;
                    if (phaseW <= 0) return null;
                    return (
                      <div
                        key={phase.id}
                        className="absolute top-0 flex items-center justify-center"
                        style={{
                          left: `${phaseX}px`,
                          width: `${phaseW}px`,
                          height: `${PHASE_HEADER_HEIGHT}px`,
                          backgroundColor: phase.color || '#3b82f6',
                          backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.18) 3px, rgba(255,255,255,0.18) 6px)',
                          color: '#fff',
                          borderRadius: '0 0 4px 4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          borderBottom: '2px solid rgba(0,0,0,0.15)',
                        }}
                      >
                        <span className="truncate px-1">{phase.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day header row (48px) */}
            {showDayHeader && (
              <div className="flex" style={{ height: `${HEADER_HEIGHT}px`, position: 'relative', zIndex: 50 }}>
                {/* Sticky team + tasks labels */}
                <div
                  className="flex border-b bg-slate-100 text-sm font-semibold text-slate-700"
                  style={{ width: `${TEAMWIDTH + TASKWIDTH}px`, height: `${HEADER_HEIGHT}px`, position: 'sticky', left: 0, zIndex: 50 }}
                >
                  <div className="flex items-center justify-center border-r border-slate-300" style={{ width: `${TEAMWIDTH}px` }}>
                    Team
                  </div>
                  <div className="flex items-center justify-center border-r border-slate-300" style={{ width: `${TASKWIDTH}px` }}>
                    Tasks
                  </div>
                </div>
                {/* Day columns */}
                <div className="relative border-b" style={{ width: `${totalDaysWidth}px` }}>
                  {dayLabels.map((info, i) => {
                    const colX = i * DAYWIDTH;
                    const hasPurpose = !!info.purpose;
                    const isTeamSpecific = hasPurpose && Array.isArray(info.purposeTeams) && info.purposeTeams.length > 0;
                    const showDayName = DAYWIDTH >= DAY_NAME_WIDTH_THRESHOLD;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 flex flex-col items-center justify-center text-xs border-r transition-colors ${
                          hasPurpose
                            ? isTeamSpecific
                              ? 'bg-slate-600 text-white'
                              : 'bg-slate-800 text-white'
                            : info.isSunday
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-50 text-slate-500'
                        }`}
                        style={{ left: `${colX}px`, width: `${DAYWIDTH}px`, height: `${HEADER_HEIGHT}px` }}
                      >
                        {showDayName && (
                          <span className={`text-[10px] font-medium ${hasPurpose ? 'text-slate-300' : info.isSunday ? 'text-purple-600' : 'text-slate-400'}`}>
                            {info.dayNameShort}
                          </span>
                        )}
                        <span className={`font-medium ${hasPurpose ? 'text-white' : ''}`}>
                          {info.dateStr}
                        </span>
                        {hasPurpose && DAYWIDTH >= 50 && (
                          <span className="text-[9px] truncate max-w-full px-1 text-slate-300">{info.purpose}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Team rows ─────────────────────────────────────── */}
          {teamOrder.map((teamId) => {
            const team = teams[teamId];
            if (!team) return null;
            const teamColor = team.color || '#94a3b8';
            const isVirtual = team._virtual;
            const visibleTasks_ = getVisibleTasks(team, taskDisplaySettings);
            const teamPhases = teamPhasesMap[teamId] || [];
            const hasTeamPhases = teamPhases.length > 0;
            const phaseRowH = hasTeamPhases ? TEAM_PHASE_ROW_HEIGHT : 0;
            const teamRowH = getTeamRowHeight(team, taskDisplaySettings, phaseRowH);

            return (
              <div key={teamId}>
                {/* Drop highlight placeholder */}
                <div className="flex">
                  <div style={{ width: `${TEAMWIDTH + TASKWIDTH}px`, height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2}px`, position: 'sticky', left: 0 }} />
                  <div style={{ flex: 1, height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2}px` }} />
                </div>

                {/* Team color header line */}
                <div
                  style={{
                    height: `${TEAM_HEADER_LINE_HEIGHT}px`,
                    marginBottom: `${TEAM_HEADER_GAP}px`,
                    backgroundColor: teamColor,
                    ...(isVirtual ? {
                      backgroundImage: `repeating-linear-gradient(90deg, ${teamColor}, ${teamColor} 8px, transparent 8px, transparent 16px)`,
                      backgroundColor: 'transparent',
                    } : {}),
                  }}
                />

                {/* Team phase row (if applicable) */}
                {hasTeamPhases && (
                  <div className="flex" style={{ height: `${TEAM_PHASE_ROW_HEIGHT}px` }}>
                    <div
                      className="flex items-center text-[9px] text-slate-400 px-2"
                      style={{
                        width: `${TEAMWIDTH + TASKWIDTH}px`,
                        height: `${TEAM_PHASE_ROW_HEIGHT}px`,
                        background: 'rgba(248,250,252,0.97)',
                        position: 'sticky',
                        left: 0,
                        zIndex: 30,
                        borderRight: '1px solid #e2e8f0',
                      }}
                    >
                      Phases
                    </div>
                    <div className="relative" style={{ width: `${totalDaysWidth}px`, height: `${TEAM_PHASE_ROW_HEIGHT}px` }}>
                      {teamPhases.map((phase) => {
                        const px = phase.start_index * DAYWIDTH;
                        const pw = phase.duration * DAYWIDTH;
                        if (pw <= 0) return null;
                        return (
                          <div
                            key={phase.id}
                            className="absolute top-0 flex items-center justify-center"
                            style={{
                              left: `${px}px`,
                              width: `${pw}px`,
                              height: `${TEAM_PHASE_ROW_HEIGHT}px`,
                              backgroundColor: phase.color || '#3b82f6',
                              backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(255,255,255,0.18) 2px, rgba(255,255,255,0.18) 4px)',
                              color: '#fff',
                              borderRadius: '0 0 3px 3px',
                              fontSize: '9px',
                              fontWeight: 600,
                              borderBottom: '2px solid rgba(0,0,0,0.15)',
                            }}
                          >
                            <span className="truncate px-1">{phase.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Team row: sidebar + day grid */}
                <div className="flex">
                  {/* ── Sticky sidebar (team name + tasks) ───── */}
                  <div
                    style={{
                      width: `${TEAMWIDTH + TASKWIDTH}px`,
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      display: 'flex',
                    }}
                  >
                    {/* Team name column */}
                    <div
                      className="flex items-start px-2 pt-2 border-r border-b border-slate-200"
                      style={{
                        width: `${TEAMWIDTH}px`,
                        height: `${teamRowH - phaseRowH}px`,
                        backgroundColor: lightenColor(teamColor, 0.92),
                        ...(isVirtual ? {
                          backgroundColor: '#f1f5f9',
                          borderLeft: '2px dashed #94a3b8',
                        } : {}),
                      }}
                    >
                      {/* Expand/collapse triangle (non-functional) */}
                      <div className="flex items-center justify-center" style={{ width: '18px', height: '18px', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill={teamColor} style={{ transform: 'rotate(90deg)', transition: 'transform 0.15s' }}>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <span className={`text-sm font-medium truncate ml-1 ${isVirtual ? 'italic text-slate-400' : ''}`}>
                        {team.name}
                      </span>
                    </div>

                    {/* Tasks column */}
                    <div
                      className="border-r border-slate-200"
                      style={{
                        width: `${TASKWIDTH}px`,
                        backgroundColor: 'rgba(255,255,255,0.97)',
                      }}
                    >
                      {visibleTasks_.map((taskId, idx) => {
                        const task = tasks[taskId];
                        if (!task) return null;
                        const th = getTaskHeight(taskId, taskDisplaySettings);
                        return (
                          <div
                            key={taskId}
                            className="flex items-center hover:bg-slate-50/50 transition-colors"
                            style={{
                              height: `${th}px`,
                              borderLeft: '1px solid #e2e8f0',
                              borderBottom: idx < visibleTasks_.length - 1 ? '1px solid #e2e8f0' : 'none',
                              paddingLeft: '8px',
                              paddingRight: '4px',
                            }}
                          >
                            {/* Drag handle icon (decorative) */}
                            <div className="flex items-center justify-center text-slate-300" style={{ width: '28px', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                                <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                              </svg>
                            </div>
                            <span className="truncate text-sm text-slate-600">{task.name}</span>
                          </div>
                        );
                      })}
                      {visibleTasks_.length === 0 && (
                        <div
                          className="flex items-center justify-center text-[10px] text-slate-400 italic"
                          style={{
                            height: `${TEAM_COLLAPSED_HEIGHT}px`,
                            backgroundColor: 'rgba(241,245,249,0.6)',
                            borderLeft: '2px dashed #cbd5e1',
                          }}
                        >
                          No tasks yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Day grid (per team) ───────────────────── */}
                  <DayGrid
                    team={team}
                    tasks={tasks}
                    days={days}
                    DAYWIDTH={DAYWIDTH}
                    taskDisplaySettings={taskDisplaySettings}
                    teamPhasesMap={teamPhasesMap}
                    phases={phases}
                    teamColor={teamColor}
                    totalDaysWidth={totalDaysWidth}
                  />
                </div>
              </div>
            );
          })}

          {/* Final drop indicator placeholder */}
          <div style={{ height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2}px` }} />

          {/* ── Milestone Layer ────────────────────────────────── */}
          <MilestoneLayer
            teamOrder={teamOrder}
            teams={teams}
            milestones={milestones}
            taskDisplaySettings={taskDisplaySettings}
            teamPhasesMap={teamPhasesMap}
            effectiveHeaderH={effectiveHeaderH}
            TEAMWIDTH={TEAMWIDTH}
            TASKWIDTH={TASKWIDTH}
            DAYWIDTH={DAYWIDTH}
          />
        </div>{/* inner container */}
      </div>{/* scroll container */}
      </div>{/* canvas wrapper */}
      </div>{/* board */}

            {/* ── Layer 4d: Milestone pedestals — raised slot markers above the floor ──
                 Each pedestal lies flat on XZ with text along world Z
                 (matching the board’s timeline direction).
                 Rotation: Rx(90°)·Rz(90°) maps local-X → world-Z.
            ── */}
            {milestone3D.map((m) => {
              const occupied = personas.some((p) => p.milestoneId === m.id);
              const slotW = Math.max((m.duration || 1) * DAYWIDTH, PERSONA_SIZE + 10);
              const slotH = PERSONA_SIZE + 10;
              const depth = MILESTONE_3D_HEIGHT;
              const baseColor = m.color || m.teamColor || '#facc15';
              const borderColor = occupied ? 'rgba(74,222,128,1)' : baseColor;
              const topBg = occupied ? 'rgba(74,222,128,0.85)' : baseColor;
              // Directional shading: each wall gets a different brightness to simulate light from +Y/+Z
              const sideA = occupied ? 'linear-gradient(180deg, rgba(50,180,80,0.95), rgba(40,150,65,0.85))' : `linear-gradient(180deg, ${baseColor}ee, ${baseColor}bb)`;
              const sideB = occupied ? 'linear-gradient(180deg, rgba(45,160,72,0.9), rgba(35,135,58,0.8))' : `linear-gradient(180deg, ${baseColor}cc, ${baseColor}99)`;
              const sideC = occupied ? 'linear-gradient(180deg, rgba(55,190,85,0.95), rgba(45,165,70,0.88))' : `linear-gradient(180deg, ${baseColor}dd, ${baseColor}aa)`;
              const sideD = occupied ? 'linear-gradient(180deg, rgba(40,150,65,0.85), rgba(30,120,50,0.75))' : `linear-gradient(180deg, ${baseColor}bb, ${baseColor}88)`;
              return (
                <div
                  key={`ms-${m.id}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${slotW}px`,
                    height: `${slotH}px`,
                    transform: [
                      `translateX(${m.worldX}px)`,
                      `translateZ(${m.worldZ}px)`,
                      `translateY(-${depth}px)`,
                      'rotateX(-90deg)',
                      'rotateZ(-90deg)',
                      `translate(-${slotW / 2}px, -${slotH / 2}px)`,
                    ].join(' '),
                    transformOrigin: '0 0',
                    transformStyle: 'preserve-3d',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Top face (label surface) */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${slotW}px`,
                    height: `${slotH}px`,
                    border: `2px solid ${borderColor}`,
                    borderRadius: '4px',
                    background: topBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: '8px',
                      color: 'rgba(255,255,255,0.9)',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                      padding: '0 2px',
                      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    }}>
                      {m.name}
                    </span>
                  </div>

                  {/* Side faces (extend from top face into -Z = downward) */}
                  {/* Bottom edge (local Y = slotH) */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: `${slotH}px`,
                    width: `${slotW}px`,
                    height: `${depth}px`,
                    transform: 'rotateX(90deg)',
                    transformOrigin: 'top left',
                    background: sideA,
                    borderLeft: `1px solid ${borderColor}`,
                    borderRight: `1px solid ${borderColor}`,
                    borderBottom: `1px solid ${borderColor}`,
                  }} />
                  {/* Top edge (local Y = 0) */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${slotW}px`,
                    height: `${depth}px`,
                    transform: 'rotateX(90deg)',
                    transformOrigin: 'top left',
                    background: sideB,
                    borderLeft: `1px solid ${borderColor}`,
                    borderRight: `1px solid ${borderColor}`,
                    borderBottom: `1px solid ${borderColor}`,
                  }} />
                  {/* Right edge (local X = slotW) */}
                  <div style={{
                    position: 'absolute',
                    left: `${slotW}px`,
                    top: 0,
                    width: `${depth}px`,
                    height: `${slotH}px`,
                    transform: 'rotateY(-90deg)',
                    transformOrigin: 'top left',
                    background: sideC,
                    borderTop: `1px solid ${borderColor}`,
                    borderBottom: `1px solid ${borderColor}`,
                    borderRight: `1px solid ${borderColor}`,
                  }} />
                  {/* Left edge (local X = 0) */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${depth}px`,
                    height: `${slotH}px`,
                    transform: 'rotateY(-90deg)',
                    transformOrigin: 'top left',
                    background: sideD,
                    borderTop: `1px solid ${borderColor}`,
                    borderBottom: `1px solid ${borderColor}`,
                    borderRight: `1px solid ${borderColor}`,
                  }} />
                </div>
              );
            })}

            {/* ── Layer 4e: Protopersonas — cubes on the XZ floor ──
                 Each persona is a CSS 3D cube at world (x, 0, z).
                 translateX = world X, translateZ = world Z.
            ── */}
            {personas.map((p) => {
              const S = PERSONA_SIZE;       // cube side length
              const half = S / 2;           // half-side for face translations
              // Shared face style — each face is an S×S square centered in the cube
              const face = {
                position: 'absolute',
                width: `${S}px`,
                height: `${S}px`,
                backfaceVisibility: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#fff',
                fontFamily: 'monospace',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.25)',
                boxSizing: 'border-box',
              };
              return (
                <div
                  key={p.id}
                  data-persona-id={p.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${S}px`,
                    height: `${S}px`,
                    // Position: world X & Z, then lift by full side so cube sits ON the floor.
                    // When snapped to a milestone, add MILESTONE_3D_HEIGHT so the cube
                    // sits on top of the raised milestone pedestal instead of on the floor.
                    // Also center the cube on the milestone slot (half cube offset).
                    transform: [
                      `translateX(${p.x - S / 2}px)`,
                      `translateZ(${p.z + S / 2}px)`,
                      `translateY(-${S + (p.milestoneId != null ? MILESTONE_3D_HEIGHT : 0)}px)`,
                    ].join(' '),
                    transformStyle: 'preserve-3d',
                    cursor: draggingPersona.current === p.id ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    zIndex: 50,
                    pointerEvents: 'auto',
                  }}
                >
                  {/* Front face (+Z) */}
                  <div style={{ ...face, background: p.color,
                    transform: `translateZ(${half}px)` }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Back face (−Z) */}
                  <div style={{ ...face, background: p.color,
                    transform: `rotateY(180deg) translateZ(${half}px)` }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Left face (−X) */}
                  <div style={{ ...face, background: p.color,
                    filter: 'brightness(0.85)',
                    transform: `rotateY(-90deg) translateZ(${half}px)` }} />
                  {/* Right face (+X) */}
                  <div style={{ ...face, background: p.color,
                    filter: 'brightness(0.85)',
                    transform: `rotateY(90deg) translateZ(${half}px)` }} />
                  {/* Top face (+Y) */}
                  <div style={{ ...face, background: p.color,
                    filter: 'brightness(1.15)',
                    transform: `rotateX(90deg) translateZ(${half}px)` }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Bottom face (−Y) — sits on the floor */}
                  <div style={{ ...face, background: p.color,
                    filter: 'brightness(0.7)',
                    transform: `rotateX(-90deg) translateZ(${half}px)` }} />
                  {/* Name label floating above the cube */}
                  <div style={{
                    position: 'absolute',
                    top: `-20px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    color: '#fff',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 4px rgba(0,0,0,0.7)',
                    pointerEvents: 'none',
                  }}>
                    {p.name}
                  </div>
                </div>
              );
            })}

      </div>{/* distance wrapper */}
      </div>{/* orbit wrapper */}

      {/* ── Persona controls panel (top-right) ── */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 999,
        background: 'rgba(0,0,0,0.7)', padding: '10px 14px',
        borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px',
        color: '#fff', minWidth: '160px',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>Protopersonas</div>
        <button
          onClick={addPersona}
          style={{
            width: '100%', padding: '6px 0', borderRadius: '6px',
            background: '#4ade80', color: '#000', fontWeight: 'bold',
            border: 'none', cursor: 'pointer', fontSize: '12px',
            marginBottom: '8px',
          }}
        >
          + Add Persona
        </button>
        {personas.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: '10px', textAlign: 'center' }}>
            No personas yet
          </div>
        )}
        {personas.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{
              width: '14px', height: '14px', borderRadius: '50%',
              background: p.color, flexShrink: 0,
              border: '1.5px solid rgba(255,255,255,0.6)',
            }} />
            <span style={{ flex: 1, fontSize: '11px' }}>{p.name}</span>
            <span style={{ fontSize: '9px', color: p.milestoneId ? '#4ade80' : '#94a3b8' }}>
              {p.milestoneId
                ? (milestones[p.milestoneId]?.name || 'MS')
                : `${Math.round(p.x)}, ${Math.round(p.z)}`}
            </span>
            <button
              onClick={() => removePersona(p.id)}
              style={{
                background: 'none', border: 'none', color: '#f87171',
                cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                padding: '0 2px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ToolbarPlaceholder — visual replica of toolbar chrome (no logic)
// ══════════════════════════════════════════════════════════════════

function ToolbarPlaceholder() {
  return (
    <div className="mb-4">
      {/* Toggle tabs */}
      <div className="flex items-end gap-0.5 ml-1">
        <button className="px-3 py-1 rounded-t-md bg-white border border-b-0 border-slate-200 text-slate-400 text-xs flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>
          <span className="text-[10px]">Show</span>
        </button>
        <button className="px-3 py-1 rounded-t-md bg-white border border-b-0 border-slate-200 text-slate-400 text-xs flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 11h3v10h2V11h3l-4-4-4 4zM4 3v2h16V3H4z"/></svg>
          <span className="text-[10px]">Header</span>
        </button>
      </div>

      {/* Toolbar body */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex divide-x divide-slate-200 px-3 py-2.5">
          {/* Mode section */}
          <div className="pr-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mode</div>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg" style={{ width: '170px' }}>
              {['View', 'Edit', 'Deps', 'Refact.'].map((label, i) => (
                <button
                  key={label}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md ${i === 0 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Create section */}
          <div className="px-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Create</div>
            <div className="grid grid-cols-2 gap-1" style={{ width: '130px' }}>
              {['Team', 'Task', 'Mile.', 'Phase'].map((label) => (
                <button key={label} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600">
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Delete section */}
          <div className="px-3 flex items-center">
            <button className="flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-xs font-medium rounded-md border border-slate-200 text-slate-300 cursor-not-allowed" style={{ width: '70px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              <span className="text-[10px]">Delete</span>
            </button>
          </div>
          {/* Display section */}
          <div className="px-3 flex-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Display</div>
            <div className="flex gap-2">
              {['Timeline', 'Hide Deps', 'Coll. Deps', 'Coll. All'].map((label) => (
                <button key={label} className="px-2 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600">
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Sizing section */}
          <div className="px-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Sizing</div>
            <div className="space-y-1" style={{ width: '210px' }}>
              {[
                { label: 'Day W', val: DEFAULT_DAYWIDTH },
                { label: 'Task H', val: DEFAULT_TASKHEIGHT_NORMAL },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 w-12">{label}</span>
                  <input type="range" className="flex-1" disabled />
                  <span className="text-[11px] text-slate-500 w-6 text-right tabular-nums">{val}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Views section */}
          <div className="pl-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Views</div>
            <button className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border border-teal-400 bg-teal-50 text-teal-700" style={{ width: '175px' }}>
              Default
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DayGrid — per-team day cell grid (display only)
// ══════════════════════════════════════════════════════════════════

function DayGrid({ team, tasks, days, DAYWIDTH, taskDisplaySettings, teamPhasesMap, phases, teamColor, totalDaysWidth }) {
  const visibleTasks_ = getVisibleTasks(team, taskDisplaySettings);
  const teamPhases = teamPhasesMap[team.id] || [];
  const phaseRowH = teamPhases.length > 0 ? TEAM_PHASE_ROW_HEIGHT : 0;
  const teamRowH = getTeamRowHeight(team, taskDisplaySettings, phaseRowH) - phaseRowH;

  // Build a day→phase color map from all phases that apply to this team
  const phaseColorMap = useMemo(() => {
    const map = {};
    for (const p of phases) {
      // Global phases apply to all teams; team phases apply only to their team
      if (p.team != null && String(p.team) !== String(team.id)) continue;
      for (let d = p.start_index; d < p.start_index + p.duration; d++) {
        map[d] = p.color || '#3b82f6';
      }
    }
    return map;
  }, [phases, team.id]);

  return (
    <div
      className="border-y border-slate-200"
      style={{ width: `${totalDaysWidth}px`, height: `${teamRowH}px`, position: 'relative', backgroundColor: '#fafbfc' }}
    >
      {visibleTasks_.map((taskId, tIdx) => {
        const th = getTaskHeight(taskId, taskDisplaySettings);
        const yOff = getTaskYOffset(taskId, team, taskDisplaySettings);
        return (
          <div
            key={taskId}
            className="absolute"
            style={{
              top: `${yOff}px`,
              left: 0,
              width: `${totalDaysWidth}px`,
              height: `${th}px`,
              borderBottom: tIdx < visibleTasks_.length - 1 ? '1px solid #e2e8f0' : 'none',
            }}
          >
            {Array.from({ length: days }, (_, i) => {
              const colX = i * DAYWIDTH;
              const phaseColor = phaseColorMap[i];
              return (
                <div
                  key={i}
                  className="absolute top-0 border-r border-slate-100"
                  style={{
                    left: `${colX}px`,
                    width: `${DAYWIDTH}px`,
                    height: `${th}px`,
                    backgroundColor: phaseColor
                      ? `${phaseColor}14`
                      : undefined,
                    ...(phaseColor ? {
                      backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 4px, ${phaseColor}0a 4px, ${phaseColor}0a 8px)`,
                    } : {}),
                  }}
                />
              );
            })}
          </div>
        );
      })}
      {/* If no visible tasks — show empty placeholder */}
      {visibleTasks_.length === 0 && (
        <div
          className="w-full h-full"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(148,163,184,0.06) 4px, rgba(148,163,184,0.06) 8px)',
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MilestoneLayer — positioned absolute overlay for milestones
// ══════════════════════════════════════════════════════════════════

function MilestoneLayer({ teamOrder, teams, milestones, taskDisplaySettings, teamPhasesMap, effectiveHeaderH, TEAMWIDTH, TASKWIDTH, DAYWIDTH }) {
  // Use the canonical layout module to compute 2D milestone positions.
  // The result is mapped to the standard milestone box format (y+2, h-4).
  const positioned = useMemo(() => {
    return computeMilestonePixelPositions({
      teamOrder, teams, milestones, taskDisplaySettings,
      teamPhasesMap, effectiveHeaderH,
      TEAMWIDTH, TASKWIDTH, DAYWIDTH,
    }).map((m) => ({ ...m, y: m.y + 2, h: m.h - 4 }));
  }, [teamOrder, teams, taskDisplaySettings, milestones, effectiveHeaderH, teamPhasesMap, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

  return (
    <div className="absolute top-0 left-0 w-full h-full" style={{ zIndex: 20, pointerEvents: 'none' }}>
      {positioned.map((m) => (
        <div
          key={m.id}
          className="absolute rounded cursor-pointer"
          style={{
            left: `${m.x}px`,
            top: `${m.y}px`,
            width: `${m.w}px`,
            height: `${m.h}px`,
            backgroundColor: m.color || m.teamColor || '#facc15',
            pointerEvents: 'auto',
          }}
        >
          <span className="text-xs truncate text-white px-2 leading-none flex items-center h-full" style={{ textShadow: '0 0 3px rgba(0,0,0,0.3)' }}>
            {m.name}
          </span>
        </div>
      ))}
    </div>
  );
}
