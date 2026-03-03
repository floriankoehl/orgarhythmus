import {
  Lightbulb, Minus, Maximize2, Minimize2, List, Save, FolderOpen,
  Trash2, Pencil, Check, Palette, Layers, ChevronDown, Star,
} from "lucide-react";
import WindowTitleBar from "../shared/WindowTitleBar";

// ─── Draggable title bar with context selector, color picker,
//     formations panel, and window controls ───
export default function IdeaBinTitleBar({
  // window
  handleWindowDrag, toggleMaximize, isMaximized, minimizeWindow,
  // context
  activeContext,
  showContextSelector, setShowContextSelector,
  fetch_contexts_for_selector,
  contextsList, setContextsList,
  enterContext, exitContext, toggle_default_context,
  // color picker
  showContextColorPicker, setShowContextColorPicker,
  updateActiveContextColor,
  // counters / view
  effectiveUnassignedCount, viewMode,
  // meta list
  showMetaList, setShowMetaList,
  // paste
  copiedIdeaId, paste_idea, selectedCategoryIds, categories,
  // formations
  showFormationPanel, setShowFormationPanel,
  formations, formationName, setFormationName,
  editingFormationId, setEditingFormationId,
  editingFormationName, setEditingFormationName,
  save_formation, update_formation_state, rename_formation,
  load_formation, delete_formation, toggle_default_formation,
}) {
  const iconColor = activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 65%, #333)` : "#92400e";

  const rightContent = (
    <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {viewMode === "ideas" && (
        <button
          onClick={() => setShowMetaList(v => !v)}
          className={`p-1 rounded transition-colors ${showMetaList ? "bg-black/10" : "hover:bg-black/10"}`}
          title="All Ideas (Meta View)"
        >
          <List size={13} style={{ color: iconColor }} />
        </button>
      )}
      {viewMode === "ideas" && copiedIdeaId && (
        <button
          onClick={() => paste_idea([...selectedCategoryIds][0] || null)}
          className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-semibold hover:bg-indigo-200 transition-colors"
          title={`Paste copied idea${selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] ? ` into "${categories[[...selectedCategoryIds][0]].name}"` : " (unassigned)"} (Ctrl+V)`}
        >
          Paste{selectedCategoryIds.size === 1 && categories[[...selectedCategoryIds][0]] ? ` → ${categories[[...selectedCategoryIds][0]].name}` : ""}
        </button>
      )}
      {/* ── Formations dropdown ── */}
      <div className="relative">
        <button
          onClick={() => setShowFormationPanel(v => !v)}
          className={`p-1 rounded transition-colors ${showFormationPanel ? "bg-black/10" : "hover:bg-black/10"}`}
          title="Formations — save / load layout"
        >
          <Save size={13} style={{ color: iconColor }} />
        </button>
        {showFormationPanel && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => { setShowFormationPanel(false); setEditingFormationId(null); }} />
            <div
              className="absolute right-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[220px] max-h-[340px] overflow-y-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-3 pb-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Formations{activeContext ? ` — ${activeContext.name}` : ""}</div>
              {/* Save new */}
              {!activeContext ? (
                <div className="px-3 py-1.5 text-[10px] text-gray-400 italic">Enter a context to manage formations</div>
              ) : (
              <div className="px-2 pb-1.5 flex items-center gap-1">
                <input
                  type="text"
                  value={formationName}
                  onChange={(e) => setFormationName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && formationName.trim()) { save_formation(formationName.trim()); } }}
                  placeholder="New formation name…"
                  className="flex-1 text-[11px] px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => { if (formationName.trim()) save_formation(formationName.trim()); }}
                  disabled={!formationName.trim()}
                  className="p-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-40 transition-colors"
                  title="Save current layout"
                >
                  <Save size={12} />
                </button>
              </div>
              )}
              {formations.length === 0 && (
                <div className="px-3 py-2 text-[10px] text-gray-400 italic">No saved formations yet</div>
              )}
              {formations.map(f => (
                <div key={f.id} className="group flex items-center gap-1 px-2 py-1 hover:bg-gray-50 transition-colors">
                  {editingFormationId === f.id ? (
                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={editingFormationName}
                        onChange={(e) => setEditingFormationName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editingFormationName.trim()) {
                            rename_formation(f.id, editingFormationName.trim());
                            setEditingFormationId(null);
                          }
                          if (e.key === "Escape") setEditingFormationId(null);
                        }}
                        className="flex-1 text-[11px] px-1.5 py-0.5 rounded border border-gray-200 focus:outline-none focus:border-amber-400"
                      />
                      <Check
                        size={12}
                        onClick={() => { if (editingFormationName.trim()) { rename_formation(f.id, editingFormationName.trim()); setEditingFormationId(null); } }}
                        className="cursor-pointer text-green-500 hover:text-green-700 flex-shrink-0"
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => { load_formation(f.id); setShowFormationPanel(false); }}
                        className="flex-1 text-left text-[11px] text-gray-700 hover:text-amber-700 truncate"
                        title={`Load "${f.name}"`}
                      >
                        <FolderOpen size={11} className="inline mr-1 text-amber-500" />
                        {f.name}
                      </button>
                      <Star
                        size={11}
                        onClick={() => toggle_default_formation(f.id)}
                        className={`cursor-pointer flex-shrink-0 transition-opacity ${f.is_default ? "text-amber-400 fill-amber-400 opacity-100" : "text-gray-300 hover:text-amber-400! opacity-0 group-hover:opacity-100"}`}
                        title={f.is_default ? "Remove as default" : "Set as default (auto-load on open)"}
                      />
                      <Save
                        size={11}
                        onClick={() => update_formation_state(f.id)}
                        className="cursor-pointer text-gray-300 hover:text-amber-500! flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Overwrite with current layout"
                      />
                      <Pencil
                        size={11}
                        onClick={() => { setEditingFormationId(f.id); setEditingFormationName(f.name); }}
                        className="cursor-pointer text-gray-300 hover:text-blue-500! flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Rename"
                      />
                      <Trash2
                        size={11}
                        onClick={() => delete_formation(f.id)}
                        className="cursor-pointer text-gray-300 hover:text-red-500! flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {/* ── Window controls (custom-styled for light bg) ── */}
      <button
        onClick={minimizeWindow}
        className="p-1 rounded hover:bg-black/10 transition-colors"
        title="Collapse"
      >
        <Minus size={13} style={{ color: iconColor }} />
      </button>
      <button
        onClick={toggleMaximize}
        className="p-1 rounded hover:bg-black/10 transition-colors"
        title={isMaximized ? "Restore size" : "Full screen"}
      >
        {isMaximized
          ? <Minimize2 size={13} style={{ color: iconColor }} />
          : <Maximize2 size={13} style={{ color: iconColor }} />
        }
      </button>
    </div>
  );

  return (
    <WindowTitleBar
      handleWindowDrag={handleWindowDrag}
      toggleMaximize={toggleMaximize}
      isMaximized={isMaximized}
      minimizeWindow={minimizeWindow}
      className={`border-b ${
        activeContext?.color
          ? "border-gray-300/50"
          : "bg-gradient-to-r from-amber-400 to-yellow-400 border-amber-500/30"
      }`}
      style={activeContext?.color ? {
        background: `linear-gradient(to right, ${activeContext.color}88, ${activeContext.color}55)`,
      } : undefined}
      controls={false}
      rightContent={rightContent}
    >
      <Lightbulb size={16} className={activeContext?.color ? "text-gray-800" : "text-amber-800"} />
      <span className={`text-sm font-semibold ${activeContext?.color ? "text-gray-900" : "text-amber-900"}`}>
        Ideas
      </span>

      {/* ── Context selector dropdown ── */}
      <div className="relative" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => { setShowContextSelector(p => !p); if (!showContextSelector) fetch_contexts_for_selector(); }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
            activeContext
              ? "bg-white/30 text-gray-800 hover:bg-white/50"
              : "bg-amber-600/15 text-amber-800 hover:bg-amber-600/25"
          }`}
          title="Select context"
        >
          <Layers size={10} />
          {activeContext ? activeContext.name : "All"}
          <ChevronDown size={10} />
        </button>
        {showContextSelector && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowContextSelector(false)} />
            <div className="absolute left-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[150px] max-h-[240px] overflow-y-auto">
              {/* "All" option (no context) */}
              <button
                onClick={() => { exitContext(); setShowContextSelector(false); }}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${
                  !activeContext ? "bg-amber-100 text-amber-800 font-medium" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
                All (no context)
              </button>
              {contextsList.map(ctx => (
                <div
                  key={ctx.id}
                  className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${
                    activeContext?.id === ctx.id ? "bg-amber-100 text-amber-800 font-medium" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {/* Default-context star toggle */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const result = await toggle_default_context(ctx.id);
                      if (result) {
                        setContextsList(prev => prev.map(c => ({ ...c, is_default: c.id === ctx.id ? result.is_default : false })));
                      }
                    }}
                    className="flex-shrink-0"
                    title={ctx.is_default ? "Remove as default context" : "Set as default context"}
                  >
                    <Star size={10} className={ctx.is_default ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-400"} />
                  </button>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-200"
                    style={{ backgroundColor: ctx.color || "#94a3b8" }}
                  />
                  <button
                    className="truncate flex-1 text-left"
                    onClick={() => { enterContext(ctx); setShowContextSelector(false); }}
                  >
                    {ctx.name}
                  </button>
                </div>
              ))}
              {contextsList.length === 0 && (
                <div className="px-3 py-1.5 text-[10px] text-gray-400 italic">No contexts yet</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Color picker — only when inside a context */}
      {activeContext && (
        <div className="relative" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowContextColorPicker(p => !p)}
            className="p-0.5 rounded hover:bg-white/30 transition-colors"
            title="Context color"
          >
            <Palette size={12} style={{ color: activeContext.color || "#6b7280" }} />
          </button>
          {showContextColorPicker && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setShowContextColorPicker(false)} />
              <div className="absolute left-0 top-full mt-1 z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[140px]">
                <div className="text-[10px] font-semibold text-gray-500 mb-1.5">Context Color</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"].map(c => (
                    <button
                      key={c}
                      onClick={() => { updateActiveContextColor(c); setShowContextColorPicker(false); }}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${activeContext.color === c ? "border-gray-800 scale-110" : "border-gray-200"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                {activeContext.color && (
                  <button
                    onClick={() => { updateActiveContextColor(null); setShowContextColorPicker(false); }}
                    className="text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Remove color
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {effectiveUnassignedCount > 0 && viewMode === "ideas" && (
        <span
          className="text-[10px] px-1.5 rounded-full font-medium"
          style={{
            backgroundColor: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 20%, transparent)` : "rgba(217,119,6,0.2)",
            color: activeContext?.color ? `color-mix(in srgb, ${activeContext.color} 70%, #333)` : "#92400e",
          }}
        >
          {effectiveUnassignedCount}
        </span>
      )}
    </WindowTitleBar>
  );
}
