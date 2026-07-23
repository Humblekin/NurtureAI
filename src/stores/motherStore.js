import { create } from 'zustand';
import db, { queueSync, generateId } from '../lib/db';

/**
 * NurtureAI — Mother Store
 * Manages Mother/Caregiver profile data and interactions with the local database.
 */
const useMotherStore = create((set, get) => ({
  mothers: [],
  currentMother: null,
  isLoading: false,
  error: null,

  // Fetch all mothers (usually for CHW/Nurse view)
  fetchMothers: async () => {
    set({ isLoading: true, error: null });
    try {
      const mothers = await db.mothers.toArray();
      set({ mothers, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch mothers:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch a specific mother by profile ID
  fetchMotherByProfileId: async (profileId) => {
    set({ isLoading: true, error: null });
    try {
      const mother = await db.mothers.where('profile_id').equals(profileId).first();
      set({ currentMother: mother || null, isLoading: false });
      return mother;
    } catch (error) {
      console.error('Failed to fetch mother:', error);
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Register a new mother
  registerMother: async (motherData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newMother = {
        id,
        ...motherData,
        synced_at: null, // Indicates it needs syncing
        created_at: new Date().toISOString(),
      };

      // Save to local IndexedDB
      await db.mothers.put(newMother);

      // Queue for Supabase sync
      await queueSync('mothers', id, 'INSERT', newMother);

      // Update local state
      set((state) => ({
        mothers: [...state.mothers, newMother],
        currentMother: newMother,
        isLoading: false,
      }));

      return { success: true, data: newMother };
    } catch (error) {
      console.error('Failed to register mother:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Update an existing mother
  updateMother: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const existing = await db.mothers.get(id);
      if (!existing) throw new Error('Mother not found locally');

      const updatedMother = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Save locally
      await db.mothers.put(updatedMother);

      // Queue sync
      await queueSync('mothers', id, 'UPDATE', updatedMother);

      // Update state
      set((state) => ({
        mothers: state.mothers.map(m => m.id === id ? updatedMother : m),
        currentMother: state.currentMother?.id === id ? updatedMother : state.currentMother,
        isLoading: false,
      }));

      return { success: true, data: updatedMother };
    } catch (error) {
      console.error('Failed to update mother:', error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },
}));

export default useMotherStore;
