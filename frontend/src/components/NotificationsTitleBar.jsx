import { Bell } from "lucide-react";
import WindowTitleBar from "./shared/WindowTitleBar";

/**
 * NotificationsTitleBar — draggable header for NotificationsWindow.
 */
export default function NotificationsTitleBar({ unreadCount = 0, ...props }) {
  return (
    <WindowTitleBar {...props} className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
      <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center">
        <Bell size={14} className="text-white" />
      </div>
      <span className="text-xs font-semibold text-white tracking-wide">Notifications</span>
      {unreadCount > 0 && (
        <span className="h-5 min-w-[20px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </WindowTitleBar>
  );
}
