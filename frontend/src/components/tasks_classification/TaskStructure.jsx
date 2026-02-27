import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { LayoutGrid } from "lucide-react";

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
    isMaximized, windowRef, iconRef,
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
  const {
    tasks, setTasks, taskOrder, setTaskOrder,
    loading: tasksLoading,
    fetchTasks, createTask, updateTaskApi, deleteTask,
    assignTaskToTeam, reorderUnassigned, tasksByTeam,
  } = useTaskData({ projectId });

  const {
    teams, setTeams, teamOrder, setTeamOrder,
    teamPositions, setTeamPositions,
    loading: teamsLoading,
    fetchTeams, createTeam, createTeamAt, updateTeamApi, deleteTeam,
    setTeamPosition, bringToFront,
    handleTeamDrag, handleTeamResize,
  } = useTaskTeams({ projectId });

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
  });

  // ── UI state ──
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_W);
  const [legendPanelCollapsed, setLegendPanelCollapsed] = useState(true);

  // ── Mode state (spectator = default, task = drag enabled) ──
  const [taskMode, setTaskMode] = useState(true);

  // ── Draw-to-create team mode ──
  const [drawTeamMode, setDrawTeamMode] = useState(false);

  // ── Selected team IDs (marquee selection on canvas) ──
  const [selectedTeamIds, setSelectedTeamIds] = useState(new Set());

  // ── Task creation mode (show form in sidebar) ──
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // ── Team editing state ──
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");

  // ── Keyboard: "t" toggles task mode, Escape cancels draw mode ──
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
            zIndex: 9970,
          }}
          className="w-11 h-11 rounded-full shadow-lg bg-gradient-to-br from-indigo-500 to-violet-600 border-2 border-indigo-300
            flex items-center justify-center cursor-pointer select-none
            hover:scale-110 hover:shadow-xl active:scale-95 transition-shadow duration-150"
          title="Open Task Structure"
        >
          <LayoutGrid size={20} className="text-white drop-shadow" />
        </div>
      )}

      {/* ── EXPANDED: Floating window ── */}
      {isOpen && (
        <div
          ref={windowRef}
          data-taskstructure-window
          style={{
            position: "fixed",
            left: windowPos.x,
            top: windowPos.y,
            width: windowSize.w,
            height: windowSize.h,
            zIndex: 9970,
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
          />

          {/* ── Main content area ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left sidebar: Task form OR Task list + Legend */}
            <div className="flex flex-col" style={{ width: isNarrow ? "100%" : sidebarWidth }}>
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
              />
            )}
          </div>

          {/* ── Confirm modal ── */}
          <TaskConfirmModal modal={confirmModal} />

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
