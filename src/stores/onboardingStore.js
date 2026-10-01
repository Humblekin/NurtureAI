import { create } from 'zustand';
import { OnboardingEngine, buildProfileRecords } from '../services/onboardingEngine';
import { coerceDraft } from '../services/onboardingFields';
import { generateId } from '../lib/db';
import { upsertRecord } from '../lib/sync';
import useMotherStore from './motherStore';
import usePregnancyStore from './pregnancyStore';
import useChildStore from './childStore';
import supabase, { isSupabaseConfigured } from '../lib/supabase';
import { calculateWeeksFromLMP } from '../lib/pregnancy';

/**
 * NurtureAI — Onboarding Store
 *
 * Manages the conversational onboarding flow for new mothers.
 * Orchestrates the OnboardingEngine, saves data directly to Supabase.
 */

const useOnboardingStore = create((set, get) => ({
  // State
  engine: null,
  conversationHistory: [],
  collectedData: {},
  currentQuestion: null,
  progress: 0,
  isStarted: false,
  isComplete: false,
  isSaving: false,
  summary: null,
  error: null,
  language: 'en',

  // Canonical profile data waiting to be reviewed in the form. The voice path
  // fills this so "Talk With Amina" ends on an editable screen instead of a
  // read-only summary the mother cannot correct.
  draft: null,

  // Actions
  startOnboarding: (profileId, profileData, language = 'en') => {
    const engine = new OnboardingEngine(profileId, language);
    const { welcomeText, firstQuestion, conversationHistory } = engine.start();

    // Pre-fill name from registration if available
    if (profileData?.full_name) {
      engine.collectedData.full_name = profileData.full_name;
    }
    if (profileData?.phone) {
      engine.collectedData.phone = profileData.phone;
    }

    set({
      engine,
      conversationHistory,
      currentQuestion: firstQuestion,
      progress: engine.getProgress(),
      isStarted: true,
      isComplete: false,
      isSaving: false,
      summary: null,
      error: null,
      language,
      draft: null,
    });
  },

  /**
   * Hand the collected answers to the form for review and correction.
   */
  saveDraft: (draft) => {
    set({ draft: coerceDraft(draft) });
  },

  clearDraft: () => set({ draft: null }),

  sendResponse: async (userResponse) => {
    const { engine, conversationHistory } = get();
    if (!engine || engine.isComplete) return;

    set({ error: null });

    try {
      const result = await engine.processResponse(userResponse);

      if (result.success) {
        // Update conversation history with new messages
        const newHistory = [...engine.conversationHistory];

        set({
          conversationHistory: newHistory,
          collectedData: { ...engine.collectedData },
          progress: engine.getProgress(),
          currentQuestion: result.nextQuestion || null,
          isComplete: result.isComplete,
          summary: result.summary || null,
        });

        return result;
      }
    } catch (error) {
      console.error('[Onboarding] Response processing failed:', error);
      set({ error: 'Something went wrong. Please try again.' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Save a health profile to the database.
   *
   * This is the ONLY place profiles are persisted. Both setup paths call it:
   * the voice path passes what the conversation collected, the form path passes
   * what the mother reviewed. `draft` lets the form override; otherwise the
   * engine's collected answers are used.
   *
   * Everything that made a save safe lives here — claim_mother to avoid
   * duplicate patient records, the community health worker lookup, the welcome
   * journal entry and the welcome notification.
   */
  confirmAndSave: async (confirmed = true, profileData = {}, draft = null) => {
    const { engine, draft: storeDraft } = get();
    const source = draft || storeDraft || engine?.collectedData;
    if (!source) return { success: false };

    const profileId = profileData.profileId || engine?.profileId || null;
    const userId = profileData.userId || engine?.profileId || null;

    set({ isSaving: true, error: null });

    try {
      const { motherProfile, pregnancyProfile, childrenProfiles } =
        buildProfileRecords(source, profileId);

      // Set phone from registration data
      if (profileData.phone) {
        motherProfile.phone = profileData.phone;
      }

      // Mother-provided registration — mark as pending worker verification
      const provenance = { data_source: 'mother_registered', verified: false };
      motherProfile.data_source = motherProfile.data_source || provenance.data_source;
      motherProfile.verified = motherProfile.verified === undefined ? provenance.verified : motherProfile.verified;
      if (pregnancyProfile) {
        pregnancyProfile.data_source = pregnancyProfile.data_source || provenance.data_source;
        pregnancyProfile.verified = pregnancyProfile.verified === undefined ? provenance.verified : pregnancyProfile.verified;
      }
      (childrenProfiles || []).forEach((child) => {
        child.data_source = child.data_source || provenance.data_source;
        child.verified = child.verified === undefined ? provenance.verified : child.verified;
      });

      // Best-effort: assign a community health worker to the mother
      if (isSupabaseConfigured() && motherProfile.community) {
        try {
          const { data: chwRows, error: chwError } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'chw')
            .ilike('community', `%${motherProfile.community}%`)
            .limit(1);
          if (!chwError && chwRows?.length > 0) {
            motherProfile.assigned_worker_id = chwRows[0].id;
          }
        } catch (err) {
          console.warn('[Onboarding] CHW lookup failed:', err);
        }
      }

      // Prefer to link an existing unclaimed mother record — a healthcare
      // worker may have registered this mother before she had an account
      // (profile_id IS NULL). Claiming on an exact phone + full-name match
      // prevents duplicate patient records. Falls through to a new record
      // when no match exists.
      let motherId = null;
      let motherResult = null;
      let claimedMother = null;
      if (isSupabaseConfigured()) {
        try {
          const { data: claimed, error: claimError } = await supabase
            .rpc('claim_mother', {
              p_phone: motherProfile.phone || '',
              p_full_name: motherProfile.full_name || '',
            });
          if (!claimError && Array.isArray(claimed) && claimed.length > 0) {
            claimedMother = claimed[0];
          }
        } catch (err) {
          console.warn('[Onboarding] Claim lookup failed, registering new record:', err);
        }
      }

      if (claimedMother) {
        await useMotherStore.getState().adoptMother(claimedMother);
        motherId = claimedMother.id;
        motherResult = { success: true, data: claimedMother };
      } else {
        // Use motherStore to register mother (keeps store state in sync)
        motherResult = await useMotherStore.getState().registerMother(motherProfile);
        motherId = motherResult.data.id;
      }

      if (!motherResult.success) {
        set({ isSaving: false, error: 'Failed to save mother profile.' });
        return { success: false, error: motherResult.error };
      }

      // Use pregnancyStore to register pregnancy if applicable
      let pregnancyId = null;
      if (pregnancyProfile) {
        pregnancyProfile.mother_id = motherId;
        const pregResult = await usePregnancyStore.getState().registerPregnancy(pregnancyProfile);
        if (pregResult.success) {
          pregnancyId = pregResult.data.id;
        }
      }

      // Create initial pregnancy weekly journal entry
      if (pregnancyId) {
        try {
          const weekNumber = pregnancyProfile?.lmp
            ? calculateWeeksFromLMP(pregnancyProfile.lmp) || 1
            : 1;
          const journalEntry = {
            id: generateId(),
            user_id: userId,
            pregnancy_id: pregnancyId,
            week_number: weekNumber,
            entry_date: new Date().toISOString(),
            mother_feeling: '',
            baby_movement: '',
            symptoms: '',
            mood: '',
            sleep_quality: '',
            nutrition_notes: '',
            water_intake: '',
            exercise_notes: '',
            medication_notes: '',
            weight: '',
            blood_pressure: '',
            additional_notes: `Welcome! This entry was created during onboarding for week ${weekNumber}. Please add your weekly health notes here.`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await upsertRecord('weekly_journals', journalEntry);
        } catch (err) {
          console.warn('[Onboarding] Initial weekly journal creation failed:', err);
        }
      }

      // Register children if applicable
      const childIds = [];
      if (childrenProfiles && childrenProfiles.length > 0) {
        for (const childProfile of childrenProfiles) {
          childProfile.mother_id = motherId;
          const childResult = await useChildStore.getState().registerChild(childProfile);
          if (childResult.success) {
            childIds.push(childResult.data.id);
          }
        }
      }

      // Create welcome notification
      const notificationId = generateId();
      const welcomeNotification = {
        id: notificationId,
        type: 'welcome',
        priority: 'medium',
        title: 'Welcome to NurtureAI!',
        message: `Hi ${motherProfile.full_name}! Your health profile has been set up. Amina is here to support you throughout your pregnancy journey.`,
        read: false,
        user_id: userId,
        patient_id: motherId,
        created_at: new Date().toISOString(),
      };
      await upsertRecord('notifications', welcomeNotification);

      set({
        isSaving: false,
        isComplete: true,
        // Saved: drop the draft so a later visit cannot re-submit it.
        draft: null,
      });

      return { success: true, motherId, pregnancyId, childIds };
    } catch (error) {
      console.error('[Onboarding] Save failed:', error);
      set({ isSaving: false, error: 'Failed to save your profile. Please try again.' });
      return { success: false, error: error.message };
    }
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  /**
   * Reset store state — called on logout to prevent data leaking between users.
   */
  reset: () => set({
    engine: null,
    conversationHistory: [],
    collectedData: {},
    currentQuestion: null,
    progress: 0,
    isStarted: false,
    isComplete: false,
    isSaving: false,
    summary: null,
    error: null,
    language: 'en',
    draft: null,
  }),
}));

export default useOnboardingStore;
