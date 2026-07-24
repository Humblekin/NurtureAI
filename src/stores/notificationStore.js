import { create } from 'zustand';
import { getUnreadNotifications, markNotificationRead, markAllRead } from '../services/reminderEngine';

/**
 * NurtureAI — Notification Store
 * Manages in-app notifications and reminders from the reminder engine.
 */
const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const notifications = await getUnreadNotifications();
      set({ notifications, unreadCount: notifications.length, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
    }
  },

  markRead: async (id) => {
    await markNotificationRead(id);
    const { notifications } = get();
    const updated = notifications.filter(n => n.id !== id);
    set({ notifications: updated, unreadCount: updated.length });
  },

  markAllRead: async () => {
    await markAllRead();
    set({ notifications: [], unreadCount: 0 });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

export default useNotificationStore;
