import { useState, useRef, useEffect } from "react";
import { Plus, Save, Pencil, Trash2, Eye, Hand, Move, Download, Upload, MoreVertical, Copy, ClipboardPaste, List, AlignLeft, FileText, Minimize2 } from "lucide-react";

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
  // import/export
  onExportProject,
  onImportProject,
  onImportTeams,
  onExportSelectedTeams,
  onExportSelectedTasks,
  selectedTeamIds,
  selectedTaskIds,
  viewMode = "compact",
  setViewMode,
  onFitAllTeams,
}) {
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#6366f1");
  const [showSaveView, setShowSaveView] = useState(false);
  const [viewName, setViewName] = useState("");
  const [showIoMenu, setShowIoMenu] = useState(false);

  const hasSelectedTeams = selectedTeamIds?.size > 0;
  const hasSelectedTasks = selectedTaskIds?.size > 0;

  // Auto-close team form when draw-to-create completes (drawTeamMode goes false externally)
  useEffect(() => {
    if (!drawTeamMode && showTeamForm) {
      setShowTeamForm(false);
      setNewTeamName("");
    }
  }, [drawTeamMode]);

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
        title={taskMode ? "Edit mode — drag tasks enabled (T)" : "Spectator mode — drag tasks disabled (T)"}
      >
        {taskMode ? <Move size={10} /> : <Hand size={10} />}
        {taskMode ? "Edit" : "Spectator"}
      </button>

      {/* Separator */}
      <div className="h-4 w-px bg-gray-300 mx-0.5" />

      {/* ── View mode pills: 1 Titles / 2 Compact / 3 Full ── */}
      <div className="flex items-center rounded-full bg-gray-100 p-0.5">
        {[
          { key: "titles", label: "1", icon: List, tip: "Titles only (1)" },
          { key: "compact", label: "2", icon: AlignLeft, tip: "Compact (2)" },
          { key: "full", label: "3", icon: FileText, tip: "Full view (3)" },
        ].map(({ key, label, icon: Icon, tip }) => (
          <button
            key={key}
            onClick={() => setViewMode?.(key)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded-full transition-colors ${
              viewMode === key
                ? "bg-white shadow-sm text-indigo-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
            title={tip}
          >
            <Icon size={9} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Fit All Teams ── */}
      <button
        onClick={onFitAllTeams}
        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 font-medium"
        title="Fit all teams into visible canvas area"
      >
        <Minimize2 size={10} /> Fit All
      </button>

      {/* ── Import / Export dropdown ── */}
      <div className="relative">
        <button
          onClick={() => setShowIoMenu((p) => !p)}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 font-medium"
          title="Import / Export"
        >
          <Download size={10} />
          I/O
        </button>

        {showIoMenu && (
          <div
            className="absolute right-0 top-full mt-0.5 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[190px] z-50"
            onMouseLeave={() => setShowIoMenu(false)}
          >
            {/* Export section */}
            <div className="px-2 py-0.5 text-[9px] text-gray-400 font-semibold uppercase">Export</div>
            <button
              onClick={() => { onExportProject?.(); setShowIoMenu(false); }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Download size={11} className="text-gray-400" /> Export All (Project)
            </button>
            {hasSelectedTeams && (
              <button
                onClick={() => { onExportSelectedTeams?.(); setShowIoMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 text-[11px] text-violet-700 hover:bg-violet-50 flex items-center gap-2"
              >
                <Copy size={11} className="text-violet-400" />
                Export {selectedTeamIds.size} Selected Team{selectedTeamIds.size > 1 ? "s" : ""}
              </button>
            )}
            {hasSelectedTasks && (
              <button
                onClick={() => { onExportSelectedTasks?.(); setShowIoMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 text-[11px] text-indigo-700 hover:bg-indigo-50 flex items-center gap-2"
              >
                <Copy size={11} className="text-indigo-400" />
                Export {selectedTaskIds.size} Selected Task{selectedTaskIds.size > 1 ? "s" : ""}
              </button>
            )}

            <div className="my-1 border-t border-gray-100" />

            {/* Import section */}
            <div className="px-2 py-0.5 text-[9px] text-gray-400 font-semibold uppercase">Import</div>
            <button
              onClick={() => { onImportProject?.(); setShowIoMenu(false); }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Upload size={11} className="text-gray-400" /> Import Full Project
            </button>
            <button
              onClick={() => { onImportTeams?.(); setShowIoMenu(false); }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <ClipboardPaste size={11} className="text-gray-400" /> Import Teams + Tasks
            </button>
          </div>
        )}
      </div>

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
