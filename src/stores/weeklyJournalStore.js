import { create } from 'zustand';
import db, { queueSync, generateId } from '../lib/db';

const useWeeklyJournalStore = create((set, get) => ({
  journals: [],
  currentJournal: null,
  isLoading: false,
  error: null,

  fetchJournalsByUser: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const journals = await db.weekly_journals
        .where('user_id').equals(userId)
        .sortBy('week_number');
      set({ journals, isLoading: false });
      return journals;
    } catch (error) {
      console.error('Failed to fetch journals:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchJournalsByPregnancy: async (pregnancyId) => {
    set({ isLoading: true, error: null });
    try {
      const journals = await db.weekly_journals
        .where('pregnancy_id').equals(pregnancyId)
        .sortBy('week_number');
      set({ journals, isLoading: false });
      return journals;
    } catch (error) {
      console.error('Failed to fetch journals:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchCurrentWeek: async (pregnancyId, weekNumber) => {
    try {
      const journal = await db.weekly_journals
        .where('pregnancy_id').equals(pregnancyId)
        .and(j => j.week_number === weekNumber)
        .first();
      set({ currentJournal: journal || null });
      return journal || null;
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
        synced_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.weekly_journals.put(entry);
      await queueSync('weekly_journals', id, 'INSERT', entry);

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
      const existing = await db.weekly_journals.get(id);
      if (!existing) throw new Error('Journal entry not found');

      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      await db.weekly_journals.put(updated);
      await queueSync('weekly_journals', id, 'UPDATE', updated);

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

  requeueUnsynced: async () => {
    try {
      const unsynced = await db.weekly_journals
        .filter(j => !j.synced_at)
        .toArray();

      for (const entry of unsynced) {
        const existingQueue = await db.sync_queue
          .where({ table_name: 'weekly_journals', record_id: entry.id })
          .first();
        if (!existingQueue) {
          await queueSync('weekly_journals', entry.id, 'INSERT', entry);
        }
      }

      if (unsynced.length > 0) {
        console.log(`[Journal] Re-queued ${unsynced.length} unsynced entries`);
      }
    } catch (error) {
      console.error('[Journal] Failed to re-queue unsynced entries:', error);
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
