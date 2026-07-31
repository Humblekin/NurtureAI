import { create } from 'zustand';
import db, { generateId } from '../lib/db';
import { syncOrQueue } from '../lib/sync';

/**
 * NurtureAI — Pregnancy Store
 * Tracks pregnancies, antenatal visits, and risk assessments.
 */
const usePregnancyStore = create((set, get) => ({
  activePregnancy: null,
  pregnancyHistory: [],
  antenatalVisits: [],
  isLoading: false,
  error: null,

  fetchPregnanciesByMotherId: async (motherId) => {
    set({ isLoading: true, error: null });
    try {
      const pregnancies = await db.pregnancies.where('mother_id').equals(motherId).filter(p => !p.deleted_at).toArray();
      const active = pregnancies.find(p => p.status === 'active') || null;
      
      set({ 
        pregnancyHistory: pregnancies,
        activePregnancy: active,
        isLoading: false 
      });
      
      if (active) {
        await get().fetchAntenatalVisits(active.id);
      }
      
      return pregnancies;
    } catch (error) {
      console.error('Failed to fetch pregnancies:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchAntenatalVisits: async (pregnancyId) => {
    try {
      const visits = await db.antenatal_visits.where('pregnancy_id').equals(pregnancyId).toArray();
      // Sort by date descending
      visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      set({ antenatalVisits: visits });
      return visits;
    } catch (error) {
      console.error('Failed to fetch antenatal visits:', error);
      return [];
    }
  },

  registerPregnancy: async (pregnancyData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newPregnancy = {
        id,
        status: 'active',
        risk_level: 'low', // Default, should be assessed
        ...pregnancyData,
        synced_at: null,
        created_at: new Date().toISOString(),
      };

      await db.pregnancies.put(newPregnancy);
      await syncOrQueue('pregnancies', id, 'INSERT', newPregnancy);

      set((state) => ({
        activePregnancy: newPregnancy,
        pregnancyHistory: [...state.pregnancyHistory, newPregnancy],
        antenatalVisits: [], // Reset visits for new pregnancy
        isLoading: false,
      }));

      return { success: true, data: newPregnancy };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  logAntenatalVisit: async (visitData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newVisit = {
        id,
        ...visitData,
        synced_at: null,
        created_at: new Date().toISOString(),
      };

      await db.antenatal_visits.put(newVisit);
      await syncOrQueue('antenatal_visits', id, 'INSERT', newVisit);

      // Optionally update pregnancy risk level if provided in visit
      if (visitData.assessed_risk_level) {
        await get().updatePregnancyRisk(visitData.pregnancy_id, visitData.assessed_risk_level);
      }

      set((state) => ({
        antenatalVisits: [newVisit, ...state.antenatalVisits], // Prepend
        isLoading: false,
      }));

      return { success: true, data: newVisit };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  updatePregnancyRisk: async (pregnancyId, newRiskLevel) => {
    try {
      const existing = await db.pregnancies.get(pregnancyId);
      if (!existing) return;

      const updated = {
        ...existing,
        risk_level: newRiskLevel,
        updated_at: new Date().toISOString()
      };

      await db.pregnancies.put(updated);
      await syncOrQueue('pregnancies', pregnancyId, 'UPDATE', updated);

      set((state) => ({
        activePregnancy: state.activePregnancy?.id === pregnancyId ? updated : state.activePregnancy,
        pregnancyHistory: state.pregnancyHistory.map(p => p.id === pregnancyId ? updated : p),
      }));
    } catch (error) {
      console.error('Failed to update pregnancy risk:', error);
    }
  },

  updatePregnancy: async (id, updates) => {
    try {
      const existing = await db.pregnancies.get(id);
      if (!existing) throw new Error('Pregnancy not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await db.pregnancies.put(updated);
      await syncOrQueue('pregnancies', id, 'UPDATE', updated);
      set((state) => ({
        activePregnancy: state.activePregnancy?.id === id ? updated : state.activePregnancy,
        pregnancyHistory: state.pregnancyHistory.map(p => p.id === id ? updated : p),
      }));
      return { success: true, data: updated };
    } catch (error) {
      console.error('Failed to update pregnancy:', error);
      return { success: false, error: error.message };
    }
  },

  updateAntenatalVisit: async (id, updates) => {
    try {
      const existing = await db.antenatal_visits.get(id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await db.antenatal_visits.put(updated);
      await syncOrQueue('antenatal_visits', id, 'UPDATE', updated);
      set((state) => ({
        antenatalVisits: state.antenatalVisits.map(v => v.id === id ? updated : v),
      }));
      return { success: true, data: updated };
    } catch (error) {
      console.error('Failed to update antenatal visit:', error);
      return { success: false, error: error.message };
    }
  },

  deleteAntenatalVisit: async (id) => {
    try {
      await db.antenatal_visits.delete(id);
      await syncOrQueue('antenatal_visits', id, 'DELETE', { id });
      set((state) => ({
        antenatalVisits: state.antenatalVisits.filter(v => v.id !== id),
      }));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete antenatal visit:', error);
      return { success: false, error: error.message };
    }
  },

  softDelete: async (id) => {
    try {
      const existing = await db.pregnancies.get(id);
      if (!existing) throw new Error('Pregnancy not found');
      const updated = { ...existing, deleted_at: new Date().toISOString() };
      await db.pregnancies.put(updated);
      await syncOrQueue('pregnancies', id, 'UPDATE', updated);
      set((state) => ({
        pregnancyHistory: state.pregnancyHistory.filter(p => p.id !== id),
        activePregnancy: state.activePregnancy?.id === id ? null : state.activePregnancy,
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  restore: async (id) => {
    try {
      const existing = await db.pregnancies.get(id);
      if (!existing) throw new Error('Pregnancy not found');
      const updated = { ...existing, deleted_at: null };
      await db.pregnancies.put(updated);
      await syncOrQueue('pregnancies', id, 'UPDATE', updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    try {
      return await db.pregnancies.where('deleted_at').notEqual(null).toArray();
    } catch (error) {
      return [];
    }
  },

  /**
   * Reset store state — called on logout to prevent data leaking between users.
   */
  reset: () => set({
    activePregnancy: null,
    pregnancyHistory: [],
    antenatalVisits: [],
    isLoading: false,
    error: null,
  }),
}));

export default usePregnancyStore;
