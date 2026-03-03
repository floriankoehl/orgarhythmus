import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { LayoutGrid, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { playSound } from "../../assets/sound_registry";
import { createTaskForProject, bulk_delete_tasks } from "../../api/org_API";

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
import usePromptSettings from "../usePromptSettings";
import TeamsTabContent from "./TeamsTabContent";
import TasksTabContent from "./TasksTabContent";
import TaskDetailPanel from "./TaskDetailPanel";
import TeamDetailPanel from "./TeamDetailPanel";

// ── Layout constants (mirror IdeaBin) ──
const MIN_SIDEBAR_W = 200;
const DEFAULT_SIDEBAR_W = 260;
const LAYOUT_BREAKPOINT = 520;
const COLLAPSED_STRIP_W = 28;
const DEFAULT_FORM_H = 140;
const MIN_FORM_H = 80;
const MAX_FORM_H = 400;

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
  const location = useLocation();

  // ── Prompt settings (for AI prepend on export) ──
  const { buildClipboardText } = usePromptSettings();

  // ── Tab navigation ──
  const [activeTab, setActiveTab] = useState("canvas"); // "canvas" | "tasks" | "teams"
  const [detailView, setDetailView] = useState(null);   // null | { type: "task"|"team", id: number }

  // ── Floating window ──
  const {
    isOpen, windowPos, setWindowPos, windowSize, setWindowSize, iconPos,
    isMaximized, setIsMaximized, zIndex, bringToFront: bringWindowToFront, windowRef, iconRef,
    openWindow, minimizeWindow, toggleMaximize,
    handleIconDrag, handleWindowDrag,
    handleWindowResize, handleEdgeResize,
    managed,
  } = useFloatingWindow({
    id: "taskStructure",
    openSound: "ideaOpen",
    closeSound: "ideaClose",
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
    assignTaskToTeam, reorderUnassigned, reorderTeamTasks, tasksByTeam,
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

  // ── UI state (needed before useTaskViews for deps) ──
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_W);
  const [legendPanelCollapsed, setLegendPanelCollapsed] = useState(true);
  const [taskMode, setTaskMode] = useState(true);
  const [drawTeamMode, setDrawTeamMode] = useState(false);
  const [collapsedTeamIds, setCollapsedTeamIds] = useState(new Set());
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [exportModal, setExportModal] = useState(null);
  const [importModal, setImportModal] = useState(null);
  const [viewMode, setViewMode] = useState("compact");
  const [teamViewOverrides, setTeamViewOverrides] = useState({});
  const [groupBy, setGroupBy] = useState("team");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [quickAddCollapsed, setQuickAddCollapsed] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [formHeight, setFormHeight] = useState(DEFAULT_FORM_H);
  const [focusedPanel, setFocusedPanel] = useState(null); // "tasks" | "canvas" | null
  const [focusedTeamId, setFocusedTeamId] = useState(null); // team id in focus mode, or null
  const displayedTaskIdsRef = useRef([]); // kept in sync by TaskList
  // ── Views / formations (API-backed) ──
  const {
    views, showViewPanel, setShowViewPanel,
    viewName, setViewName,
    editingViewId, setEditingViewId,
    editingViewName, setEditingViewName,
    fetchViews, saveView, updateViewState,
    renameView, loadView, deleteView,
    toggleDefault, loadDefaultView,
  } = useTaskViews({
    projectId,
    deps: {
      windowPos, windowSize, isMaximized, viewMode, teamViewOverrides,
      sidebarWidth, legendPanelCollapsed, groupBy,
      collapsedTeamIds, teamPositions,
      leftCollapsed, rightCollapsed,
      toolbarCollapsed, quickAddCollapsed, formHeight, taskMode, focusedTeamId,
      setWindowPos, setWindowSize, setIsMaximized, setViewMode,
      setTeamViewOverrides, setSidebarWidth, setLegendPanelCollapsed,
      setGroupBy, setCollapsedTeamIds, setTeamPositions,
      setLeftCollapsed, setRightCollapsed,
      setToolbarCollapsed, setQuickAddCollapsed, setFormHeight, setTaskMode, setFocusedTeamId,
    },
  });

  // ── Refs ──
  const taskListRef = useRef(null);
  const teamCanvasRef = useRef(null);
  const triggerDeleteSelectedRef = useRef(null);
  const triggerDeleteSelectedTeamsRef = useRef(null);

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

  // ── Keyboard: "t" toggles task mode, 1/2/3 changes view mode, Escape cancels draw mode ──
  //    Ctrl+A selects all tasks, Ctrl+Shift+A selects all expanded teams
  //    Delete triggers delete for selected tasks or teams, Enter confirms modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      // Only handle keyboard shortcuts on canvas tab
      if (activeTab !== "canvas" || detailView) return;
      // Ignore if user is typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;

      // Ctrl+Shift+A → select all expanded (visible) teams
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        const expandedIds = teamOrder.filter((tid) => !collapsedTeamIds.has(tid));
        setSelectedTeamIds(new Set(expandedIds));
        return;
      }

      // Ctrl+A → select tasks (focus-aware)
      //   task list focused  → only displayed (filtered) tasks
      //   canvas focused + teams selected → only tasks inside those teams
      //   otherwise → all tasks
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        if (focusedPanel === "tasks" && displayedTaskIdsRef.current.length > 0) {
          setSelectedTaskIds(new Set(displayedTaskIdsRef.current));
        } else if (focusedPanel === "canvas" && selectedTeamIds.size > 0) {
          const map = tasksByTeam();
          const ids = [];
          for (const tid of selectedTeamIds) {
            const teamTasks = map[tid];
            if (teamTasks) teamTasks.forEach((t) => ids.push(t.id));
          }
          setSelectedTaskIds(new Set(ids));
        } else {
          const allIds = Object.keys(tasks).map(Number);
          setSelectedTaskIds(new Set(allIds));
        }
        return;
      }

      // Ctrl+T  → select all displayed tasks (legacy, kept for compat)
      if ((e.ctrlKey || e.metaKey) && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        const allIds = Object.keys(tasks).map(Number);
        setSelectedTaskIds(new Set(allIds));
        return;
      }

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setTaskMode((prev) => !prev);
      }
      if (e.key === "1") { e.preventDefault(); setViewMode("titles"); }
      if (e.key === "2") { e.preventDefault(); setViewMode("compact"); }
      if (e.key === "3") { e.preventDefault(); setViewMode("full"); }
      if (e.key === "Escape") {
        if (focusedTeamId) {
          e.preventDefault();
          setFocusedTeamId(null);
        } else if (drawTeamMode) {
          e.preventDefault();
          setDrawTeamMode(false);
        }
      }
      // Delete key → trigger delete for selected teams first, then tasks
      if (e.key === "Delete") {
        e.preventDefault();
        if (selectedTeamIds.size > 0) {
          triggerDeleteSelectedTeamsRef.current?.();
        } else if (selectedTaskIds.size > 0) {
          triggerDeleteSelectedRef.current?.();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, activeTab, detailView, drawTeamMode, editingTaskId, isCreatingTask, tasks, selectedTaskIds, selectedTeamIds, teamOrder, collapsedTeamIds, focusedPanel, tasksByTeam, focusedTeamId]);

  // ── Load default view every time the window opens ──
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      loadDefaultView();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, loadDefaultView]);

  // ── Route-based auto-open: /teams, /teams/:id, /tasks, /tasks/:id ──
  useEffect(() => {
    const path = location.pathname;
    const match = path.match(/\/projects\/\d+\/(teams|tasks)(?:\/(\d+))?$/);
    if (!match) return;

    const [, section, id] = match;
    if (!isOpen) openWindow();

    if (id) {
      setDetailView({ type: section === "teams" ? "team" : "task", id: parseInt(id) });
    } else {
      setActiveTab(section === "teams" ? "teams" : "tasks");
      setDetailView(null);
    }
  }, [location.pathname]);

  // ── Refetch canvas data when returning from other tabs ──
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab === "canvas" && prevTabRef.current !== "canvas" && isOpen) {
      fetchTasks();
      fetchTeams();
    }
    prevTabRef.current = activeTab;
  }, [activeTab, isOpen]);

  // ── Pipeline: idea → task (listen for drops from IdeaBin) ──
  useEffect(() => {
    const handler = async (e) => {
      const { ideaId, placementId, title, description } = e.detail || {};
      if (!title || !projectId) return;
      try {
        // Parse acceptance criteria from description if present
        let cleanDesc = description || "";
        const parsedAC = [];
        const acMatch = cleanDesc.match(/acceptance\s*criteria\s*:\s*([\s\S]*)/i);
        if (acMatch) {
          cleanDesc = cleanDesc.slice(0, acMatch.index).trim();
          const acBlock = acMatch[1].trim();
          const lines = acBlock.split(/\n/).map(l => l.replace(/^[-\u2022*]\s*/, "").trim()).filter(Boolean);
          lines.forEach(l => parsedAC.push({ title: l }));
        }

        const task = await createTaskForProject(projectId, {
          name: title,
          description: cleanDesc,
          acceptance_criteria: parsedAC,
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
      const { categoryId, name, ideas: ideaData, dropX, dropY } = e.detail || {};
      if (!name || !projectId) return;
      try {
        // Convert screen coordinates to canvas-relative coordinates
        let team;
        const canvas = teamCanvasRef.current;
        if (canvas && dropX != null && dropY != null) {
          const rect = canvas.getBoundingClientRect();
          const canvasX = dropX - rect.left + canvas.scrollLeft;
          const canvasY = dropY - rect.top + canvas.scrollTop;
          team = await createTeamAt(name, null, { x: Math.max(0, Math.round(canvasX - 120)), y: Math.max(0, Math.round(canvasY - 20)) });
        } else {
          team = await createTeam(name);
        }
        if (team) {
          // create tasks from the category's ideas and assign them to the new team
          if (ideaData?.length) {
            for (const idea of ideaData) {
              try {
                // Parse acceptance criteria from idea description if present
                let cleanDesc = idea.description || "";
                const parsedAC = [];
                const acMatch = cleanDesc.match(/acceptance\s*criteria\s*:\s*([\s\S]*)/i);
                if (acMatch) {
                  cleanDesc = cleanDesc.slice(0, acMatch.index).trim();
                  const acBlock = acMatch[1].trim();
                  const lines = acBlock.split(/\n/).map(l => l.replace(/^[-\u2022*]\s*/, "").trim()).filter(Boolean);
                  lines.forEach(l => parsedAC.push({ title: l }));
                }
                const task = await createTaskForProject(projectId, {
                  name: idea.title || "Untitled",
                  description: cleanDesc,
                  team_id: team.id,
                  acceptance_criteria: parsedAC,
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
  }, [projectId, createTeam, createTeamAt, teamCanvasRef, setTasks, fetchTasks]);

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
  const isNarrowRaw = windowSize.w < LAYOUT_BREAKPOINT;
  const isNarrow = isNarrowRaw && !focusedTeamId;  // focus mode overrides narrow layout

  // ── Team focus mode ──
  // Entering focus: team fills the canvas, left sidebar + toolbar collapse.
  // Exiting: any contradicting action auto-clears focus (but doesn't re-expand collapsed panels).
  const enterTeamFocus = useCallback((teamId) => {
    setFocusedTeamId(teamId);
    setLeftCollapsed(true);
    setToolbarCollapsed(true);
    setSelectedTeamIds(new Set([teamId]));
    playSound('uiClick');
  }, []);

  const exitTeamFocus = useCallback(() => {
    setFocusedTeamId(null);
  }, []);

  // ── Handlers ──
  const onCreateTask = useCallback(() => {
    exitTeamFocus();
    setIsCreatingTask(true);
    setEditingTaskId(null);
  }, [exitTeamFocus]);

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
    exitTeamFocus();
    await createTeam(name, color);
    // Refetch tasks to update team assignments display
    fetchTasks();
  }, [createTeam, fetchTasks]);

  // ── Fit all teams into visible canvas area ──
  const fitAllTeams = useCallback(() => {
    const canvas = teamCanvasRef.current;
    if (!canvas || teamOrder.length === 0) return;

    const PAD = 20;
    const canvasW = canvas.clientWidth;
    const canvasH = canvas.clientHeight;

    // Compute bounding box of all visible teams
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const posEntries = [];
    for (const tid of teamOrder) {
      const pos = teamPositions[tid];
      if (!pos) continue;
      const x = pos.x || 0;
      const y = pos.y || 0;
      const w = pos.w || 240;
      const h = pos.h || 300;
      posEntries.push({ tid, x, y, w, h });
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }
    if (posEntries.length === 0) return;

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    if (bboxW <= 0 || bboxH <= 0) return;

    const availW = canvasW - PAD * 2;
    const availH = canvasH - PAD * 2;
    const scale = Math.min(1, availW / bboxW, availH / bboxH);

    setTeamPositions((prev) => {
      const next = { ...prev };
      for (const { tid, x, y, w, h } of posEntries) {
        next[tid] = {
          ...next[tid],
          x: Math.round((x - minX) * scale + PAD),
          y: Math.round((y - minY) * scale + PAD),
          w: Math.round(w * scale),
          h: Math.round(h * scale),
        };
      }
      // Persist to localStorage
      try {
        localStorage.setItem(`ts_team_canvas_${projectId}`, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });

    // Reset scroll to top-left so user sees all teams
    canvas.scrollLeft = 0;
    canvas.scrollTop = 0;
  }, [teamOrder, teamPositions, setTeamPositions, projectId]);

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

  // ── Bulk-delete selected tasks (with confirmation) ──
  const triggerDeleteSelected = useCallback(() => {
    const ids = [...selectedTaskIds];
    if (ids.length === 0) return;

    const taskItems = ids.map((id) => tasks[id]).filter(Boolean);
    if (taskItems.length === 0) return;

    setConfirmModal({
      message: (
        <div>
          <p className="text-sm font-medium mb-2">
            Delete {taskItems.length} task{taskItems.length > 1 ? 's' : ''}?
          </p>
          <ul className="text-xs text-gray-600 space-y-0.5 max-h-[160px] overflow-y-auto pr-1">
            {taskItems.map((t) => (
              <li key={t.id} className="flex items-start gap-1">
                <span className="text-red-400 mt-px">•</span>
                <span className="font-semibold">{t.name || '(untitled)'}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
      confirmLabel: `Delete${taskItems.length > 1 ? ` (${taskItems.length})` : ''}`,
      confirmColor: 'bg-red-500 hover:bg-red-600',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await bulk_delete_tasks(projectId, ids);
          setTasks((prev) => {
            const next = { ...prev };
            ids.forEach((id) => delete next[id]);
            return next;
          });
          setTaskOrder((prev) => prev.filter((id) => !ids.includes(id)));
          setSelectedTaskIds(new Set());
          if (ids.includes(editingTaskId)) setEditingTaskId(null);
        } catch (e) {
          console.error('Bulk delete failed', e);
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }, [selectedTaskIds, tasks, projectId, editingTaskId, setTasks, setTaskOrder]);

  // Keep ref in sync so the keyboard handler can call it without stale closure
  useEffect(() => { triggerDeleteSelectedRef.current = triggerDeleteSelected; }, [triggerDeleteSelected]);

  // ── Bulk-delete selected teams (with confirmation) ──
  const triggerDeleteSelectedTeams = useCallback(() => {
    const ids = [...selectedTeamIds];
    if (ids.length === 0) return;

    const teamItems = ids.map((id) => teams[id]).filter(Boolean);
    if (teamItems.length === 0) return;

    // Count affected tasks
    const affectedTaskCount = ids.reduce((sum, tid) => sum + (tasksByTeamMap[tid]?.length || 0), 0);

    setConfirmModal({
      message: (
        <div>
          <p className="text-sm font-medium mb-2">
            Delete {teamItems.length} team{teamItems.length > 1 ? 's' : ''}?
          </p>
          <ul className="text-xs text-gray-600 space-y-0.5 max-h-[120px] overflow-y-auto pr-1">
            {teamItems.map((t) => {
              const count = tasksByTeamMap[t.id]?.length || 0;
              return (
                <li key={t.id} className="flex items-start gap-1">
                  <div className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: t.color || '#6366f1' }} />
                  <span className="font-semibold" style={{ color: t.color || '#6366f1' }}>{t.name || '(unnamed)'}</span>
                  {count > 0 && <span className="text-gray-400 ml-1">({count} task{count > 1 ? 's' : ''})</span>}
                </li>
              );
            })}
          </ul>
          {affectedTaskCount > 0 && (
            <p className="text-[10px] text-gray-500 mt-2 border-t border-gray-100 pt-1.5">
              {affectedTaskCount} task{affectedTaskCount > 1 ? 's' : ''} will become unassigned (not deleted).
            </p>
          )}
        </div>
      ),
      confirmLabel: `Delete${teamItems.length > 1 ? ` (${teamItems.length})` : ''}`,
      confirmColor: 'bg-red-500 hover:bg-red-600',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          for (const tid of ids) {
            await deleteTeam(tid);
          }
          setSelectedTeamIds(new Set());
          // Refetch tasks since they become unassigned
          fetchTasks();
        } catch (e) {
          console.error('Bulk delete teams failed', e);
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }, [selectedTeamIds, teams, tasksByTeamMap, deleteTeam, fetchTasks]);

  // Keep ref in sync
  useEffect(() => { triggerDeleteSelectedTeamsRef.current = triggerDeleteSelectedTeams; }, [triggerDeleteSelectedTeams]);

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
    setExportModal({ json: buildExportJson("project"), title: "Export Project Structure", scenarioKey: "task_multi_teams" });
  }, [buildExportJson]);

  const handleExportSelectedTeams = useCallback(() => {
    const ids = [...selectedTeamIds];
    if (ids.length === 0) return;
    const json = buildExportJson("teams", ids);
    const title = ids.length === 1 && teams[ids[0]]
      ? `Export Team — ${teams[ids[0]].name}`
      : `Export ${ids.length} Teams`;
    const scenarioKey = ids.length === 1 ? 'task_single_team' : 'task_multi_teams';
    setExportModal({ json, title, scenarioKey });
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
    setExportModal({ json: { tasks: tasksJson }, title: `Export ${ids.length} Task${ids.length > 1 ? "s" : ""}`, scenarioKey: 'task_single_task' });
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
      {/* ── COLLAPSED: Floating icon (hidden when managed) ── */}
      {!isOpen && !managed && (
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
            toolbarCollapsed={toolbarCollapsed}
            toggleToolbar={() => { setToolbarCollapsed(v => { if (v) exitTeamFocus(); return !v; }); playSound('uiClick'); }}
            activeTab={activeTab}
            setActiveTab={(tab) => { exitTeamFocus(); setActiveTab(tab); setDetailView(null); }}
            detailView={detailView}
            onBackFromDetail={() => setDetailView(null)}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            teams={teams}
            views={views}
            loadView={loadView}
            saveView={saveView}
            updateViewState={updateViewState}
            deleteView={deleteView}
            renameView={renameView}
            toggleDefault={toggleDefault}
            showViewPanel={showViewPanel}
            setShowViewPanel={setShowViewPanel}
            viewName={viewName}
            setViewName={setViewName}
            editingViewId={editingViewId}
            setEditingViewId={setEditingViewId}
            editingViewName={editingViewName}
            setEditingViewName={setEditingViewName}
          />

          {/* ── Content: detail view, tab content, or canvas ── */}
          {detailView ? (
            detailView.type === "task" ? (
              <TaskDetailPanel
                taskId={detailView.id}
                onViewTeamDetail={(id) => setDetailView({ type: "team", id })}
              />
            ) : (
              <TeamDetailPanel
                teamId={detailView.id}
                onViewTaskDetail={(id) => setDetailView({ type: "task", id })}
              />
            )
          ) : activeTab === "tasks" ? (
            <TasksTabContent
              onViewTaskDetail={(id) => setDetailView({ type: "task", id })}
            />
          ) : activeTab === "teams" ? (
            <TeamsTabContent
              onViewTeamDetail={(id) => setDetailView({ type: "team", id })}
            />
          ) : (
            <>
          {/* ── Toolbar ── */}
          {!toolbarCollapsed && <TaskStructureToolbar
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
            onFitAllTeams={fitAllTeams}
          />}

          {/* ── Main content area ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* ── LEFT: Collapsed strip ── */}
            {leftCollapsed && !isNarrow && (
              <div className="flex flex-col items-center flex-shrink-0 bg-gray-50 border-r border-gray-200" style={{ width: COLLAPSED_STRIP_W }}>
                <button
                  onClick={() => { exitTeamFocus(); setLeftCollapsed(false); }}
                  className="mt-2 p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Expand task panel"
                >
                  <PanelLeftOpen size={16} />
                </button>
              </div>
            )}

            {/* Left sidebar: Task form OR Task list + Legend */}
            {(!leftCollapsed || isNarrow) && (
            <div
              className={`flex flex-col relative ${rightCollapsed && !isNarrow ? "flex-1" : ""} ${focusedPanel === "tasks" ? "ring-2 ring-indigo-300/60 ring-inset" : ""}`}
              style={{ width: isNarrow ? "100%" : (rightCollapsed ? undefined : sidebarWidth), minWidth: rightCollapsed ? 0 : undefined }}
              onMouseDown={() => setFocusedPanel("tasks")}
            >  {/* Collapse task panel button — top-right corner */}
              {!isNarrow && !rightCollapsed && (
                <button
                  onClick={() => setLeftCollapsed(true)}
                  className="absolute top-1.5 right-0 z-30 bg-white border border-gray-300 rounded-l px-1 py-1 flex items-center justify-center shadow-sm hover:bg-gray-100 hover:border-gray-400 transition-colors"
                  title="Collapse task panel"
                >
                  <PanelLeftClose size={12} className="text-gray-500" />
                </button>
              )}
              {/* Auto-assign team indicator (only for edit panel mode) — purely informational */}
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
                    onQuickCreateTask={handleCreateTaskFromForm}
                    setConfirmModal={setConfirmModal}
                    taskListRef={taskListRef}
                    sidebarWidth={(isNarrow || rightCollapsed) ? "100%" : sidebarWidth}
                    taskMode={taskMode}
                    viewMode={viewMode}
                    onToggleCriterion={onToggleCriterion}
                    quickAddCollapsed={quickAddCollapsed}
                    setQuickAddCollapsed={setQuickAddCollapsed}
                    autoAssignTeamId={autoAssignTeamId}
                    formHeight={formHeight}
                    setFormHeight={setFormHeight}
                    minFormH={MIN_FORM_H}
                    maxFormH={MAX_FORM_H}
                    focusedPanel={focusedPanel}
                    setFocusedPanel={setFocusedPanel}
                    displayedTaskIdsRef={displayedTaskIdsRef}
                  />

                  {/* Legend panel */}
                  <TaskLegendPanel
                    collapsed={legendPanelCollapsed}
                    setCollapsed={setLegendPanelCollapsed}
                  />
                </>
              )}
            </div>
            )}

            {/* Sidebar resize handle + intersection dot */}
            {!isNarrow && !leftCollapsed && !rightCollapsed && (
              <div className="relative flex-shrink-0" style={{ width: 6 }}>
                {/* Corner anchor — controls both form height AND sidebar width */}
                {!quickAddCollapsed && (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startW = sidebarWidth;
                      const startH = formHeight;
                      const onMove = (ev) => {
                        setSidebarWidth(Math.max(MIN_SIDEBAR_W, Math.min(startW + (ev.clientX - startX), windowSize.w - 200)));
                        setFormHeight(Math.min(MAX_FORM_H, Math.max(MIN_FORM_H, startH + (ev.clientY - startY))));
                      };
                      const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                      document.addEventListener("mousemove", onMove);
                      document.addEventListener("mouseup", onUp);
                    }}
                    className="absolute bg-gray-300 hover:bg-indigo-500 transition-colors duration-150 z-10 rounded-sm"
                    style={{ width: 10, height: 10, left: -2, top: formHeight - 2, cursor: "nwse-resize" }}
                    title="Drag to resize form and sidebar"
                  />
                )}
                {/* Normal horizontal resize strip */}
                <div
                  onMouseDown={handleSidebarResize}
                  className="w-full h-full bg-gray-200 hover:bg-indigo-400 cursor-col-resize transition-colors duration-150"
                />
              </div>
            )}

            {/* ── RIGHT: Collapsed strip ── */}
            {!isNarrow && rightCollapsed && (
              <div className="flex flex-col items-center flex-shrink-0 bg-gray-50 border-l border-gray-200" style={{ width: COLLAPSED_STRIP_W, minWidth: COLLAPSED_STRIP_W, maxWidth: COLLAPSED_STRIP_W }}>
                <button
                  onClick={() => setRightCollapsed(false)}
                  className="mt-2 p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Expand team canvas"
                >
                  <PanelRightOpen size={16} />
                </button>
              </div>
            )}

            {/* Right canvas: Team containers */}
            {!isNarrow && !rightCollapsed && (
              <div className={`flex-1 min-w-0 min-h-0 flex flex-col ${focusedPanel === "canvas" ? "ring-2 ring-indigo-300/60 ring-inset" : ""}`} onMouseDown={() => setFocusedPanel("canvas")}>
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
                  setExportModal({ json, title: `Export Team — ${team?.name || "Team"}`, scenarioKey: 'task_single_team' });
                }}
                viewMode={viewMode}
                teamViewOverrides={teamViewOverrides}
                setTeamViewOverride={setTeamViewOverride}
                onToggleCriterion={onToggleCriterion}
                onCollapseRight={() => setRightCollapsed(true)}
                showCollapseRight={!leftCollapsed}
                focusedTeamId={focusedTeamId}
                onEnterTeamFocus={enterTeamFocus}
                onExitTeamFocus={exitTeamFocus}
                onReorderTask={reorderTeamTasks}
              />
              </div>
            )}
          </div>
            </>
          )}

          {/* ── Confirm modal ── */}
          <TaskConfirmModal modal={confirmModal} />

          {/* ── Export modal ── */}
          {exportModal && (
            <TaskExportModal
              json={exportModal.json}
              title={exportModal.title}
              scenarioKey={exportModal.scenarioKey}
              buildClipboardText={buildClipboardText}
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

          {/* ── Loading overlay (canvas tab only) ── */}
          {activeTab === "canvas" && !detailView && (tasksLoading || teamsLoading) && (
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
