import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { playSound } from "../../assets/sound_registry";
import { createTaskForProject } from "../../api/org_API";

import useFloatingWindow from "../shared/useFloatingWindow";
import useTaskData from "./hooks/useTaskData";
import useTaskTeams from "./hooks/useTaskTeams";
import useTaskDrag from "./hooks/useTaskDrag";
import useTaskViews from "./hooks/useTaskViews";

import TaskStructureTitleBar from "./TaskStructureTitleBar";
import TaskStructureToolbar from "./TaskStructureToolbar";
import TaskList from "./TaskList";
import TeamCanvas from "./TeamCanvas";
import TaskEditPanel from "./TaskEditPanel";
import TaskLegendPanel from "./TaskLegendPanel";
import TaskConfirmModal from "./TaskConfirmModal";
import TaskDragGhosts from "./TaskDragGhosts";
import TaskExportModal from "./TaskExportModal";
import TaskImportModal from "./TaskImportModal";

// ── Layout constants (mirror IdeaBin) ──
const MIN_SIDEBAR_W = 200;
const DEFAULT_SIDEBAR_W = 260;
const LAYOUT_BREAKPOINT = 520;

/**
 * TaskStructure — the main floating workspace for task structural management.
 *
 * Mounted at ProjectLayout level (per SRS §6.2), available across all project subpages.
 * Mirrors IdeaBin's floating-window UX: collapsed icon → expanded draggable/resizable window.
 *
 * Layout: Left sidebar (task list + legend panel) | Right canvas (team containers).
 */
