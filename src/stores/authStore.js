import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import supabase, { isSupabaseConfigured } from '../lib/supabase';
import useMotherStore from './motherStore';
import usePregnancyStore from './pregnancyStore';
import useChildStore from './childStore';
import useTimelineStore from './timelineStore';
import useNotificationStore from './notificationStore';
import useOnboardingStore from './onboardingStore';
import useVisitStore from './visitStore';
import useReferralStore from './referralStore';
import useWeeklyJournalStore from './weeklyJournalStore';
import useAppStore from './appStore';
import { clearOutbox } from '../lib/sync';

/**
 * NurtureAI — Auth Store
 * 
 * Manages authentication state, user profile, and role-based access.
 * All data is read and written directly to Supabase.
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
          set({ isLoading: false, error: 'Supabase is not configured. Please check your environment settings.' });
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
            } else {
              console.error('Profile fetch error:', profileError);
            }
          }
        } catch (error) {
          console.error('Auth init error:', error);
          set({ error: error.message });
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
                useVisitStore.getState().reset();
                useReferralStore.getState().reset();
                useWeeklyJournalStore.getState().reset();
                useAppStore.getState().clearCurrentPatient();

                set({
                  user: null,
                  profile: null,
                  session: null,
                  isAuthenticated: false,
                });
                localStorage.removeItem('nurtureai-auth');
              } else {
                // Forced sign-out (token refresh failed, etc.)
                console.warn('[Auth] Session lost (forced sign-out). Please sign in again.');
                // Clear ALL data stores + outbox to prevent data leaking between users
                useMotherStore.getState().reset();
                usePregnancyStore.getState().reset();
                useChildStore.getState().reset();
                useTimelineStore.getState().reset();
                useNotificationStore.getState().reset();
                useOnboardingStore.getState().reset();
                useVisitStore.getState().reset();
                useReferralStore.getState().reset();
                useWeeklyJournalStore.getState().reset();
                useAppStore.getState().clearCurrentPatient();
                clearOutbox();
                set({
                  user: null,
                  profile: null,
                  session: null,
                  isAuthenticated: false,
                });
                localStorage.removeItem('nurtureai-auth');
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
          set({ error: 'Supabase is not configured. Please check your environment settings.', isLoading: false });
          return { success: false, error: 'Supabase is not configured.' };
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
          }

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
          set({ error: 'Supabase is not configured. Please check your environment settings.', isLoading: false });
          return { success: false, error: 'Supabase is not configured.' };
        }

        try {
          // Public self-registration is always a mother. Worker/admin accounts
          // are created by an admin through a dedicated, authorized flow.
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                ...profileData,
                role: ROLES.MOTHER,
              },
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
        useVisitStore.getState().reset();
        useReferralStore.getState().reset();
        useWeeklyJournalStore.getState().reset();
        useAppStore.getState().clearCurrentPatient();
        clearOutbox();

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
       * Fetch user profile from Supabase
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
          }
        } catch (error) {
          console.error('Profile fetch error:', error);
          set({ error: error.message });
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
