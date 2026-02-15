import { useState } from 'react';
import { X, Bell, CheckCircle2, Clock, Check, AlertCircle } from 'lucide-react';
import { useNotifications } from '../auth/NotificationContext';

export default function NotificationsPanel({ isOpen, onClose }) {
  const {
    notifications: rawNotifications,
    loadingNotifications = false, // ADD default value as safety
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  
  // Ensure notifications is always an array
  const notifications = Array.isArray(rawNotifications) ? rawNotifications : [];
  const [filter, setFilter] = useState('unread'); // 'all', 'unread' - default to unread

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  // Sort notifications: overdue first, then by creation date
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    if (a.action_type === 'attempt_overdue' && b.action_type !== 'attempt_overdue') return -1;
    if (a.action_type !== 'attempt_overdue' && b.action_type === 'attempt_overdue') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const getNotificationIcon = (actionType) => {
    switch (actionType) {
      case 'attempt_overdue':
        return <AlertCircle size={18} className="text-red-600" />;
      case 'attempt_today':
        return <AlertCircle size={18} className="text-orange-600" />;
      case 'attempt_upcoming':
        return <Clock size={16} className="text-blue-500" />;
      case 'task_assigned':
        return <CheckCircle2 size={16} className="text-blue-500" />;
      case 'task_unassigned':
        return <Clock size={16} className="text-amber-500" />;
      case 'team_joined':
        return <CheckCircle2 size={16} className="text-green-500" />;
      case 'team_left':
        return <Clock size={16} className="text-red-500" />;
      default:
        return <Bell size={16} className="text-slate-500" />;
    }
  };

  const getNotificationColor = (actionType, read) => {
    if (actionType === 'attempt_overdue') {
      return 'bg-red-50 border-l-4 border-red-600';
    }
    if (actionType === 'attempt_today') {
      return 'bg-orange-50 border-l-4 border-orange-600';
    }
    if (read) return 'bg-slate-50';
    
    switch (actionType) {
      case 'attempt_upcoming':
        return 'bg-blue-50 border-l-4 border-blue-400';
      case 'task_assigned':
        return 'bg-blue-50 border-l-4 border-blue-400';
      case 'task_unassigned':
        return 'bg-amber-50 border-l-4 border-amber-400';
      case 'team_joined':
        return 'bg-green-50 border-l-4 border-green-400';
      case 'team_left':
        return 'bg-red-50 border-l-4 border-red-400';
      default:
        return 'bg-slate-50';
    }
  };

  const getTitleColor = (actionType) => {
    if (actionType === 'attempt_overdue') {
      return 'text-red-900 font-bold';
    }
    if (actionType === 'attempt_today') {
      return 'text-orange-900 font-bold';
    }
    return 'text-slate-900 font-semibold';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <Bell size={18} className="text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Filters */}
        <div className="border-b border-slate-200 p-3 flex gap-2 sticky top-16 bg-white/95">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Unread
          </button>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto h-[calc(100vh-140px)]">
          {loadingNotifications ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 mt-3">Loading...</p>
            </div>
          ) : sortedNotifications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {sortedNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 transition-colors ${getNotificationColor(notif.action_type, notif.read)}`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 pt-1">
                      {getNotificationIcon(notif.action_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`text-sm ${getTitleColor(notif.action_type)}`}>
                            {notif.title}
                          </h3>
                          <p className="text-sm text-slate-700 mt-1 line-clamp-2">
                            {notif.message}
                          </p>
                          {notif.related_task && (
                            <div className="mt-2 text-xs text-slate-600 bg-white/50 px-2 py-1 rounded inline-block">
                              Task: <span className="font-medium">{notif.related_task.name}</span>
                            </div>
                          )}
                          <div className="mt-2 text-xs text-slate-500">
                            {formatTime(notif.created_at)}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-shrink-0">
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="p-1.5 hover:bg-white/50 rounded-lg transition-colors text-slate-500 hover:text-blue-600"
                              title="Mark as read"
                            >
                              <Check size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Bell size={32} className="text-slate-300" />
              </div>
              <h3 className="text-slate-900 font-semibold">No notifications</h3>
              <p className="text-sm text-slate-600 mt-1">
                {filter === 'unread' ? 'All caught up!' : 'You are all set'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
