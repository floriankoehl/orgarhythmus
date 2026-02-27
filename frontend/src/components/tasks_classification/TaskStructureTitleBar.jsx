import { useState, useRef } from "react";
import { Minus, Maximize2, Minimize2, X, LayoutGrid } from "lucide-react";

/**
 * Title bar for TaskStructure floating window — mirrors IdeaBinTitleBar.
 *
 * Contains: drag handle, title, view selector, window controls.
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
  activeViewIdx,
  loadView,
  saveView,
  showViewPanel,
  setShowViewPanel,
}) {
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  const accentColor = activeTeamColor || "#6366f1"; // indigo default

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

      {/* ── Group-by selector ── */}
      <div className="relative ml-auto">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setShowViewDropdown((p) => !p)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/90 hover:bg-white/20 transition-colors"
          title="Change grouping"
        >
          <span className="font-medium">
            {groupBy === "team" ? "By Team" : "By Legend"}
          </span>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5l3 3 3-3z" />
          </svg>
        </button>

        {showViewDropdown && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 py-1 min-w-[140px] z-50"
          >
            <button
              onClick={() => { setGroupBy("team"); setShowViewDropdown(false); }}
              className={`w-full text-left px-3 py-1 text-[11px] hover:bg-gray-100 ${groupBy === "team" ? "font-bold text-indigo-600" : "text-gray-700"}`}
            >
              By Team
            </button>
            <div className="border-t border-gray-100 my-0.5" />
            <div className="px-3 py-0.5 text-[9px] text-gray-400 font-medium uppercase">Saved Views</div>
            {views.length === 0 && (
              <div className="px-3 py-1 text-[10px] text-gray-400 italic">No saved views</div>
            )}
            {views.map((v, i) => (
              <button
                key={i}
                onClick={() => { loadView(i); setShowViewDropdown(false); }}
                className={`w-full text-left px-3 py-1 text-[11px] hover:bg-gray-100 ${activeViewIdx === i ? "font-bold text-indigo-600" : "text-gray-700"}`}
              >
                {v.name}
              </button>
            ))}
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
