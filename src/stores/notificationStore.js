import { create } from 'zustand';
import { getUnreadNotifications, markNotificationRead, markAllRead } from '../services/reminderEngine';

/**
 * NurtureAI — Notification Store
 * Manages in-app notifications and reminders from the reminder engine.
 * All operations are scoped to the current user's profile ID.
 */
const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (userId) => {
    set({ isLoading: true });
    try {
      const notifications = await getUnreadNotifications(userId);
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

  markAllRead: async (userId) => {
    await markAllRead(userId);
    set({ notifications: [], unreadCount: 0 });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  /**
   * Reset store state — called on logout to prevent data leaking between users.
   */
  reset: () => set({ notifications: [], unreadCount: 0, isLoading: false }),
}));

export default useNotificationStore;
