// ═══════════════════════════════════════════════════════════════════
// Assignment_Second.jsx — Visual replica of the Dependencies page
// ═══════════════════════════════════════════════════════════════════
//
// This renders an exact visual copy of the 2D Dependencies Gantt chart
// surface: scroll container, day header, team/task sidebar, day grid,
// milestones — all using the same layout constants. Buttons and
// interactions are NOT wired up; this is a display-only surface.
//
import { useState, useEffect, useRef, useMemo } from 'react';
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
} from '../dependency/layoutMath.js';

// ── Phase header height ──────────────────────────────────────────
const PHASE_HEADER_HEIGHT = 26;

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

/** Get task height from display settings */
function getTaskHeight(taskId, taskDisplaySettings) {
  const s = taskDisplaySettings[taskId];
  if (!s || s.hidden) return 0;
  return s.size === 'small' ? DEFAULT_TASKHEIGHT_SMALL : DEFAULT_TASKHEIGHT_NORMAL;
}

/** Get visible tasks for a team */
function getVisibleTasks(team, taskDisplaySettings) {
  if (!team) return [];
  return team.tasks.filter((tid) => {
    const s = taskDisplaySettings[tid];
    return s ? !s.hidden : true;
  });
}

/** Get team row height */
function getTeamRowHeight(team, taskDisplaySettings, teamPhaseRowH = 0) {
  if (!team) return TEAM_COLLAPSED_HEIGHT;
  let h = 0;
  for (const tid of team.tasks) {
    h += getTaskHeight(tid, taskDisplaySettings);
  }
  return Math.max(h, TEAM_COLLAPSED_HEIGHT) + teamPhaseRowH;
}

/** Get Y offset for a team */
function getTeamYOffset(teamId, teamOrder, teams, taskDisplaySettings, effectiveHeaderH, teamPhasesMap) {
  let offset = effectiveHeaderH;
  for (const tid of teamOrder) {
    if (tid === teamId) break;
    offset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
    offset += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;
    const phaseH = (teamPhasesMap[tid] && teamPhasesMap[tid].length > 0) ? TEAM_PHASE_ROW_HEIGHT : 0;
    offset += getTeamRowHeight(teams[tid], taskDisplaySettings, phaseH);
  }
  return offset;
}

