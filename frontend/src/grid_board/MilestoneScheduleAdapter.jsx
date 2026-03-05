// MilestoneScheduleAdapter — connects the generic <DependencyGrid />
// to the existing Django backend for the Milestone / Team / Task domain.
//
// Responsibilities:
//   1. Fetch data from the backend and transform to generic shapes.
//   2. Own React state for that data.
//   3. Provide persist callbacks & view/snapshot/safety APIs.
//   4. Domain-specific features: refactor drag to IdeaBin, header collapse,
//      bulk import, 3D-view easter egg.

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DependencyGrid from './DependencyGrid';
import usePromptSettings from '../components/usePromptSettings';
import { assemblePrompt } from '../components/shared/promptEngine/assembler';
import { DEP_SCENARIOS, DEP_GRID } from '../components/shared/promptEngine/scenarios/depScenarios';
import DependencyIOPopup from './DependencyIOPopup';
import { checkDepConflict, applyDepDetected } from '../components/shared/promptEngine/depResponseApplier';
import { buildDepChangeItems, recomposeDepDetected, DEP_CHANGE_TYPE_META } from '../components/shared/promptEngine/depChangeBuilder';
import ControlledApplyModal from '../components/shared/promptEngine/ControlledApplyPanel';
import { getDefaultViewState } from './viewDefaults';
import { playSound } from '../assets/sound_registry';
import { emitDataEvent, useManualRefresh } from '../api/dataEvents';

//  API imports — existing backend calls
import {
  fetch_project_details,
  fetch_project_teams,
  fetch_project_tasks,
  get_all_milestones,
  get_all_dependencies,
  get_project_days,
  get_all_phases,
  update_start_index,
  add_milestone,
  delete_milestone,
  change_duration,
  rename_milestone,
  move_milestone_task,
  create_dependency,
  delete_dependency_api,
  update_dependency,
  reorder_team_tasks,
  set_task_deadline,
  set_day_purpose,
  get_all_views,
  create_view,
  update_view,
  delete_view,
  set_default_view,
  list_snapshots,
  create_snapshot,
  restore_snapshot,
  delete_snapshot,
  rename_snapshot,
  create_phase,
  update_phase,
  delete_phase,
  get_user_shortcuts,
  save_user_shortcuts,
  bulk_import_dependencies,
} from '../api/dependencies_api';
import {
  updateTeam,
  createTeamForProject,
  createTaskForProject,
} from '../api/org_API.js';
import { daysBetween } from './layoutMath';

// ═══════════════════════════════════════════════════════════════════════════
//  MilestoneScheduleAdapter
// ═══════════════════════════════════════════════════════════════════════════

