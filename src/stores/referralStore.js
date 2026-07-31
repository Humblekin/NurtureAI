import { create } from 'zustand';
import db, { generateId } from '../lib/db';
import { syncOrQueue } from '../lib/sync';

/**
 * NurtureAI — Referral Store
 * Tracks patient referrals between facilities and CHWs.
 */
const useReferralStore = create((set, get) => ({
  referrals: [],
  isLoading: false,
  error: null,

  fetchIncomingReferrals: async (facilityId) => {
    set({ isLoading: true, error: null });
    if (!facilityId) {
      set({ referrals: [], isLoading: false });
      return [];
    }
    try {
      const referrals = await db.referrals.where('to_facility_id').equals(facilityId).filter(r => !r.deleted_at).toArray();
      set({ referrals, isLoading: false });
      return referrals;
    } catch (error) {
      console.error('Failed to fetch incoming referrals:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchOutgoingReferrals: async (workerOrFacilityId) => {
    set({ isLoading: true, error: null });
    if (!workerOrFacilityId) {
      set({ referrals: [], isLoading: false });
      return [];
    }
    try {
      const referrals = await db.referrals.where('from_facility_id').equals(workerOrFacilityId).filter(r => !r.deleted_at).toArray();
      set({ referrals, isLoading: false });
      return referrals;
    } catch (error) {
      console.error('Failed to fetch outgoing referrals:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  createReferral: async (referralData) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateId();
      const newReferral = {
        id,
        status: 'pending', // pending, accepted, completed, rejected
        ...referralData,
        synced_at: null,
        created_at: new Date().toISOString(),
      };

      await db.referrals.put(newReferral);
      await syncOrQueue('referrals', id, 'INSERT', newReferral);

      set((state) => ({
        referrals: [newReferral, ...state.referrals],
        isLoading: false,
      }));

      return { success: true, data: newReferral };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  updateReferralStatus: async (referralId, status, notes = '') => {
    set({ isLoading: true, error: null });
    try {
      const existing = await db.referrals.get(referralId);
      if (!existing) throw new Error('Referral not found locally');

      const updated = {
        ...existing,
        status,
        notes: notes ? `${existing.notes || ''}\n[Update]: ${notes}` : existing.notes,
        updated_at: new Date().toISOString(),
      };

      await db.referrals.put(updated);
      await syncOrQueue('referrals', referralId, 'UPDATE', updated);

      set((state) => ({
        referrals: state.referrals.map(r => r.id === referralId ? updated : r),
        isLoading: false,
      }));

      return { success: true, data: updated };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  updateReferral: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const existing = await db.referrals.get(id);
      if (!existing) throw new Error('Referral not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await db.referrals.put(updated);
      await syncOrQueue('referrals', id, 'UPDATE', updated);
      set((state) => ({
        referrals: state.referrals.map(r => r.id === id ? updated : r),
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
      const existing = await db.referrals.get(id);
      if (!existing) throw new Error('Referral not found');
      const updated = { ...existing, deleted_at: new Date().toISOString() };
      await db.referrals.put(updated);
      await syncOrQueue('referrals', id, 'UPDATE', updated);
      set((state) => ({
        referrals: state.referrals.filter(r => r.id !== id),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  restore: async (id) => {
    try {
      const existing = await db.referrals.get(id);
      if (!existing) throw new Error('Referral not found');
      const updated = { ...existing, deleted_at: null };
      await db.referrals.put(updated);
      await syncOrQueue('referrals', id, 'UPDATE', updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    try {
      return await db.referrals.where('deleted_at').notEqual(null).toArray();
    } catch (error) {
      return [];
    }
  },
}));

export default useReferralStore;
