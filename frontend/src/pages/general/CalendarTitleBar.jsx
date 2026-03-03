import {
  Calendar as CalendarIcon,
  ArrowLeftRight,
  ArrowUpDown,
} from "lucide-react";
import WindowTitleBar from "../../components/shared/WindowTitleBar";

/**
 * CalendarTitleBar — title bar for CalendarWindow.
 *
 * Contains: icon + title, view-mode button group,
 * transpose toggle (for 3d/7d), standardized window controls.
 */

const VIEW_OPTIONS = [
  { key: "auto", label: "Auto" },
  { key: "3d", label: "3 Days" },
  { key: "7d", label: "7 Days" },
  { key: "1m", label: "Month" },
];

export default function CalendarTitleBar({
  handleWindowDrag,
  toggleMaximize,
  isMaximized,
  minimizeWindow,
  viewMode,
  setViewMode,
  effectiveView,
  transposed,
  setTransposed,
}) {
  const showTranspose = effectiveView === "3d" || effectiveView === "7d";

  return (
    <WindowTitleBar
      handleWindowDrag={handleWindowDrag}
      toggleMaximize={toggleMaximize}
      isMaximized={isMaximized}
      minimizeWindow={minimizeWindow}
      className="bg-gradient-to-r from-emerald-500 to-teal-600 border-b border-emerald-600/30"
    >
      {/* Icon */}
      <CalendarIcon size={16} className="text-white/90 flex-shrink-0" />

      {/* Title */}
      <span className="text-[12px] font-semibold text-white truncate">
        Calendar
      </span>

      {/* ── View mode button group ── */}
      <div
        className="flex items-center ml-2 rounded-md overflow-hidden border border-white/20"
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {VIEW_OPTIONS.map(({ key, label }) => {
          const isActive = viewMode === key;
          return (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-white/30 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/15 hover:text-white/90"
              }`}
            >
              {label}
              {key === "auto" && viewMode === "auto" && (
                <span className="ml-0.5 text-[9px] opacity-70">
                  ({effectiveView === "3d" ? "3D" : effectiveView === "7d" ? "7D" : "M"})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Transpose toggle (only for 3d / 7d views) ── */}
      {showTranspose && (
        <button
          onClick={() => setTransposed((t) => !t)}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className={`p-1 rounded transition-colors ml-1 ${
            transposed
              ? "bg-white/30 text-white"
              : "hover:bg-white/20 text-white/60 hover:text-white"
          }`}
          title={transposed ? "Switch to horizontal layout" : "Switch to vertical layout"}
        >
          {transposed ? <ArrowUpDown size={13} /> : <ArrowLeftRight size={13} />}
        </button>
      )}
    </WindowTitleBar>
  );
}
