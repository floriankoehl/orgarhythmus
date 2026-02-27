import { useState, useRef } from "react";
import { Minus, Maximize2, Minimize2, X, LayoutGrid, Star, Pencil, Trash2, Save, Check } from "lucide-react";

/**
 * Title bar for TaskStructure floating window — mirrors IdeaBinTitleBar.
 *
 * Contains: drag handle, title, view selector + management panel, window controls.
 */
export default function TaskStructureTitleBar({
  handleWindowDrag,
  toggleMaximize,
  isMaximized,
  minimizeWindow,
  activeTeamColor,
  groupBy,
  setGroupBy,
  teams,
  views,
  loadView,
  saveView,
  updateViewState,
  deleteView,
  renameView,
  toggleDefault,
  showViewPanel,
  setShowViewPanel,
  viewName,
  setViewName,
  editingViewId,
  setEditingViewId,
  editingViewName,
  setEditingViewName,
}) {
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const inputRef = useRef(null);

  const accentColor = activeTeamColor || "#6366f1"; // indigo default

  const handleSave = () => {
    const name = viewName.trim();
    if (!name) return;
    saveView(name);
    setViewName("");
  };

  const handleRenameSubmit = (viewId) => {
    const name = editingViewName.trim();
    if (!name) return;
    renameView(viewId, name);
    setEditingViewId(null);
    setEditingViewName("");
  };

  return (
    <div
      onMouseDown={handleWindowDrag}
      onDoubleClick={toggleMaximize}
      className="flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing flex-shrink-0 select-none"
      style={{
        background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #333))`,
      }}
    >
      {/* Icon */}
      <LayoutGrid size={16} className="text-white/90 flex-shrink-0" />

      {/* Title */}
      <span className="text-[12px] font-semibold text-white truncate">
        Task Structure
      </span>

      {/* ── View selector ── */}
      <div className="relative ml-auto">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setShowViewPanel((p) => !p)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/90 hover:bg-white/20 transition-colors"
          title="Views"
        >
          <span className="font-medium">Views</span>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5l3 3 3-3z" />
          </svg>
        </button>

        {showViewPanel && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
            style={{ minWidth: 260, maxHeight: 400, overflowY: "auto" }}
          >
            {/* ── Save new view ── */}
            <div className="px-3 pb-2 border-b border-gray-100">
              <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Save Current Layout</div>
              <div className="flex gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                  placeholder="View name…"
                  className="flex-1 px-2 py-1 text-[11px] bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-indigo-400"
                />
                <button
                  onClick={handleSave}
                  disabled={!viewName.trim()}
                  className="px-2 py-1 text-[10px] font-medium text-white bg-indigo-500 rounded hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={12} />
                </button>
              </div>
            </div>

            {/* ── Saved views list ── */}
            <div className="pt-1">
              <div className="px-3 py-0.5 text-[9px] text-gray-400 font-semibold uppercase tracking-wider">
                Saved Views {views.length > 0 && `(${views.length})`}
              </div>

              {views.length === 0 && (
                <div className="px-3 py-2 text-[10px] text-gray-400 italic">No saved views yet</div>
              )}

              {views.map((v) => (
                <div
                  key={v.id}
                  className="group flex items-center gap-1 px-3 py-1 hover:bg-gray-50 transition-colors"
                >
                  {editingViewId === v.id ? (
                    /* Rename inline */
                    <div className="flex-1 flex gap-1">
                      <input
                        type="text"
                        value={editingViewName}
                        onChange={(e) => setEditingViewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSubmit(v.id);
                          if (e.key === "Escape") { setEditingViewId(null); setEditingViewName(""); }
                        }}
                        autoFocus
                        className="flex-1 px-1.5 py-0.5 text-[11px] border border-gray-200 rounded focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={() => handleRenameSubmit(v.id)}
                        className="p-0.5 text-green-600 hover:text-green-700"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Name — click to load */}
                      <button
                        onClick={() => loadView(v.id)}
                        className="flex-1 text-left text-[11px] text-gray-700 hover:text-indigo-600 truncate font-medium"
                        title={`Load "${v.name}"`}
                      >
                        {v.name}
                      </button>

                      {/* Default star */}
                      <button
                        onClick={() => toggleDefault(v.id)}
                        className={`p-0.5 transition-colors ${v.is_default ? "text-amber-500" : "text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-400"}`}
                        title={v.is_default ? "Remove as default" : "Set as default"}
                      >
                        <Star size={12} fill={v.is_default ? "currentColor" : "none"} />
                      </button>

                      {/* Overwrite (save current state into this view) */}
                      <button
                        onClick={() => updateViewState(v.id)}
                        className="p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-indigo-500 transition-colors"
                        title="Overwrite with current layout"
                      >
                        <Save size={12} />
                      </button>

                      {/* Rename */}
                      <button
                        onClick={() => { setEditingViewId(v.id); setEditingViewName(v.name); }}
                        className="p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-blue-500 transition-colors"
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteView(v.id)}
                        className="p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Window controls ── */}
      <div className="flex items-center gap-0.5 ml-2" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={minimizeWindow}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
          title="Minimize"
        >
          <Minus size={14} className="text-white" />
        </button>
        <button
          onClick={toggleMaximize}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Minimize2 size={13} className="text-white" /> : <Maximize2 size={13} className="text-white" />}
        </button>
      </div>
    </div>
  );
}
