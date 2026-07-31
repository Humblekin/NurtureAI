import { create } from 'zustand';
import db, { generateId } from '../lib/db';
import { syncOrQueue } from '../lib/sync';

/**
 * NurtureAI — Child Store
 * Tracks child health, vaccinations, growth, and milestones.
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
    try {
      const children = await db.children.filter(c => !c.deleted_at).toArray();
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
    try {
      const children = await db.children.where('mother_id').equals(motherId).filter(c => !c.deleted_at).toArray();
      set({ children, isLoading: false });
      
      // Pre-fetch related data for all children
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
        synced_at: null,
        created_at: new Date().toISOString(),
      };

      await db.children.put(newChild);
      await syncOrQueue('children', id, 'INSERT', newChild);

      set((state) => ({
        children: [...state.children, newChild],
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
      const existing = await db.children.get(id);
      if (!existing) throw new Error('Child not found locally');
      const updatedChild = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await db.children.put(updatedChild);
      await syncOrQueue('children', id, 'UPDATE', updatedChild);
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
    try {
      const vax = await db.vaccinations.where('child_id').equals(childId).toArray();
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
        synced_at: null,
        created_at: new Date().toISOString(),
      };

      await db.vaccinations.put(newVax);
      await syncOrQueue('vaccinations', id, 'INSERT', newVax);

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
      const existing = await db.vaccinations.get(id);
      if (!existing) throw new Error('Vaccination not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await db.vaccinations.put(updated);
      await syncOrQueue('vaccinations', id, 'UPDATE', updated);
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
      await db.vaccinations.delete(id);
      await syncOrQueue('vaccinations', id, 'DELETE', { id });
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
    try {
      const records = await db.growth_records.where('child_id').equals(childId).toArray();
      records.sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));
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
        synced_at: null,
        created_at: new Date().toISOString(),
      };

      await db.growth_records.put(newRecord);
      await syncOrQueue('growth_records', id, 'INSERT', newRecord);

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
      const existing = await db.growth_records.get(id);
      if (!existing) throw new Error('Growth record not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await db.growth_records.put(updated);
      await syncOrQueue('growth_records', id, 'UPDATE', updated);
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
      await db.growth_records.delete(id);
      await syncOrQueue('growth_records', id, 'DELETE', { id });
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
      const existing = await db.children.get(id);
      if (!existing) throw new Error('Child not found');
      const updated = { ...existing, deleted_at: new Date().toISOString() };
      await db.children.put(updated);
      await syncOrQueue('children', id, 'UPDATE', updated);
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
      const existing = await db.children.get(id);
      if (!existing) throw new Error('Child not found');
      const updated = { ...existing, deleted_at: null };
      await db.children.put(updated);
      await syncOrQueue('children', id, 'UPDATE', updated);
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    try {
      return await db.children.where('deleted_at').notEqual(null).toArray();
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

export default useChildStore;
