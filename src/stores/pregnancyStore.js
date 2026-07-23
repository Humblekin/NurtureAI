import { create } from 'zustand';
import db, { queueSync, generateId } from '../lib/db';

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
      const pregnancies = await db.pregnancies.where('mother_id').equals(motherId).toArray();
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
      await queueSync('pregnancies', id, 'INSERT', newPregnancy);

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
      await queueSync('antenatal_visits', id, 'INSERT', newVisit);

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
      await queueSync('pregnancies', pregnancyId, 'UPDATE', updated);

      set((state) => ({
        activePregnancy: state.activePregnancy?.id === pregnancyId ? updated : state.activePregnancy,
        pregnancyHistory: state.pregnancyHistory.map(p => p.id === pregnancyId ? updated : p),
      }));
    } catch (error) {
      console.error('Failed to update pregnancy risk:', error);
    }
  }
}));

export default usePregnancyStore;
