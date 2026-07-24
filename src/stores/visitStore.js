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
      const visits = await db.visits.where('worker_id').equals(workerId).filter(v => !v.deleted_at).toArray();
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
      const visits = await db.visits.filter(v => !v.deleted_at).toArray();
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
      const visits = await db.visits.where('patient_id').equals(patientId).filter(v => !v.deleted_at).toArray();
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
  },

  updateVisit: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const existing = await db.visits.get(id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await db.visits.put(updated);
      await queueSync('visits', id, 'UPDATE', updated);
      set((state) => ({
        visits: state.visits.map(v => v.id === id ? updated : v),
        isLoading: false,
      }));
      return { success: true, data: updated };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  softDelete: async (id) => {
    try {
      const existing = await db.visits.get(id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, deleted_at: new Date().toISOString() };
      await db.visits.put(updated);
      await queueSync('visits', id, 'UPDATE', updated);
      set((state) => ({
        visits: state.visits.filter(v => v.id !== id),
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  restore: async (id) => {
    try {
      const existing = await db.visits.get(id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, deleted_at: null };
      await db.visits.put(updated);
      await queueSync('visits', id, 'UPDATE', updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    try {
      return await db.visits.where('deleted_at').notEqual(null).toArray();
    } catch (error) {
      return [];
    }
  },
}));

export default useVisitStore;
