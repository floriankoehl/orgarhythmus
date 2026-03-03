import { useState } from "react";
import { Bell, CheckCircle2, Clock, Check, AlertCircle, CheckCheck } from "lucide-react";
import { useNotifications } from "../auth/NotificationContext";

/**
 * NotificationsContent — inner panel of the floating NotificationsWindow.
 *
 * Preserves all of the original NotificationsPanel functionality:
 * filter (all / unread), notification list with coloured cards,
 * mark-as-read, mark-all-as-read.
 */
export default function NotificationsContent() {
  const {
    notifications: rawNotifications,
    loadingNotifications = false,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const notifications = Array.isArray(rawNotifications) ? rawNotifications : [];
  const [filter, setFilter] = useState("unread");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const sortedNotifications = [...filteredNotifications].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  /* ── helpers ────────────────────────────────────────── */

  const getNotificationIcon = (actionType) => {
    switch (actionType) {
      case "attempt_overdue":
        return <AlertCircle size={16} className="text-red-600" />;
      case "attempt_today":
        return <AlertCircle size={16} className="text-orange-600" />;
      case "attempt_upcoming":
        return <Clock size={14} className="text-blue-500" />;
      case "task_assigned":
        return <CheckCircle2 size={14} className="text-blue-500" />;
      case "task_unassigned":
        return <Clock size={14} className="text-amber-500" />;
      case "team_joined":
        return <CheckCircle2 size={14} className="text-green-500" />;
      case "team_left":
        return <Clock size={14} className="text-red-500" />;
      default:
        return <Bell size={14} className="text-slate-500" />;
    }
  };

  const getNotificationColor = (actionType, read) => {
    if (actionType === "attempt_overdue") return "bg-red-50 border-l-4 border-red-600";
    if (actionType === "attempt_today") return "bg-orange-50 border-l-4 border-orange-600";
    if (read) return "bg-slate-50";
    switch (actionType) {
      case "attempt_upcoming":
        return "bg-blue-50 border-l-4 border-blue-400";
      case "task_assigned":
        return "bg-blue-50 border-l-4 border-blue-400";
      case "task_unassigned":
        return "bg-amber-50 border-l-4 border-amber-400";
      case "team_joined":
        return "bg-green-50 border-l-4 border-green-400";
      case "team_left":
        return "bg-red-50 border-l-4 border-red-400";
      default:
        return "bg-slate-50";
    }
  };

  const getTitleColor = (actionType) => {
    if (actionType === "attempt_overdue") return "text-red-900 font-bold";
    if (actionType === "attempt_today") return "text-orange-900 font-bold";
    return "text-slate-900 font-semibold";
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
  };

  /* ── render ─────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full">
      {/* ── Filter bar ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-white/95 sticky top-0 z-[1]">
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 text-[11px] rounded-full font-medium transition-colors ${
              filter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-2.5 py-1 text-[11px] rounded-full font-medium transition-colors ${
              filter === "unread"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Unread{unreadCount > 0 && ` (${unreadCount})`}
          </button>
        </div>

        {/* Mark all as read */}
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            title="Mark all as read"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* ── Notifications list ── */}
      <div className="flex-1 overflow-y-auto">
        {loadingNotifications ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-7 w-7 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
            <p className="text-xs text-slate-500 mt-3">Loading...</p>
          </div>
        ) : sortedNotifications.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {sortedNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 transition-colors ${getNotificationColor(notif.action_type, notif.read)}`}
              >
                <div className="flex gap-2.5">
                  {/* Icon */}
                  <div className="flex-shrink-0 pt-0.5">
                    {getNotificationIcon(notif.action_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={`text-xs ${getTitleColor(notif.action_type)}`}>
                          {notif.title}
                        </h3>
                        <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        {notif.related_task && (
                          <div className="mt-1.5 text-[10px] text-slate-600 bg-white/50 px-1.5 py-0.5 rounded inline-block">
                            Task: <span className="font-medium">{notif.related_task.name}</span>
                          </div>
                        )}
                        <div className="mt-1 text-[10px] text-slate-500">
                          {formatTime(notif.created_at)}
                        </div>
                      </div>

                      {/* Mark as read */}
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-1 hover:bg-white/50 rounded-lg transition-colors text-slate-400 hover:text-blue-600 flex-shrink-0"
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Bell size={28} className="text-slate-300" />
            </div>
            <h3 className="text-sm text-slate-900 font-semibold">No notifications</h3>
            <p className="text-xs text-slate-600 mt-1">
              {filter === "unread" ? "All caught up!" : "You are all set"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
