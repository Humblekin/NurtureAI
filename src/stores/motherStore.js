import { create } from 'zustand';
import { generateId, generatePatientCode } from '../lib/db';
import { upsertRecord } from '../lib/sync';
import { withNormalizedBloodGroup } from '../lib/bloodGroup';
import supabase, { isSupabaseConfigured } from '../lib/supabase';

/**
 * NurtureAI — Mother Store
 * Manages Mother/Caregiver profile data. Reads and writes go directly to Supabase.
 */
const useMotherStore = create((set, get) => ({
  mothers: [],
  currentMother: null,
  isLoading: false,
  error: null,

  // Fetch all mothers (usually for CHW/Nurse view)
  fetchMothers: async () => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ mothers: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('mothers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ mothers: data || [], isLoading: false });
      return data || [];
    } catch (error) {
      console.error('Failed to fetch mothers:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  // Fetch a specific mother by her record ID (worker-opened records,
  // including mothers registered by a worker who has no login profile yet).
  fetchMotherById: async (motherId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ currentMother: null, isLoading: false });
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('mothers')
        .select('*')
        .eq('id', motherId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      set({ currentMother: data || null, isLoading: false });
      return data || null;
    } catch (error) {
      console.error('Failed to fetch mother:', error);
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Fetch a specific mother by profile ID
  fetchMotherByProfileId: async (profileId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ currentMother: null, isLoading: false });
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('mothers')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle();
      if (error) throw error;
      set({ currentMother: data || null, isLoading: false });
      return data || null;
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
        ...withNormalizedBloodGroup(motherData),
        patient_code: motherData.patient_code || generatePatientCode(id),
        created_at: new Date().toISOString(),
      };

      await upsertRecord('mothers', newMother);

      set((state) => ({
        mothers: [newMother, ...state.mothers],
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

  // Adopt an existing mother record already linked to this account via the
  // claim_mother RPC (worker-registered before the mother had an account).
  // No database write is performed here — the record already belongs to the
  // authenticated profile; we only sync local store state.
  adoptMother: async (mother) => {
    set((state) => ({
      mothers: [mother, ...state.mothers.filter((m) => m.id !== mother.id)],
      currentMother: mother,
    }));
    return { success: true, data: mother };
  },

  // Update an existing mother
  updateMother: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const existing = getExisting(get(), id);
      const updatedMother = {
        ...existing,
        ...withNormalizedBloodGroup(updates),
        updated_at: new Date().toISOString(),
      };

      await upsertRecord('mothers', updatedMother);

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

  // Verify a mother record as a healthcare worker. The worker confirms the
  // details recorded by the mother; provenance (data_source) stays untouched.
  verifyMother: async (id, workerId) => {
    try {
      const existing = getExisting(get(), id);
      const updated = {
        ...existing,
        verified: true,
        verified_by: workerId || null,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await upsertRecord('mothers', updated);

      set((state) => ({
        mothers: state.mothers.map(m => m.id === id ? updated : m),
        currentMother: state.currentMother?.id === id ? updated : state.currentMother,
      }));

      return { success: true, data: updated };
    } catch (error) {
      console.error('Failed to verify mother:', error);
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  softDelete: async (id) => {
    try {
      const existing = getExisting(get(), id);
      const updated = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await upsertRecord('mothers', updated);
      set((state) => ({
        mothers: state.mothers.filter(m => m.id !== id),
        currentMother: state.currentMother?.id === id ? null : state.currentMother,
      }));
      return { success: true };
    } catch (error) {
      console.error('Failed to soft-delete mother:', error);
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  restore: async (id) => {
    try {
      const existing = getExisting(get(), id);
      const updated = { ...existing, deleted_at: null, updated_at: new Date().toISOString() };
      await upsertRecord('mothers', updated);
      set((state) => ({
        mothers: [updated, ...state.mothers],
      }));
      return { success: true };
    } catch (error) {
      console.error('Failed to restore mother:', error);
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('mothers')
        .select('*')
        .not('deleted_at', 'is', null);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch archived mothers:', error);
      return [];
    }
  },

  /**
   * Reset store state — called on logout to prevent data leaking between users.
   */
  reset: () => set({
    mothers: [],
    currentMother: null,
    isLoading: false,
    error: null,
  }),
}));

function getExisting(state, id) {
  const existing = state.mothers.find(m => m.id === id) || state.currentMother;
  if (!existing) throw new Error('Mother not found');
  return existing;
}

export default useMotherStore;
