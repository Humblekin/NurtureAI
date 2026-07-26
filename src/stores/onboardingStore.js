import { create } from 'zustand';
import { OnboardingEngine } from '../services/onboardingEngine';
import db, { generateId, queueSync } from '../lib/db';
import useMotherStore from './motherStore';
import usePregnancyStore from './pregnancyStore';
import useChildStore from './childStore';

/**
 * NurtureAI — Onboarding Store
 *
 * Manages the conversational onboarding flow for new mothers.
 * Orchestrates the OnboardingEngine, saves data to IndexedDB, and syncs to Supabase.
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
    });
  },

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

  confirmAndSave: async (confirmed, profileData = {}) => {
    const { engine } = get();
    if (!engine) return { success: false };

    set({ isSaving: true, error: null });

    try {
      const result = await engine.handleConfirmation(confirmed);

      if (!result.success) {
        set({ isSaving: false });
        return result;
      }

      const { motherProfile, pregnancyProfile, childrenProfiles } = result;

      // Set phone from registration data
      if (profileData.phone) {
        motherProfile.phone = profileData.phone;
      }

      // Use motherStore to register mother (keeps store state in sync)
      const motherResult = await useMotherStore.getState().registerMother(motherProfile);
      if (!motherResult.success) {
        set({ isSaving: false, error: 'Failed to save mother profile.' });
        return { success: false, error: motherResult.error };
      }

      const motherId = motherResult.data.id;

      // Use pregnancyStore to register pregnancy if applicable
      let pregnancyId = null;
      if (pregnancyProfile) {
        pregnancyProfile.mother_id = motherId;
        const pregResult = await usePregnancyStore.getState().registerPregnancy(pregnancyProfile);
        if (pregResult.success) {
          pregnancyId = pregResult.data.id;
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
        patient_id: motherId,
        created_at: new Date().toISOString(),
      };
      await db.notifications.put(welcomeNotification);
      await queueSync('notifications', notificationId, 'INSERT', welcomeNotification);

      set({
        isSaving: false,
        isComplete: true,
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
  }),
}));

export default useOnboardingStore;