export default function TaskStructure() {
  const { projectId } = useParams();

  // ── Floating window ──
  const {
    isOpen, windowPos, windowSize, iconPos,
    isMaximized, zIndex, bringToFront: bringWindowToFront, windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag,
    handleWindowResize, handleEdgeResize,
  } = useFloatingWindow({
    openSound: "ideaOpen",
    closeSound: "ideaClose",
    defaultIcon: { x: 8, y: 60 }, // offset below IdeaBin icon
    minSize: { w: 360, h: 280 },
  });

  // ── Data hooks ──
  // ── Selection state (declared early — referenced by hooks below) ──
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());

  const {
    tasks, setTasks, taskOrder, setTaskOrder,
    loading: tasksLoading,
    fetchTasks, createTask, updateTaskApi, deleteTask,
    assignTaskToTeam, reorderUnassigned, tasksByTeam,
    toggleCriterionApi,
  } = useTaskData({ projectId });

  // Keep a ref to tasks for cross-hook access (e.g. pipeline drag)
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const {
    teams, setTeams, teamOrder, setTeamOrder,
    teamPositions, setTeamPositions,
    loading: teamsLoading,
    fetchTeams, createTeam, createTeamAt, updateTeamApi, deleteTeam,
    setTeamPosition, bringToFront,
    handleTeamDrag, handleTeamResize,
  } = useTaskTeams({ projectId, selectedTeamIds, tasksRef });

  const {
    views, activeViewIdx, groupBy, setGroupBy,
    saveView, loadView, deleteView, renameView,
  } = useTaskViews({ projectId });

  // ── Refs ──
  const taskListRef = useRef(null);
  const teamCanvasRef = useRef(null);

  // ── Drag hook ──
  const {
    dragging, dragSource, hoverTeamId, hoverUnassigned,
    hoverIndex, prevIndex, handleTaskDrag,
  } = useTaskDrag({
    tasks, taskOrder, setTaskOrder,
    assignTaskToTeam,
    teams, teamPositions,
    windowRef, taskListRef, teamCanvasRef,
    selectedTaskIds,
  });

  // ── UI state ──
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_W);
  const [legendPanelCollapsed, setLegendPanelCollapsed] = useState(true);

  // ── Mode state (spectator = default, task = drag enabled) ──
  const [taskMode, setTaskMode] = useState(true);

  // ── Draw-to-create team mode ──
  const [drawTeamMode, setDrawTeamMode] = useState(false);

  // ── Collapsed teams (displayed as chips on canvas top) ──
  const [collapsedTeamIds, setCollapsedTeamIds] = useState(new Set());

  // ── Task creation mode (show form in sidebar) ──
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // ── Team editing state ──
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");

  // ── Import / Export modals ──
  const [exportModal, setExportModal] = useState(null);   // { json, title } or null
  const [importModal, setImportModal] = useState(null);   // { scope, targetTeamId?, targetTeamName? } or null

  // ── Task view mode: "titles" | "compact" | "full" ──
  const [viewMode, setViewMode] = useState("compact");
  // ── Per-team view overrides: { teamId: "titles"|"compact"|"full" } ──
  const [teamViewOverrides, setTeamViewOverrides] = useState({});

  // ── Keyboard: "t" toggles task mode, 1/2/3 changes view mode, Escape cancels draw mode ──
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      // Ignore if user is typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setTaskMode((prev) => !prev);
      }
      if (e.key === "1") { e.preventDefault(); setViewMode("titles"); }
      if (e.key === "2") { e.preventDefault(); setViewMode("compact"); }
      if (e.key === "3") { e.preventDefault(); setViewMode("full"); }
      if (e.key === "Escape") {
        if (drawTeamMode) {
          e.preventDefault();
          setDrawTeamMode(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, drawTeamMode, editingTaskId, isCreatingTask]);

  // ── Pipeline: idea → task (listen for drops from IdeaBin) ──
  useEffect(() => {
    const handler = async (e) => {
      const { ideaId, placementId, title, description } = e.detail || {};
      if (!title || !projectId) return;
      try {
        const task = await createTaskForProject(projectId, {
          name: title.split(/\s+/).slice(0, 6).join(" "),
          description: description || "",
        });
        const created = task?.task || task;
        if (created) {
          setTasks((prev) => ({ ...prev, [created.id]: created }));
          if (!created.team) setTaskOrder((prev) => [...prev, created.id]);
        }
        // Delete the source idea
        window.dispatchEvent(new CustomEvent("pipeline-delete-idea", { detail: { ideaId, placementId } }));
        playSound("ideaTransform");
      } catch (err) {
        console.error("Pipeline idea→task failed:", err);
      }
    };
    window.addEventListener("pipeline-idea-to-task", handler);
    return () => window.removeEventListener("pipeline-idea-to-task", handler);
  }, [projectId, setTasks, setTaskOrder]);

  // ── Pipeline: clean up task from local state when IdeaBin converts it ──
  useEffect(() => {
    const handler = (e) => {
      const { taskId } = e.detail || {};
      if (!taskId) return;
      setTasks((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setTaskOrder((prev) => prev.filter((id) => id !== taskId));
    };
    window.addEventListener("pipeline-delete-task", handler);
    return () => window.removeEventListener("pipeline-delete-task", handler);
  }, [setTasks, setTaskOrder]);

  // ── Pipeline: category → team ──
  useEffect(() => {
    const handler = async (e) => {
      const { categoryId, name, ideaIds } = e.detail || {};
      if (!name || !projectId) return;
      try {
        const team = await createTeam(name);
        if (team) {
          // create tasks from the category's ideas and assign them to the new team
          if (ideaIds?.length) {
            for (const ideaId of ideaIds) {
              try {
                const task = await createTaskForProject(projectId, {
                  name: `Task from idea ${ideaId}`,
                  team: team.id,
                });
                const created = task?.task || task;
                if (created) {
                  setTasks((prev) => ({ ...prev, [created.id]: created }));
                }
              } catch (_) { /* skip individual failures */ }
            }
          }
          // delete source category
          window.dispatchEvent(new CustomEvent("pipeline-delete-category", { detail: { categoryId } }));
          playSound("ideaTransform");
          fetchTasks();
        }
      } catch (err) {
        console.error("Pipeline category→team failed:", err);
      }
    };
    window.addEventListener("pipeline-category-to-team", handler);
    return () => window.removeEventListener("pipeline-category-to-team", handler);
  }, [projectId, createTeam, setTasks, fetchTasks]);

  // ── Pipeline: clean up team from local state when IdeaBin converts it ──
  useEffect(() => {
    const handler = (e) => {
      const { teamId } = e.detail || {};
      if (!teamId) return;
      deleteTeam(teamId);
    };
    window.addEventListener("pipeline-delete-team", handler);
    return () => window.removeEventListener("pipeline-delete-team", handler);
  }, [deleteTeam]);

  // ── Derived data ──
  const tasksByTeamMap = useMemo(() => tasksByTeam(), [tasksByTeam]);
  const editingTask = editingTaskId ? tasks[editingTaskId] : null;
  const isNarrow = windowSize.w < LAYOUT_BREAKPOINT;

  // ── Handlers ──
  const onCreateTask = useCallback(() => {
    setIsCreatingTask(true);
    setEditingTaskId(null);
  }, []);

  const handleCreateTaskFromForm = useCallback(async (payload) => {
    const task = await createTask(payload);
    if (task) setSelectedTaskIds(new Set([task.id]));
    return task;
  }, [createTask]);

  const handleCloseForm = useCallback(() => {
    setEditingTaskId(null);
    setIsCreatingTask(false);
  }, []);

  // ── Auto-assign: single selected team → new task gets assigned there ──
  const autoAssignTeamId = selectedTeamIds.size === 1 ? [...selectedTeamIds][0] : null;

  const handleCollapseTeam = useCallback((teamId) => {
    setCollapsedTeamIds((prev) => { const next = new Set(prev); next.add(teamId); return next; });
  }, []);

  const handleExpandTeam = useCallback((teamId) => {
    setCollapsedTeamIds((prev) => { const next = new Set(prev); next.delete(teamId); return next; });
  }, []);

  const onCreateTeam = useCallback(async (name, color) => {
    await createTeam(name, color);
    // Refetch tasks to update team assignments display
    fetchTasks();
  }, [createTeam, fetchTasks]);

  const onEditTask = useCallback((taskId) => {
    setEditingTaskId(taskId);
    setIsCreatingTask(false);
  }, []);

  const onDeleteTask = useCallback(async (taskId) => {
    await deleteTask(taskId);
    if (editingTaskId === taskId) setEditingTaskId(null);
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, [deleteTask, editingTaskId]);

  const onRenameTeam = useCallback(async (teamId, newName) => {
    await updateTeamApi(teamId, { name: newName });
  }, [updateTeamApi]);

  const onDeleteTeam = useCallback(async (teamId) => {
    await deleteTeam(teamId);
    // Refetch tasks — they become unassigned
    fetchTasks();
  }, [deleteTeam, fetchTasks]);

  const onUpdateTeamColor = useCallback(async (teamId, color) => {
    await updateTeamApi(teamId, { color });
  }, [updateTeamApi]);

  const onUpdateTask = useCallback(async (taskId, payload) => {
    await updateTaskApi(taskId, payload);
    // If team changed, refetch to update groupings
    if ("team_id" in payload) {
      fetchTasks();
    }
  }, [updateTaskApi, fetchTasks]);

  // ── Toggle acceptance criterion done state ──
  const onToggleCriterion = useCallback(async (taskId, criterionId) => {
    // Optimistic update
    setTasks((prev) => {
      const task = prev[taskId];
      if (!task) return prev;
      const criteria = (task.acceptance_criteria || []).map((c) =>
        c.id === criterionId ? { ...c, done: !c.done } : c
      );
      return { ...prev, [taskId]: { ...task, acceptance_criteria: criteria } };
    });
    await toggleCriterionApi(taskId, criterionId);
  }, [setTasks, toggleCriterionApi]);

  // ── Set per-team view override ──
  const setTeamViewOverride = useCallback((teamId, mode) => {
    setTeamViewOverrides((prev) => {
      if (!mode) {
        const next = { ...prev };
        delete next[teamId];
        return next;
      }
      return { ...prev, [teamId]: mode };
    });
  }, []);

  // ── Sidebar resize ──
  const handleSidebarResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (ev) => {
      setSidebarWidth(Math.max(MIN_SIDEBAR_W, Math.min(startW + (ev.clientX - startX), windowSize.w - 200)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth, windowSize.w]);

  // ── Build export JSON for a given scope ──
  const buildExportJson = useCallback((scope, teamIds) => {
    const taskToJson = (t) => {
      const obj = { name: t.name || "" };
      if (t.description) obj.description = t.description;
      if (t.priority) obj.priority = t.priority;
      if (t.difficulty) obj.difficulty = t.difficulty;
      if (t.acceptance_criteria && t.acceptance_criteria.length) {
        obj.acceptance_criteria = t.acceptance_criteria.map((c) => ({
          title: c.title,
          ...(c.description ? { description: c.description } : {}),
          done: !!c.done,
        }));
      }
      if (t.hard_deadline) obj.hard_deadline = t.hard_deadline;
      return obj;
    };

    const teamToJson = (tid) => {
      const team = teams[tid];
      if (!team) return null;
      const ids = tasksByTeamMap[tid] || [];
      return {
        name: team.name || "Unnamed",
        color: team.color || "#6366f1",
        tasks: ids.map((id) => tasks[id]).filter(Boolean).map(taskToJson),
      };
    };

    // Specific teams
    if (teamIds && teamIds.length > 0) {
      const teamsJson = teamIds.map(teamToJson).filter(Boolean);
      if (teamsJson.length === 1) return teamsJson[0];
      return { teams: teamsJson };
    }

    // Full project
    const teamsJson = teamOrder.map(teamToJson).filter(Boolean);
    const unassigned = taskOrder.map((id) => tasks[id]).filter(Boolean).map(taskToJson);
    return { teams: teamsJson, unassigned_tasks: unassigned };
  }, [tasks, teams, teamOrder, taskOrder, tasksByTeamMap]);

  // ── Export handlers ──
  const handleExportProject = useCallback(() => {
    setExportModal({ json: buildExportJson("project"), title: "Export Project Structure" });
  }, [buildExportJson]);

  const handleExportSelectedTeams = useCallback(() => {
    const ids = [...selectedTeamIds];
    if (ids.length === 0) return;
    const json = buildExportJson("teams", ids);
    const title = ids.length === 1 && teams[ids[0]]
      ? `Export Team — ${teams[ids[0]].name}`
      : `Export ${ids.length} Teams`;
    setExportModal({ json, title });
  }, [buildExportJson, selectedTeamIds, teams]);

  const handleExportSelectedTasks = useCallback(() => {
    const ids = [...selectedTaskIds];
    if (ids.length === 0) return;
    const taskToJson = (t) => {
      const obj = { name: t.name || "" };
      if (t.description) obj.description = t.description;
      if (t.priority) obj.priority = t.priority;
      if (t.difficulty) obj.difficulty = t.difficulty;
      if (t.acceptance_criteria && t.acceptance_criteria.length) {
        obj.acceptance_criteria = t.acceptance_criteria.map((c) => ({
          title: c.title,
          ...(c.description ? { description: c.description } : {}),
          done: !!c.done,
        }));
      }
      return obj;
    };
    const tasksJson = ids.map((id) => tasks[id]).filter(Boolean).map(taskToJson);
    setExportModal({ json: { tasks: tasksJson }, title: `Export ${ids.length} Task${ids.length > 1 ? "s" : ""}` });
  }, [selectedTaskIds, tasks]);

  // ── Import handlers ──
  const handleOpenImportProject = useCallback(() => {
    setImportModal({ scope: "project" });
  }, []);

  const handleOpenImportTeams = useCallback(() => {
    setImportModal({ scope: "teams" });
  }, []);

  const handleOpenInsertTasks = useCallback((teamId, teamName) => {
    setImportModal({ scope: "tasks", targetTeamId: teamId, targetTeamName: teamName });
  }, []);

  const handleImport = useCallback(async (data) => {
    // data = { teams: [...], unassigned_tasks: [...] }
    const importScope = importModal?.scope;
    const targetTeamId = importModal?.targetTeamId;

    // Helper: normalise acceptance_criteria to [{title, description?, done},...] array
    const normaliseCriteria = (criteria) => {
      if (!criteria || !Array.isArray(criteria)) return [];
      return criteria.map((c) =>
        typeof c === "string"
          ? { title: c, done: false }
          : { title: c.title || c.text || "", description: c.description || "", done: !!c.done }
      ).filter((c) => c.title);
    };

    // Create teams + their tasks
    for (const teamData of (data.teams || [])) {
      const created = await createTeam(teamData.name, teamData.color || "#6366f1");
      if (created) {
        for (const taskData of (teamData.tasks || [])) {
          const payload = {
            name: taskData.name || "Untitled",
            description: taskData.description || "",
            priority: taskData.priority || "",
            difficulty: taskData.difficulty || "",
            team_id: created.id,
            acceptance_criteria: normaliseCriteria(taskData.acceptance_criteria),
          };
          if (taskData.hard_deadline) payload.hard_deadline = taskData.hard_deadline;
          await createTask(payload);
        }
      }
    }

    // Create unassigned tasks (or tasks for a target team)
    for (const taskData of (data.unassigned_tasks || [])) {
      const payload = {
        name: taskData.name || "Untitled",
        description: taskData.description || "",
        priority: taskData.priority || "",
        difficulty: taskData.difficulty || "",
        team_id: importScope === "tasks" && targetTeamId ? targetTeamId : null,
        acceptance_criteria: normaliseCriteria(taskData.acceptance_criteria),
      };
      if (taskData.hard_deadline) payload.hard_deadline = taskData.hard_deadline;
      await createTask(payload);
    }

    // Refetch everything
    await fetchTasks();
    await fetchTeams();
    setImportModal(null);
  }, [importModal, createTeam, createTask, fetchTasks, fetchTeams]);

  // ═════════════════════════════════════════════
  //  JSX
  // ═════════════════════════════════════════════

  return (
    <>
      {/* ── COLLAPSED: Floating icon ── */}
      {!isOpen && (
        <div
          ref={iconRef}
          onMouseDown={handleIconDrag}
          style={{
            position: "fixed",
            left: iconPos.x,
            top: iconPos.y,
            zIndex: zIndex,
          }}
          className="w-12 h-12 rounded-full shadow-lg bg-gradient-to-br from-indigo-500 to-violet-600 border-2 border-indigo-300
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150"
          title="Open Task Structure"
        >
          <LayoutGrid size={22} className="text-white drop-shadow" />
        </div>
      )}

      {/* ── EXPANDED: Floating window ── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-taskstructure-window
          onMouseDown={bringWindowToFront}
          style={{
            position: "fixed",
            left: windowPos.x,
            top: windowPos.y,
            width: windowSize.w,
            height: windowSize.h,
            zIndex: zIndex,
          }}
          className="flex flex-col bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden select-none"
        >
          {/* ── Resize edges ── */}
          <div onMouseDown={(e) => handleEdgeResize(e, "top")} className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom")} className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "left")} className="absolute left-0 top-3 bottom-3 w-1.5 cursor-ew-resize z-10" />
          <div onMouseDown={(e) => handleEdgeResize(e, "right")} className="absolute right-0 top-3 bottom-3 w-1.5 cursor-ew-resize z-10" />
          {/* ── Resize corners ── */}
          <div onMouseDown={(e) => handleEdgeResize(e, "top-left")} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "top-right")} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom-left")} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-20" />
          <div onMouseDown={(e) => handleEdgeResize(e, "bottom-right")} className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-20" />

          {/* ── Title bar ── */}
          <TaskStructureTitleBar
            handleWindowDrag={handleWindowDrag}
            toggleMaximize={toggleMaximize}
            isMaximized={isMaximized}
            minimizeWindow={minimizeWindow}
            activeTeamColor="#6366f1"
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            teams={teams}
            views={views}
            activeViewIdx={activeViewIdx}
            loadView={loadView}
            saveView={saveView}
          />

          {/* ── Toolbar ── */}
          <TaskStructureToolbar
            onCreateTeam={onCreateTeam}
            groupBy={groupBy}
            views={views}
            saveView={saveView}
            onCreateTask={onCreateTask}
            taskCount={Object.keys(tasks).length}
            teamCount={teamOrder.length}
            taskMode={taskMode}
            setTaskMode={setTaskMode}
            drawTeamMode={drawTeamMode}
            setDrawTeamMode={setDrawTeamMode}
            onExportProject={handleExportProject}
            onImportProject={handleOpenImportProject}
            onImportTeams={handleOpenImportTeams}
            onExportSelectedTeams={handleExportSelectedTeams}
            onExportSelectedTasks={handleExportSelectedTasks}
            selectedTeamIds={selectedTeamIds}
            selectedTaskIds={selectedTaskIds}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          {/* ── Main content area ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left sidebar: Task form OR Task list + Legend */}
            <div className="flex flex-col" style={{ width: isNarrow ? "100%" : sidebarWidth }}>
              {/* Auto-assign team indicator */}
              {autoAssignTeamId && teams[autoAssignTeamId] && (
                <div
                  className="px-3 py-1 text-[10px] font-medium flex items-center gap-1.5 border-b flex-shrink-0"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${teams[autoAssignTeamId].color || "#6366f1"} 10%, white)`,
                    borderColor: `color-mix(in srgb, ${teams[autoAssignTeamId].color || "#6366f1"} 30%, white)`,
                    color: teams[autoAssignTeamId].color || "#6366f1",
                  }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teams[autoAssignTeamId].color || "#6366f1" }} />
                  <span className="truncate">Selected: {teams[autoAssignTeamId].name}</span>
                </div>
              )}
              {(editingTask || isCreatingTask) ? (
                <TaskEditPanel
                  task={editingTask}
                  isNew={isCreatingTask}
                  teams={teams}
                  teamOrder={teamOrder}
                  onUpdate={onUpdateTask}
                  onCreate={handleCreateTaskFromForm}
                  onClose={handleCloseForm}
                  milestones={[]}
                  defaultTeamId={autoAssignTeamId}
                />
              ) : (
                <>
                  <TaskList
                    tasks={tasks}
                    taskOrder={taskOrder}
                    teams={teams}
                    dragging={dragging}
                    dragSource={dragSource}
                    hoverIndex={hoverIndex}
                    prevIndex={prevIndex}
                    hoverUnassigned={hoverUnassigned}
                    handleTaskDrag={handleTaskDrag}
                    selectedTaskIds={selectedTaskIds}
                    setSelectedTaskIds={setSelectedTaskIds}
                    onEditTask={onEditTask}
                    onDeleteTask={onDeleteTask}
                    onCreateTask={onCreateTask}
                    setConfirmModal={setConfirmModal}
                    taskListRef={taskListRef}
                    sidebarWidth={isNarrow ? "100%" : sidebarWidth}
                    taskMode={taskMode}
                    viewMode={viewMode}
                    onToggleCriterion={onToggleCriterion}
                  />

                  {/* Legend panel */}
                  <TaskLegendPanel
                    collapsed={legendPanelCollapsed}
                    setCollapsed={setLegendPanelCollapsed}
                  />
                </>
              )}
            </div>

            {/* Sidebar resize handle */}
            {!isNarrow && (
              <div
                onMouseDown={handleSidebarResize}
                className="w-1 cursor-col-resize hover:bg-indigo-300 active:bg-indigo-400 transition-colors flex-shrink-0"
              />
            )}

            {/* Right canvas: Team containers */}
            {!isNarrow && (
              <TeamCanvas
                tasks={tasks}
                teams={teams}
                teamOrder={teamOrder}
                teamPositions={teamPositions}
                tasksByTeamMap={tasksByTeamMap}
                handleTeamDrag={handleTeamDrag}
                handleTeamResize={handleTeamResize}
                editingTeamId={editingTeamId}
                setEditingTeamId={setEditingTeamId}
                editingTeamName={editingTeamName}
                setEditingTeamName={setEditingTeamName}
                onRenameTeam={onRenameTeam}
                onDeleteTeam={onDeleteTeam}
                onUpdateTeamColor={onUpdateTeamColor}
                dragging={dragging}
                dragSource={dragSource}
                hoverIndex={hoverIndex}
                prevIndex={prevIndex}
                hoverTeamId={hoverTeamId}
                handleTaskDrag={handleTaskDrag}
                selectedTaskIds={selectedTaskIds}
                setSelectedTaskIds={setSelectedTaskIds}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                setConfirmModal={setConfirmModal}
                teamCanvasRef={teamCanvasRef}
                taskMode={taskMode}
                drawTeamMode={drawTeamMode}
                setDrawTeamMode={setDrawTeamMode}
                createTeamAt={createTeamAt}
                selectedTeamIds={selectedTeamIds}
                setSelectedTeamIds={setSelectedTeamIds}
                collapsedTeamIds={collapsedTeamIds}
                onCollapseTeam={handleCollapseTeam}
                onExpandTeam={handleExpandTeam}
                onInsertTasks={handleOpenInsertTasks}
                onExportTeam={(teamId) => {
                  const json = buildExportJson("teams", [teamId]);
                  const team = teams[teamId];
                  setExportModal({ json, title: `Export Team — ${team?.name || "Team"}` });
                }}
                viewMode={viewMode}
                teamViewOverrides={teamViewOverrides}
                setTeamViewOverride={setTeamViewOverride}
                onToggleCriterion={onToggleCriterion}
              />
            )}
          </div>

          {/* ── Confirm modal ── */}
          <TaskConfirmModal modal={confirmModal} />

          {/* ── Export modal ── */}
          {exportModal && (
            <TaskExportModal
              json={exportModal.json}
              title={exportModal.title}
              onClose={() => setExportModal(null)}
            />
          )}

          {/* ── Import modal ── */}
          {importModal && (
            <TaskImportModal
              scope={importModal.scope}
              targetTeamName={importModal.targetTeamName}
              onImport={handleImport}
              onClose={() => setImportModal(null)}
            />
          )}

          {/* ── Loading overlay ── */}
          {(tasksLoading || teamsLoading) && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-30 rounded-lg">
              <div className="text-[11px] text-gray-400 animate-pulse">Loading…</div>
            </div>
          )}
        </div>
      )}

      {/* ── Drag ghost ── */}
      <TaskDragGhosts dragging={dragging} />
    </>
  );
}
