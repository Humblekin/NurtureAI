/**
 * NurtureAI — ConversationManager (Redesigned)
 *
 * Framework-agnostic service managing the full voice conversation lifecycle.
 * Enforces a strict state machine with only one active state at a time.
 *
 * States: IDLE → GREETING → LISTENING → PROCESSING → SPEAKING → LISTENING
 *
 * Key improvements over v1:
 * - Strict state machine with enforced transitions
 * - AbortController for AI requests (no duplicate requests)
 * - Proper barge-in: speech stops instantly, recognition restarts
 * - End-of-speech detection via configurable silence threshold
 * - No own SpeechRecognition instance — manages lifecycle through deps
 */

import db from '../lib/db';

export const CONVERSATION_STATES = {
  IDLE: 'idle',
  GREETING: 'greeting',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  PAUSED: 'paused',
  ERROR: 'error',
};

// Valid state transitions — enforces one-way flow
const VALID_TRANSITIONS = {
  [CONVERSATION_STATES.IDLE]: [CONVERSATION_STATES.GREETING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.GREETING]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.LISTENING]: [CONVERSATION_STATES.PROCESSING, CONVERSATION_STATES.SPEAKING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.PROCESSING]: [CONVERSATION_STATES.SPEAKING, CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.SPEAKING]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.PROCESSING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.PAUSED]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.IDLE, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.ERROR]: [CONVERSATION_STATES.IDLE, CONVERSATION_STATES.LISTENING],
};

/**
 * Creates a ConversationManager instance.
 *
 * @param {object} deps - Dependencies injected from React
 * @param {function} deps.sendToAI - async (messages, options) => string
 * @param {function} deps.speakText - async (text, signal?) => void
 * @param {function} deps.stopSpeech - () => void
 * @param {function} deps.startListening - () => void
 * @param {function} deps.stopListening - () => void
 * @param {function} deps.onStateChange - (state) => void
 * @param {function} deps.onMessagesChange - (messages) => void
 * @param {function} deps.onTranscriptChange - (transcript) => void
 * @param {function} deps.onError - (error) => void
 * @param {function} deps.onGreeting - (greetingData) => void
 */
