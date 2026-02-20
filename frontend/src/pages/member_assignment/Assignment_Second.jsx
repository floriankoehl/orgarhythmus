// Assignment_Second.jsx — 3D Assignment view orchestrator
// ═══════════════════════════════════════════════════════════════════
//
// This is the orchestration layer that wires together:
//   - Data fetching (project, teams, tasks, milestones, phases)
//   - View management (useViewManagement)
//   - Camera controls (useCamera3D)
//   - Persona logic (usePersonas)
//   - Floor representation (useFloor3D) — for hit-testing and team/task height slabs
//   - Sub-components (ViewsPanel, ToolbarPlaceholder, DayGrid, MilestoneLayer)
//
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetch_project_details,
  fetch_project_teams,
  fetch_project_tasks,
  get_all_milestones,
  get_project_days,
  get_all_phases,
  get_all_dependencies,
} from '../../api/dependencies_api.js';
import { useViewManagement } from '../dependency/useViewManagement.js';
import { getDefaultViewState } from '../dependency/viewDefaults.js';
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
  getContrastTextColor,
  getVisibleTasks,
  isTaskVisible,
} from '../dependency/layoutMath.js';

// 3D engine module
import {
  PHASE_HEADER_HEIGHT,
  CAMERA_BASE_DISTANCE,
  CAMERA_DEFAULT_TILT,
  CAMERA_DEFAULT_YAW,
  CAMERA_DEFAULT_ZOOM,
  CAMERA_DEFAULT_SCALE,
  PERSPECTIVE_DEPTH,
  PERSONA_SIZE,
  PERSONA_DRAG_LIFT,
  MILESTONE_3D_HEIGHT,
  BOARD_3D_HEIGHT,
  TEAM_3D_HEIGHT,
  TASK_3D_HEIGHT,
  buildDayLabels,
  getTaskHeight,
  getTaskYOffset,
  getTeamRowHeight,
  calcContentHeight,
} from '../../engine3d/constants.js';
import { useCamera3D } from '../../engine3d/useCamera3D.js';
import { usePersonas } from '../../engine3d/usePersonas.js';
import { useFloor3D } from '../../engine3d/useFloor3D.js';
import { ViewsPanel, ToolbarPlaceholder, DayGrid, MilestoneLayer } from '../../engine3d/components.jsx';
import { buildConnectionGeometry } from '../../engine3d/connectionGeometry.js';

// ══════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════

