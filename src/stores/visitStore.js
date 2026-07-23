import { create } from 'zustand';
import db, { queueSync, generateId } from '../lib/db';

/**
 * NurtureAI — Visit Store
 * Tracks general health worker visits (home visits, facility visits).
 */
const useVisitStore = create((set, get) => ({
  visits: [],
  isLoading: false,
  error: null,

  fetchVisitsByWorker: async (workerId) => {
    set({ isLoading: true, error: null });
    try {
      const visits = await db.visits.where('worker_id').equals(workerId).toArray();
      visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      set({ visits, isLoading: false });
      return visits;
    } catch (error) {
      console.error('Failed to fetch worker visits:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchAllVisits: async () => {
    set({ isLoading: true, error: null });
    try {
      const visits = await db.visits.toArray();
      visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      set({ visits, isLoading: false });
      return visits;
    } catch (error) {
      console.error('Failed to fetch all visits:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchVisitsByPatient: async (patientId) => {
    set({ isLoading: true, error: null });
    try {
      const visits = await db.visits.where('patient_id').equals(patientId).toArray();
      visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      set({ visits, isLoading: false });
      return visits;
    } catch (error) {
      console.error('Failed to fetch patient visits:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  logVisit: async (visitData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newVisit = {
        id,
        ...visitData,
        synced_at: null,
        created_at: new Date().toISOString(),
      };

      await db.visits.put(newVisit);
      await queueSync('visits', id, 'INSERT', newVisit);

      set((state) => ({
        visits: [newVisit, ...state.visits],
        isLoading: false,
      }));

      return { success: true, data: newVisit };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  }
}));

export default useVisitStore;
