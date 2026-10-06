import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, clearToken } from '../lib/api';
import { allows, type Permission } from '../lib/permissions';
import type { AppNotification, User } from '../lib/types';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface AppContextValue {
  user: User;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  toasts: Toast[];
  showToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: number) => void;
  notifications: AppNotification[];
  unreadCount: number;
  refreshNotifications: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const NOTIFICATION_POLL_MS = 60_000;
let toastSeq = 0;

export function AppProvider({ user: initialUser, onSignedOut, children }: {
  user: User; onSignedOut: () => void; children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastSeq;
    setToasts(list => [...list, { id, type, message }]);
    timers.current.set(id, setTimeout(() => dismissToast(id), 4000));
  }, [dismissToast]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const refreshNotifications = useCallback(() => {
    api.get<{ unread: number; data: AppNotification[] }>('/admin/notifications')
      .then(res => { setNotifications(res.data); setUnreadCount(res.unread); })
      // The bell is non-critical; a failed poll just keeps the last known list.
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshNotifications();
    const t = setInterval(refreshNotifications, NOTIFICATION_POLL_MS);
    return () => clearInterval(t);
  }, [refreshNotifications]);

  const markNotificationRead = useCallback((id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.read) return;
    setNotifications(list => list.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    api.post(`/admin/notifications/${id}/read`).catch(refreshNotifications);
  }, [notifications, refreshNotifications]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(list => list.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    api.post('/admin/notifications/read-all').catch(refreshNotifications);
  }, [refreshNotifications]);

  const logout = useCallback(async () => {
    // Revoke the token server-side; even if that fails, forget it locally.
    await api.post('/auth/logout').catch(() => undefined);
    clearToken();
    onSignedOut();
  }, [onSignedOut]);

  return (
    <AppContext.Provider value={{
      user, setUser, logout,
      toasts, showToast, dismissToast,
      notifications, unreadCount, refreshNotifications, markNotificationRead, markAllNotificationsRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

/** Whether the signed-in staff member's role allows `permission` (see lib/permissions). */
export function useCan(permission: Permission): boolean {
  return allows(useApp().user.role, permission);
}
