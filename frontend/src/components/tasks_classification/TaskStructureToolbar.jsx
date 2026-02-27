import { useState, useRef } from "react";
import { Plus, Save, Pencil, Trash2, Eye, Hand, Move } from "lucide-react";

/**
 * Toolbar strip between title bar and content area.
 *
 * Houses: + Team button, view save, filters (future).
 */
export default function TaskStructureToolbar({
  // team creation
  onCreateTeam,
  // views
  groupBy,
  views,
  saveView,
  // task creation
  onCreateTask,
  // counts
  taskCount,
  teamCount,
  // modes
  taskMode = false,
  setTaskMode,
  drawTeamMode = false,
  setDrawTeamMode,
}) {
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#6366f1");
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState("");

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    onCreateTeam(newTeamName.trim(), newTeamColor);
    setNewTeamName("");
    setShowTeamForm(false);
    setDrawTeamMode?.(false);
  };

  const handleSaveView = () => {
    saveView(viewName.trim() || undefined, { groupBy });
    setViewName("");
    setShowSaveView(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 flex-shrink-0 border-b border-gray-200 bg-gray-50/80">
      {/* ── + Team (form + draw-to-create) ── */}
      {showTeamForm ? (
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={newTeamColor}
            onChange={(e) => setNewTeamColor(e.target.value)}
            className="w-5 h-5 rounded cursor-pointer border-0 p-0"
            title="Team color"
          />
          <input
            autoFocus
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateTeam();
              if (e.key === "Escape") { setShowTeamForm(false); setNewTeamName(""); setDrawTeamMode?.(false); }
            }}
            placeholder="Team name…"
            className="text-[11px] border border-gray-300 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-indigo-400"
          />
          <button
            onClick={handleCreateTeam}
            className="text-[10px] px-1.5 py-0.5 bg-indigo-500 text-white rounded hover:bg-indigo-600 font-medium"
          >
            Add
          </button>
          <span className="text-[10px] text-gray-400 italic">or draw on canvas</span>
          <button
            onClick={() => { setShowTeamForm(false); setNewTeamName(""); setDrawTeamMode?.(false); }}
            className="text-[10px] px-1 py-0.5 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setShowTeamForm(true); setDrawTeamMode?.(true); }}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${
            drawTeamMode
              ? "bg-amber-100 text-amber-700 border-amber-300 animate-pulse"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
          }`}
          title="Create new team (type name or draw on canvas)"
        >
          <Plus size={10} /> Team
        </button>
      )}

      {/* ── + Task ── */}
      <button
        onClick={onCreateTask}
        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-medium"
        title="Create new task"
      >
        <Plus size={10} /> Task
      </button>

      {/* Separator */}
      <div className="h-4 w-px bg-gray-300 mx-0.5" />

      {/* ── Task / Spectator mode toggle ── */}
      <button
        onClick={() => setTaskMode?.((prev) => !prev)}
        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${
          taskMode
            ? "bg-violet-100 text-violet-700 border-violet-300"
            : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
        }`}
        title={taskMode ? "Task mode — drag tasks enabled (T)" : "Spectator mode — drag tasks disabled (T)"}
      >
        {taskMode ? <Move size={10} /> : <Hand size={10} />}
        {taskMode ? "Task" : "Spectator"}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Stats ── */}
      <span className="text-[10px] text-gray-400">
        {taskCount} task{taskCount !== 1 ? "s" : ""} · {teamCount} team{teamCount !== 1 ? "s" : ""}
      </span>

      {/* ── Save View ── */}
      {showSaveView ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveView();
              if (e.key === "Escape") { setShowSaveView(false); setViewName(""); }
            }}
            placeholder="View name…"
            className="text-[10px] border border-gray-300 rounded px-1.5 py-0.5 w-24 focus:outline-none focus:border-indigo-400"
          />
          <button onClick={handleSaveView} className="text-indigo-500 hover:text-indigo-700">
            <Save size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveView(true)}
          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-gray-500 hover:bg-gray-100"
          title="Save current view"
        >
          <Eye size={10} /> Save View
        </button>
      )}
    </div>
  );
}