export default function AssignmentSecond() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const boardRef = useRef(null);
  const viewportRef = useRef(null);

  // ── Data state ─────────────────────────────────────────────────
  const [days, setDays] = useState(null);
  const [projectStartDate, setProjectStartDate] = useState(null);
  const [projectDays, setProjectDays] = useState({});
  const [teamOrder, setTeamOrder] = useState([]);
  const [teams, setTeams] = useState({});
  const [tasks, setTasks] = useState({});
  const [milestones, setMilestones] = useState({});
  const [connections, setConnections] = useState([]);
  const [phases, setPhases] = useState([]);
  const [taskDisplaySettings, setTaskDisplaySettings] = useState({});
  const [teamDisplaySettings, setTeamDisplaySettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [cameraFlash, setCameraFlash] = useState(null);
  // Panel collapse state — each panel can be toggled open/closed independently
  const [openPanel, setOpenPanel] = useState(null); // null | 'debug' | 'camera' | 'views' | 'personas'
  const togglePanel = useCallback((name) => setOpenPanel((prev) => prev === name ? null : name), []);

  // ── Layout constants (view-driven, fall back to defaults) ──────
  const [customDayWidth, setCustomDayWidth] = useState(DEFAULT_DAYWIDTH);
  const [customTaskHeightNormal, setCustomTaskHeightNormal] = useState(DEFAULT_TASKHEIGHT_NORMAL);
  const [customTaskHeightSmall, setCustomTaskHeightSmall] = useState(DEFAULT_TASKHEIGHT_SMALL);
  const [customTeamColumnWidth, setCustomTeamColumnWidth] = useState(DEFAULT_TEAMWIDTH);
  const [customTaskColumnWidth, setCustomTaskColumnWidth] = useState(DEFAULT_TASKWIDTH);

  const TEAMWIDTH = customTeamColumnWidth;
  const TASKWIDTH = customTaskColumnWidth;
  const DAYWIDTH = customDayWidth;

  // ── Fetch data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const resProj = await fetch_project_details(projectId);
        const project = resProj.project;
        const numDays = daysBetween(project.start_date, project.end_date);
        setDays(numDays);
        setProjectStartDate(new Date(project.start_date));

        try {
          const resDays = await get_project_days(projectId);
          setProjectDays(resDays.days || {});
        } catch { setProjectDays({}); }

        const resTeams = await fetch_project_teams(projectId);
        const newTeamOrder = [];
        const teamObj = {};
        for (const t of resTeams.teams) {
          newTeamOrder.push(t.id);
          teamObj[t.id] = { ...t, tasks: [] };
        }

        const resTasks = await fetch_project_tasks(projectId);
        const initTaskDisplay = {};
        for (const tid in teamObj) {
          const taskIds = resTasks.taskOrder?.[String(tid)] || [];
          teamObj[tid].tasks = taskIds;
          for (const id of taskIds) {
            initTaskDisplay[id] = { size: 'normal', hidden: false };
          }
        }
        const unassigned = resTasks.taskOrder?.['null'] || [];
        if (unassigned.length > 0) {
          const UID = '__unassigned__';
          teamObj[UID] = { id: UID, name: 'Unassigned', color: '#94a3b8', tasks: unassigned, _virtual: true };
          newTeamOrder.push(UID);
          for (const id of unassigned) {
            initTaskDisplay[id] = { size: 'normal', hidden: false };
          }
        }

        const resMilestones = await get_all_milestones(projectId);
        const msObj = {};
        if (Array.isArray(resMilestones.milestones)) {
          for (const m of resMilestones.milestones) {
            msObj[m.id] = { ...m };
          }
        }

        try {
          const resPhases = await get_all_phases(projectId);
          setPhases(resPhases.phases || []);
        } catch { setPhases([]); }

        try {
          const resDeps = await get_all_dependencies(projectId);
          const fetched = resDeps.dependencies;
          if (Array.isArray(fetched)) {
            setConnections(fetched.map(d => ({ source: d.source, target: d.target, weight: d.weight || 'strong', reason: d.reason || null })));
          }
        } catch { setConnections([]); }

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

  // ── View management ────────────────────────────────────────────
  const restoreCameraRef = useRef(null);
  const applyViewState = useCallback((state) => {
    if (!state) return;
    const defaults = getDefaultViewState();
    const savedTask = state.taskDisplaySettings || {};
    setTaskDisplaySettings((prev) => {
      const merged = {};
      for (const id of Object.keys(prev)) {
        merged[id] = savedTask[id] || { size: 'normal', hidden: false };
      }
      for (const id of Object.keys(savedTask)) {
        if (!merged[id]) merged[id] = savedTask[id];
      }
      return merged;
    });
    setTeamDisplaySettings(state.teamDisplaySettings || {});
    setCustomDayWidth(state.customDayWidth ?? defaults.customDayWidth);
    setCustomTaskHeightNormal(state.customTaskHeightNormal ?? defaults.customTaskHeightNormal);
    setCustomTaskHeightSmall(state.customTaskHeightSmall ?? defaults.customTaskHeightSmall);
    setCustomTeamColumnWidth(state.teamColumnWidth ?? defaults.teamColumnWidth);
    setCustomTaskColumnWidth(state.taskColumnWidth ?? defaults.taskColumnWidth);
    if (state.camera && restoreCameraRef.current) {
      restoreCameraRef.current(state.camera);
    }
  }, []);

  const getCameraStateRef = useRef(null);
  const collectViewState = useCallback(() => {
    return {
      taskDisplaySettings,
      teamDisplaySettings,
      customDayWidth,
      customTaskHeightNormal,
      customTaskHeightSmall,
      teamColumnWidth: TEAMWIDTH,
      taskColumnWidth: TASKWIDTH,
      camera: getCameraStateRef.current ? getCameraStateRef.current() : null,
    };
  }, [taskDisplaySettings, teamDisplaySettings, customDayWidth, customTaskHeightNormal, customTaskHeightSmall, TEAMWIDTH, TASKWIDTH]);

  const {
    savedViews, activeViewId, activeViewName,
    viewTransition, viewFlashName,
    handleLoadView, handleNextView, handlePrevView,
    handleSaveView, handleCreateView, handleDeleteView, handleSetDefaultView,
  } = useViewManagement({ projectId, collectViewState, applyViewState });

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

  const taskDisplaySettings3D = useMemo(() => {
    const out = {};
    for (const id of Object.keys(taskDisplaySettings)) {
      const s = taskDisplaySettings[id];
      out[id] = { ...s, size: 'normal', hidden: s?.hidden || false };
    }
    return out;
  }, [taskDisplaySettings]);

  const contentHeight = useMemo(() => {
    if (!days) return 400;
    return calcContentHeight(teamOrder, teams, taskDisplaySettings3D, effectiveHeaderH, teamPhasesMap, teamDisplaySettings, DEFAULT_TASKHEIGHT_SMALL, DEFAULT_TASKHEIGHT_NORMAL);
  }, [teamOrder, teams, taskDisplaySettings3D, effectiveHeaderH, teamPhasesMap, days, teamDisplaySettings]);

  const boardW = totalWidth + 48;

  // ── Hide headers on mount ──────────────────────────────────────
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

  // ── Floor representation hook ──────────────────────────────────
  // Moved before usePersonas so floorLayout is available for slab snapping.
  // We need a pre-measurement of board dims for floor computation.
  const preFloorBoardDimsRef = useRef({ w: 1400, h: 600, offsetX: 0, offsetY: 0 });
  const [preFloorBoardDims, setPreFloorBoardDims] = useState(preFloorBoardDimsRef.current);
  useEffect(() => {
    if (boardRef.current && containerRef.current) {
      let top = 0, left = 0;
      let el = containerRef.current;
      while (el && el !== boardRef.current) { top += el.offsetTop; left += el.offsetLeft; el = el.offsetParent; }
      const dims = { w: boardRef.current.offsetWidth, h: boardRef.current.offsetHeight, offsetX: left, offsetY: top };
      preFloorBoardDimsRef.current = dims;
      setPreFloorBoardDims(dims);
    }
  }, [days, teamOrder, teams, taskDisplaySettings3D, teamPhasesMap, teamDisplaySettings, TEAMWIDTH, TASKWIDTH, DAYWIDTH]);

  const { floorLayout } = useFloor3D({
    teamOrder, teams,
    taskDisplaySettings: taskDisplaySettings3D,
    teamDisplaySettings, teamPhasesMap,
    effectiveHeaderH, TEAMWIDTH, TASKWIDTH, DAYWIDTH,
    days,
    thSmall: DEFAULT_TASKHEIGHT_SMALL,
    thNormal: DEFAULT_TASKHEIGHT_NORMAL,
    boardDims: preFloorBoardDims,
  });

  // ── Persona hook ───────────────────────────────────────────────
  const screenToFloorRef = useRef(null);

  const {
    personas, allPersonas, draggingId, boardDims, milestone3D,
    addPersona, removePersona,
    onPersonaDragMove, onPersonaDragEnd,
    draggingPersona, dragAnchor,
    assignPersonaToMilestone, findNearestMilestone,
  } = usePersonas({
    projectId, days, teamOrder, teams, milestones,
    taskDisplaySettings3D, teamDisplaySettings, teamPhasesMap,
    effectiveHeaderH, TEAMWIDTH, TASKWIDTH, DAYWIDTH,
    boardRef, containerRef,
    screenToFloor: (...args) => screenToFloorRef.current?.(...args),
    floorLayout,
  });

  // ── Camera hook ────────────────────────────────────────────────
  const {
    orbitX, orbitY, panX, panY, panZ, zoom, cameraScale,
    screenToFloor,
    getCameraState,
    restoreCamera,
  } = useCamera3D({
    viewportRef,
    draggingPersona,
    dragAnchor,
    onPersonaDragMove,
    onPersonaDragEnd,
    handleNextView,
    handlePrevView,
  });

  useEffect(() => { screenToFloorRef.current = screenToFloor; }, [screenToFloor]);

  // ── Ghost drag — "pick a persona from team/task slab → drop on milestone" ──
  // When a persona badge on a team/task slab is clicked, a floating copy tracks
  // the cursor. Releasing over a milestone saves that milestone assignment while
  // keeping the persona baked into the team/task.
  const [ghostDrag, setGhostDrag] = useState(null);
  const ghostDragRef = useRef(null);
  const findNearestMilestoneRef = useRef(findNearestMilestone);
  const assignPersonaToMilestoneRef = useRef(assignPersonaToMilestone);
  useEffect(() => { ghostDragRef.current = ghostDrag; }, [ghostDrag]);
  useEffect(() => {
    findNearestMilestoneRef.current = findNearestMilestone;
    assignPersonaToMilestoneRef.current = assignPersonaToMilestone;
  }, [findNearestMilestone, assignPersonaToMilestone]);

  const startGhostDrag = useCallback((personaId, color, name, e) => {
    e.stopPropagation();
    e.preventDefault();
    setGhostDrag({ personaId, color, name, clientX: e.clientX, clientY: e.clientY });
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!ghostDragRef.current) return;
      setGhostDrag((prev) => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null);
    };
    const onUp = (e) => {
      if (!ghostDragRef.current) return;
      const { personaId } = ghostDragRef.current;
      const floor = screenToFloorRef.current?.(e.clientX, e.clientY);
      if (floor) {
        const nearest = findNearestMilestoneRef.current?.(floor.x, floor.z);
        if (nearest) {
          assignPersonaToMilestoneRef.current?.(personaId, nearest.id);
        }
      }
      setGhostDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    getCameraStateRef.current = getCameraState;
    restoreCameraRef.current = restoreCamera;
  }, [getCameraState, restoreCamera]);

  // ── Restore camera on mount: saved state → defaults fallback ──
  const cameraRestoredRef = useRef(false);
  useEffect(() => {
    if (cameraRestoredRef.current || !projectId) return;
    cameraRestoredRef.current = true;
    const saved = localStorage.getItem(`orgarhythmus_camera_${projectId}`);
    if (saved) {
      try { restoreCamera(JSON.parse(saved)); } catch { /* fall through */ }
    }
    if (!saved) {
      restoreCamera({
        orbitX: CAMERA_DEFAULT_TILT,
        orbitY: CAMERA_DEFAULT_YAW,
        panX: 0, panY: 0, panZ: 0,
        zoom: CAMERA_DEFAULT_ZOOM,
        cameraScale: CAMERA_DEFAULT_SCALE,
      });
    }
  }, [projectId, restoreCamera]);

  // Auto-save camera to localStorage (debounced)
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`orgarhythmus_camera_${projectId}`, JSON.stringify({
        orbitX, orbitY, panX, panY, panZ, zoom, cameraScale,
      }));
    }, 600);
    return () => clearTimeout(timer);
  }, [projectId, orbitX, orbitY, panX, panY, panZ, zoom, cameraScale]);

  const handleSaveCamera = useCallback(() => {
    if (!projectId) return;
    const cam = getCameraState();
    localStorage.setItem(`orgarhythmus_camera_${projectId}`, JSON.stringify(cam));
  }, [projectId, getCameraState]);

  const handleResetCamera = useCallback(() => {
    restoreCamera({
      orbitX: CAMERA_DEFAULT_TILT,
      orbitY: CAMERA_DEFAULT_YAW,
      panX: 0, panY: 0, panZ: 0,
      zoom: CAMERA_DEFAULT_ZOOM,
      cameraScale: CAMERA_DEFAULT_SCALE,
    });
    if (projectId) {
      localStorage.removeItem(`orgarhythmus_camera_${projectId}`);
    }
  }, [projectId, restoreCamera]);

  // Floor dimensions (use boardDims from usePersonas)
  const floorW = boardDims.h || (contentHeight + 180);
  const floorH = boardW;

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
      {/* ── Collapsible toolbar — left side ── */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: '4px',
        fontFamily: 'monospace',
      }}>
        {/* Back button — always visible */}
        <button
          onClick={() => navigate(`/projects/${projectId}/dependencies`)}
          style={{
            background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ fontSize: '16px' }}>←</span> Back
        </button>

        {/* ── Camera panel toggle ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <button
            onClick={() => togglePanel('camera')}
            title="Camera controls (Home = reset)"
            style={{
              background: openPanel === 'camera' ? 'rgba(248,113,113,0.9)' : 'rgba(0,0,0,0.7)',
              color: '#fff', border: 'none', borderRadius: '8px',
              width: '36px', height: '36px', cursor: 'pointer',
              fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >🎥</button>
          {openPanel === 'camera' && (
            <div style={{
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              padding: '10px 14px', borderRadius: '10px', color: '#fff', fontSize: '12px',
              display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px',
            }}>
              <button
                onClick={() => { handleSaveCamera(); setCameraFlash('Saved!'); setTimeout(() => setCameraFlash(null), 1200); }}
                style={{
                  background: 'rgba(74,222,128,0.85)', color: '#000', border: 'none',
                  borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 'bold',
                }}
              >
                {cameraFlash || '📷 Save Camera'}
              </button>
              <button
                onClick={handleResetCamera}
                style={{
                  background: 'rgba(248,113,113,0.85)', color: '#000', border: 'none',
                  borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 'bold',
                }}
              >
                ↺ Reset View
              </button>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                Home key = reset
              </div>
            </div>
          )}
        </div>

        {/* ── Views panel toggle ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <button
            onClick={() => togglePanel('views')}
            title="Dependency views (X = cycle)"
            style={{
              background: openPanel === 'views' ? 'rgba(20,184,166,0.9)' : 'rgba(0,0,0,0.7)',
              color: '#fff', border: 'none', borderRadius: '8px',
              width: '36px', height: '36px', cursor: 'pointer',
              fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >👁</button>
          {openPanel === 'views' && (
            <ViewsPanel
              savedViews={savedViews}
              activeViewId={activeViewId}
              activeViewName={activeViewName}
              handleLoadView={handleLoadView}
              handleNextView={handleNextView}
              handlePrevView={handlePrevView}
              handleSaveView={handleSaveView}
              handleCreateView={handleCreateView}
              handleDeleteView={handleDeleteView}
              handleSetDefaultView={handleSetDefaultView}
              viewFlashName={viewFlashName}
            />
          )}
        </div>

        {/* ── Debug HUD toggle ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <button
            onClick={() => togglePanel('debug')}
            title="Debug info"
            style={{
              background: openPanel === 'debug' ? 'rgba(99,102,241,0.9)' : 'rgba(0,0,0,0.7)',
              color: '#fff', border: 'none', borderRadius: '8px',
              width: '36px', height: '36px', cursor: 'pointer',
              fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >⚙</button>
          {openPanel === 'debug' && (
            <div style={{
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              padding: '8px 12px', borderRadius: '10px',
              color: '#fff', fontSize: '12px', lineHeight: '1.6',
            }}>
              <div>orbitX: <span style={{ color: '#f87171' }}>{orbitX.toFixed(1)}°</span></div>
              <div>orbitY: <span style={{ color: '#4ade80' }}>{orbitY.toFixed(1)}°</span></div>
              <div>scale: <span style={{ color: '#60a5fa' }}>{cameraScale.toFixed(2)}x</span></div>
              <div>pan: <span style={{ color: '#fbbf24' }}>{panX.toFixed(0)}, {panY.toFixed(0)} | Z: {panZ.toFixed(0)}</span></div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
                Middle = orbit | Right = pan | Shift+Scroll = zoom
              </div>
              <div style={{ fontSize: '10px', color: '#c084fc' }}>
                board: {boardDims.w}×{boardDims.h}
              </div>
              <div style={{ fontSize: '10px', color: '#67e8f9' }}>
                floor: {floorW}×{floorH} | content: {totalWidth}×{contentHeight}
              </div>
            </div>
          )}
        </div>

        {/* ── Persona panel toggle ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <button
            onClick={() => togglePanel('personas')}
            title="Protopersonas"
            style={{
              background: openPanel === 'personas' ? 'rgba(168,85,247,0.9)' : 'rgba(0,0,0,0.7)',
              color: '#fff', border: 'none', borderRadius: '8px',
              width: '36px', height: '36px', cursor: 'pointer',
              fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >👤</button>
          {openPanel === 'personas' && (
            <div style={{
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              padding: '10px 14px', borderRadius: '10px', color: '#fff',
              fontSize: '12px', minWidth: '180px',
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
                  <span style={{ fontSize: '9px', color: p.milestoneIds?.length ? '#4ade80' : (p.taskIds?.length || p.teamIds?.length) ? '#60a5fa' : '#94a3b8' }}>
                    {p.milestoneIds?.length
                      ? (milestones[p.milestoneIds[0]]?.name || 'MS')
                      : p.taskIds?.length
                        ? (tasks[p.taskIds[0]]?.name || 'Task')
                        : p.teamIds?.length
                          ? (teams[p.teamIds[0]]?.name || 'Team')
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
          )}
        </div>
      </div>

      {/* ── Layer 2: Camera orbit ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transformStyle: 'preserve-3d',
          transform: [
            `translateX(${panX}px)`,
            `translateY(${panY}px)`,
            `rotateX(${-orbitX}deg)`,
            `rotateY(${-orbitY}deg)`,
          ].join(' '),
        }}
      >
        {/* ── Layer 3: Camera distance + scale ── */}
        <div
          style={{
            transformStyle: 'preserve-3d',
            transform: `translateZ(${zoom - CAMERA_BASE_DISTANCE + panZ}px) scale3d(${cameraScale}, ${cameraScale}, ${cameraScale})`,
            position: 'relative',
          }}
        >
            {/* ── 3D Axis Gizmo ── */}
            <div style={{ position: 'absolute', top: 0, left: 0, transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
              {/* X axis (red) */}
              <div style={{ position: 'absolute', width: '300px', height: '4px', background: 'linear-gradient(90deg, #ff3333, #ff3333 80%, transparent)', transform: 'translateY(-2px)', boxShadow: '0 0 8px rgba(255,50,50,0.6)' }} />
              <div style={{ position: 'absolute', left: '305px', top: '-14px', color: '#ff3333', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 10px rgba(255,50,50,0.8)' }}>+X</div>
              <div style={{ position: 'absolute', width: '300px', height: '3px', background: 'linear-gradient(270deg, rgba(255,80,80,0.5), transparent)', transform: 'translate(-300px, -1.5px)' }} />
              <div style={{ position: 'absolute', left: '-335px', top: '-12px', color: 'rgba(255,80,80,0.6)', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 6px rgba(255,50,50,0.4)' }}>−X</div>

              {/* Y axis (green) */}
              <div style={{ position: 'absolute', width: '4px', height: '300px', background: 'linear-gradient(0deg, #33ff33, #33ff33 80%, transparent)', transform: 'translate(-2px, -300px)', boxShadow: '0 0 8px rgba(50,255,50,0.6)' }} />
              <div style={{ position: 'absolute', left: '-12px', top: '-328px', color: '#33ff33', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 10px rgba(50,255,50,0.8)' }}>+Y</div>
              <div style={{ position: 'absolute', width: '3px', height: '300px', background: 'linear-gradient(180deg, rgba(50,255,50,0.5), transparent)', transform: 'translate(-1.5px, 0)' }} />
              <div style={{ position: 'absolute', left: '-12px', top: '305px', color: 'rgba(50,255,50,0.6)', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 6px rgba(50,255,50,0.4)' }}>−Y</div>

              {/* Z axis (blue) */}
              <div style={{ position: 'absolute', width: '4px', height: '300px', background: 'linear-gradient(0deg, #3399ff, #3399ff 80%, transparent)', transform: 'translate(-2px, 0) rotateX(90deg)', transformOrigin: 'top center', boxShadow: '0 0 8px rgba(50,150,255,0.6)' }} />
              <div style={{ position: 'absolute', left: '10px', color: '#3399ff', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 10px rgba(50,150,255,0.8)', transform: 'translateZ(305px)', transformOrigin: 'center center' }}>+Z</div>
              <div style={{ position: 'absolute', width: '3px', height: '300px', background: 'linear-gradient(180deg, rgba(30,144,255,0.5), transparent)', transform: 'translate(-1.5px, 0) rotateX(-90deg)', transformOrigin: 'top center' }} />
              <div style={{ position: 'absolute', left: '10px', color: 'rgba(30,144,255,0.6)', fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 0 6px rgba(50,150,255,0.4)', transform: 'translateZ(-310px)', transformOrigin: 'center center' }}>−Z</div>

              {/* Origin dot */}
              <div style={{ position: 'absolute', width: '12px', height: '12px', borderRadius: '50%', background: 'white', transform: 'translate(-6px, -6px)', boxShadow: '0 0 12px rgba(255,255,255,1), 0 0 4px rgba(255,255,255,0.9)' }} />
            </div>

            {/* ── Floor plane ── */}
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
              <div style={{ position: 'absolute', bottom: '8px', right: '8px', color: 'rgba(0,0,0,0.2)', fontSize: '12px', fontFamily: 'monospace' }}>XZ floor</div>

              {/* Floor side faces */}
              <div style={{ position: 'absolute', left: 0, top: `${floorH}px`, width: `${floorW}px`, height: `${BOARD_3D_HEIGHT}px`, transform: 'rotateX(-90deg)', transformOrigin: 'top left', background: 'linear-gradient(180deg, #e2e4e8, #d1d3d8)', borderBottom: '1px solid rgba(0,0,0,0.12)' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, width: `${floorW}px`, height: `${BOARD_3D_HEIGHT}px`, transform: 'rotateX(-90deg)', transformOrigin: 'top left', background: 'linear-gradient(180deg, #e8eaee, #dcdee3)', borderBottom: '1px solid rgba(0,0,0,0.1)' }} />
              <div style={{ position: 'absolute', left: `${floorW}px`, top: 0, width: `${BOARD_3D_HEIGHT}px`, height: `${floorH}px`, transform: 'rotateY(90deg)', transformOrigin: 'top left', background: 'linear-gradient(180deg, #dfe1e6, #cfd1d6)', borderRight: '1px solid rgba(0,0,0,0.12)' }} />
              <div style={{ position: 'absolute', left: 0, top: 0, width: `${BOARD_3D_HEIGHT}px`, height: `${floorH}px`, transform: 'rotateY(90deg)', transformOrigin: 'top left', background: 'linear-gradient(180deg, #e5e7ec, #d5d7dc)', borderRight: '1px solid rgba(0,0,0,0.1)' }} />
            </div>

            {/* ── Board (2D Gantt on XZ floor) ── */}
            <div
              ref={boardRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${boardW}px`,
                transform: [
                  'rotateY(90deg)',
                  'rotateX(90deg)',
                  'translate(-50%, -50%)',
                ].join(' '),
                transformOrigin: '0 0',
                transformStyle: 'preserve-3d',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 5px 40px rgba(0,0,0,0.6)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  padding: '24px 24px 0 24px',
                  background: 'linear-gradient(160deg, #f8f9fb 0%, #f6f7fa 50%, #f7f6f5 100%)',
                }}
              >
                <ToolbarPlaceholder
                  savedViews={savedViews}
                  activeViewId={activeViewId}
                  activeViewName={activeViewName}
                  handleLoadView={handleLoadView}
                  handleNextView={handleNextView}
                  handlePrevView={handlePrevView}
                  handleSaveView={handleSaveView}
                  handleCreateView={handleCreateView}
                  viewFlashName={viewFlashName}
                />
              </div>

          {/* ── Canvas ── */}
          <div
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              overflow: 'hidden',
              background: 'linear-gradient(160deg, #f8f9fb 0%, #f6f7fa 50%, #f7f6f5 100%)',
              padding: '0 24px 24px 24px',
            }}
          >
      <div
        data-board-scroll
        style={{ height: `${contentHeight + 16}px`, transform: 'scaleY(-1)', flex: '1 1 auto', minHeight: 0 }}
        className="overflow-x-hidden overflow-y-hidden border border-slate-200 shadow-sm"
        onWheel={(e) => {
          if (e.shiftKey && e.deltaY !== 0) {
            e.preventDefault();
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        <div
          ref={containerRef}
          style={{ width: `${totalWidth}px`, height: `${contentHeight}px`, transform: 'scaleY(-1)' }}
          className="relative"
        >
          {/* ── Header Row ── */}
          <div className="flex flex-col" style={{ height: `${effectiveHeaderH}px`, position: 'relative', zIndex: 50 }}>
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

            {showDayHeader && (
              <div className="flex" style={{ height: `${HEADER_HEIGHT}px`, position: 'relative', zIndex: 50 }}>
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

          {/* ── Team rows ── */}
          {teamOrder.map((teamId) => {
            const team = teams[teamId];
            if (!team) return null;
            if (teamDisplaySettings[teamId]?.hidden) return null;
            const isCollapsed = teamDisplaySettings[teamId]?.collapsed;
            const teamColor = team.color || '#94a3b8';
            const isVirtual = team._virtual;
            const visibleTasks_ = isCollapsed ? [] : getVisibleTasks(team, taskDisplaySettings3D);
            const teamPhases = teamPhasesMap[teamId] || [];
            const hasTeamPhases = !isCollapsed && teamPhases.length > 0;
            const phaseRowH = hasTeamPhases ? TEAM_PHASE_ROW_HEIGHT : 0;
            const teamRowH = getTeamRowHeight(team, taskDisplaySettings3D, phaseRowH, isCollapsed, DEFAULT_TASKHEIGHT_SMALL, DEFAULT_TASKHEIGHT_NORMAL);

            return (
              <div key={teamId}>
                <div className="flex">
                  <div style={{ width: `${TEAMWIDTH + TASKWIDTH}px`, height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2}px`, position: 'sticky', left: 0 }} />
                  <div style={{ flex: 1, height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2}px` }} />
                </div>

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

                <div className="flex">
                  <div
                    style={{
                      width: `${TEAMWIDTH + TASKWIDTH}px`,
                      position: 'sticky',
                      left: 0,
                      zIndex: 30,
                      display: 'flex',
                    }}
                  >
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
                      <div className="flex items-center justify-center" style={{ width: '18px', height: '18px', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill={teamColor} style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <span className={`text-sm font-medium truncate ml-1 ${isVirtual ? 'italic text-slate-400' : ''}`}>
                        {team.name}
                      </span>
                    </div>

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
                        const th = getTaskHeight(taskId, taskDisplaySettings3D, DEFAULT_TASKHEIGHT_SMALL, DEFAULT_TASKHEIGHT_NORMAL);
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

                  <DayGrid
                    team={team}
                    tasks={tasks}
                    days={days}
                    DAYWIDTH={DAYWIDTH}
                    taskDisplaySettings={taskDisplaySettings3D}
                    teamPhasesMap={teamPhasesMap}
                    phases={phases}
                    teamColor={teamColor}
                    totalDaysWidth={totalDaysWidth}
                    thSmall={DEFAULT_TASKHEIGHT_SMALL}
                    thNormal={DEFAULT_TASKHEIGHT_NORMAL}
                    isCollapsed={isCollapsed}
                  />
                </div>
              </div>
            );
          })}

          <div style={{ height: `${TEAM_DRAG_HIGHLIGHT_HEIGHT + MARIGN_BETWEEN_DRAG_HIGHLIGHT * 2}px` }} />

          <MilestoneLayer
            teamOrder={teamOrder}
            teams={teams}
            milestones={milestones}
            taskDisplaySettings={taskDisplaySettings3D}
            teamDisplaySettings={teamDisplaySettings}
            teamPhasesMap={teamPhasesMap}
            effectiveHeaderH={effectiveHeaderH}
            TEAMWIDTH={TEAMWIDTH}
            TASKWIDTH={TASKWIDTH}
            DAYWIDTH={DAYWIDTH}
            TASKHEIGHT_SMALL={DEFAULT_TASKHEIGHT_SMALL}
            TASKHEIGHT_NORMAL={DEFAULT_TASKHEIGHT_NORMAL}
          />
        </div>{/* inner container */}
      </div>{/* scroll container */}
      </div>{/* canvas wrapper */}
      </div>{/* board */}

            {/* ── Team height slabs ── */}
            {/* Extruded 3D boxes above the floor for each team row.
                Positioned using world-space coords from useFloor3D's floorLayout.
                Each slab has a top face and front/back side walls.
                This is a preparation feature — not interactive yet. */}
            {floorLayout.teams.map((teamSlab) => {
              const team = teamSlab.team;
              const teamColor = team?.color || '#94a3b8';
              const teamName = team?.name || '';
              const slabH = TEAM_3D_HEIGHT;
              // Use the team name column Z extent only — not the full board width
              const slabXLen = Math.abs(teamSlab.worldXEnd - teamSlab.worldXStart);
              const slabZLen = Math.abs(teamSlab.nameWorldZEnd - teamSlab.nameWorldZStart);
              const slabXCenter = (teamSlab.worldXStart + teamSlab.worldXEnd) / 2;
              const slabZCenter = (teamSlab.nameWorldZStart + teamSlab.nameWorldZEnd) / 2;
              const occupied = allPersonas.some((p) => p.teamIds?.includes(teamSlab.teamId));
              const borderColor = occupied ? 'rgba(74,222,128,1)' : teamColor;
              const topBg = occupied ? 'rgba(74,222,128,0.85)' : teamColor;
              const textColor = getContrastTextColor(occupied ? '#4ade80' : teamColor);
              const slabPersonas = allPersonas.filter((p) => p.teamIds?.includes(teamSlab.teamId));

              if (slabXLen < 1 || slabZLen < 1) return null;

              return (
                <div
                  key={`team-slab-${teamSlab.teamId}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${slabZLen}px`,
                    height: `${slabXLen}px`,
                    transform: [
                      `translateX(${slabXCenter}px)`,
                      `translateZ(${slabZCenter}px)`,
                      `translateY(-${slabH}px)`,
                      'rotateX(-90deg)',
                      'rotateZ(-90deg)',
                      `translate(-${slabZLen / 2}px, -${slabXLen / 2}px)`,
                    ].join(' '),
                    transformOrigin: '0 0',
                    transformStyle: 'preserve-3d',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Top face */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: `${slabZLen}px`, height: `${slabXLen}px`,
                    background: topBg,
                    border: `2px solid ${borderColor}`,
                    borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    pointerEvents: slabPersonas.length > 0 ? 'auto' : 'none',
                  }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, color: textColor,
                      fontFamily: 'sans-serif', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: '100%', padding: '0 4px',
                      transform: 'scaleX(-1)',
                    }}>{teamName}</span>
                    {/* Ghost persona badges — click to assign to a milestone */}
                    {slabPersonas.map((gp, gi) => (
                      <div
                        key={gp.id}
                        title={`${gp.name} — drag to milestone`}
                        onMouseDown={(e) => startGhostDrag(gp.id, gp.color, gp.name, e)}
                        style={{
                          position: 'absolute',
                          right: `${4 + gi * 16}px`,
                          top: '50%',
                          transform: 'translateY(-50%) scaleX(-1)',
                          width: '12px', height: '12px', borderRadius: '50%',
                          background: gp.color,
                          border: '1.5px solid rgba(255,255,255,0.9)',
                          cursor: 'grab',
                          pointerEvents: 'auto',
                          boxShadow: '0 0 4px rgba(0,0,0,0.4)',
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                  {/* Front wall */}
                  <div style={{
                    position: 'absolute', left: 0, top: `${slabXLen}px`,
                    width: `${slabZLen}px`, height: `${slabH}px`,
                    transform: 'rotateX(90deg)', transformOrigin: 'top left',
                    background: `color-mix(in srgb, ${borderColor} 85%, #000)`,
                  }} />
                  {/* Back wall */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0,
                    width: `${slabZLen}px`, height: `${slabH}px`,
                    transform: 'rotateX(90deg)', transformOrigin: 'top left',
                    background: `color-mix(in srgb, ${borderColor} 75%, #000)`,
                  }} />
                  {/* Left wall */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0,
                    width: `${slabH}px`, height: `${slabXLen}px`,
                    transform: 'rotateY(-90deg)', transformOrigin: 'top left',
                    background: `color-mix(in srgb, ${borderColor} 80%, #000)`,
                  }} />
                  {/* Right wall */}
                  <div style={{
                    position: 'absolute', left: `${slabZLen}px`, top: 0,
                    width: `${slabH}px`, height: `${slabXLen}px`,
                    transform: 'rotateY(-90deg)', transformOrigin: 'top left',
                    background: `color-mix(in srgb, ${borderColor} 70%, #000)`,
                  }} />
                </div>
              );
            })}

            {/* ── Task height slabs ── */}
            {/* Extruded 3D boxes for each task row — thinner than team slabs. */}
            {floorLayout.teams.flatMap((teamSlab) =>
              teamSlab.tasks.map((taskSlab) => {
                const team = teamSlab.team;
                const teamColor = team?.color || '#94a3b8';
                const taskObj = tasks[taskSlab.taskId];
                const taskName = taskObj?.name || '';
                const slabH = TASK_3D_HEIGHT;
                // Use the task name column Z extent only — not the full board width
                const slabXLen = Math.abs(taskSlab.worldXEnd - taskSlab.worldXStart);
                const slabZLen = Math.abs(taskSlab.nameWorldZEnd - taskSlab.nameWorldZStart);
                const slabXCenter = (taskSlab.worldXStart + taskSlab.worldXEnd) / 2;
                const slabZCenter = (taskSlab.nameWorldZStart + taskSlab.nameWorldZEnd) / 2;
                const bgColor = lightenColor(teamColor, 0.35);
                const occupied = allPersonas.some((p) => p.taskIds?.includes(taskSlab.taskId));
                const borderColor = occupied ? 'rgba(74,222,128,1)' : teamColor;
                const topBg = occupied ? 'rgba(74,222,128,0.85)' : bgColor;
                const textColor = getContrastTextColor(occupied ? '#4ade80' : bgColor);
                const slabTaskPersonas = allPersonas.filter((p) => p.taskIds?.includes(taskSlab.taskId));

                if (slabXLen < 1 || slabZLen < 1) return null;

                return (
                  <div
                    key={`task-slab-${taskSlab.taskId}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${slabZLen}px`,
                      height: `${slabXLen}px`,
                      transform: [
                        `translateX(${slabXCenter}px)`,
                        `translateZ(${slabZCenter}px)`,
                        `translateY(-${slabH}px)`,
                        'rotateX(-90deg)',
                        'rotateZ(-90deg)',
                        `translate(-${slabZLen / 2}px, -${slabXLen / 2}px)`,
                      ].join(' '),
                      transformOrigin: '0 0',
                      transformStyle: 'preserve-3d',
                      pointerEvents: 'none',
                    }}
                  >
                    {/* Top face */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0,
                      width: `${slabZLen}px`, height: `${slabXLen}px`,
                      background: topBg,
                      border: `2px solid ${borderColor}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                      pointerEvents: slabTaskPersonas.length > 0 ? 'auto' : 'none',
                    }}>
                      <span style={{
                        fontSize: '8px', fontWeight: 600, color: textColor,
                        fontFamily: 'sans-serif', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        maxWidth: '100%', padding: '0 3px',
                        transform: 'scaleX(-1)',
                      }}>{taskName}</span>
                      {/* Ghost persona badges — click to assign to a milestone */}
                      {slabTaskPersonas.map((gp, gi) => (
                        <div
                          key={gp.id}
                          title={`${gp.name} — drag to milestone`}
                          onMouseDown={(e) => startGhostDrag(gp.id, gp.color, gp.name, e)}
                          style={{
                            position: 'absolute',
                            right: `${2 + gi * 12}px`,
                            top: '50%',
                            transform: 'translateY(-50%) scaleX(-1)',
                            width: '9px', height: '9px', borderRadius: '50%',
                            background: gp.color,
                            border: '1px solid rgba(255,255,255,0.9)',
                            cursor: 'grab',
                            pointerEvents: 'auto',
                            boxShadow: '0 0 3px rgba(0,0,0,0.4)',
                            flexShrink: 0,
                          }}
                        />
                      ))}
                    </div>
                    {/* Front wall */}
                    <div style={{
                      position: 'absolute', left: 0, top: `${slabXLen}px`,
                      width: `${slabZLen}px`, height: `${slabH}px`,
                      transform: 'rotateX(90deg)', transformOrigin: 'top left',
                      background: `color-mix(in srgb, ${borderColor} 80%, #000)`,
                    }} />
                    {/* Back wall */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0,
                      width: `${slabZLen}px`, height: `${slabH}px`,
                      transform: 'rotateX(90deg)', transformOrigin: 'top left',
                      background: `color-mix(in srgb, ${borderColor} 70%, #000)`,
                    }} />
                    {/* Left wall */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0,
                      width: `${slabH}px`, height: `${slabXLen}px`,
                      transform: 'rotateY(-90deg)', transformOrigin: 'top left',
                      background: `color-mix(in srgb, ${borderColor} 75%, #000)`,
                    }} />
                    {/* Right wall */}
                    <div style={{
                      position: 'absolute', left: `${slabZLen}px`, top: 0,
                      width: `${slabH}px`, height: `${slabXLen}px`,
                      transform: 'rotateY(-90deg)', transformOrigin: 'top left',
                      background: `color-mix(in srgb, ${borderColor} 65%, #000)`,
                    }} />
                  </div>
                );
              })
            )}

            {/* ── Milestone pedestals ── */}
            {milestone3D.map((m) => {
              const occupied = personas.some((p) => p.milestoneIds?.includes(m.id));
              const slotW = Math.max((m.duration || 1) * DAYWIDTH, PERSONA_SIZE + 10);
              const slotH = PERSONA_SIZE + 10;
              const depth = MILESTONE_3D_HEIGHT;
              const baseColor = m.color || m.teamColor || '#facc15';
              const borderColor = occupied ? 'rgba(74,222,128,1)' : baseColor;
              const topBg = occupied ? 'rgba(74,222,128,0.85)' : baseColor;
              const sideA = `linear-gradient(180deg, color-mix(in srgb, ${baseColor} 90%, #000), color-mix(in srgb, ${baseColor} 70%, #000))`;
              const sideB = `linear-gradient(180deg, color-mix(in srgb, ${baseColor} 80%, #000), color-mix(in srgb, ${baseColor} 60%, #000))`;
              const sideC = `linear-gradient(180deg, color-mix(in srgb, ${baseColor} 85%, #000), color-mix(in srgb, ${baseColor} 65%, #000))`;
              const sideD = `linear-gradient(180deg, color-mix(in srgb, ${baseColor} 75%, #000), color-mix(in srgb, ${baseColor} 55%, #000))`;
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
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: `${slotW}px`, height: `${slotH}px`,
                    border: `2px solid ${borderColor}`, borderRadius: '4px',
                    background: topBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: '8px', color: getContrastTextColor(baseColor),
                      fontFamily: 'monospace', whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: '100%', padding: '0 2px',
                      textShadow: 'none',
                      display: 'inline-block',
                      transform: 'scaleX(-1)',
                    }}>
                      {m.name}
                    </span>
                  </div>
                  <div style={{ position: 'absolute', left: 0, top: `${slotH}px`, width: `${slotW}px`, height: `${depth}px`, transform: 'rotateX(90deg)', transformOrigin: 'top left', background: sideA, borderLeft: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, width: `${slotW}px`, height: `${depth}px`, transform: 'rotateX(90deg)', transformOrigin: 'top left', background: sideB, borderLeft: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }} />
                  <div style={{ position: 'absolute', left: `${slotW}px`, top: 0, width: `${depth}px`, height: `${slotH}px`, transform: 'rotateY(-90deg)', transformOrigin: 'top left', background: sideC, borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}` }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, width: `${depth}px`, height: `${slotH}px`, transform: 'rotateY(-90deg)', transformOrigin: 'top left', background: sideD, borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}` }} />
                </div>
              );
            })}





            {/* ── Milestone dependency bezier curves (3D ribbon planks) ── */}
            {connections.map((conn, ci) => {
              const srcMs = milestone3D.find((m) => m.id === conn.source);
              const tgtMs = milestone3D.find((m) => m.id === conn.target);
              if (!srcMs || !tgtMs) return null;

              const { segments, lastPt, arrowAngle, arrowSize, ribbonW, beamH, liftY, weightColor, weightColorDark } =
                buildConnectionGeometry(conn, srcMs, tgtMs);

              return (
                <div key={`dep-${ci}`} style={{ position: 'absolute', top: 0, left: 0, transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
                  {segments.map(({ pt, segAngle, sw }, si) => (
                    <div
                      key={si}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: `${sw}px`,
                        height: `${ribbonW}px`,
                        transform: [
                          `translateX(${pt.x}px)`,
                          `translateZ(${pt.z}px)`,
                          `translateY(-${liftY + beamH}px)`,
                          'rotateX(-90deg)',
                          `rotateZ(${-segAngle}deg)`,
                          `translate(0px, -${ribbonW / 2}px)`,
                        ].join(' '),
                        transformOrigin: '0 0',
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      <div style={{ position: 'absolute', left: 0, top: 0, width: `${sw}px`, height: `${ribbonW}px`, background: weightColor }} />
                      <div style={{ position: 'absolute', left: 0, top: `${ribbonW}px`, width: `${sw}px`, height: `${beamH}px`, background: weightColorDark, transform: 'rotateX(90deg)', transformOrigin: 'top left' }} />
                      <div style={{ position: 'absolute', left: 0, top: 0, width: `${sw}px`, height: `${beamH}px`, background: `linear-gradient(180deg, ${weightColor}, ${weightColorDark})`, transform: 'rotateX(90deg)', transformOrigin: 'top left' }} />
                    </div>
                  ))}
                  <div style={{
                    position: 'absolute',
                    width: 0, height: 0,
                    borderLeft: `${arrowSize}px solid ${weightColor}`,
                    borderTop: `${arrowSize / 2}px solid transparent`,
                    borderBottom: `${arrowSize / 2}px solid transparent`,
                    transform: [
                      `translateX(${lastPt.x}px)`,
                      `translateZ(${lastPt.z}px)`,
                      `translateY(-${liftY + beamH / 2}px)`,
                      'rotateX(-90deg)',
                      `rotateZ(${-arrowAngle}deg)`,
                      `translateX(-${arrowSize}px)`,
                      `translateY(-${arrowSize / 2}px)`,
                    ].join(' '),
                    transformOrigin: '0 50%',
                    filter: `drop-shadow(0 0 4px ${weightColor})`,
                  }} />
                </div>
              );
            })}

            {/* ── Protopersona figures (blocky box style) ── */}
            {/* Personas that are on a team/task but NOT on a milestone are shown
                as ghost badges on the slabs above — skip full 3D figure for them. */}
            {personas.map((p) => {
              const isSlabOnly = (p.teamIds?.length || p.taskIds?.length) && !p.milestoneIds?.length;
              if (isSlabOnly) return null;
              const S = PERSONA_SIZE;
              const isBeingDragged = p.id === draggingId;
              const headW = S * 0.44, headH = S * 0.40, headD = S * 0.40;
              const bodyW = S * 0.50, bodyH = S * 0.44, bodyD = S * 0.30;
              const legW  = bodyW * 0.40, legH = S * 0.34, legD = bodyD * 0.85;
              const legGap = bodyW * 0.08;
              const totalH = headH + bodyH + legH;
              // Lift persona above whatever it's standing on (or hovering over)
              let standOnH = 0;
              if (isBeingDragged) {
                // While dragging, dynamically detect what's underneath and float above it
                // Check milestones first
                let overMs = false;
                for (const m of milestone3D) {
                  const dx = Math.max(0, Math.abs(m.worldX - p.x) - (m.halfX || 0));
                  const dz = Math.max(0, Math.abs(m.worldZ - p.z) - (m.halfZ || 0));
                  if (dx < 1 && dz < 1) { standOnH = MILESTONE_3D_HEIGHT; overMs = true; break; }
                }
                if (!overMs) {
                  // Check team/task slabs (with padding matching snap tolerance)
                  const PAD = 15;
                  let foundSlab = false;
                  // Task slabs first (more specific)
                  for (const ts of floorLayout.teams) {
                    const inX = p.x >= Math.min(ts.worldXStart, ts.worldXEnd) - PAD && p.x <= Math.max(ts.worldXStart, ts.worldXEnd) + PAD;
                    if (!inX) continue;
                    for (const tk of ts.tasks) {
                      const tInX = p.x >= Math.min(tk.worldXStart, tk.worldXEnd) - PAD && p.x <= Math.max(tk.worldXStart, tk.worldXEnd) + PAD;
                      if (!tInX) continue;
                      const tInZ = p.z >= Math.min(tk.nameWorldZStart, tk.nameWorldZEnd) - PAD && p.z <= Math.max(tk.nameWorldZStart, tk.nameWorldZEnd) + PAD;
                      if (tInZ) { standOnH = TASK_3D_HEIGHT; foundSlab = true; break; }
                    }
                    if (foundSlab) break;
                  }
                  if (!foundSlab) {
                    // Team slabs
                    for (const ts of floorLayout.teams) {
                      const inX = p.x >= Math.min(ts.worldXStart, ts.worldXEnd) - PAD && p.x <= Math.max(ts.worldXStart, ts.worldXEnd) + PAD;
                      if (!inX) continue;
                      const inZ = p.z >= Math.min(ts.nameWorldZStart, ts.nameWorldZEnd) - PAD && p.z <= Math.max(ts.nameWorldZStart, ts.nameWorldZEnd) + PAD;
                      if (inZ) { standOnH = TEAM_3D_HEIGHT; foundSlab = true; break; }
                    }
                  }
                }
                standOnH += PERSONA_DRAG_LIFT;
              } else {
                if (p.milestoneIds?.length > 0) standOnH = MILESTONE_3D_HEIGHT;
                else if (p.taskIds?.length > 0) standOnH = TASK_3D_HEIGHT;
                else if (p.teamIds?.length > 0) standOnH = TEAM_3D_HEIGHT;
              }
              const renderZ = p.z;
              const baseY = totalH + standOnH;
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
                    transform: [
                      `translateX(${p.x - S / 2}px)`,
                      `translateZ(${renderZ + S / 2}px)`,
                      `translateY(-${baseY}px)`,
                    ].join(' '),
                    transition: isBeingDragged ? 'none' : 'transform 0.25s ease-out',
                    transformStyle: 'preserve-3d',
                    cursor: isBeingDragged ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    zIndex: 50,
                    pointerEvents: 'auto',
                  }}
                >
                  {/* ── Head ── */}
                  <div style={{ position: 'absolute', left: `${(S - headW) / 2}px`, top: '0px', width: `${headW}px`, height: `${headH}px`, transformStyle: 'preserve-3d' }}>
                    <div style={{ position: 'absolute', width: `${headW}px`, height: `${headH}px`, background: '#fcd9b6', transform: `translateZ(${headD / 2}px)` }}>
                      <div style={{ position: 'absolute', top: `${headH * 0.38}px`, left: `${headW * 0.22}px`, width: '3px', height: '3px', background: '#2d2d2d' }} />
                      <div style={{ position: 'absolute', top: `${headH * 0.38}px`, right: `${headW * 0.22}px`, width: '3px', height: '3px', background: '#2d2d2d' }} />
                      <div style={{ position: 'absolute', top: `${headH * 0.62}px`, left: '50%', width: '5px', height: '2px', background: '#c17c5e', transform: 'translateX(-50%)' }} />
                    </div>
                    <div style={{ position: 'absolute', width: `${headW}px`, height: `${headH}px`, background: '#d4a67a', transform: `rotateY(180deg) translateZ(${headD / 2}px)` }} />
                    <div style={{ position: 'absolute', width: `${headD}px`, height: `${headH}px`, background: '#ecc9a0', transform: `rotateY(-90deg) translateZ(0px)` }} />
                    <div style={{ position: 'absolute', width: `${headD}px`, height: `${headH}px`, background: '#ecc9a0', transform: `rotateY(90deg) translateZ(${headW}px)` }} />
                    <div style={{ position: 'absolute', width: `${headW}px`, height: `${headD}px`, background: '#5c3d2e', transform: 'rotateX(90deg) translateZ(0px)' }} />
                    <div style={{ position: 'absolute', width: `${headW}px`, height: `${headD}px`, background: '#e8c09a', transform: `rotateX(-90deg) translateZ(${headH}px)` }} />
                  </div>

                  {/* ── Torso ── */}
                  <div style={{ position: 'absolute', left: `${(S - bodyW) / 2}px`, top: `${headH}px`, width: `${bodyW}px`, height: `${bodyH}px`, transformStyle: 'preserve-3d' }}>
                    <div style={{ position: 'absolute', width: `${bodyW}px`, height: `${bodyH}px`, background: p.color, transform: `translateZ(${bodyD / 2}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fff', fontFamily: 'sans-serif', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{p.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div style={{ position: 'absolute', width: `${bodyW}px`, height: `${bodyH}px`, background: p.color, filter: 'brightness(0.75)', transform: `rotateY(180deg) translateZ(${bodyD / 2}px)` }} />
                    <div style={{ position: 'absolute', width: `${bodyD}px`, height: `${bodyH}px`, background: p.color, filter: 'brightness(0.82)', transform: 'rotateY(-90deg) translateZ(0px)' }} />
                    <div style={{ position: 'absolute', width: `${bodyD}px`, height: `${bodyH}px`, background: p.color, filter: 'brightness(0.82)', transform: `rotateY(90deg) translateZ(${bodyW}px)` }} />
                    <div style={{ position: 'absolute', width: `${bodyW}px`, height: `${bodyD}px`, background: p.color, filter: 'brightness(1.08)', transform: 'rotateX(90deg) translateZ(0px)' }} />
                    <div style={{ position: 'absolute', width: `${bodyW}px`, height: `${bodyD}px`, background: p.color, filter: 'brightness(0.68)', transform: `rotateX(-90deg) translateZ(${bodyH}px)` }} />
                  </div>

                  {/* ── Left leg ── */}
                  <div style={{ position: 'absolute', left: `${(S - bodyW) / 2 + legGap}px`, top: `${headH + bodyH}px`, width: `${legW}px`, height: `${legH}px`, transformStyle: 'preserve-3d' }}>
                    <div style={{ position: 'absolute', width: `${legW}px`, height: `${legH}px`, background: '#3b4861', transform: `translateZ(${legD / 2}px)` }} />
                    <div style={{ position: 'absolute', width: `${legW}px`, height: `${legH}px`, background: '#2d3a4e', transform: `rotateY(180deg) translateZ(${legD / 2}px)` }} />
                    <div style={{ position: 'absolute', width: `${legD}px`, height: `${legH}px`, background: '#344054', transform: 'rotateY(-90deg) translateZ(0px)' }} />
                    <div style={{ position: 'absolute', width: `${legD}px`, height: `${legH}px`, background: '#344054', transform: `rotateY(90deg) translateZ(${legW}px)` }} />
                  </div>

                  {/* ── Right leg ── */}
                  <div style={{ position: 'absolute', left: `${(S - bodyW) / 2 + bodyW - legGap - legW}px`, top: `${headH + bodyH}px`, width: `${legW}px`, height: `${legH}px`, transformStyle: 'preserve-3d' }}>
                    <div style={{ position: 'absolute', width: `${legW}px`, height: `${legH}px`, background: '#3b4861', transform: `translateZ(${legD / 2}px)` }} />
                    <div style={{ position: 'absolute', width: `${legW}px`, height: `${legH}px`, background: '#2d3a4e', transform: `rotateY(180deg) translateZ(${legD / 2}px)` }} />
                    <div style={{ position: 'absolute', width: `${legD}px`, height: `${legH}px`, background: '#344054', transform: 'rotateY(-90deg) translateZ(0px)' }} />
                    <div style={{ position: 'absolute', width: `${legD}px`, height: `${legH}px`, background: '#344054', transform: `rotateY(90deg) translateZ(${legW}px)` }} />
                  </div>

                  {/* ── Name label ── */}
                  <div style={{
                    position: 'absolute', top: '-14px', left: '50%',
                    transform: 'translateX(-50%)',
                    color: '#fff', fontSize: '9px', fontFamily: 'sans-serif',
                    fontWeight: 700, whiteSpace: 'nowrap',
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                    pointerEvents: 'none',
                  }}>
                    {p.name}
                  </div>
                </div>
              );
            })}

      </div>{/* distance wrapper */}
      </div>{/* orbit wrapper */}

      {/* ── Ghost drag floating indicator ─────────────────────────── */}
      {/* Appears when user clicks a persona badge on a team/task slab.
          Follows the cursor until released over a milestone. */}
      {ghostDrag && (
        <div
          style={{
            position: 'fixed',
            left: ghostDrag.clientX - 18,
            top: ghostDrag.clientY - 18,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: ghostDrag.color,
            border: '3px solid rgba(255,255,255,0.95)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            pointerEvents: 'none',
            zIndex: 9999,
            cursor: 'grabbing',
            userSelect: 'none',
          }}
        >
          {ghostDrag.name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
