import { useState, useRef, useEffect } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, ChevronDown, Save, Star, Plus, PanelTop, PanelTopClose, Sparkles } from "lucide-react";
import WindowTitleBar from "../components/shared/WindowTitleBar";

/**
 * Title bar for the Schedule floating window.
 *
 * Contains: icon + title, view selector, toolbar toggle, standardized window controls.
 */
export default function ScheduleTitleBar({
  handleWindowDrag,
  toggleMaximize,
  isMaximized,
  minimizeWindow,
  viewBar = {},
}) {
  const {
    savedViews = [],
    activeViewId,
    activeViewName,
    onLoadView,
    onSaveView,
    onNextView,
    onPrevView,
    onCreateView,
    toolbarCollapsed,
    toggleToolbar,
    // AI IO
    ioPopupOpen,
    setIoPopupOpen,
    ioPopupContent,
  } = viewBar;

  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setIsCreating(false);
        setNewName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const hasViews = savedViews.length > 0 || activeViewId;

  const toolbarToggle = (
    <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {/* AI IO button */}
      <div className="relative">
        <button
          onClick={() => setIoPopupOpen?.((v) => !v)}
          className={`p-1 rounded transition-colors ${
            ioPopupOpen
              ? "bg-white/30 text-white"
              : "hover:bg-white/20 text-white/70 hover:text-white"
          }`}
          title="AI I/O — Dependency Prompts"
        >
          <Sparkles size={13} />
        </button>
        {ioPopupOpen && ioPopupContent}
      </div>
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
  );

  return (
    <WindowTitleBar
      handleWindowDrag={handleWindowDrag}
      toggleMaximize={toggleMaximize}
      isMaximized={isMaximized}
      minimizeWindow={minimizeWindow}
      className="bg-gradient-to-r from-sky-500 to-blue-600 border-b border-sky-600/30"
      rightContent={toolbarToggle}
    >
      {/* Icon */}
      <CalendarRange size={16} className="text-white/90 flex-shrink-0" />

      {/* Title */}
      <span className="text-[12px] font-semibold text-white truncate">
        Schedule
      </span>

      {/* ── View selector ── */}
      <div className="relative flex items-center gap-0.5 ml-2" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} ref={dropdownRef}>
        {/* Prev arrow */}
        {hasViews && (
          <button
            onClick={() => onPrevView?.()}
            className="p-0.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title="Previous view"
          >
            <ChevronLeft size={13} />
          </button>
        )}

        {/* Current view name + dropdown toggle */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors min-w-0 max-w-[160px] ${
            showDropdown
              ? "bg-white/30 text-white"
              : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
          }`}
        >
          <span className="truncate">{activeViewName || "Default"}</span>
          <ChevronDown size={11} className="flex-shrink-0 opacity-70" />
        </button>

        {/* Next arrow */}
        {hasViews && (
          <button
            onClick={() => onNextView?.()}
            className="p-0.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            title="Next view"
          >
            <ChevronRight size={13} />
          </button>
        )}

        {/* Save active view */}
        {activeViewId && (
          <button
            onClick={() => onSaveView?.()}
            className="p-0.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors ml-0.5"
            title={`Save "${activeViewName}"`}
          >
            <Save size={12} />
          </button>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div
            className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-xl z-[200]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 space-y-0.5">
              {/* Default view */}
              <button
                onClick={() => { onLoadView?.(null); setShowDropdown(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                  !activeViewId ? "bg-sky-50 text-sky-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Default
              </button>

              {/* Saved views */}
              {savedViews.length > 0 && (
                <div className="border-t border-slate-100 pt-1 mt-1 space-y-0.5">
                  {savedViews.map((view) => (
                    <button
                      key={view.id}
                      onClick={() => { onLoadView?.(view); setShowDropdown(false); }}
                      className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded text-xs transition ${
                        activeViewId === view.id
                          ? "bg-sky-50 text-sky-700 font-semibold"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {view.is_default && <Star size={11} className="text-amber-500 flex-shrink-0" />}
                      <span className="truncate">{view.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Create new view */}
              <div className="border-t border-slate-100 pt-1 mt-1">
                {isCreating ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newName.trim()) {
                        onCreateView?.(newName.trim());
                        setNewName("");
                        setIsCreating(false);
                        setShowDropdown(false);
                      }
                    }}
                  >
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="View name…"
                      autoFocus
                      className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-sky-400"
                      onKeyDown={(e) => { if (e.key === "Escape") { setIsCreating(false); setNewName(""); } }}
                    />
                    <button
                      type="submit"
                      disabled={!newName.trim()}
                      className="px-2 py-1 text-xs rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 transition"
                    >
                      Create
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition"
                  >
                    <Plus size={12} />
                    <span>New View</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </WindowTitleBar>
  );
}
