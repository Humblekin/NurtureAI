import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import supabase, { isSupabaseConfigured } from '../lib/supabase';
import db from '../lib/db';
import { seedDemoForRole } from '../lib/demoData';
import { fullSync } from '../lib/sync';
import useMotherStore from './motherStore';
import usePregnancyStore from './pregnancyStore';
import useChildStore from './childStore';
import useTimelineStore from './timelineStore';
import useNotificationStore from './notificationStore';
import useOnboardingStore from './onboardingStore';

/**
 * NurtureAI — Auth Store
 * 
 * Manages authentication state, user profile, and role-based access.
 * Persists session locally for offline access.
 */

// Role hierarchy for permission checks
export const ROLES = {
  MOTHER: 'mother',
  CHW: 'chw',
  NURSE: 'nurse',
  DOCTOR: 'doctor',
  DISTRICT_OFFICER: 'district_officer',
  ADMIN: 'admin',
};

export const ROLE_LABELS = {
  [ROLES.MOTHER]: 'Mother / Caregiver',
  [ROLES.CHW]: 'Community Health Worker',
  [ROLES.NURSE]: 'Nurse',
  [ROLES.DOCTOR]: 'Doctor',
  [ROLES.DISTRICT_OFFICER]: 'District Health Officer',
  [ROLES.ADMIN]: 'Administrator',
};

