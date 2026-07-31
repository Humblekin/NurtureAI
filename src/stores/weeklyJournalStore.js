import { create } from 'zustand';
import { generateId } from '../lib/db';
import { upsertRecord } from '../lib/sync';
import supabase, { isSupabaseConfigured } from '../lib/supabase';

const useWeeklyJournalStore = create((set) => ({
  journals: [],
  currentJournal: null,
  isLoading: false,
  error: null,

  fetchJournalsByUser: async (userId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ journals: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('weekly_journals')
        .select('*')
        .eq('user_id', userId)
        .order('week_number', { ascending: true });
      if (error) throw error;
      set({ journals: data || [], isLoading: false });
      return data || [];
    } catch (error) {
      console.error('Failed to fetch journals:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchJournalsByPregnancy: async (pregnancyId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ journals: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('weekly_journals')
        .select('*')
        .eq('pregnancy_id', pregnancyId)
        .order('week_number', { ascending: true });
      if (error) throw error;
      set({ journals: data || [], isLoading: false });
      return data || [];
    } catch (error) {
      console.error('Failed to fetch journals:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchCurrentWeek: async (pregnancyId, weekNumber) => {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await supabase
        .from('weekly_journals')
        .select('*')
        .eq('pregnancy_id', pregnancyId)
        .eq('week_number', weekNumber)
        .maybeSingle();
      if (error) throw error;
      set({ currentJournal: data || null });
      return data || null;
    } catch (error) {
      console.error('Failed to fetch current week journal:', error);
      return null;
    }
  },

  saveJournal: async (journalData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const entry = {
        id,
        ...journalData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await upsertRecord('weekly_journals', entry);

      set((state) => ({
        journals: [...state.journals, entry].sort((a, b) => b.week_number - a.week_number),
        currentJournal: entry,
        isLoading: false,
      }));

      return { success: true, data: entry };
    } catch (error) {
      console.error('Failed to save journal:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  updateJournal: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const existing = get().journals.find(j => j.id === id);
      if (!existing) throw new Error('Journal entry not found');

      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      await upsertRecord('weekly_journals', updated);

      set((state) => ({
        journals: state.journals.map(j => j.id === id ? updated : j),
        currentJournal: updated,
        isLoading: false,
      }));

      return { success: true, data: updated };
    } catch (error) {
      console.error('Failed to update journal:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  reset: () => set({
    journals: [],
    currentJournal: null,
    isLoading: false,
    error: null,
  }),
}));

export default useWeeklyJournalStore;
