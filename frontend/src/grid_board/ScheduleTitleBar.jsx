import { Minus, Maximize2, Minimize2, CalendarRange } from "lucide-react";

/**
 * Title bar for the Schedule floating window — mirrors IdeaBinTitleBar / TaskStructureTitleBar.
 *
 * Contains: drag handle, icon + title, window controls (minimize, maximize/restore).
 */
export default function ScheduleTitleBar({
  handleWindowDrag,
  toggleMaximize,
  isMaximized,
  minimizeWindow,
}) {
  return (
    <div
      onMouseDown={handleWindowDrag}
      onDoubleClick={toggleMaximize}
      className="flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing flex-shrink-0 select-none
        bg-gradient-to-r from-sky-500 to-blue-600 border-b border-sky-600/30"
    >
      {/* Icon */}
      <CalendarRange size={16} className="text-white/90 flex-shrink-0" />

      {/* Title */}
      <span className="text-[12px] font-semibold text-white truncate">
        Schedule
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Window controls */}
      <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={minimizeWindow}
          className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={toggleMaximize}
          className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  );
}
