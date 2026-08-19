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

      // Currently selected patient (worker workflows). Used to scope
      // worker-facing Amina to the record that is open. Memory-only
      // (not persisted) and cleared on sign-out to prevent data leaking
      // between users.
      currentPatient: null,
      setCurrentPatient: (patient) => set({ currentPatient: patient }),
      clearCurrentPatient: () => set({ currentPatient: null }),

      // Data-change signal: bumped whenever a clinical record is written so
      // an open health-worker Amina session can refresh its context without a
      // patient switch or page navigation (e.g. right after logging a visit
      // while the chat is still open). Memory-only, never persisted.
      dataVersion: 0,
      markDataChanged: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),

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
