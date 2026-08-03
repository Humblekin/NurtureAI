import { create } from 'zustand';
import { generateId } from '../lib/db';
import { upsertRecord } from '../lib/sync';
import supabase, { isSupabaseConfigured } from '../lib/supabase';

/**
 * NurtureAI — Referral Store
 * Tracks patient referrals between facilities and CHWs.
 * Reads and writes go directly to Supabase.
 */
const useReferralStore = create((set, get) => ({
  referrals: [],
  isLoading: false,
  error: null,

  fetchIncomingReferrals: async (facilityId) => {
    set({ isLoading: true, error: null });
    if (!facilityId || !isSupabaseConfigured()) {
      set({ referrals: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('to_facility_id', facilityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ referrals: data || [], isLoading: false });
      return data || [];
    } catch (error) {
      console.error('Failed to fetch incoming referrals:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },

  fetchOutgoingReferrals: async (workerOrFacilityId) => {
    set({ isLoading: true, error: null });
    if (!workerOrFacilityId || !isSupabaseConfigured()) {
      set({ referrals: [], isLoading: false });
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('from_facility_id', workerOrFacilityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ referrals: data || [], isLoading: false });
      return data || [];
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
        created_at: new Date().toISOString(),
      };

      await upsertRecord('referrals', newReferral);

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
      const existing = getExisting(get(), referralId);
      if (!existing) throw new Error('Referral not found');

      const updated = {
        ...existing,
        status,
        notes: notes ? `${existing.notes || ''}\n[Update]: ${notes}` : existing.notes,
        updated_at: new Date().toISOString(),
      };

      await upsertRecord('referrals', updated);

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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Referral not found');
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      await upsertRecord('referrals', updated);
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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Referral not found');
      const updated = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      await upsertRecord('referrals', updated);
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
      const existing = getExisting(get(), id);
      if (!existing) throw new Error('Referral not found');
      const updated = { ...existing, deleted_at: null, updated_at: new Date().toISOString() };
      await upsertRecord('referrals', updated);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  fetchArchived: async () => {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('referrals')
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
  return state.referrals.find(r => r.id === id);
}

export default useReferralStore;
