import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { BASE_URL } from '../config/api';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true); // ADD THIS
  const { isAuthenticated } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoadingNotifications(true); // ADD THIS
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const res = await fetch(
        `${BASE_URL}/api/notifications/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error('Failed to load notifications');

      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.notifications)
          ? data.notifications
          : Array.isArray(data.results)
            ? data.results
            : [];
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false); // ADD THIS
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.read).length
    : 0;

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch(
        `${BASE_URL}/api/notifications/${notificationId}/read/`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch(
        `${BASE_URL}/api/notifications/read-all/`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('access_token');
      await fetch(
        `${BASE_URL}/api/notifications/${notificationId}/delete/`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loadingNotifications, // ADD THIS
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
