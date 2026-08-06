import { create } from 'zustand';
import { generateId } from '../lib/db';
import { upsertRecord, deleteRecord } from '../lib/sync';
import { calculateWeeksFromLMP } from '../lib/pregnancy';
import supabase, { isSupabaseConfigured } from '../lib/supabase';

/**
 * NurtureAI — Pregnancy Store
 * Tracks pregnancies, antenatal visits, and risk assessments.
 * Reads and writes go directly to Supabase.
 */
const usePregnancyStore = create((set, get) => ({
  activePregnancy: null,
  pregnancyHistory: [],
  antenatalVisits: [],
  isLoading: false,
  error: null,

  fetchPregnanciesByMotherId: async (motherId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ pregnancyHistory: [], activePregnancy: null, isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('pregnancies')
        .select('*')
        .eq('mother_id', motherId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const pregnancies = data || [];
      const active = pregnancies.find(p => p.status === 'active') || null;

      set({
        pregnancyHistory: pregnancies,
        activePregnancy: active,
        isLoading: false,
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
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('antenatal_visits')
        .select('*')
        .eq('pregnancy_id', pregnancyId)
        .is('deleted_at', null);
      if (error) throw error;
      const visits = (data || []).sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
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
        created_at: new Date().toISOString(),
      };

      await upsertRecord('pregnancies', newPregnancy);

      set((state) => ({
        activePregnancy: newPregnancy,
        pregnancyHistory: [newPregnancy, ...state.pregnancyHistory],
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
        created_at: new Date().toISOString(),
      };

      await upsertRecord('antenatal_visits', newVisit);

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
      const existing = getExisting(get(), pregnancyId);
      if (!existing) return;

      const updated = {
        ...existing,
        risk_level: newRiskLevel,
        updated_at: new Date().toISOString()
      };

      await upsertRecord('pregnancies', updated);

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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Pregnancy not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await upsertRecord('pregnancies', updated);
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
      const existing = get().antenatalVisits.find(v => v.id === id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await upsertRecord('antenatal_visits', updated);
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
      await deleteRecord('antenatal_visits', id);
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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Pregnancy not found');
      const updated = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await upsertRecord('pregnancies', updated);
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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Pregnancy not found');
      const updated = { ...existing, deleted_at: null, updated_at: new Date().toISOString() };
      await upsertRecord('pregnancies', updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('pregnancies')
        .select('*')
        .not('deleted_at', 'is', null);
      if (error) throw error;
      return data || [];
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

function getExisting(state, pregnancyId) {
  return state.pregnancyHistory.find(p => p.id === pregnancyId) || state.activePregnancy;
}

export default usePregnancyStore;
