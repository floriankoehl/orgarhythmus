import {
  Minus,
  Maximize2,
  Minimize2,
  UserCircle,
} from "lucide-react";

/**
 * ProfileTitleBar — title bar for ProfileWindow.
 *
 * Contains: drag handle, icon + title, window controls (minimize/maximize).
 */
export default function ProfileTitleBar({
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
        bg-gradient-to-r from-cyan-500 to-blue-600 border-b border-cyan-600/30"
    >
      {/* Icon */}
      <UserCircle size={16} className="text-white/90 flex-shrink-0" />

      {/* Title */}
      <span className="text-[12px] font-semibold text-white truncate">
        Profile
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
          <Minus size={14} />
        </button>
        <button
          onClick={toggleMaximize}
          className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}