/** Get Y offset for a task within its team */
function getTaskYOffset(taskId, team, taskDisplaySettings) {
  if (!team) return 0;
  let offset = 0;
  for (const tid of team.tasks) {
    if (tid === taskId) break;
    offset += getTaskHeight(tid, taskDisplaySettings);
  }
  return offset;
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
  const [orbitX, setOrbitX] = useState(30);   // vertical tilt  (5–90°)
  const [orbitY, setOrbitY] = useState(30);    // horizontal spin
  const [panX, setPanX]     = useState(0);     // translate left/right (px)
  const [panY, setPanY]     = useState(0);     // translate up/down    (px)
  const [zoom, setZoom]     = useState(500);   // translateZ depth     (px)  — closer to origin
  const isDragging = useRef(false);
  const isPanning  = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onDown = (e) => {
      // Middle mouse = orbit, Right mouse = pan
      if (e.button === 1) {
        e.preventDefault();
        isDragging.current = true;
        isPanning.current  = e.shiftKey; // Shift+middle also pans
        lastMouse.current  = { x: e.clientX, y: e.clientY };
      } else if (e.button === 2) {
        e.preventDefault();
        isDragging.current = true;
        isPanning.current  = true;
        lastMouse.current  = { x: e.clientX, y: e.clientY };
      }
    };
    const onMove = (e) => {
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
      setZoom((prev) => Math.max(-800, Math.min(600, prev - e.deltaY * 0.8)));
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
  // Transform hierarchy (simulates orbit camera):
  //   Perspective container
  //     → Orbit wrapper     : rotateX(orbitX) rotateY(orbitY)  — camera on sphere
  //     → Distance wrapper  : translateZ(-distance + zoom)     — camera distance
  //     → Board             : translate(-50%,-50%) rotateX(-90deg) — world alignment (XZ plane)
  //
  return (
    <div
      className="w-full select-none"
      style={{
        height: '100dvh',
        background: '#1a1a2e',
        perspective: '1800px',
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
      </div>

      {/* ── Orbit wrapper — rotates the scene = camera orbits around the board ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transformStyle: 'preserve-3d',
          transform: `translateX(${panX}px) translateY(${panY}px) rotateX(${-orbitX}deg) rotateY(${-orbitY}deg)`,
        }}
      >
        {/* ── Distance wrapper — translateZ = camera distance from center ── */}
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: `translateZ(${-600 + zoom}px)`,
            position: 'relative',
          }}
        >
            {/* ── 3D Axis Gizmo — shows ±X (red), ±Y (green), ±Z (blue) ── */}
            <div style={{ position: 'absolute', top: 0, left: 0, transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
              {/* ── X axis (red) ── */}
              {/* +X ray — right */}
              <div style={{ position: 'absolute', width: '180px', height: '3px', background: 'red', transform: 'translateY(-1.5px)' }} />
              <div style={{ position: 'absolute', left: '185px', top: '-10px', color: 'red', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>+X</div>
              {/* −X ray — left (faded) */}
              <div style={{ position: 'absolute', width: '180px', height: '2px', background: 'rgba(255,80,80,0.35)', transform: 'translate(-180px, -1px)' }} />
              <div style={{ position: 'absolute', left: '-210px', top: '-10px', color: 'rgba(255,80,80,0.5)', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}>−X</div>

              {/* ── Y axis (green) ── */}
              {/* +Y ray — up */}
              <div style={{ position: 'absolute', width: '3px', height: '180px', background: 'limegreen', transform: 'translate(-1.5px, -180px)' }} />
              <div style={{ position: 'absolute', left: '-8px', top: '-202px', color: 'limegreen', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>+Y</div>
              {/* −Y ray — down (faded) */}
              <div style={{ position: 'absolute', width: '2px', height: '180px', background: 'rgba(50,255,50,0.35)', transform: 'translate(-1px, 0)' }} />
              <div style={{ position: 'absolute', left: '-10px', top: '185px', color: 'rgba(50,255,50,0.5)', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}>−Y</div>

              {/* ── Z axis (blue) — rotateX(90deg) so it extends toward viewer ── */}
              {/* +Z ray — toward viewer */}
              <div style={{ position: 'absolute', width: '3px', height: '180px', background: 'dodgerblue', transform: 'translate(-1.5px, 0) rotateX(90deg)', transformOrigin: 'top center' }} />
              <div style={{ position: 'absolute', left: '8px', color: 'dodgerblue', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', transform: 'translateZ(185px)', transformOrigin: 'center center' }}>+Z</div>
              {/* −Z ray — into screen (faded) */}
              <div style={{ position: 'absolute', width: '2px', height: '180px', background: 'rgba(30,144,255,0.35)', transform: 'translate(-1px, 0) rotateX(-90deg)', transformOrigin: 'top center' }} />
              <div style={{ position: 'absolute', left: '8px', color: 'rgba(30,144,255,0.5)', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', transform: 'translateZ(-190px)', transformOrigin: 'center center' }}>−Z</div>

              {/* Origin dot */}
              <div style={{ position: 'absolute', width: '8px', height: '8px', borderRadius: '50%', background: 'white', transform: 'translate(-4px, -4px)', boxShadow: '0 0 6px rgba(255,255,255,0.8)' }} />
            </div>

            {/* ── Floor plane — lies flat in XZ, grid pattern ── */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '800px',
                height: '800px',
                transform: 'translate(-50%, -50%) rotateX(90deg)',
                transformOrigin: 'center center',
                background: 'rgba(255,255,255,0.08)',
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
                border: '2px solid rgba(255,255,255,0.25)',
                pointerEvents: 'none',
              }}
            >
              {/* Floor label */}
              <div style={{ position: 'absolute', bottom: '8px', right: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'monospace' }}>XZ floor</div>
            </div>

            {/* ── The board — lies on XZ floor at Y=0, top→−X, bottom→+X ── */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 'min(88vw, 1400px)',
                transform: 'rotateY(90deg) rotateX(90deg) translate(-50%, -50%)',
                transformOrigin: '0 0',
                transformStyle: 'preserve-3d',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                boxShadow: '0 5px 40px rgba(0,0,0,0.6)',
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
        className="overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 shadow-sm"
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
            tasks={tasks}
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
      </div>{/* distance wrapper */}
      </div>{/* orbit wrapper */}
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

function MilestoneLayer({ teamOrder, teams, tasks, milestones, taskDisplaySettings, teamPhasesMap, effectiveHeaderH, TEAMWIDTH, TASKWIDTH, DAYWIDTH }) {
  // Group milestones by task
  const milestonesByTask = useMemo(() => {
    const map = {};
    for (const m of Object.values(milestones)) {
      if (!map[m.task]) map[m.task] = [];
      map[m.task].push(m);
    }
    return map;
  }, [milestones]);

  // We need to calculate Y positions from the top of the canvas
  // for each team/task to position milestones absolutely
  const positioned = useMemo(() => {
    const result = [];
    let yOffset = effectiveHeaderH;

    for (const teamId of teamOrder) {
      const team = teams[teamId];
      if (!team) continue;

      // Drop highlight
      yOffset += TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2;
      // Header line
      yOffset += TEAM_HEADER_LINE_HEIGHT + TEAM_HEADER_GAP;

      const teamPhases = teamPhasesMap[teamId] || [];
      const phaseRowH = teamPhases.length > 0 ? TEAM_PHASE_ROW_HEIGHT : 0;

      // Phase row offset
      const tasksStartY = yOffset + phaseRowH;

      // Walk tasks
      const visibleTasks_ = getVisibleTasks(team, taskDisplaySettings);
      for (const taskId of visibleTasks_) {
        const th = getTaskHeight(taskId, taskDisplaySettings);
        const taskY = tasksStartY + getTaskYOffset(taskId, team, taskDisplaySettings);
        const taskMilestones = milestonesByTask[taskId] || [];
        for (const m of taskMilestones) {
          const x = TEAMWIDTH + TASKWIDTH + m.start_index * DAYWIDTH;
          const w = (m.duration || 1) * DAYWIDTH;
          result.push({
            ...m,
            x,
            y: taskY + 2,
            w,
            h: th - 4,
            teamColor: team.color || '#94a3b8',
          });
        }
      }

      // Advance yOffset past this entire team
      yOffset = tasksStartY - phaseRowH + getTeamRowHeight(team, taskDisplaySettings, phaseRowH);
    }

    return result;
  }, [teamOrder, teams, taskDisplaySettings, milestonesByTask, effectiveHeaderH, teamPhasesMap, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

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
