import { useState, useRef } from "react";
import { Plus, Save, Pencil, Trash2, Eye } from "lucide-react";

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
  };

  const handleSaveView = () => {
    saveView(viewName.trim() || undefined, { groupBy });
    setViewName("");
    setShowSaveView(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 flex-shrink-0 border-b border-gray-200 bg-gray-50/80">
      {/* ── + Team ── */}
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
              if (e.key === "Escape") { setShowTeamForm(false); setNewTeamName(""); }
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
          <button
            onClick={() => { setShowTeamForm(false); setNewTeamName(""); }}
            className="text-[10px] px-1 py-0.5 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowTeamForm(true)}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-medium"
          title="Create new team"
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