export default function MilestoneScheduleAdapter({ isFloating = false, windowPos, windowSize, setWindowPos, setWindowSize, isMaximized, setIsMaximized, viewBarRef, triggerViewBarRender }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { buildClipboardText, settings: promptSettings, projectDescRef } = usePromptSettings();
  const [ioPopupOpen, setIoPopupOpen] = useState(false);

  // ── Conflict resolve state ──
  // { sourceId, targetId, sourceName, targetName, changeItemId } or null
  const [resolveState, setResolveState] = useState(null);

  // ── Inline review state (slide-through dependencies on the grid) ──
  // { items: [...changeItems], currentIdx: number, sessionEdgeIds: Set, detected: [...], showInspect: boolean }
  const [reviewState, setReviewState] = useState(null);

  // ── Grid control ref — gives adapter access to DependencyGrid's view functions ──
  const gridControlRef = useRef(null);
  // ── View state saved before entering review mode (restored on end) ──
  const preReviewStateRef = useRef(null);

  // ── Secret shortcut: press 0 + 9 together → 3D view ──
  const heldRef = useRef(new Set());
  useEffect(() => {
    const down = (e) => {
      if (e.key === '0' || e.key === '9') heldRef.current.add(e.key);
      if (heldRef.current.has('0') && heldRef.current.has('9')) {
        navigate(`/projects/${projectId}/assignment`);
      }
    };
    const up = (e) => heldRef.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [projectId, navigate]);

  // ── Header collapse DOM effect (specific to this app shell, skipped when floating) ──
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  useEffect(() => {
    if (isFloating) return; // floating window has its own chrome
    const projectHeaderEl = document.querySelector('[data-project-header]');
    const orgaHeaderEl = document.querySelector('[data-orga-header]');
    const projectMainEl = projectHeaderEl?.closest('.min-h-screen')?.querySelector('main');
    const orgaMainEl = document.querySelector('[data-orga-main]');
    if (projectHeaderEl) {
      projectHeaderEl.style.transition = 'transform 0.3s ease';
      projectHeaderEl.style.transform = headerCollapsed ? 'translateY(-100%)' : '';
    }
    if (orgaHeaderEl) {
      orgaHeaderEl.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      orgaHeaderEl.style.transform = headerCollapsed ? 'translateY(-100%)' : '';
      orgaHeaderEl.style.opacity = headerCollapsed ? '0' : '';
      orgaHeaderEl.style.pointerEvents = headerCollapsed ? 'none' : '';
    }
    if (orgaMainEl) {
      orgaMainEl.style.transition = 'margin-top 0.3s ease';
      orgaMainEl.style.marginTop = headerCollapsed ? '0' : '';
    }
    if (projectMainEl) {
      projectMainEl.style.transition = 'margin-top 0.3s ease';
      projectMainEl.style.marginTop = headerCollapsed ? '0' : '';
    }
    return () => {
      if (projectHeaderEl) { projectHeaderEl.style.transform = ''; projectHeaderEl.style.transition = ''; }
      if (orgaHeaderEl) { orgaHeaderEl.style.transform = ''; orgaHeaderEl.style.transition = ''; orgaHeaderEl.style.opacity = ''; orgaHeaderEl.style.pointerEvents = ''; }
      if (orgaMainEl) { orgaMainEl.style.marginTop = ''; orgaMainEl.style.transition = ''; }
      if (projectMainEl) { projectMainEl.style.marginTop = ''; projectMainEl.style.transition = ''; }
    };
  }, [headerCollapsed, isFloating]);

  // ════════════════════════════════════════════════════════════════════
  //  Data state (adapter owns state, grid gets controlled props)
  // ════════════════════════════════════════════════════════════════════
  const [totalColumns, setTotalColumns]     = useState(0);
  const [projectStartDate, setProjectStartDate] = useState(null);
  const [projectDays, setProjectDays]       = useState({});
  const [phases, setPhases]                 = useState([]);
  const [nodes, setNodes]                   = useState({});   // milestones
  const [laneOrder, setLaneOrder]           = useState([]);   // team order
  const [lanes, setLanes]                   = useState({});   // teams
  const [rows, setRows]                     = useState({});   // tasks
  const [edges, setEdges]                   = useState([]);   // dependencies
  const [reloadFlag, setReloadFlag]         = useState(0);     // bump to reload

  // ── Load all data ──
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        // Project details → column count
        const resProjcet = await fetch_project_details(projectId);
        const project = resProjcet.project;
        const numDays = daysBetween(project.start_date, project.end_date);
        setTotalColumns(numDays);
        setProjectStartDate(new Date(project.start_date));

        // Teams → lanes
        const resTeams = await fetch_project_teams(projectId);
        const fetchedTeams = resTeams.teams;
        const newLaneOrder = [];
        const laneObj = {};
        for (const team of fetchedTeams) {
          newLaneOrder.push(team.id);
          laneObj[team.id] = { ...team, tasks: [], rows: [] };
        }

        // Tasks → rows
        const resTasks = await fetch_project_tasks(projectId);
        for (const lid in laneObj) {
          const taskIds = resTasks.taskOrder?.[String(lid)] || [];
          laneObj[lid].tasks = taskIds;
          laneObj[lid].rows = taskIds;
        }
        // Unassigned tasks
        const unassignedIds = resTasks.taskOrder?.["null"] || [];
        if (unassignedIds.length > 0) {
          const UID = "__unassigned__";
          laneObj[UID] = { id: UID, name: "Unassigned", color: "#94a3b8", tasks: unassignedIds, rows: unassignedIds, _virtual: true };
          newLaneOrder.push(UID);
        }

        setLaneOrder(newLaneOrder);
        setLanes(laneObj);
        // Add generic alias: lane ← team
        const rowsTransformed = {};
        for (const [id, task] of Object.entries(resTasks.tasks)) {
          rowsTransformed[id] = { ...task, lane: task.team };
        }
        setRows(rowsTransformed);

        // Milestones → nodes (add generic aliases: row ← task, startColumn ← start_index)
        const resMilestones = await get_all_milestones(projectId);
        const nodesObj = {};
        if (Array.isArray(resMilestones.milestones)) {
          for (const m of resMilestones.milestones) {
            nodesObj[m.id] = { ...m, row: m.task, startColumn: m.start_index, display: 'default' };
          }
        }
        setNodes(nodesObj);

        // Days
        try { const rd = await get_project_days(projectId); setProjectDays(rd.days || {}); } catch { setProjectDays({}); }

        // Phases (add generic alias: lane ← team)
        try {
          const rp = await get_all_phases(projectId);
          setPhases((rp.phases || []).map(p => ({ ...p, lane: p.team })));
        } catch { setPhases([]); }

        // Dependencies → edges
        try {
          const rd2 = await get_all_dependencies(projectId);
          if (Array.isArray(rd2.dependencies)) {
            setEdges(rd2.dependencies.map(d => ({ source: d.source, target: d.target, weight: d.weight || 'strong', reason: d.reason || null, description: d.description || null })));
          }
        } catch { setEdges([]); }
      } catch (err) {
        console.error('MilestoneScheduleAdapter: data load failed', err);
      }
    })();
  }, [projectId, reloadFlag]);

  // ── IdeaBin refresh listener ──
  useEffect(() => {
    const h = () => setReloadFlag(n => n + 1);
    window.addEventListener("ideabin-dep-refresh", h);
    return () => window.removeEventListener("ideabin-dep-refresh", h);
  }, []);

  // ── Targeted partial reloaders for cross-window sync ──
  // ── Cross-window sync: manual refresh reloads all data ──
  useManualRefresh(() => setReloadFlag(n => n + 1));

  // ════════════════════════════════════════════════════════════════════
  //  Column labels (computed from projectStartDate + projectDays)
  // ════════════════════════════════════════════════════════════════════
  const columnLabels = useMemo(() => {
    if (!projectStartDate || !totalColumns) return [];
    const labels = [];
    for (let i = 0; i < totalColumns; i++) {
      const date = new Date(projectStartDate);
      date.setDate(date.getDate() + i);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const dayOfWeek = date.getDay();
      const isSunday = dayOfWeek === 0;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const dayNameShort = dayNames[dayOfWeek];
      const dayData = projectDays[i] || {};
      labels.push({
        index: i,
        dateStr: `${day}.${month}`,
        dayNameShort: dayData.day_name_short || dayNameShort,
        isSunday: dayData.is_sunday ?? isSunday,
        isWeekend: dayData.is_weekend ?? isWeekend,
        purpose: dayData.purpose || null,
        purposeLanes: dayData.purpose_teams || null,
        isBlocked: dayData.is_blocked || false,
      });
    }
    return labels;
  }, [projectStartDate, totalColumns, projectDays]);

  // ════════════════════════════════════════════════════════════════════
  //  Persist callbacks — each maps generic → backend API
  // ════════════════════════════════════════════════════════════════════

  const persistNodeMove = useCallback(async (nodeId, newStartIndex) => {
    await update_start_index(projectId, nodeId, newStartIndex);
    emitDataEvent('milestones');
  }, [projectId]);

  const persistNodeResize = useCallback(async (nodeId, durationChange) => {
    await change_duration(projectId, nodeId, durationChange);
    emitDataEvent('milestones');
  }, [projectId]);

  const persistNodeCreate = useCallback(async (rowId, opts = {}) => {
    // Accept generic field names, map to backend
    const { startColumn, ...rest } = opts;
    const apiData = { ...rest };
    if (startColumn != null) apiData.start_index = startColumn;
    const result = await add_milestone(projectId, rowId, apiData);
    // API returns { added_milestone: {...}, created: true } — extract the milestone
    const milestone = result?.added_milestone || result;
    emitDataEvent('milestones');
    if (milestone) return { ...milestone, row: milestone.task, startColumn: milestone.start_index };
    return milestone;
  }, [projectId]);

  const persistNodeDelete = useCallback(async (nodeId) => {
    await delete_milestone(projectId, nodeId);
    emitDataEvent('milestones');
  }, [projectId]);

  const persistNodeRename = useCallback(async (nodeId, newName) => {
    await rename_milestone(projectId, nodeId, newName);
    emitDataEvent('milestones');
  }, [projectId]);

  const persistNodeTaskChange = useCallback(async (nodeId, newRowId) => {
    await move_milestone_task(projectId, nodeId, newRowId);
    emitDataEvent('milestones');
  }, [projectId]);

  const persistEdgeCreate = useCallback(async (sourceId, targetId, opts = {}) => {
    const result = await create_dependency(projectId, sourceId, targetId, opts);
    return result;
  }, [projectId]);

  const persistEdgeDelete = useCallback(async (sourceId, targetId) => {
    await delete_dependency_api(projectId, sourceId, targetId);
  }, [projectId]);

  const persistEdgeUpdate = useCallback(async (sourceId, targetId, updates) => {
    const result = await update_dependency(projectId, sourceId, targetId, updates);
    return result;
  }, [projectId]);

  const persistLaneOrder = useCallback(async (newOrder) => {
    const { safe_team_order } = await import('../api/dependencies_api');
    await safe_team_order(projectId, newOrder);
    emitDataEvent('teams');
  }, [projectId]);

  const persistLaneCreate = useCallback(async (data) => {
    const { name, color } = data;
    const result = await createTeamForProject(projectId, { name, color });
    emitDataEvent('teams');
    return result;
  }, [projectId]);

  const persistRowOrder = useCallback(async (rowId, targetLaneId, order) => {
    await reorder_team_tasks(projectId, rowId, targetLaneId, order);
    emitDataEvent('tasks');
  }, [projectId]);

  const persistRowCreate = useCallback(async (data) => {
    const { name, lane_id } = data;
    const result = await createTaskForProject(projectId, { name, team_id: lane_id });
    emitDataEvent('tasks');
    return result;
  }, [projectId]);

  const persistColumnPurpose = useCallback(async (colIndex, purpose, purposeLanes) => {
    const result = await set_day_purpose(projectId, colIndex, purpose, purposeLanes);
    if (result?.success && result.day) {
      setProjectDays(prev => ({ ...prev, [colIndex]: result.day }));
    }
    return result;
  }, [projectId]);

  const persistPhaseCreate = useCallback(async (data) => {
    const result = await create_phase(projectId, data);
    return result ? { ...result, lane: result.team } : result;
  }, [projectId]);

  const persistPhaseUpdate = useCallback(async (phaseId, updates) => {
    const result = await update_phase(projectId, phaseId, updates);
    return result ? { ...result, lane: result.team } : result;
  }, [projectId]);

  const persistPhaseDelete = useCallback(async (phaseId) => {
    await delete_phase(projectId, phaseId);
  }, [projectId]);

  const persistRowDeadline = useCallback(async (rowId, deadlineIndex) => {
    await set_task_deadline(projectId, rowId, deadlineIndex);
    emitDataEvent('tasks');
  }, [projectId]);

  const persistLaneColor = useCallback(async (laneId, color) => {
    await updateTeam(projectId, laneId, { color });
    emitDataEvent('teams');
  }, [projectId]);

  // ════════════════════════════════════════════════════════════════════
  //  View / Snapshot / Safety / Shortcuts API wrappers
  // ════════════════════════════════════════════════════════════════════

  const fetchViews = useCallback(() => get_all_views(projectId), [projectId]);
  const createViewApi = useCallback((data) => create_view(projectId, data), [projectId]);
  const updateViewApi = useCallback((viewId, updates) => update_view(projectId, viewId, updates), [projectId]);
  const deleteViewApi = useCallback((viewId) => delete_view(projectId, viewId), [projectId]);
  const setDefaultViewApi = useCallback((viewId) => set_default_view(projectId, viewId), [projectId]);

  const fetchSnapshots = useCallback(() => list_snapshots(projectId), [projectId]);
  const createSnapshotApi = useCallback((name, desc, viewState) => create_snapshot(projectId, { name, description: desc }), [projectId]);
  const restoreSnapshotApi = useCallback((snapId) => restore_snapshot(projectId, snapId), [projectId]);
  const deleteSnapshotApi = useCallback((snapId) => delete_snapshot(projectId, snapId), [projectId]);
  const renameSnapshotApi = useCallback((snapId, name) => rename_snapshot(projectId, snapId, { name }), [projectId]);

  const fetchSafetyCheckData = useCallback(async () => {
    const [resM, resD, resT, resP] = await Promise.all([
      get_all_milestones(projectId),
      get_all_dependencies(projectId),
      fetch_project_tasks(projectId),
      fetch_project_details(projectId),
    ]);
    // Map to generic field names for the safety check
    const milestones = resM.milestones || [];
    const tasks = resT.tasks || {};
    const rowsMapped = {};
    for (const [id, t] of Object.entries(tasks)) {
      rowsMapped[id] = { ...t, lane: t.team };
    }
    return {
      nodes: milestones.map(m => ({ ...m, row: m.task, startColumn: m.start_index })),
      edges: resD.dependencies || [],
      rows: rowsMapped,
      totalColumns: daysBetween(resP.project.start_date, resP.project.end_date),
    };
  }, [projectId]);

  // ── User shortcuts ──
  const [userShortcuts, setUserShortcuts] = useState({});
  useEffect(() => {
    get_user_shortcuts().then(d => setUserShortcuts(d.shortcuts || {})).catch(() => {});
  }, []);

  const handleSaveShortcuts = useCallback((shortcuts) => {
    setUserShortcuts(shortcuts);
    save_user_shortcuts(shortcuts).catch(() => {});
  }, []);

  // ── Bulk import ──
  const handleBulkImport = useCallback(async (jsonString) => {
    const result = await bulk_import_dependencies(projectId, jsonString);
    setReloadFlag(n => n + 1);
    emitDataEvent('tasks');
    emitDataEvent('teams');
    emitDataEvent('milestones');
    return result;
  }, [projectId]);

  // ════════════════════════════════════════════════════════════════════
  //  AI IO — context & apply context memos
  // ════════════════════════════════════════════════════════════════════

  /** Data context passed to scenario availability/payload builders */
  const ioCtx = useMemo(() => ({
    nodes, edges, rows, lanes, laneOrder, totalColumns,
    projectDescription: projectDescRef?.current || "",
  }), [nodes, edges, rows, lanes, laneOrder, totalColumns, projectDescRef]);

  /** API context for applying AI responses */
  const applyCtx = useMemo(() => ({
    addMilestone: async (taskId, opts) => {
      const result = await add_milestone(projectId, taskId, opts);
      emitDataEvent('milestones');
      return result?.added_milestone || result;
    },
    createDependency: async (sourceId, targetId, opts) => {
      const result = await create_dependency(projectId, sourceId, targetId, opts);
      return result;
    },
    updateMilestone: async (nodeId, updates) => {
      if (updates.name != null) await rename_milestone(projectId, nodeId, updates.name);
      if (updates.start_index != null) await update_start_index(projectId, nodeId, updates.start_index);
      if (updates.duration != null) await change_duration(projectId, nodeId, updates.duration);
      if (updates.task != null) await move_milestone_task(projectId, nodeId, updates.task);
      emitDataEvent('milestones');
    },
    updateDependency: async (sourceId, targetId, updates) => {
      const result = await update_dependency(projectId, sourceId, targetId, updates);
      return result;
    },
    deleteDependency: async (sourceId, targetId) => {
      await delete_dependency_api(projectId, sourceId, targetId);
    },
    moveMilestone: async (nodeId, newStartIndex) => {
      await update_start_index(projectId, nodeId, newStartIndex);
      emitDataEvent('milestones');
    },
    refreshAll: () => setReloadFlag(n => n + 1),
    nodes, edges, rows,
  }), [projectId, nodes, edges, rows]);

  // ── Conflict resolve handlers ──
  const handleResolveStart = useCallback((info) => {
    setResolveState(info);
  }, []);

  const handleResolveEnd = useCallback(() => {
    setResolveState(null);
  }, []);

  // ── Inline review handlers ──
  const handleReviewStart = useCallback((detected, changeItems) => {
    // Skip dependencies that already exist in the graph
    const filtered = changeItems.filter(item => {
      if (item.changeType === 'create_dependency' || item.changeType === 'conflict_dependency') {
        const d = item.detail;
        if (d?.sourceId && d?.targetId && edges.some(e => e.source === d.sourceId && e.target === d.targetId)) {
          return false;
        }
      }
      return true;
    });
    if (filtered.length === 0) return; // all proposals already exist

    // Save current view state before switching to default
    if (gridControlRef.current?.collectViewState) {
      preReviewStateRef.current = gridControlRef.current.collectViewState();
    }
    // Apply the "everything visible" default view
    if (gridControlRef.current?.applyViewState) {
      gridControlRef.current.applyViewState(getDefaultViewState());
    }

    setReviewState({
      items: filtered,
      currentIdx: 0,
      sessionEdgeIds: new Set(),
      detected,
      showInspect: false,
    });
    setIoPopupOpen(false);
  }, [edges]);

  const handleReviewAccept = useCallback(async () => {
    if (!reviewState) return;
    const current = reviewState.items[reviewState.currentIdx];
    if (!current) return;
    const d = current.detail;

    try {
      if (current.changeType === "create_dependency" || current.changeType === "conflict_dependency") {
        await create_dependency(projectId, d.sourceId, d.targetId, {
          weight: d.weight || "strong",
          reason: d.reason || null,
          description: null,
        });
        // Optimistic edge add
        setEdges(prev => [...prev, { source: d.sourceId, target: d.targetId, weight: d.weight || "strong", reason: d.reason || null, _session: true }]);
        setReviewState(prev => {
          const next = { ...prev, sessionEdgeIds: new Set([...prev.sessionEdgeIds, `${d.sourceId}-${d.targetId}`]) };
          // Auto-advance
          if (next.currentIdx < next.items.length - 1) next.currentIdx = next.currentIdx + 1;
          return next;
        });
      } else if (current.changeType === "update_dependency") {
        await update_dependency(projectId, d.sourceId, d.targetId, {
          weight: d.weight || undefined,
          reason: d.reason || undefined,
        });
        setEdges(prev => prev.map(e => (e.source === d.sourceId && e.target === d.targetId) ? { ...e, weight: d.weight, reason: d.reason, _session: true } : e));
        setReviewState(prev => ({
          ...prev,
          sessionEdgeIds: new Set([...prev.sessionEdgeIds, `${d.sourceId}-${d.targetId}`]),
          currentIdx: Math.min(prev.currentIdx + 1, prev.items.length - 1),
        }));
      } else if (current.changeType === "remove_dependency") {
        await delete_dependency_api(projectId, d.sourceId, d.targetId);
        setEdges(prev => prev.filter(e => !(e.source === d.sourceId && e.target === d.targetId)));
        setReviewState(prev => ({
          ...prev,
          currentIdx: Math.min(prev.currentIdx + 1, prev.items.length - 1),
        }));
      } else if (current.changeType === "move_milestone") {
        await update_start_index(projectId, d.milestoneId, d.newDay);
        setNodes(prev => ({ ...prev, [d.milestoneId]: { ...prev[d.milestoneId], startColumn: d.newDay, start_index: d.newDay } }));
        emitDataEvent('milestones');
        setReviewState(prev => ({
          ...prev,
          currentIdx: Math.min(prev.currentIdx + 1, prev.items.length - 1),
        }));
      }
      playSound('milestoneMove');
    } catch (err) {
      console.error("Review accept failed:", err);
    }
  }, [reviewState, projectId]);

  const handleReviewDecline = useCallback(() => {
    if (!reviewState) return;
    setReviewState(prev => ({
      ...prev,
      currentIdx: Math.min(prev.currentIdx + 1, prev.items.length - 1),
    }));
  }, [reviewState]);

  const handleReviewPrev = useCallback(() => {
    setReviewState(prev => prev && ({ ...prev, currentIdx: Math.max(prev.currentIdx - 1, 0) }));
  }, []);

  const handleReviewNext = useCallback(() => {
    setReviewState(prev => prev && ({ ...prev, currentIdx: Math.min(prev.currentIdx + 1, prev.items.length - 1) }));
  }, []);

  const handleReviewInspect = useCallback(() => {
    setReviewState(prev => prev && ({ ...prev, showInspect: !prev.showInspect }));
  }, []);

  const handleReviewEnd = useCallback(() => {
    // Restore pre-review view state
    if (preReviewStateRef.current && gridControlRef.current?.applyViewState) {
      gridControlRef.current.applyViewState(preReviewStateRef.current);
      preReviewStateRef.current = null;
    }
    setReviewState(null);
    setReloadFlag(n => n + 1);
  }, []);

  // Ghost edges for the grid — derived from resolveState OR reviewState
  const ghostEdges = useMemo(() => {
    // Resolve mode takes priority
    if (resolveState) {
      const src = nodes[resolveState.sourceId];
      const tgt = nodes[resolveState.targetId];
      const conflict = src && tgt ? checkDepConflict(src, tgt) : { conflict: true };
      return [{ source: resolveState.sourceId, target: resolveState.targetId, resolved: !conflict.conflict }];
    }
    // Review mode — show current item as ghost edge
    if (reviewState) {
      const current = reviewState.items[reviewState.currentIdx];
      if (!current?.detail) return [];
      const d = current.detail;
      const isEdgeType = ["create_dependency", "conflict_dependency", "update_dependency", "remove_dependency"].includes(current.changeType);
      if (isEdgeType && d.sourceId && d.targetId) {
        // Skip if this dependency was already accepted (exists in sessionEdgeIds)
        const key = `${d.sourceId}-${d.targetId}`;
        if (reviewState.sessionEdgeIds.has(key)) return [];
        const src = nodes[d.sourceId];
        const tgt = nodes[d.targetId];
        const conflict = src && tgt ? checkDepConflict(src, tgt) : { conflict: true };
        return [{
          source: d.sourceId,
          target: d.targetId,
          resolved: !conflict.conflict,
          isRemove: current.changeType === "remove_dependency",
        }];
      }
      return [];
    }
    return [];
  }, [resolveState, reviewState, nodes]);

  // Session edge IDs for visual distinction in the grid
  const sessionEdgeIds = useMemo(() => {
    return reviewState?.sessionEdgeIds || new Set();
  }, [reviewState]);

  // ── Focus mode: hide all rows/lanes not involved in the current review item ──
  useEffect(() => {
    if (!reviewState || !gridControlRef.current) return;
    const current = reviewState.items[reviewState.currentIdx];
    if (!current?.detail) return;
    const d = current.detail;

    const relevantRows = new Set();
    const relevantLanes = new Set();

    // Collect rows + lanes for source, target, or single milestone
    for (const mId of [d.sourceId, d.targetId, d.milestoneId].filter(Boolean)) {
      const node = nodes[mId];
      if (!node) continue;
      const rowKey = String(node.row);
      relevantRows.add(rowKey);
      const laneKey = rows[rowKey]?.lane != null ? String(rows[rowKey].lane) : null;
      if (laneKey) relevantLanes.add(laneKey);
    }

    if (relevantRows.size === 0) return; // nothing to focus on

    gridControlRef.current.setRowDisplaySettings(prev => {
      const next = {};
      for (const id of Object.keys(prev)) {
        next[id] = { ...prev[id], hidden: !relevantRows.has(id) };
      }
      return next;
    });
    gridControlRef.current.setLaneDisplaySettings(prev => {
      const next = {};
      for (const id of Object.keys(prev)) {
        next[id] = { ...prev[id], hidden: !relevantLanes.has(id) };
      }
      return next;
    });
  }, [reviewState?.currentIdx, reviewState?.items, nodes, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build function for inspect modal (uses current nodes/rows/lanes)
  const buildChangeItemsForInspect = useCallback((det) => {
    return buildDepChangeItems(det, nodes, rows, lanes);
  }, [nodes, rows, lanes]);

  // ── Navigation ──
  const handleLaneNavigate = useCallback((laneId) => {
    navigate(`/projects/${projectId}/teams/${laneId}`);
  }, [projectId, navigate]);

  const handleRowNavigate = useCallback((rowId) => {
    navigate(`/projects/${projectId}/tasks/${rowId}`);
  }, [projectId, navigate]);

  // ── Column labels setter (day purpose save updates projectDays state) ──
  const handleSetColumnLabels = useCallback((colIdx, fields) => {
    setProjectDays(prev => ({
      ...prev,
      [colIdx]: { ...(prev[colIdx] || {}), ...fields },
    }));
  }, []);

  // ════════════════════════════════════════════════════════════════════
  //  Refactor drag (domain-specific, IdeaBin integration)
  // ════════════════════════════════════════════════════════════════════
  const [refactorGhost, setRefactorGhost] = useState(null);
  const refactorDragging = useRef(false);

  const handleRefactorDrag = useCallback((e, type, payload) => {
    e.preventDefault();
    e.stopPropagation();
    refactorDragging.current = true;

    let ghost = { type, ...payload, x: e.clientX, y: e.clientY, overIdeaBin: false, overCell: null };
    setRefactorGhost(ghost);

    const onMove = (ev) => {
      const ideaBinEl = document.querySelector("[data-ideabin-window]");
      let overIdeaBin = false;
      if (ideaBinEl) {
        const r = ideaBinEl.getBoundingClientRect();
        overIdeaBin = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      }
      let overCell = null;
      if (!overIdeaBin && type === 'node') {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        if (el) {
          const cell = el.closest('[data-grid-col-index]');
          if (cell) {
            overCell = {
              columnIndex: parseInt(cell.dataset.gridColIndex, 10),
              rowId: cell.dataset.gridColRowId,
              laneId: cell.dataset.gridColLaneId,
            };
          }
        }
      }
      ghost = { ...ghost, x: ev.clientX, y: ev.clientY, overIdeaBin, overCell };
      setRefactorGhost(ghost);
    };

    const onUp = async () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      refactorDragging.current = false;

      if (ghost.overIdeaBin) {
        window.dispatchEvent(new CustomEvent("dep-refactor-drop", {
          detail: { type, ...payload },
        }));
        setRefactorGhost(null);
        return;
      }

      if (type === 'node' && ghost.overCell) {
        const { columnIndex, rowId: targetRowId } = ghost.overCell;
        const nId = payload.id;
        try {
          const oldRow = payload.rowId;
          const rowChanged = String(targetRowId) !== String(oldRow);
          if (rowChanged) {
            await move_milestone_task(projectId, nId, targetRowId);
          }
          await update_start_index(projectId, nId, columnIndex);
          // Optimistic update
          setNodes(prev => ({
            ...prev,
            [nId]: { ...prev[nId], row: targetRowId, startColumn: columnIndex },
          }));
          if (rowChanged) {
            setRows(prev => {
              const updated = { ...prev };
              if (updated[oldRow]) {
                updated[oldRow] = { ...updated[oldRow], milestones: (updated[oldRow].milestones || []).filter(ref => String(ref.id || ref) !== String(nId)) };
              }
              if (updated[targetRowId]) {
                updated[targetRowId] = { ...updated[targetRowId], milestones: [...(updated[targetRowId].milestones || []), { id: nId }] };
              }
              return updated;
            });
          }
          playSound('milestoneMove');
          emitDataEvent('milestones');
        } catch (err) {
          console.error("Refactor drag move failed:", err);
          playSound('error');
        }
      }

      setRefactorGhost(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [projectId, setNodes, setRows]);

  // ════════════════════════════════════════════════════════════════════
  //  Render
  // ════════════════════════════════════════════════════════════════════

  return (
    <DependencyGrid
      // Data
      totalColumns={totalColumns}
      columnLabels={columnLabels}
      lanes={lanes}
      laneOrder={laneOrder}
      rows={rows}
      nodes={nodes}
      edges={edges}
      phases={phases}
      projectStartDate={projectStartDate}

      // Data setters
      setLanes={setLanes}
      setLaneOrder={setLaneOrder}
      setRows={setRows}
      setNodes={setNodes}
      setEdges={setEdges}
      setPhases={setPhases}
      setColumnLabels={handleSetColumnLabels}
      onReloadData={() => setReloadFlag(n => n + 1)}

      // Persist callbacks
      persistNodeMove={persistNodeMove}
      persistNodeResize={persistNodeResize}
      persistNodeCreate={persistNodeCreate}
      persistNodeDelete={persistNodeDelete}
      persistNodeRename={persistNodeRename}
      persistNodeTaskChange={persistNodeTaskChange}
      persistEdgeCreate={persistEdgeCreate}
      persistEdgeDelete={persistEdgeDelete}
      persistEdgeUpdate={persistEdgeUpdate}
      persistLaneOrder={persistLaneOrder}
      persistLaneCreate={persistLaneCreate}
      persistRowOrder={persistRowOrder}
      persistRowCreate={persistRowCreate}
      persistColumnPurpose={persistColumnPurpose}
      persistPhaseCreate={persistPhaseCreate}
      persistPhaseUpdate={persistPhaseUpdate}
      persistPhaseDelete={persistPhaseDelete}
      persistRowDeadline={persistRowDeadline}
      persistLaneColor={persistLaneColor}

      // View / snapshot API
      fetchViews={fetchViews}
      createViewApi={createViewApi}
      updateViewApi={updateViewApi}
      deleteViewApi={deleteViewApi}
      setDefaultViewApi={setDefaultViewApi}
      fetchSnapshots={fetchSnapshots}
      createSnapshotApi={createSnapshotApi}
      restoreSnapshotApi={restoreSnapshotApi}
      deleteSnapshotApi={deleteSnapshotApi}
      renameSnapshotApi={renameSnapshotApi}

      // Safety check
      fetchSafetyCheckData={fetchSafetyCheckData}

      // User shortcuts
      userShortcuts={userShortcuts}
      onSaveShortcuts={handleSaveShortcuts}

      // Navigation
      onLaneNavigate={handleLaneNavigate}
      onRowNavigate={handleRowNavigate}

      // Header collapse (adapter owns the DOM effect)
      headerCollapsed={headerCollapsed}
      onSetHeaderCollapsed={setHeaderCollapsed}

      // Floating mode
      isFloating={isFloating}

      // Window state (for view persistence when floating)
      windowPos={windowPos}
      windowSize={windowSize}
      setWindowPos={setWindowPos}
      setWindowSize={setWindowSize}
      isMaximized={isMaximized}
      setIsMaximized={setIsMaximized}

      // Labels (domain-specific)
      laneLabel="Team"
      rowLabel="Task"
      nodeLabel="Milestone"
      edgeLabel="Dependency"
      columnLabel="Day"

      // Extra
      buildClipboardText={buildClipboardText}
      onBulkImport={handleBulkImport}
      handleRefactorDrag={handleRefactorDrag}

      // AI IO
      ioPopupOpen={ioPopupOpen}
      setIoPopupOpen={setIoPopupOpen}
      ioPopupContent={
        <DependencyIOPopup
          scenarios={DEP_SCENARIOS}
          grid={DEP_GRID}
          ctx={ioCtx}
          settings={promptSettings}
          assemblePrompt={assemblePrompt}
          applyCtx={applyCtx}
          onClose={() => { setIoPopupOpen(false); setResolveState(null); setReviewState(null); }}
          iconColor="#0ea5e9"
          onResolveStart={handleResolveStart}
          onResolveEnd={handleResolveEnd}
          resolveActive={!!resolveState}
          onReviewStart={handleReviewStart}
          reviewActive={!!reviewState}
        />
      }

      // View bar (floating title bar)
      viewBarRef={viewBarRef}
      triggerViewBarRender={triggerViewBarRender}

      // Grid control ref (adapter-level access to view functions)
      gridControlRef={gridControlRef}

      // Ghost edges for conflict resolution
      ghostEdges={ghostEdges}
      resolveState={resolveState}
      onResolveEnd={handleResolveEnd}
      sessionEdgeIds={sessionEdgeIds}
    >
      {/* Refactor mode ghost card */}
      {refactorGhost && (
        <div
          id="refactor-ghost"
          style={{ position: 'fixed', left: refactorGhost.x + 14, top: refactorGhost.y - 10, zIndex: 99999, pointerEvents: 'none', transition: 'background-color 0.15s, border-color 0.15s' }}
          className={`px-3 py-2 rounded-lg shadow-lg border-2 text-xs font-semibold max-w-[200px] truncate ${
            refactorGhost.overIdeaBin ? 'bg-yellow-100 border-yellow-500 text-yellow-800'
              : refactorGhost.overCell ? 'bg-blue-100 border-blue-500 text-blue-800'
              : 'bg-white border-slate-300 text-slate-700'
          }`}
        >
          {refactorGhost.overIdeaBin ? '\uD83D\uDCA1 ' : ''}
          {refactorGhost.type === 'lane' && `\uD83C\uDFE2 ${refactorGhost.name}`}
          {refactorGhost.type === 'row' && `\uD83D\uDCCB ${refactorGhost.name}`}
          {refactorGhost.type === 'node' && `\uD83C\uDFC1 ${refactorGhost.name}`}
          {refactorGhost.overIdeaBin && <div className="text-[10px] font-normal text-yellow-600 mt-0.5">Drop to create idea</div>}
          {refactorGhost.overCell && refactorGhost.type === 'node' && <div className="text-[10px] font-normal text-blue-600 mt-0.5">Drop to move here</div>}
        </div>
      )}

      {/* Refactor mode active banner */}
      {/* (This is rendered from the grid's refactorMode state, but the banner is domain UI.) */}

      {/* Conflict resolve banner */}
      {resolveState && (
        <ResolveBanner
          resolveState={resolveState}
          nodes={nodes}
          onResume={handleResolveEnd}
          onCancel={() => { setResolveState(null); }}
        />
      )}

      {/* Inline review bar */}
      {reviewState && !resolveState && (
        <ReviewBar
          reviewState={reviewState}
          nodes={nodes}
          rows={rows}
          onAccept={handleReviewAccept}
          onDecline={handleReviewDecline}
          onPrev={handleReviewPrev}
          onNext={handleReviewNext}
          onInspect={handleReviewInspect}
          onDone={handleReviewEnd}
        />
      )}

      {/* Inspect modal — detailed view during inline review */}
      {reviewState?.showInspect && reviewState.detected && (
        <ControlledApplyModal
          detected={reviewState.detected}
          applyCtx={applyCtx}
          onResult={() => {}}
          onClose={handleReviewInspect}
          buildChangeItemsFn={buildChangeItemsForInspect}
          recomposeDetectedFn={recomposeDepDetected}
          applyDetectedFn={applyDepDetected}
          changeTypeMeta={DEP_CHANGE_TYPE_META}
        />
      )}
    </DependencyGrid>
  );
}


// ═══════════════════════════════════════════════════════════
//  Resolve Banner — floating indicator during conflict resolve
// ═══════════════════════════════════════════════════════════
function ResolveBanner({ resolveState, nodes, onResume, onCancel }) {
  // Real-time conflict check from current node positions
  const sourceNode = nodes[resolveState.sourceId];
  const targetNode = nodes[resolveState.targetId];
  const conflict = sourceNode && targetNode
    ? checkDepConflict(sourceNode, targetNode)
    : { conflict: true };
  const isResolved = !conflict.conflict;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl border-2 bg-white/95 backdrop-blur-sm"
      style={{
        position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
        borderColor: isResolved ? '#22c55e' : '#f97316',
      }}
    >
      {/* Status indicator */}
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isResolved ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <div className="text-[11px] font-semibold text-gray-800">
          Resolving: "{resolveState.sourceName}" → "{resolveState.targetName}"
        </div>
        <div className={`text-[10px] font-medium ${isResolved ? 'text-green-600' : 'text-orange-600'}`}>
          {isResolved
            ? '✓ Conflict resolved — you can resume and accept'
            : `⚠ Conflict: predecessor ends day ${conflict.sourceEnd}, successor starts day ${conflict.targetStart}`
          }
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onResume}
        className={`text-[11px] px-3 py-1.5 rounded font-medium transition-colors flex-shrink-0 ${
          isResolved
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300'
        }`}
      >
        Resume
      </button>
      <button
        onClick={onCancel}
        className="text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        Cancel
      </button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  Review Bar — compact inline review bar for sliding through proposals
// ═══════════════════════════════════════════════════════════
function ReviewBar({ reviewState, nodes, rows, onAccept, onDecline, onPrev, onNext, onInspect, onDone }) {
  const { items, currentIdx, sessionEdgeIds } = reviewState;
  const current = items[currentIdx];
  const total = items.length;
  const isLast = currentIdx >= total - 1;
  const isFirst = currentIdx <= 0;

  // Check if current item was already accepted in this session
  const isAlreadyAccepted = current?.detail?.sourceId && current?.detail?.targetId
    ? sessionEdgeIds.has(`${current.detail.sourceId}-${current.detail.targetId}`)
    : false;

  // Live conflict check for dependency items
  const d = current?.detail;
  const hasDep = d?.sourceId && d?.targetId;
  const conflict = hasDep && nodes[d.sourceId] && nodes[d.targetId]
    ? checkDepConflict(nodes[d.sourceId], nodes[d.targetId])
    : null;
  const isConflict = conflict?.conflict;

  // Color scheme based on type
  const isRemove = current?.changeType === "remove_dependency";
  const borderColor = isAlreadyAccepted ? '#22c55e' : isConflict ? '#f97316' : '#3b82f6';

  // Scroll + highlight a milestone node on the grid
  const scrollToNode = useCallback((nodeId) => {
    const el = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!el) return;
    // Scroll the grid's scroll container to center the node horizontally
    const scrollContainer = el.closest('.dep-scroll');
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const currentScroll = scrollContainer.scrollLeft;
      const elCenterInContainer = (elRect.left + elRect.width / 2) - containerRect.left + currentScroll;
      scrollContainer.scrollTo({ left: elCenterInContainer - containerRect.width / 2, behavior: 'smooth' });
    }
    // Brief highlight pulse
    el.style.transition = 'box-shadow 0.2s ease, transform 0.2s ease';
    el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.6), 0 0 16px rgba(59,130,246,0.3)';
    el.style.transform = 'scale(1.08)';
    setTimeout(() => {
      el.style.boxShadow = '';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 300);
    }, 1200);
  }, []);

  // Build clickable label parts from detail
  const labelContent = useMemo(() => {
    if (!current?.detail) return <span>{current?.label || "—"}</span>;
    const ct = current.changeType;
    const dt = current.detail;
    if (["create_dependency", "conflict_dependency", "update_dependency", "remove_dependency"].includes(ct) && dt.sourceId && dt.targetId) {
      const prefix = ct === "remove_dependency" ? "Remove: " : ct === "update_dependency" ? "Update: " : ct.includes("conflict") ? "⚠️ " : "";
      return (
        <>
          {prefix}
          <button onClick={() => scrollToNode(dt.sourceId)} className="underline decoration-dotted underline-offset-2 hover:text-blue-600 cursor-pointer">{dt.sourceName}</button>
          {" → "}
          <button onClick={() => scrollToNode(dt.targetId)} className="underline decoration-dotted underline-offset-2 hover:text-blue-600 cursor-pointer">{dt.targetName}</button>
        </>
      );
    }
    if (ct === "move_milestone" && dt.milestoneId) {
      const name = nodes[dt.milestoneId]?.name || `#${dt.milestoneId}`;
      return (
        <>
          {"Move: "}
          <button onClick={() => scrollToNode(dt.milestoneId)} className="underline decoration-dotted underline-offset-2 hover:text-blue-600 cursor-pointer">{name}</button>
          {` → day ${dt.newDay}`}
        </>
      );
    }
    return <span>{current?.label || "—"}</span>;
  }, [current, nodes, scrollToNode]);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl shadow-2xl border-2 bg-white/95 backdrop-blur-sm"
      style={{
        position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
        borderColor,
        maxWidth: '90vw',
      }}
    >
      {/* Navigation */}
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>

      {/* Counter */}
      <span className="text-[10px] text-gray-400 font-mono min-w-[36px] text-center">
        {currentIdx + 1}/{total}
      </span>

      {/* Item info */}
      <div className="flex flex-col min-w-0">
        <div className="text-[11px] font-semibold text-gray-800 whitespace-nowrap">
          {labelContent}
        </div>
        {isConflict && !isAlreadyAccepted && (
          <div className="text-[9px] text-orange-600 font-medium">
            ⚠ Conflict: ends day {conflict.sourceEnd}, starts day {conflict.targetStart}
          </div>
        )}
        {isAlreadyAccepted && (
          <div className="text-[9px] text-green-600 font-medium">✓ Already accepted</div>
        )}
      </div>

      {/* Next */}
      <button
        onClick={onNext}
        disabled={isLast}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Inspect */}
      <button
        onClick={onInspect}
        className={`text-[10px] px-2 py-1 rounded border transition-colors flex-shrink-0 ${
          reviewState.showInspect
            ? 'bg-sky-100 border-sky-300 text-sky-700'
            : 'border-gray-300 text-gray-500 hover:bg-gray-100'
        }`}
        title="Show details"
      >
        Details
      </button>

      {/* Accept / Decline */}
      {!isAlreadyAccepted ? (
        <>
          <button
            onClick={onDecline}
            className="text-[10px] px-2.5 py-1.5 rounded font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className={`text-[10px] px-2.5 py-1.5 rounded font-medium transition-colors flex-shrink-0 ${
              isConflict
                ? 'border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isConflict ? 'Accept (conflict)' : 'Accept'}
          </button>
        </>
      ) : (
        <div className="text-[10px] px-2.5 py-1.5 rounded font-medium bg-green-50 border border-green-200 text-green-700 flex-shrink-0">
          ✓ Accepted
        </div>
      )}

      {/* Done */}
      <button
        onClick={onDone}
        className="text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        Done
      </button>
    </div>
  );
}
