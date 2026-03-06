import { useRef, useState } from "react";
import { GripVertical, Users, Pencil, Trash2, MoreVertical, ChevronDown, ChevronRight, CheckSquare, Square, AlertTriangle, Target, Flag } from "lucide-react";

/**
 * Individual task card rendered in the sidebar task list and within team containers.
 *
 * Supports three view modes:
 *   "titles"  — name only (+ team badge if outside team)
 *   "compact" — name + description (line-clamp-2)
 *   "full"    — name + description (expanded) + priority + difficulty + deadline + milestones + acceptance criteria (tickable)
 *
 * Mirrors IdeaBinIdeaCard: draggable, selectable, shows team color accent,
 * priority/difficulty badges, and quick actions.
 */
export default function TaskCard({
  task,
  index,
  source,               // { type: "unassigned" } | { type: "team", teamId }
  teams,
  dragging,
  dragSource,
  hoverIndex,
  prevIndex,
  handleTaskDrag,
  selectedTaskIds,
  setSelectedTaskIds,
  onEditTask,
  onDeleteTask,
  setConfirmModal,
  taskMode = false,        // when true, dragging is enabled
  insideTeam = false,      // when true, hide team badge (already visible in container header)
  viewMode = "compact",    // "titles" | "compact" | "full"
  onToggleCriterion,       // (taskId, criterionId) => void
  onToggleMilestoneTodo,   // (taskId, milestoneId, todoId) => void
  displayedTaskIds = null, // ordered array of task IDs for shift-click range select
  lastClickedTaskRef = null, // ref to last-clicked task ID for shift anchor
  onIntraTeamDrag = null,  // (e, taskId, index) => void — intra-team reorder
}) {
  const [showActions, setShowActions] = useState(false);
  const moreRef = useRef(null);

  if (!task) return null;

  const team = task.team?.id ? teams[task.team.id] || task.team : task.team;
  const teamColor = team?.color || null;
  const isSelected = selectedTaskIds.has(task.id);
  const isSource =
    dragSource &&
    dragSource.type === source.type &&
    (source.type === "unassigned" || String(dragSource.teamId) === String(source.teamId));

  const priorityColors = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-green-100 text-green-700",
  };

  const difficultyColors = {
    hard: "bg-purple-100 text-purple-700",
    medium: "bg-blue-100 text-blue-700",
    easy: "bg-teal-100 text-teal-700",
  };

  // Acceptance criteria from the related model
  const criteria = task.acceptance_criteria || [];
  const criteriaTotal = criteria.length;
  const criteriaDone = criteria.filter((c) => c.done).length;
  const taskIsDone = !!task.is_done;

  const handleClick = (e) => {
    if (e.shiftKey && displayedTaskIds && lastClickedTaskRef) {
      // Range select: select all tasks between anchor and current
      const anchorId = lastClickedTaskRef.current;
      const anchorIdx = anchorId != null ? displayedTaskIds.indexOf(anchorId) : -1;
      const currentIdx = displayedTaskIds.indexOf(task.id);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        const rangeIds = displayedTaskIds.slice(start, end + 1);
        setSelectedTaskIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((id) => next.add(id));
          return next;
        });
      } else {
        // No anchor yet — treat as normal click
        setSelectedTaskIds(new Set([task.id]));
        if (lastClickedTaskRef) lastClickedTaskRef.current = task.id;
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        if (next.has(task.id)) next.delete(task.id);
        else next.add(task.id);
        return next;
      });
    } else {
      // Toggle: deselect if already sole selection, otherwise select
      setSelectedTaskIds((prev) =>
        prev.size === 1 && prev.has(task.id) ? new Set() : new Set([task.id])
      );
    }
    // Update anchor for shift-select
    if (lastClickedTaskRef) lastClickedTaskRef.current = task.id;
  };

  const handleDelete = () => {
    setConfirmModal({
      message: (
        <div>
          <p className="text-sm font-medium mb-1">Delete task?</p>
          <p className="text-xs text-gray-600">
            Permanently delete <span className="font-semibold">"{task.name}"</span>
          </p>
        </div>
      ),
      confirmLabel: "Delete",
      confirmColor: "bg-red-500 hover:bg-red-600",
      onConfirm: () => { onDeleteTask(task.id); setConfirmModal(null); },
      onCancel: () => setConfirmModal(null),
    });
  };

  return (
    <div data-task-item="true" data-task-id={task.id}>
      {/* Drop indicator */}
      <div
        style={{
          opacity: isSource && index === hoverIndex ? 1 : 0,
          transition: "opacity 100ms ease",
        }}
        className="w-full h-0.5 my-[1px] rounded bg-indigo-400"
      />

      <div
        onClick={handleClick}
        onDoubleClick={(e) => { e.stopPropagation(); onEditTask?.(task.id); }}
        className={`group relative flex items-start gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all text-[11px]
          ${taskIsDone ? "opacity-70" : ""}
          ${isSelected
            ? "bg-indigo-50 border border-indigo-300 shadow-sm"
            : taskIsDone
              ? "bg-green-50 border border-green-200 shadow-xs hover:border-green-300"
              : insideTeam
                ? "bg-white border border-gray-200 shadow-xs hover:border-gray-300"
                : "bg-white hover:bg-gray-100 border border-transparent"
          }`}
        style={{
          borderLeftWidth: teamColor ? 3 : undefined,
          borderLeftColor: teamColor || undefined,
        }}
      >
        {/* Drag handle — only interactive in task mode */}
        <div
          onMouseDown={(e) => {
            if (!taskMode) return;
            e.stopPropagation();
            // Inside a team: start intra-team reorder (can escalate to cross-panel on leave)
            if (insideTeam && onIntraTeamDrag) {
              onIntraTeamDrag(e, task.id, index);
            } else {
              handleTaskDrag(e, task, index, source);
            }
          }}
          className={`mt-0.5 flex-shrink-0 rounded p-0.5 transition-colors ${
            taskMode
              ? "cursor-grab active:cursor-grabbing bg-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300"
              : "text-gray-200 cursor-default"
          }`}
          title={taskMode ? "Drag to reorder or assign" : "Switch to edit mode (T) to drag"}
        >
          <GripVertical size={14} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + team badge */}
          <div className="flex items-center gap-1">
            <span className={`font-semibold truncate ${taskIsDone ? "text-green-700 line-through" : "text-gray-800"}`}>
              {task.name || "Untitled Task"}
            </span>
            {team && !insideTeam && (
              <span
                className="text-[9px] px-1 py-0 rounded-full font-medium flex-shrink-0"
                style={{
                  backgroundColor: teamColor ? `color-mix(in srgb, ${teamColor} 15%, white)` : "#f3f4f6",
                  color: teamColor || "#6b7280",
                }}
              >
                {team.name || "Team"}
              </span>
            )}
            {/* Criteria progress indicator (compact + titles modes) */}
            {viewMode !== "full" && criteriaTotal > 0 && (
              <span className={`text-[8px] px-1 py-0 rounded font-medium flex-shrink-0 ${
                criteriaDone === criteriaTotal ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {criteriaDone}/{criteriaTotal}
              </span>
            )}
          </div>

          {/* ── COMPACT + FULL: Description ── */}
          {viewMode !== "titles" && task.description && (
            <p className={`text-[10px] text-gray-500 mt-0.5 whitespace-pre-wrap ${
              viewMode === "compact" ? "line-clamp-2" : ""
            }`}>
              {task.description}
            </p>
          )}

          {/* ── FULL only: Priority + Difficulty + Deadline badges ── */}
          {viewMode === "full" && (task.priority || task.difficulty || task.hard_deadline) && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {task.priority && (
                <span className={`text-[9px] px-1 py-0 rounded font-medium ${priorityColors[task.priority?.toLowerCase()] || "bg-gray-100 text-gray-600"}`}>
                  Priority: {task.priority}
                </span>
              )}
              {task.difficulty && (
                <span className={`text-[9px] px-1 py-0 rounded font-medium ${difficultyColors[task.difficulty?.toLowerCase()] || "bg-gray-100 text-gray-600"}`}>
                  Difficulty: {task.difficulty}
                </span>
              )}
              {task.hard_deadline && (
                <span className="text-[9px] px-1 py-0 rounded font-medium bg-orange-100 text-orange-700">
                  ⏰ {task.hard_deadline}
                </span>
              )}
            </div>
          )}

          {/* ── FULL: Milestones with TODOs ── */}
          {viewMode === "full" && task.milestones && task.milestones.length > 0 && (
            <div className="mt-1.5">
              <div className="flex items-center gap-0.5 text-[9px] font-medium text-gray-400 uppercase mb-0.5">
                <Flag size={8} /> Milestones
              </div>
              {task.milestones.map((m, i) => {
                const todos = m.todos || [];
                const todosDone = todos.filter((t) => t.done).length;
                const mDone = !!m.is_done_effective;
                return (
                  <div key={m.id || i} className={`pl-2 py-0.5 border-l-2 ml-0.5 mb-0.5 ${mDone ? 'border-green-300' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-1 text-[9px]">
                      {mDone
                        ? <CheckSquare size={9} className="text-green-500 flex-shrink-0" />
                        : <Square size={9} className="text-gray-300 flex-shrink-0" />
                      }
                      <span className={`font-medium ${mDone ? 'text-green-700 line-through' : 'text-gray-600'}`}>{m.name}</span>
                      {todos.length > 0 && (
                        <span className={`text-[8px] px-1 py-0 rounded font-medium ${
                          todosDone === todos.length ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {todosDone}/{todos.length}
                        </span>
                      )}
                    </div>
                    {m.description && <p className="text-[8px] text-gray-400 ml-3.5">{m.description}</p>}
                    {todos.length > 0 && (
                      <div className="ml-3.5 mt-0.5 space-y-0.5">
                        {todos.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-start gap-1 group/todo cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleMilestoneTodo?.(task.id, m.id, t.id);
                            }}
                          >
                            {t.done ? (
                              <CheckSquare size={10} className="text-green-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Square size={10} className="text-gray-300 group-hover/todo:text-gray-500 mt-0.5 flex-shrink-0" />
                            )}
                            <span className={`text-[9px] flex-1 ${t.done ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                              {t.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── FULL: Acceptance Criteria (tickable checkboxes) ── */}
          {viewMode === "full" && criteriaTotal > 0 && (
            <div className="mt-1.5">
              <div className="flex items-center gap-0.5 text-[9px] font-medium text-gray-400 uppercase mb-0.5">
                <CheckSquare size={8} /> Criteria
                <span className={`ml-auto text-[8px] font-medium ${
                  criteriaDone === criteriaTotal ? "text-green-600" : "text-gray-400"
                }`}>
                  {criteriaDone}/{criteriaTotal}
                </span>
              </div>
              <div className="space-y-0.5">
                {criteria.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-1 group/crit cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCriterion?.(task.id, c.id);
                    }}
                  >
                    {c.done ? (
                      <CheckSquare size={11} className="text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Square size={11} className="text-gray-300 group-hover/crit:text-gray-500 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={`text-[10px] flex-1 ${
                      c.done ? "text-gray-400 line-through" : "text-gray-700"
                    }`}>
                      {c.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onEditTask(task.id); }}
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            title="Edit task"
          >
            <Pencil size={11} />
          </button>
          <button
            ref={moreRef}
            onClick={(e) => { e.stopPropagation(); setShowActions((p) => !p); }}
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            title="More actions"
          >
            <MoreVertical size={11} />
          </button>
        </div>

        {/* Action dropdown */}
        {showActions && (
          <div
            className="absolute right-1 top-full mt-0.5 bg-white rounded shadow-lg border border-gray-200 py-0.5 min-w-[100px] z-50"
            onMouseLeave={() => setShowActions(false)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onEditTask(task.id); setShowActions(false); }}
              className="w-full text-left px-2 py-1 text-[10px] text-gray-700 hover:bg-gray-100 flex items-center gap-1"
            >
              <Pencil size={10} /> Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); setShowActions(false); }}
              className="w-full text-left px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 flex items-center gap-1"
            >
              <Trash2 size={10} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
