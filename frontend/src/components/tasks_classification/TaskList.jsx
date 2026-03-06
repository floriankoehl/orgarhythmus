import { useState, useRef, useMemo, useEffect } from "react";
import { Plus, ChevronDown, ChevronRight, Search, Filter } from "lucide-react";
import TaskCard from "./TaskCard";
import TaskQuickAdd from "./TaskQuickAdd";

/**
 * Left panel — scrollable task list with search/filter and the unassigned pseudo-group.
 *
 * Mirrors IdeaBin's sidebar: task items in a scrollable list,
 * draggable for reorder & cross-drop onto team containers.
 */
export default function TaskList({
  tasks,
  taskOrder,
  teams,
  dragging,
  dragSource,
  hoverIndex,
  prevIndex,
  hoverUnassigned,
  handleTaskDrag,
  selectedTaskIds,
  setSelectedTaskIds,
  onEditTask,
  onDeleteTask,
  onCreateTask,
  onQuickCreateTask,
  setConfirmModal,
  taskListRef,
  sidebarWidth,
  taskMode = false,
  viewMode = "compact",
  onToggleCriterion,
  onToggleMilestoneTodo,
  quickAddCollapsed,
  setQuickAddCollapsed,
  autoAssignTeamId,
  formHeight,
  setFormHeight,
  minFormH,
  maxFormH,
  focusedPanel,
  setFocusedPanel,
  displayedTaskIdsRef,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllTasks, setShowAllTasks] = useState(false);
  const lastClickedTaskRef = useRef(null);

  // Unassigned tasks (in display order)
  const unassignedTasks = taskOrder
    .map((id) => tasks[id])
    .filter(Boolean)
    .filter((t) => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  // All tasks flat list (for "all" view)
  const allTasks = Object.values(tasks).filter(
    (t) => !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayTasks = showAllTasks ? allTasks : unassignedTasks;
  const displayedTaskIds = useMemo(() => displayTasks.map((t) => t.id), [displayTasks]);

  // Keep parent ref in sync so Ctrl+A in TaskStructure can read displayed IDs
  useEffect(() => {
    if (displayedTaskIdsRef) displayedTaskIdsRef.current = displayedTaskIds;
  }, [displayedTaskIds, displayedTaskIdsRef]);

  return (
    <div
      className="flex flex-col h-full border-r border-gray-200 bg-white"
      style={{ width: sidebarWidth, minWidth: 200 }}
    >
      {/* Quick-add form (always visible, collapsible) — at top so intersection dot aligns */}
      <TaskQuickAdd
        onCreate={onQuickCreateTask}
        defaultTeamId={autoAssignTeamId}
        teams={teams}
        collapsed={quickAddCollapsed}
        setCollapsed={setQuickAddCollapsed}
        formHeight={formHeight}
      />

      {/* ── Vertical splitter between form and task list ── */}
      {!quickAddCollapsed && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const startY = e.clientY;
            const startH = formHeight;
            const onMove = (ev) => {
              setFormHeight(Math.min(maxFormH, Math.max(minFormH, startH + (ev.clientY - startY))));
            };
            const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          className="h-1.5 flex-shrink-0 bg-gray-200 hover:bg-indigo-400 cursor-row-resize transition-colors duration-150"
        />
      )}

      {/* Header — Unassigned / All toggle */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center rounded-full bg-gray-100 p-0.5">
          <button
            onClick={() => setShowAllTasks(false)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${!showAllTasks ? "bg-white shadow-sm text-indigo-700" : "text-gray-500"}`}
          >
            Unassigned ({taskOrder.length})
          </button>
          <button
            onClick={() => setShowAllTasks(true)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${showAllTasks ? "bg-white shadow-sm text-indigo-700" : "text-gray-500"}`}
          >
            All ({Object.keys(tasks).length})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1 flex-shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks…"
            className="w-full text-[10px] pl-5 pr-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-indigo-300"
          />
        </div>
      </div>

      {/* Task list */}
      <div
        ref={taskListRef}
        className={`flex-1 overflow-y-auto px-1 py-0.5 bg-gray-50/80 ${hoverUnassigned ? "bg-indigo-50/40" : ""}`}
      >
        {displayTasks.length === 0 ? (
          <div className="text-center text-[10px] text-gray-400 py-6 italic">
            {searchQuery ? "No matching tasks" : showAllTasks ? "No tasks yet" : "No unassigned tasks"}
          </div>
        ) : (
          displayTasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              index={i}
              source={showAllTasks ? { type: "all" } : { type: "unassigned" }}
              teams={teams}
              dragging={dragging}
              dragSource={dragSource}
              hoverIndex={!showAllTasks ? hoverIndex : null}
              prevIndex={prevIndex}
              handleTaskDrag={handleTaskDrag}
              selectedTaskIds={selectedTaskIds}
              setSelectedTaskIds={setSelectedTaskIds}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              setConfirmModal={setConfirmModal}
              taskMode={taskMode}
              viewMode={viewMode}
              onToggleCriterion={onToggleCriterion}
              onToggleMilestoneTodo={onToggleMilestoneTodo}
              displayedTaskIds={displayedTaskIds}
              lastClickedTaskRef={lastClickedTaskRef}
            />
          ))
        )}
      </div>

      {/* Open full form (for editing) */}
      <div className="px-2 py-1.5 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={onCreateTask}
          className="w-full flex items-center justify-center gap-1 text-[10px] py-1 rounded border border-dashed border-gray-300 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
        >
          <Plus size={10} /> Full Task Form
        </button>
      </div>
    </div>
  );
}
