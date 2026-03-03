import { useRef, useState, useCallback } from "react";
import { Pencil, Trash2, GripVertical, Minimize2, Maximize2, ChevronDown, Upload, Download, Eye, Settings } from "lucide-react";
import TaskCard from "./TaskCard";

/**
 * Single team container on the canvas — draggable, resizable, shows team header
 * and a list of assigned task cards.
 *
 * Mirrors IdeaBin's category card pattern.
 */
export default function TeamContainer({
  team,
  tasks,        // { id: taskObj } full map
  taskIds,      // [id,...] tasks assigned to this team
  teams,        // full teams map
  position,     // { x, y, w, h, z }
  handleTeamDrag,
  handleTeamResize,
  // editing
  editingTeamId,
  setEditingTeamId,
  editingTeamName,
  setEditingTeamName,
  onRenameTeam,
  onDeleteTeam,
  onUpdateTeamColor,
  // task interactions
  dragging,
  dragSource,
  hoverIndex,
  prevIndex,
  hoverTeamId,
  handleTaskDrag,
  selectedTaskIds,
  setSelectedTaskIds,
  onEditTask,
  onDeleteTask,
  setConfirmModal,
  taskMode = false,
  isTeamSelected = false,
  onCollapseTeam,
  setSelectedTeamIds,
  onInsertTasks,
  onExportTeam,
  viewMode = "compact",
  setTeamViewOverride,
  onToggleCriterion,
  isFocused = false,
  onEnterTeamFocus,
  onExitTeamFocus,
}) {
  const [minimized, setMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [taskMarquee, setTaskMarquee] = useState(null); // { startY, currentY }
  const taskListRef = useRef(null);
  const lastClickedTaskRef = useRef(null);
  const isEditing = editingTeamId === team.id;
  const isDropTarget = hoverTeamId != null && String(hoverTeamId) === String(team.id);
  const teamColor = team.color || "#6366f1";

  const handleRename = () => {
    if (editingTeamName.trim()) {
      onRenameTeam(team.id, editingTeamName.trim());
    }
    setEditingTeamId(null);
  };

  const handleDelete = () => {
    setConfirmModal({
      message: (
        <div>
          <p className="text-sm font-medium mb-1">Delete team?</p>
          <p className="text-xs text-gray-600">
            Delete <span className="font-semibold" style={{ color: teamColor }}>"{team.name}"</span>.
            Tasks will become unassigned.
          </p>
        </div>
      ),
      confirmLabel: "Delete Team",
      confirmColor: "bg-red-500 hover:bg-red-600",
      onConfirm: () => { onDeleteTeam(team.id); setConfirmModal(null); },
      onCancel: () => setConfirmModal(null),
    });
  };

  // ── Task marquee selection inside the team ──
  const handleTaskMarqueeStart = useCallback((e) => {
    // Only start if clicking on the container background, not on a task card
    if (e.target.closest("[data-task-item]")) return;
    if (e.button !== 0) return;

    const startY = e.clientY;
    setTaskMarquee({ startY, currentY: startY });

    const handleMouseMove = (moveE) => {
      setTaskMarquee((prev) => prev ? { ...prev, currentY: moveE.clientY } : null);
    };

    const handleMouseUp = (upE) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setTaskMarquee(null);

      const minY = Math.min(startY, upE.clientY);
      const maxY = Math.max(startY, upE.clientY);
      if (maxY - minY < 5) return;

      if (!taskListRef.current) return;
      const items = taskListRef.current.querySelectorAll("[data-task-item]");
      const hit = [];
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > minY && r.top < maxY) {
          const id = parseInt(el.dataset.taskId, 10);
          if (id) hit.push(id);
        }
      });

      if (hit.length > 0) {
        if (upE.ctrlKey || upE.metaKey) {
          setSelectedTaskIds((old) => {
            const next = new Set(old);
            hit.forEach((id) => next.add(id));
            return next;
          });
        } else {
          setSelectedTaskIds(new Set(hit));
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [setSelectedTaskIds]);

  return (
    <div
      data-team-container={team.id}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: position.w || 240,
        height: minimized ? "auto" : (position.h || 300),
        zIndex: position.z || 0,
      }}
      className={`flex flex-col rounded-lg shadow-md border transition-shadow bg-white ${
        isDropTarget ? "ring-2 ring-indigo-400 shadow-lg" : isTeamSelected ? "ring-2 ring-violet-400 shadow-md" : ""
      }`}
      style-border-color={teamColor}
    >
      {/* ── Team header ── */}
      <div
        onMouseDown={(e) => handleTeamDrag(e, team.id, () => {
          // Click (no drag) — select/toggle team & clear task selection
          if (e.ctrlKey || e.metaKey) {
            setSelectedTeamIds?.((prev) => {
              const next = new Set(prev);
              if (next.has(team.id)) next.delete(team.id);
              else next.add(team.id);
              return next;
            });
          } else {
            setSelectedTeamIds?.((prev) =>
              prev.size === 1 && prev.has(team.id) ? new Set() : new Set([team.id])
            );
          }
          setSelectedTaskIds?.(new Set());
        })}
        className="flex items-center gap-1.5 px-2 py-1.5 cursor-grab active:cursor-grabbing flex-shrink-0 overflow-hidden rounded-t-lg"
        style={{
          backgroundColor: `color-mix(in srgb, ${teamColor} 15%, white)`,
          borderBottom: `2px solid ${teamColor}`,
        }}
      >
        {/* Color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 cursor-pointer relative"
          style={{ backgroundColor: teamColor }}
          onClick={(e) => { e.stopPropagation(); setShowSettings((p) => !p); }}
          title="Team settings"
        />

        {/* Name / rename */}
        {isEditing ? (
          <input
            autoFocus
            value={editingTeamName}
            onChange={(e) => setEditingTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setEditingTeamId(null);
            }}
            onBlur={handleRename}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-[11px] font-semibold bg-transparent border-b border-gray-400 focus:outline-none flex-1 min-w-0"
            style={{ color: teamColor }}
          />
        ) : (
          <span
            className="text-[11px] font-semibold truncate flex-1"
            style={{ color: teamColor }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              // Double-click → collapse to chip at top of canvas
              onCollapseTeam?.(team.id);
            }}
          >
            {team.name || "Unnamed Team"}
          </span>
        )}

        {/* Task count */}
        <span className="text-[9px] text-gray-400 font-medium flex-shrink-0">
          {taskIds.length}
        </span>

        {/* Settings button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowSettings((p) => !p); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-0.5 rounded hover:bg-white/50 text-gray-400 hover:text-gray-600"
          title="Team settings"
        >
          <Settings size={11} />
        </button>

        {/* Focus mode toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); isFocused ? onExitTeamFocus?.() : onEnterTeamFocus?.(team.id); }}
          onMouseDown={(e) => e.stopPropagation()}
          className={`p-0.5 rounded hover:bg-white/50 transition-colors ${isFocused ? "text-indigo-500" : "text-gray-400 hover:text-gray-600"}`}
          title={isFocused ? "Exit focus mode" : "Focus — expand team to fill canvas"}
        >
          {isFocused ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
        </button>

        {/* Minimize toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setMinimized((p) => !p); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-0.5 rounded hover:bg-white/50 text-gray-400 hover:text-gray-600"
        >
          {minimized ? <ChevronDown size={11} /> : <Minimize2 size={11} />}
        </button>
      </div>

      {/* ── Settings dropdown ── */}
      {showSettings && (
        <div
          className="absolute right-0 top-8 bg-white rounded shadow-lg border border-gray-200 py-1 min-w-[140px] z-[200]"
          onMouseLeave={() => setShowSettings(false)}
        >
          <div className="px-2 py-1 flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Color:</span>
            <input
              type="color"
              value={teamColor}
              onChange={(e) => onUpdateTeamColor(team.id, e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-0 p-0"
            />
          </div>
          <button
            onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name || ""); setShowSettings(false); }}
            className="w-full text-left px-2 py-1 text-[10px] text-gray-700 hover:bg-gray-100 flex items-center gap-1"
          >
            <Pencil size={10} /> Rename
          </button>
          <button
            onClick={() => { isFocused ? onExitTeamFocus?.() : onEnterTeamFocus?.(team.id); setShowSettings(false); }}
            className={`w-full text-left px-2 py-1 text-[10px] flex items-center gap-1 ${isFocused ? "text-indigo-700 bg-indigo-50 font-medium" : "text-gray-700 hover:bg-gray-100"}`}
          >
            {isFocused ? <><Minimize2 size={10} /> Exit Focus</> : <><Maximize2 size={10} /> Focus Mode</>}
          </button>
          <button
            onClick={() => { handleDelete(); setShowSettings(false); }}
            className="w-full text-left px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 flex items-center gap-1"
          >
            <Trash2 size={10} /> Delete
          </button>
          <div className="my-0.5 border-t border-gray-100" />
          <button
            onClick={() => { onInsertTasks?.(team.id, team.name); setShowSettings(false); }}
            className="w-full text-left px-2 py-1 text-[10px] text-gray-700 hover:bg-gray-100 flex items-center gap-1"
          >
            <Upload size={10} /> Insert Tasks (JSON)
          </button>
          <button
            onClick={() => { onExportTeam?.(team.id); setShowSettings(false); }}
            className="w-full text-left px-2 py-1 text-[10px] text-gray-700 hover:bg-gray-100 flex items-center gap-1"
          >
            <Download size={10} /> Export Team
          </button>
          <div className="my-0.5 border-t border-gray-100" />
          <div className="px-2 py-0.5 text-[9px] text-gray-400 font-medium">View Mode</div>
          {["titles", "compact", "full"].map((m) => (
            <button
              key={m}
              onClick={() => { setTeamViewOverride?.(team.id, viewMode === m ? null : m); setShowSettings(false); }}
              className={`w-full text-left px-2 py-1 text-[10px] flex items-center gap-1 ${
                viewMode === m ? "text-indigo-700 bg-indigo-50 font-medium" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Eye size={10} /> {m === "titles" ? "Titles Only" : m === "compact" ? "Compact" : "Full View"}
            </button>
          ))}
        </div>
      )}

      {/* ── Task list inside container ── */}
      {!minimized && (
        <div
          ref={taskListRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-0.5 relative rounded-b-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${teamColor} 5%, white)` }}
          onMouseDown={handleTaskMarqueeStart}
        >
          {taskIds.length === 0 ? (
            <div className="text-center text-[10px] text-gray-300 py-4 italic">
              Drop tasks here
            </div>
          ) : (
            taskIds.map((taskId, i) => (
              <TaskCard
                key={taskId}
                task={tasks[taskId]}
                index={i}
                source={{ type: "team", teamId: team.id }}
                insideTeam
                teams={teams}
                dragging={dragging}
                dragSource={dragSource}
                hoverIndex={null}
                prevIndex={null}
                handleTaskDrag={handleTaskDrag}
                selectedTaskIds={selectedTaskIds}
                setSelectedTaskIds={setSelectedTaskIds}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                setConfirmModal={setConfirmModal}
                taskMode={taskMode}
                viewMode={viewMode}
                onToggleCriterion={onToggleCriterion}
                displayedTaskIds={taskIds}
                lastClickedTaskRef={lastClickedTaskRef}
              />
            ))
          )}

          {/* Task marquee overlay */}
          {taskMarquee && taskListRef.current && (() => {
            const listRect = taskListRef.current.getBoundingClientRect();
            const top = Math.min(taskMarquee.startY, taskMarquee.currentY) - listRect.top + taskListRef.current.scrollTop;
            const bottom = Math.max(taskMarquee.startY, taskMarquee.currentY) - listRect.top + taskListRef.current.scrollTop;
            const h = bottom - top;
            if (h < 5) return null;
            return (
              <div
                className="absolute left-0 right-0 border border-indigo-400 bg-indigo-100/20 rounded pointer-events-none z-40"
                style={{ top, height: h }}
              />
            );
          })()}
        </div>
      )}

      {/* ── Resize handle (bottom-right) — hidden in focus mode ── */}
      {!minimized && !isFocused && (
        <div
          onMouseDown={(e) => handleTeamResize(e, team.id)}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${teamColor} 50%)`,
            opacity: 0.4,
            borderRadius: "0 0 8px 0",
          }}
        />
      )}
    </div>
  );
}
