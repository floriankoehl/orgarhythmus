import { useState, useRef } from "react";
import { Star, Pencil, Trash2, Save, Check, ArrowLeft, Users, ListTodo, LayoutGrid, PanelTop, PanelTopClose } from "lucide-react";
import WindowTitleBar from "../shared/WindowTitleBar";

const TAB_CONFIG = [
  { key: "canvas", label: "Canvas", Icon: LayoutGrid },
  { key: "tasks", label: "Tasks", Icon: ListTodo },
  { key: "teams", label: "Teams", Icon: Users },
];

/**
 * Title bar for TaskStructure floating window.
 *
 * Contains: tabs (Canvas|Tasks|Teams) or back-nav for detail views,
 * view selector + management panel (canvas tab only), standardized window controls.
 */
export default function TaskStructureTitleBar({
  handleWindowDrag,
  toggleMaximize,
  isMaximized,
  minimizeWindow,
  activeTeamColor,
  // Toolbar collapse
  toolbarCollapsed,
  toggleToolbar,
  // Tab navigation
  activeTab,
  setActiveTab,
  detailView,
  onBackFromDetail,
  // View management (canvas tab only)
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

  /* ── Views panel (right-aligned, canvas tab only) ── */
  const viewsPanel = (
    <div className={`relative ${activeTab !== "canvas" || detailView ? "invisible" : ""}`}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
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
          className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[9999]"
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
                      onClick={() => { loadView(v.id); setShowViewPanel(false); }}
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
  );

  return (
    <WindowTitleBar
      handleWindowDrag={handleWindowDrag}
      toggleMaximize={toggleMaximize}
      isMaximized={isMaximized}
      minimizeWindow={minimizeWindow}
      style={{
        background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #333))`,
      }}
      rightContent={
        <div className="flex items-center gap-1">
          {viewsPanel}
          {/* Toolbar toggle — only show on canvas tab */}
          {activeTab === "canvas" && !detailView && (
            <div onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => toggleToolbar?.()}
                className={`p-1 rounded transition-colors ${
                  toolbarCollapsed
                    ? "hover:bg-white/20 text-white/60 hover:text-white"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                title={toolbarCollapsed ? "Show toolbar" : "Hide toolbar"}
              >
                {toolbarCollapsed ? <PanelTop size={13} /> : <PanelTopClose size={13} />}
              </button>
            </div>
          )}
        </div>
      }
    >
      {/* Icon */}
      <LayoutGrid size={16} className="text-white/90 flex-shrink-0" />

      {detailView ? (
        /* ── Detail mode: back button + detail type label ── */
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={onBackFromDetail}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-white/90 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft size={14} />
          <span className="font-medium">
            {detailView.type === "task" ? "Task Detail" : "Team Detail"}
          </span>
        </button>
      ) : (
        /* ── Tab buttons ── */
        <div className="flex items-center gap-0.5 ml-1" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          {TAB_CONFIG.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                activeTab === key
                  ? "bg-white/25 text-white font-semibold"
                  : "text-white/60 hover:bg-white/15 hover:text-white/90"
              }`}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </WindowTitleBar>
  );
}