let authListenerUnsubscribed = false;
let intentionalSignOut = false;

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      profile: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setProfile: (profile) => set({ profile }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      /**
       * Initialize auth — check for existing session and subscribe to changes
       */
      initialize: async () => {
        set({ isLoading: true, error: null });

        if (!isSupabaseConfigured()) {
          const cachedProfile = get().profile;
          if (cachedProfile) {
            set({ isAuthenticated: true, isLoading: false });
            await seedDemoForRole(cachedProfile.id, cachedProfile.role);
          } else {
            set({ isLoading: false });
          }
          return;
        }

        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (session) {
            set({
              user: session.user,
              session,
              isAuthenticated: true,
            });

            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (!profileError && profile) {
              set({ profile });
              await db.profiles.put({ ...profile, synced_at: new Date().toISOString() });
            } else {
              console.error('Profile fetch error:', profileError);
            }

            await fullSync();
          }
        } catch (error) {
          console.error('Auth init error:', error);
          const cachedProfile = get().profile;
          if (cachedProfile) {
            set({ isAuthenticated: true });
          }
        } finally {
          set({ isLoading: false });
        }

        // Subscribe to auth state changes (token refresh, sign out, etc.)
        if (!authListenerUnsubscribed) {
          supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              if (session) {
                set({ user: session.user, session, isAuthenticated: true });
              }
            } else if (event === 'SIGNED_OUT') {
              if (intentionalSignOut) {
                // Clear ALL data stores to prevent data leaking between users
                useMotherStore.getState().reset();
                usePregnancyStore.getState().reset();
                useChildStore.getState().reset();
                useTimelineStore.getState().reset();
                useNotificationStore.getState().reset();
                useOnboardingStore.getState().reset();

                set({
                  user: null,
                  profile: null,
                  session: null,
                  isAuthenticated: false,
                });
                localStorage.removeItem('nurtureai-auth');
              } else {
                // Forced sign-out (token refresh failed, etc.)
                // Don't clear local data — just mark as unauthenticated
                // The user can re-authenticate without losing unsynced data
                console.warn('[Auth] Session lost (forced sign-out). Local data preserved.');
                // Clear stale Supabase session from localStorage to break the 429 loop
                const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                if (sbKey) localStorage.removeItem(sbKey);
                set({
                  session: null,
                  isAuthenticated: false,
                });
              }
              intentionalSignOut = false;
            }
          });
          authListenerUnsubscribed = true;
        }
      },

      /**
       * Sign in with email and password
       */
      signIn: async (email, password) => {
        set({ isLoading: true, error: null });

        if (!isSupabaseConfigured()) {
          // Demo mode for development
          const demoProfile = {
            id: 'demo-user',
            email,
            role: 'mother',
            full_name: 'Fatima Abdulai',
            phone: '+233241234567',
            community: 'Tamale South',
            region: 'Northern',
          };
          set({
            user: { id: 'demo-user', email },
            profile: demoProfile,
            isAuthenticated: true,
            isLoading: false,
          });
          await db.profiles.put(demoProfile);
          await seedDemoForRole(demoProfile.id, demoProfile.role);
          return { success: true };
        }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          set({
            user: data.user,
            session: data.session,
            isAuthenticated: true,
          });

          // Fetch fresh profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!profileError && profile) {
            set({ profile });
            await db.profiles.put({ ...profile, synced_at: new Date().toISOString() });
          }

          // Sync data from Supabase to local IndexedDB before rendering
          await fullSync().catch(err => console.error('Post-login sync failed:', err));
          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          set({ error: error.message, isLoading: false });
          return { success: false, error: error.message };
        }
      },

      /**
       * Register a new user
       */
      signUp: async (email, password, profileData) => {
        set({ isLoading: true, error: null });

        if (!isSupabaseConfigured()) {
          const demoProfile = {
            id: 'demo-user',
            email,
            ...profileData,
          };
          set({
            user: { id: 'demo-user', email },
            profile: demoProfile,
            isAuthenticated: true,
            isLoading: false,
          });
          await db.profiles.put(demoProfile);
          await seedDemoForRole(demoProfile.id, demoProfile.role || 'mother');
          return { success: true };
        }

        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: profileData,
            },
          });

          if (error) throw error;

          // Profile is auto-created by the on_auth_user_created trigger
          if (data.user) {
            // Wait briefly for trigger to complete, then fetch the profile
            await new Promise((r) => setTimeout(r, 500));
            await get().fetchProfile(data.user.id);

            set({
                user: data.user,
                session: data.session,
                isAuthenticated: true,
              });
            }

            // Sync data after registration
            await fullSync().catch(err => console.error('Post-signup sync failed:', err));
            set({ isLoading: false });
            return { success: true };
        } catch (error) {
          set({ error: error.message, isLoading: false });
          return { success: false, error: error.message };
        }
      },

      /**
       * Sign out
       */
      signOut: async () => {
        intentionalSignOut = true;

        if (isSupabaseConfigured()) {
          await supabase.auth.signOut();
        }

        // Clear ALL data stores to prevent data leaking between users
        useMotherStore.getState().reset();
        usePregnancyStore.getState().reset();
        useChildStore.getState().reset();
        useTimelineStore.getState().reset();
        useNotificationStore.getState().reset();
        useOnboardingStore.getState().reset();

        set({
          user: null,
          profile: null,
          session: null,
          isAuthenticated: false,
          error: null,
        });
        // Clear persisted state
        localStorage.removeItem('nurtureai-auth');
        intentionalSignOut = false;
      },

      /**
       * Fetch user profile from Supabase or local DB
       */
      fetchProfile: async (userId) => {
        try {
          if (isSupabaseConfigured()) {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();

            if (error) throw error;

            set({ profile: data });
            await db.profiles.put({ ...data, synced_at: new Date().toISOString() });
          } else {
            const localProfile = await db.profiles.get(userId);
            if (localProfile) {
              set({ profile: localProfile });
            }
          }
        } catch (error) {
          // Try local cache
          const localProfile = await db.profiles.get(userId);
          if (localProfile) {
            set({ profile: localProfile });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * Check if user has a specific role
       */
      hasRole: (role) => {
        const { profile } = get();
        return profile?.role === role;
      },

      /**
       * Check if user has any of the given roles
       */
      hasAnyRole: (roles) => {
        const { profile } = get();
        return roles.includes(profile?.role);
      },
    }),
    {
      name: 'nurtureai-auth',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
      }),
    }
  )
);

export default useAuthStore;
