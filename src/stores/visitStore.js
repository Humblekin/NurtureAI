import { create } from 'zustand';
import { generateId } from '../lib/db';
import { upsertRecord } from '../lib/sync';
import supabase, { isSupabaseConfigured } from '../lib/supabase';

/**
 * NurtureAI — Visit Store
 * Tracks general health worker visits (home visits, facility visits).
 * Reads and writes go directly to Supabase.
 */
const useVisitStore = create((set) => ({
  visits: [],
  isLoading: false,
  error: null,

  fetchVisitsByWorker: async (workerId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ visits: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('worker_id', workerId)
        .is('deleted_at', null)
        .order('visit_date', { ascending: false });
      if (error) throw error;
      set({ visits: data || [], isLoading: false });
      return data || [];
    } catch (error) {
      console.error('Failed to fetch worker visits:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchAllVisits: async () => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ visits: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .is('deleted_at', null)
        .order('visit_date', { ascending: false });
      if (error) throw error;
      set({ visits: data || [], isLoading: false });
      return data || [];
    } catch (error) {
      console.error('Failed to fetch all visits:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchVisitsByPatient: async (patientId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ visits: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('visit_date', { ascending: false });
      if (error) throw error;
      set({ visits: data || [], isLoading: false });
      return data || [];
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
        created_at: new Date().toISOString(),
      };

      await upsertRecord('visits', newVisit);

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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await upsertRecord('visits', updated);
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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await upsertRecord('visits', updated);
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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Visit not found');
      const updated = { ...existing, deleted_at: null, updated_at: new Date().toISOString() };
      await upsertRecord('visits', updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .not('deleted_at', 'is', null);
      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  },
}));

function getExisting(state, id) {
  return state.visits.find(v => v.id === id);
}

export default useVisitStore;
