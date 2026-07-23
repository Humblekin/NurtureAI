import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * NurtureAI — App Store
 * 
 * Global application state: theme, network status, sidebar, notifications.
 */

const useAppStore = create(
  persist(
    (set, get) => ({
      // Theme
      theme: 'light',
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        set({ theme: newTheme });
      },
      initTheme: () => {
        const { theme } = get();
        document.documentElement.setAttribute('data-theme', theme);
      },

      // Network
      isOnline: navigator.onLine,
      setOnline: (isOnline) => set({ isOnline }),

      // Sidebar
      sidebarOpen: true,
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      collapseSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Mobile menu
      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

      // Sync status
      syncStatus: 'idle', // idle | syncing | synced | error
      setSyncStatus: (status) => set({ syncStatus: status }),
      pendingSyncCount: 0,
      setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

      // Toasts / Notifications
      toasts: [],
      addToast: (toast) => {
        const id = Date.now() + Math.random();
        const newToast = { id, duration: 5000, ...toast };
        set((s) => ({ toasts: [...s.toasts, newToast] }));

        // Auto-remove after duration
        if (newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, newToast.duration);
        }

        return id;
      },
      removeToast: (id) => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },
    }),
    {
      name: 'nurtureai-app',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

export default useAppStore;
