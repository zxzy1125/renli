import { create } from 'zustand';
import { notificationsApi, type Notification } from '@/lib/api';

interface NotificationState {
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: (page?: number) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollingTimer: ReturnType<typeof setInterval> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  notifications: [],
  loading: false,

  fetchUnreadCount: async () => {
    try {
      const count = await notificationsApi.unreadCount();
      set({ unreadCount: count });
    } catch {
      // 静默失败，轮询会重试
    }
  },

  fetchNotifications: async (page = 1) => {
    set({ loading: true });
    try {
      const res = await notificationsApi.list({ page, pageSize: 20 });
      set({ notifications: res.data ?? [] });
    } catch {
      // ignore
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (id: string) => {
    await notificationsApi.markRead(id);
    const { unreadCount } = get();
    set({
      notifications: get().notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: Math.max(0, unreadCount - 1),
    });
  },

  markAllRead: async () => {
    await notificationsApi.markAllRead();
    set({
      notifications: get().notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    });
  },

  startPolling: () => {
    if (pollingTimer) return;
    get().fetchUnreadCount();
    pollingTimer = setInterval(() => get().fetchUnreadCount(), 60000);
  },

  stopPolling: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  },
}));
