import { create } from 'zustand';
import db, { queueSync, generateId } from '../lib/db';

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

  fetchChildrenByMotherId: async (motherId) => {
    set({ isLoading: true, error: null });
    try {
      const children = await db.children.where('mother_id').equals(motherId).toArray();
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
      await queueSync('children', id, 'INSERT', newChild);

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
      await queueSync('vaccinations', id, 'INSERT', newVax);

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
      await queueSync('growth_records', id, 'INSERT', newRecord);

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
  }
}));

export default useChildStore;
