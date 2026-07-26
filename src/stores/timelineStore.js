import { create } from 'zustand';
import { buildPregnancyTimeline, buildChildTimeline, generateAIInsights } from '../services/timelineService';

/**
 * NurtureAI — Timeline Store
 *
 * Manages the health journey timeline state.
 * Builds, caches, and filters timeline events for the current user.
 */
const useTimelineStore = create((set, get) => ({
  pregnancyEvents: [],
  pregnancyProgress: null,
  childEvents: {},
  childProgress: {},
  allEvents: [],
  aiInsights: [],
  isLoading: false,
  error: null,
  activeFilter: 'all',
  expandedEventId: null,
  celebrationEvent: null,
  showCelebration: false,

  buildPregnancyTimeline: async (profileId) => {
    set({ isLoading: true, error: null });
    try {
      const { events, progress } = await buildPregnancyTimeline(profileId);
      const insights = progress
        ? generateAIInsights(progress, null, events.filter(e => e.category === 'anc').length, 0)
        : [];

      set((state) => {
        const allEvents = [...events, ...state.aiInsights.filter(i => !events.some(e => e.id === i.id))];
        const filtered = get().filterEvents(allEvents, state.activeFilter);
        return {
          pregnancyEvents: events,
          pregnancyProgress: progress,
          aiInsights: insights,
          allEvents: filtered,
          isLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to build pregnancy timeline:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  buildChildTimeline: async (childId) => {
    set({ isLoading: true, error: null });
    try {
      const { events, progress } = await buildChildTimeline(childId);
      const insights = progress
        ? generateAIInsights(null, progress, 0, events.filter(e => e.category === 'vaccination').length)
        : [];

      set((state) => {
        const updatedChildEvents = { ...state.childEvents, [childId]: events };
        const updatedChildProgress = { ...state.childProgress, [childId]: progress };

        const allChildEvts = Object.values(updatedChildEvents).flat();
        const allInsights = [...state.aiInsights.filter(i => !allChildEvts.some(e => e.id === i.id)), ...insights];
        const allEvts = [...state.pregnancyEvents, ...allChildEvts, ...allInsights];
        const filtered = get().filterEvents(allEvts, state.activeFilter);

        return {
          childEvents: updatedChildEvents,
          childProgress: updatedChildProgress,
          aiInsights: allInsights,
          allEvents: filtered,
          isLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to build child timeline:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  buildAllTimelines: async (profileId, childIds = []) => {
    set({ isLoading: true, error: null });
    try {
      const { events: pEvents, progress: pProgress } = await buildPregnancyTimeline(profileId);
      const cEventsMap = {};
      const cProgressMap = {};

      for (const childId of childIds) {
        const { events, progress } = await buildChildTimeline(childId);
        cEventsMap[childId] = events;
        cProgressMap[childId] = progress;
      }

      const allChildEvts = Object.values(cEventsMap).flat();
      const totalVax = allChildEvts.filter(e => e.category === 'vaccination').length;
      const childProg = Object.values(cProgressMap).find(Boolean);
      const insights = generateAIInsights(pProgress, childProg, pEvents.filter(e => e.category === 'anc').length, totalVax);

      const allEvts = [...pEvents, ...allChildEvts, ...insights];
      const filtered = get().filterEvents(allEvts, get().activeFilter);

      set({
        pregnancyEvents: pEvents,
        pregnancyProgress: pProgress,
        childEvents: cEventsMap,
        childProgress: cProgressMap,
        aiInsights: insights,
        allEvents: filtered,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to build timelines:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  setFilter: (filter) => {
    set((state) => {
      const allRaw = [...state.pregnancyEvents, ...Object.values(state.childEvents).flat(), ...state.aiInsights];
      const filtered = get().filterEvents(allRaw, filter);
      return { activeFilter: filter, allEvents: filtered };
    });
  },

  filterEvents: (events, filter) => {
    if (filter === 'all') return events;
    return events.filter(e => {
      if (filter === 'pregnancy') return e.category === 'pregnancy';
      if (filter === 'anc') return e.category === 'anc';
      if (filter === 'vaccination') return e.category === 'vaccination';
      if (filter === 'growth') return e.category === 'growth';
      if (filter === 'visit') return e.category === 'visit';
      if (filter === 'referral') return e.category === 'referral';
      if (filter === 'ai') return e.category === 'ai' || e.isAI;
      if (filter === 'overdue') return e.type === 'overdue';
      return true;
    });
  },

  toggleExpandEvent: (eventId) => {
    set((state) => ({
      expandedEventId: state.expandedEventId === eventId ? null : eventId,
    }));
  },

  triggerCelebration: (event) => {
    set({ celebrationEvent: event, showCelebration: true });
  },

  dismissCelebration: () => {
    set({ celebrationEvent: null, showCelebration: false });
  },

  clearTimeline: () => {
    set({
      pregnancyEvents: [],
      pregnancyProgress: null,
      childEvents: {},
      childProgress: {},
      allEvents: [],
      aiInsights: [],
      activeFilter: 'all',
      expandedEventId: null,
      isLoading: false,
      error: null,
    });
  },

  /**
   * Reset store state — called on logout to prevent data leaking between users.
   */
  reset: () => set({
    pregnancyEvents: [],
    pregnancyProgress: null,
    childEvents: {},
    childProgress: {},
    allEvents: [],
    aiInsights: [],
    activeFilter: 'all',
    expandedEventId: null,
    celebrationEvent: null,
    showCelebration: false,
    isLoading: false,
    error: null,
  }),
}));

export default useTimelineStore;
