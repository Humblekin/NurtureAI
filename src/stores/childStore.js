import { create } from 'zustand';
import { generateId } from '../lib/db';
import { upsertRecord, deleteRecord } from '../lib/sync';
import supabase, { isSupabaseConfigured } from '../lib/supabase';

/**
 * NurtureAI — Child Store
 * Tracks child health, vaccinations, growth, and milestones.
 * Reads and writes go directly to Supabase.
 */
const useChildStore = create((set, get) => ({
  children: [],
  currentChild: null,
  vaccinations: {}, // Keyed by child_id
  growthRecords: {}, // Keyed by child_id
  isLoading: false,
  error: null,

  fetchAllChildren: async () => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ children: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const children = data || [];
      set({ children, isLoading: false });
      children.forEach(child => {
        get().fetchVaccinations(child.id);
        get().fetchGrowthRecords(child.id);
      });
      return children;
    } catch (error) {
      console.error('Failed to fetch all children:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchChildrenByMotherId: async (motherId) => {
    set({ isLoading: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ children: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('mother_id', motherId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const children = data || [];
      set({ children, isLoading: false });

      children.forEach(child => {
        get().fetchVaccinations(child.id);
        get().fetchGrowthRecords(child.id);
      });

      return children;
    } catch (error) {
      console.error('Failed to fetch children:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  setCurrentChild: (childId) => {
    const child = get().children.find(c => c.id === childId) || null;
    set({ currentChild: child });
  },

  registerChild: async (childData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newChild = {
        id,
        ...childData,
        created_at: new Date().toISOString(),
      };

      await upsertRecord('children', newChild);

      set((state) => ({
        children: [newChild, ...state.children],
        isLoading: false,
      }));

      return { success: true, data: newChild };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  updateChild: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const existing = getExistingChild(get(), id);
      const updatedChild = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await upsertRecord('children', updatedChild);
      set((state) => ({
        children: state.children.map(c => c.id === id ? updatedChild : c),
        currentChild: state.currentChild?.id === id ? updatedChild : state.currentChild,
        isLoading: false,
      }));
      return { success: true, data: updatedChild };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // ---- Vaccinations ----

  fetchVaccinations: async (childId) => {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('vaccinations')
        .select('*')
        .eq('child_id', childId)
        .is('deleted_at', null);
      if (error) throw error;
      const vax = data || [];
      set((state) => ({
        vaccinations: { ...state.vaccinations, [childId]: vax }
      }));
      return vax;
    } catch (error) {
      console.error('Failed to fetch vaccinations:', error);
      return [];
    }
  },

  recordVaccination: async (childId, vaxData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newVax = {
        id,
        child_id: childId,
        ...vaxData,
        created_at: new Date().toISOString(),
      };

      await upsertRecord('vaccinations', newVax);

      set((state) => ({
        vaccinations: {
          ...state.vaccinations,
          [childId]: [...(state.vaccinations[childId] || []), newVax]
        },
        isLoading: false,
      }));

      return { success: true, data: newVax };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  updateVaccination: async (id, childId, updates) => {
    try {
      const existing = getExistingVax(get(), id, childId);
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await upsertRecord('vaccinations', updated);
      set((state) => ({
        vaccinations: {
          ...state.vaccinations,
          [childId]: (state.vaccinations[childId] || []).map(v => v.id === id ? updated : v),
        },
      }));
      return { success: true, data: updated };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  deleteVaccination: async (id, childId) => {
    try {
      await deleteRecord('vaccinations', id);
      set((state) => ({
        vaccinations: {
          ...state.vaccinations,
          [childId]: (state.vaccinations[childId] || []).filter(v => v.id !== id),
        },
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // ---- Growth Records ----

  fetchGrowthRecords: async (childId) => {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('growth_records')
        .select('*')
        .eq('child_id', childId)
        .is('deleted_at', null);
      if (error) throw error;
      const records = (data || []).sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));
      set((state) => ({
        growthRecords: { ...state.growthRecords, [childId]: records }
      }));
      return records;
    } catch (error) {
      console.error('Failed to fetch growth records:', error);
      return [];
    }
  },

  recordGrowth: async (childId, growthData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newRecord = {
        id,
        child_id: childId,
        ...growthData,
        created_at: new Date().toISOString(),
      };

      await upsertRecord('growth_records', newRecord);

      set((state) => ({
        growthRecords: {
          ...state.growthRecords,
          [childId]: [...(state.growthRecords[childId] || []), newRecord]
        },
        isLoading: false,
      }));

      return { success: true, data: newRecord };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  updateGrowthRecord: async (id, childId, updates) => {
    try {
      const existing = getExistingGrowth(get(), id, childId);
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await upsertRecord('growth_records', updated);
      set((state) => ({
        growthRecords: {
          ...state.growthRecords,
          [childId]: (state.growthRecords[childId] || []).map(g => g.id === id ? updated : g),
        },
      }));
      return { success: true, data: updated };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  deleteGrowthRecord: async (id, childId) => {
    try {
      await deleteRecord('growth_records', id);
      set((state) => ({
        growthRecords: {
          ...state.growthRecords,
          [childId]: (state.growthRecords[childId] || []).filter(g => g.id !== id),
        },
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  softDelete: async (id) => {
    try {
      const existing = getExistingChild(get(), id);
      const updated = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await upsertRecord('children', updated);
      set((state) => ({
        children: state.children.filter(c => c.id !== id),
        currentChild: state.currentChild?.id === id ? null : state.currentChild,
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  restore: async (id) => {
    try {
      const existing = getExistingChild(get(), id);
      const updated = { ...existing, deleted_at: null, updated_at: new Date().toISOString() };
      await upsertRecord('children', updated);
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('children')
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
    children: [],
    currentChild: null,
    vaccinations: {},
    growthRecords: {},
    isLoading: false,
    error: null,
  }),
}));

function getExistingChild(state, id) {
  const existing = state.children.find(c => c.id === id) || state.currentChild;
  if (!existing) throw new Error('Child not found');
  return existing;
}

function getExistingVax(state, id, childId) {
  const existing = (state.vaccinations[childId] || []).find(v => v.id === id);
  if (!existing) throw new Error('Vaccination not found');
  return existing;
}

function getExistingGrowth(state, id, childId) {
  const existing = (state.growthRecords[childId] || []).find(g => g.id === id);
  if (!existing) throw new Error('Growth record not found');
  return existing;
}

export default useChildStore;
