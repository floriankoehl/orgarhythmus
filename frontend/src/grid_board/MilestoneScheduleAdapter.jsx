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
import { playSound } from '../assets/sound_registry';

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

export default function MilestoneScheduleAdapter({ isFloating = false }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { buildClipboardText } = usePromptSettings();

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
  }, [projectId]);

  const persistNodeResize = useCallback(async (nodeId, durationChange) => {
    await change_duration(projectId, nodeId, durationChange);
  }, [projectId]);

  const persistNodeCreate = useCallback(async (rowId, opts = {}) => {
    // Accept generic field names, map to backend
    const { startColumn, ...rest } = opts;
    const apiData = { ...rest };
    if (startColumn != null) apiData.start_index = startColumn;
    const result = await add_milestone(projectId, rowId, apiData);
    // API returns { added_milestone: {...}, created: true } — extract the milestone
    const milestone = result?.added_milestone || result;
    if (milestone) return { ...milestone, row: milestone.task, startColumn: milestone.start_index };
    return milestone;
  }, [projectId]);

  const persistNodeDelete = useCallback(async (nodeId) => {
    await delete_milestone(projectId, nodeId);
  }, [projectId]);

  const persistNodeRename = useCallback(async (nodeId, newName) => {
    await rename_milestone(projectId, nodeId, newName);
  }, [projectId]);

  const persistNodeTaskChange = useCallback(async (nodeId, newRowId) => {
    await move_milestone_task(projectId, nodeId, newRowId);
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
  }, [projectId]);

  const persistLaneCreate = useCallback(async (data) => {
    const { name, color } = data;
    const result = await createTeamForProject(projectId, { name, color });
    return result;
  }, [projectId]);

  const persistRowOrder = useCallback(async (rowId, targetLaneId, order) => {
    await reorder_team_tasks(projectId, rowId, targetLaneId, order);
  }, [projectId]);

  const persistRowCreate = useCallback(async (data) => {
    const { name, lane_id } = data;
    const result = await createTaskForProject(projectId, { name, team_id: lane_id });
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
  }, [projectId]);

  const persistLaneColor = useCallback(async (laneId, color) => {
    await updateTeam(projectId, laneId, { color });
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
    return result;
  }, [projectId]);

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
    </DependencyGrid>
  );
}
