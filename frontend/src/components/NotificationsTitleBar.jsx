import { Bell, Minus, Maximize2, Minimize2 } from "lucide-react";

/**
 * NotificationsTitleBar — draggable header for NotificationsWindow.
 *
 * Shows Bell icon, "Notifications" title, unread badge, and window controls.
 */
export default function NotificationsTitleBar({
  handleWindowDrag,
  toggleMaximize,
  isMaximized,
  minimizeWindow,
  unreadCount = 0,
}) {
  return (
    <div
      onMouseDown={handleWindowDrag}
      onDoubleClick={toggleMaximize}
      className="flex items-center justify-between px-3 py-2 cursor-move select-none
        bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700"
    >
      {/* Left — icon + title */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center">
          <Bell size={14} className="text-white" />
        </div>
        <span className="text-xs font-semibold text-white tracking-wide">
          Notifications
        </span>
        {unreadCount > 0 && (
          <span className="h-5 min-w-[20px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      {/* Right — window controls */}
      <div className="flex items-center gap-1">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={minimizeWindow}
          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={toggleMaximize}
          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}