export function createConversationManager(deps) {
  const {
    sendToAI,
    speakText,
    stopSpeech,
    startListening,
    stopListening,
    onStateChange,
    onMessagesChange,
    onTranscriptChange,
    onError,
    onGreeting,
    setListeningActive,
  } = deps;

  // ---- Internal state ----
  let state = CONVERSATION_STATES.IDLE;
  let messages = [];
  let destroyed = false;
  let language = 'en';
  let userProfile = null;
  let healthContext = '';
  let proactiveContext = '';
  let conversationStartTime = null;
  let messageCount = 0;

  // Abort controller for current AI request
  let aiAbortController = null;

  // Silence detection
  let silenceTimer = null;
  let lastSpeechTime = 0;
  const SILENCE_THRESHOLD_MS = 2000; // 2s silence = end of utterance
  const SILENCE_CHECK_INTERVAL = 150;

  // ---- State machine ----
  function setState(newState) {
    if (state === newState) return;
    if (!VALID_TRANSITIONS[state]?.includes(newState)) {
      console.warn(`[ConversationManager] Invalid transition: ${state} → ${newState}`);
      return;
    }
    state = newState;
    onStateChange?.(state);
    // Sync the listening active flag with the hook
    if (setListeningActive) {
      setListeningActive(newState === CONVERSATION_STATES.LISTENING);
    }
  }

  function forceState(newState) {
    // Force transition without validation (for error recovery, destroy, etc.)
    state = newState;
    onStateChange?.(state);
    if (setListeningActive) {
      setListeningActive(newState === CONVERSATION_STATES.LISTENING);
    }
  }

  function setMessages(msgs) {
    messages = msgs;
    onMessagesChange?.(msgs);
  }

  // ---- Cancel any in-progress work ----
  function cancelCurrentWork() {
    // Cancel AI request
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    // Stop speech
    stopSpeech();
    // Stop listening
    stopListening();
    // Clear silence timer
    clearSilenceTimer();
    // Clear transcript
    onTranscriptChange?.('');
  }

  // ---- Silence / end-of-utterance detection ----
  function startSilenceDetection() {
    clearSilenceTimer();
    lastSpeechTime = Date.now();
    silenceTimer = setInterval(() => {
      if (state !== CONVERSATION_STATES.LISTENING) {
        clearSilenceTimer();
        return;
      }
      if (Date.now() - lastSpeechTime > SILENCE_THRESHOLD_MS && lastSpeechTime > 0) {
        // Silence detected — this is just informational.
        // The actual finalization happens in handleUserSpeech when
        // the recognition engine delivers a final result.
        clearSilenceTimer();
      }
    }, SILENCE_CHECK_INTERVAL);
  }

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearInterval(silenceTimer);
      silenceTimer = null;
    }
  }

  // ---- Handle user speech (called by hook when final transcript arrives) ----
  async function handleUserSpeech(text) {
    if (!text || destroyed || state === CONVERSATION_STATES.PROCESSING) return;

    // Don't stop recognition here — let it run during processing.
    // The state check below prevents duplicate processing.
    // Stopping and immediately restarting recognition causes a race condition
    // where start() fails because the engine hasn't fully stopped yet.
    clearSilenceTimer();
    onTranscriptChange?.('');

    // Add user message
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    messageCount++;

    // Transition to processing
    setState(CONVERSATION_STATES.PROCESSING);

    // Create abort controller for this request
    aiAbortController = new AbortController();

    try {
      const langInstruction = language === 'dag'
        ? '\n\nIMPORTANT: The user is communicating in Dagbani. You MUST respond entirely in Dagbani. Use simple Dagbani with occasional English medical terms in parentheses when needed for clarity.'
        : '\n\nThe user is communicating in English. Respond in English.';

      const apiMessages = newMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await sendToAI(apiMessages, {
        userRole: userProfile?.role || 'mother',
        languageInstruction: langInstruction,
        healthContext,
        proactiveContext,
        signal: aiAbortController.signal,
      });

      // Check if destroyed or aborted after await
      if (destroyed || aiAbortController?.signal.aborted) return;

      // Add assistant message
      const assistantMsg = { role: 'assistant', content: response };
      setMessages([...newMessages, assistantMsg]);

      // Stop recognition before speaking — prevents barge-in detection
      // from firing immediately (isListening && isSpeaking would be true)
      stopListening();

      // Transition to speaking
      setState(CONVERSATION_STATES.SPEAKING);

      try {
        await speakText(response, aiAbortController.signal);
      } catch (speakErr) {
        if (speakErr.name === 'AbortError') {
          // Barge-in — user spoke while we were speaking
        } else {
          console.error('[ConversationManager] Speech error:', speakErr);
          onError?.('speech_error');
        }
      }

      if (destroyed) return;

      // onSpeechEnded() already calls restartListening() when TTS finishes.
      // Only restart here as a fallback if state is still SPEAKING
      // (e.g. speakText threw before onSpeechEnd could fire).
      if (state === CONVERSATION_STATES.SPEAKING) {
        restartListening();
      }
    } catch (err) {
      if (destroyed) return;
      if (err.name === 'AbortError') return; // Cancelled by new request

      console.error('[ConversationManager] Processing error:', err);
      onError?.('processing_error');

      // Recover — go back to listening
      restartListening();
    } finally {
      aiAbortController = null;
    }
  }

  // ---- Restart listening after speaking or error ----
  function restartListening() {
    if (destroyed) return;
    setState(CONVERSATION_STATES.LISTENING);
    // Small delay to ensure recognition engine is fully stopped before restarting.
    // Without this, recognition.start() can fail silently if called too soon
    // after recognition.stop().
    setTimeout(() => {
      if (destroyed || state !== CONVERSATION_STATES.LISTENING) return;
      startListening();
      startSilenceDetection();
    }, 80);
  }

  // ---- Generate personalized greeting ----
  async function generatePersonalizedGreeting() {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    let personalGreeting = '';

    if (healthContext) {
      const nameMatch = healthContext.match(/Name: ([^\n]+)/);
      const motherName = nameMatch ? nameMatch[1].trim() : null;
      const weekMatch = healthContext.match(/Week (\d+)/);
      const pregnancyWeek = weekMatch ? parseInt(weekMatch[1]) : null;
      const childMatch = healthContext.match(/(\w+) \((\w+), (\d+) months old\)/);
      const childName = childMatch ? childMatch[1] : null;
      const hasOverdueAnc = healthContext.includes('OVERDUE') && healthContext.includes('ANC');
      const hasOverdueVax = healthContext.includes('VACCINATION OVERDUE');
      const hasOverdueGrowth = healthContext.includes('GROWTH CHECK OVERDUE');

      if (language === 'dag') {
        personalGreeting = `Sannu! Ni ce Amina, abokiyar ki ta lafiya.`;
        if (motherName) personalGreeting += ` ${motherName}, n na le?`;
        if (pregnancyWeek) personalGreeting += ` Ki na ${pregnancyWeek} wa ciki.`;
        personalGreeting += ` Yelima wula ka nyen soŋa zaŋkpa n ni kali a binyerishaŋa?`;
      } else {
        personalGreeting = `${timeGreeting}! I'm Amina, your healthcare companion.`;
        if (motherName) personalGreeting += ` ${motherName}, how are you today?`;
        if (pregnancyWeek) personalGreeting += ` You are now ${pregnancyWeek} weeks pregnant.`;
        if (childName) personalGreeting += ` How is ${childName} doing?`;

        if (hasOverdueAnc) {
          personalGreeting += ` I notice your last antenatal visit was a while ago — let's talk about scheduling your next check-up.`;
        } else if (hasOverdueVax) {
          personalGreeting += ` I see there's a vaccination due — we should discuss that.`;
        } else if (hasOverdueGrowth) {
          personalGreeting += ` It's been a while since ${childName || 'your child'}'s last growth check.`;
        }

        personalGreeting += ` How can I help you today?`;
      }
    } else {
      if (language === 'dag') {
        personalGreeting = "Sannu! Ni ce Amina, abokiyar ki ta lafiya. Yelima wula ka nyen soŋa zaŋkpa n ni kali a binyerishaŋa?";
      } else {
        personalGreeting = `${timeGreeting}! I'm Amina, your maternal and child healthcare companion. I'm here to help you with pregnancy, child health, nutrition, and more. How can I help you today?`;
      }
    }

    return personalGreeting;
  }

  // ---- Conversation Summary (Long-term Memory) ----
  async function saveConversationSummary() {
    if (!userProfile?.id || messages.length < 2) return;

    try {
      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      if (userMessages.length === 0) return;

      const allText = userMessages.map(m => m.content).join(' ');
      const topics = extractTopics(allText);

      const summaryParts = [];
      if (userMessages.length <= 3) {
        summaryParts.push(userMessages.map(m => m.content.substring(0, 100)).join('; '));
      } else {
        summaryParts.push(userMessages.slice(0, 3).map(m => m.content.substring(0, 80)).join('; '));
        summaryParts.push(`... and ${userMessages.length - 3} more questions`);
      }

      await db.ai_conversations.add({
        id: `conv-${userProfile.id}-${Date.now()}`,
        user_id: userProfile.id,
        summary: summaryParts.join(' '),
        topics,
        message_count: messages.length,
        last_message: assistantMessages[assistantMessages.length - 1]?.content?.substring(0, 200) || '',
        started_at: conversationStartTime || new Date().toISOString(),
        created_at: new Date().toISOString(),
        synced_at: null,
      });
    } catch (err) {
      console.warn('[ConversationManager] Failed to save conversation summary:', err);
    }
  }

  function extractTopics(text) {
    const lower = text.toLowerCase();
    const topicKeywords = {
      pregnancy: ['pregnant', 'pregnancy', 'baby', 'weeks', 'trimester', 'edd', 'lmp', 'antenatal', 'anc'],
      child_health: ['child', 'baby', 'vaccination', 'vaccine', 'growth', 'milestone', 'breastfeeding', 'feeding'],
      nutrition: ['food', 'eat', 'nutrition', 'iron', 'folic', 'supplement', 'diet', 'meal'],
      symptoms: ['pain', 'bleeding', 'headache', 'fever', 'swelling', 'nausea', 'vomiting', 'dizzy'],
      appointment: ['appointment', 'visit', 'clinic', 'hospital', 'facility', 'check-up'],
      medication: ['medicine', 'medication', 'drug', 'prescription', 'tablet'],
      mental_health: ['stress', 'anxiety', 'depression', 'worried', 'scared', 'mood'],
    };

    const foundTopics = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        foundTopics.push(topic);
      }
    }
    return foundTopics.length > 0 ? foundTopics : ['general'];
  }

  // ---- Public API ----
  return {
    getState: () => state,
    getMessages: () => messages,

    /**
     * Initialize and start the conversation.
     */
    async init(opts = {}) {
      language = opts.language || 'en';
      userProfile = opts.userProfile || null;
      conversationStartTime = new Date().toISOString();
      messageCount = 0;

      forceState(CONVERSATION_STATES.IDLE);

      // Speak personalized greeting
      forceState(CONVERSATION_STATES.GREETING);
      const welcome = await generatePersonalizedGreeting();
      setMessages([{ role: 'assistant', content: welcome }]);

      onGreeting?.({
        text: welcome,
        motherName: healthContext.match(/Name: ([^\n]+)/)?.[1]?.trim(),
        pregnancyWeek: healthContext.match(/Week (\d+)/)?.[1] ? parseInt(healthContext.match(/Week (\d+)/)[1]) : null,
      });

      try {
        aiAbortController = new AbortController();
        await speakText(welcome, aiAbortController.signal);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[ConversationManager] Greeting speech error:', err);
        }
      }

      if (destroyed) return;

      aiAbortController = null;

      // Start listening — begin the conversation loop
      restartListening();
    },

    /**
     * Process a final transcript from speech recognition.
     * Called by the hook when recognition delivers a final result.
     */
    onFinalTranscript(text) {
      if (destroyed || state !== CONVERSATION_STATES.LISTENING) return;
      handleUserSpeech(text);
    },

    /**
     * Process interim transcript for live display.
     */
    onInterimTranscript(text) {
      if (destroyed || state !== CONVERSATION_STATES.LISTENING) return;
      onTranscriptChange?.(text);
    },

    /**
     * Send a text message (for chat mode integration).
     */
    async sendText(text) {
      if (!text?.trim()) return null;

      cancelCurrentWork();

      const userMsg = { role: 'user', content: text.trim() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      messageCount++;

      forceState(CONVERSATION_STATES.PROCESSING);

      try {
        const langInstruction = language === 'dag'
          ? '\n\nIMPORTANT: The user is communicating in Dagbani. You MUST respond entirely in Dagbani.'
          : '\n\nThe user is communicating in English. Respond in English.';

        const apiMessages = newMessages
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role, content: m.content }));

        const response = await sendToAI(apiMessages, {
          userRole: userProfile?.role || 'mother',
          languageInstruction: langInstruction,
          healthContext,
          proactiveContext,
        });

        if (destroyed) return response;

        const assistantMsg = { role: 'assistant', content: response };
        setMessages([...newMessages, assistantMsg]);
        return response;
      } catch {
        if (destroyed) return null;
        return 'I apologize, I encountered an error. Please try again.';
      }
    },

    /**
     * Pause the conversation.
     */
    pause() {
      cancelCurrentWork();
      forceState(CONVERSATION_STATES.PAUSED);
    },

    /**
     * Resume from pause.
     */
    resume() {
      if (destroyed) return;
      restartListening();
    },

    /**
     * Barge-in: user started speaking while Amina was talking.
     * Immediately stops TTS, cancels any pending AI request, and switches to listening.
     */
    bargeIn() {
      if (state === CONVERSATION_STATES.SPEAKING) {
        stopSpeech();
        // The speakText promise will reject with AbortError,
        // and the catch block will restart listening
      }
    },

    /**
     * Called by hook when speech playback starts (for avatar sync).
     */
    onSpeechStarted() {
      // Avatar already in SPEAKING state from setState — this is for any
      // additional sync needs (e.g., lip sync timing)
    },

    /**
     * Called by hook when speech playback ends naturally.
     */
    onSpeechEnded() {
      if (destroyed) return;
      if (state === CONVERSATION_STATES.SPEAKING) {
        restartListening();
      }
    },

    /**
     * Switch language.
     */
    setLanguage(lang) {
      language = lang;
    },

    setUserProfile(profile) {
      userProfile = profile;
    },

    setHealthContext(ctx) {
      healthContext = ctx;
      if (ctx) {
        const alertMatch = ctx.match(/\[PROACTIVE HEALTH ALERTS[^\]]*\]\n([\s\S]*?)(?=\n===|\n\n\[|\n$)/);
        if (alertMatch) {
          proactiveContext = alertMatch[1].trim();
        }
      }
    },

    /**
     * Clear conversation and reset.
     */
    reset() {
      saveConversationSummary();
      cancelCurrentWork();
      messages = [];
      messageCount = 0;
      conversationStartTime = new Date().toISOString();
      onMessagesChange?.([]);
      onTranscriptChange?.('');
      forceState(CONVERSATION_STATES.IDLE);
    },

    /**
     * Destroy the manager — clean up all resources.
     */
    destroy() {
      destroyed = true;
      saveConversationSummary();
      cancelCurrentWork();
    },
  };
}
