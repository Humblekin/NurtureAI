import db from '../lib/db';

export const CONVERSATION_STATES = {
  IDLE: 'idle',
  GREETING: 'greeting',
  LISTENING: 'listening',
  USER_SPEAKING: 'user_speaking',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  INTERRUPTED: 'interrupted',
  PAUSED: 'paused',
  ERROR: 'error',
};

const VALID_TRANSITIONS = {
  [CONVERSATION_STATES.IDLE]: [CONVERSATION_STATES.GREETING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.GREETING]: [CONVERSATION_STATES.SPEAKING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.LISTENING]: [CONVERSATION_STATES.USER_SPEAKING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.USER_SPEAKING]: [CONVERSATION_STATES.PROCESSING, CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.PROCESSING]: [CONVERSATION_STATES.SPEAKING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.SPEAKING]: [CONVERSATION_STATES.INTERRUPTED, CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.ERROR, CONVERSATION_STATES.PAUSED],
  [CONVERSATION_STATES.INTERRUPTED]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.IDLE, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.PAUSED]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.IDLE, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.ERROR]: [CONVERSATION_STATES.IDLE, CONVERSATION_STATES.LISTENING],
};

export function createConversationManager(deps) {
  const {
    sendToAI,
    speakText,
    stopSpeech,
    onStateChange,
    onMessagesChange,
    onTranscriptChange,
    onError,
    onGreeting,
  } = deps;

  let state = CONVERSATION_STATES.IDLE;
  let messages = [];
  let destroyed = false;
  let language = 'en';
  let userProfile = null;
  let healthContext = '';
  let proactiveContext = '';
  let conversationStartTime = null;
  let messageCount = 0;
  let aiAbortController = null;
  let lastSpokenText = '';

  function setState(newState) {
    if (state === newState) return;
    if (!VALID_TRANSITIONS[state]?.includes(newState)) {
      console.warn(`[ConversationManager] Invalid transition: ${state} → ${newState}`);
      return;
    }
    state = newState;
    onStateChange?.(state);
  }

  function forceState(newState) {
    state = newState;
    onStateChange?.(state);
  }

  function setMessages(msgs) {
    messages = msgs;
    onMessagesChange?.(msgs);
  }

  function cancelCurrentWork() {
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    stopSpeech();
    onTranscriptChange?.('');
  }

  // ---- Handle user speech (final transcript) ----
  async function handleUserSpeech(text) {
    if (!text || destroyed) return;

    console.log('[Conversation] ✅ Final transcript:', text);
    onTranscriptChange?.('');

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    messageCount++;

    setState(CONVERSATION_STATES.PROCESSING);
    aiAbortController = new AbortController();

    try {
      const langInstruction = language === 'dag'
        ? '\n\nIMPORTANT: The user is communicating in Dagbani. You MUST respond entirely in Dagbani. Use simple Dagbani with occasional English medical terms in parentheses when needed for clarity.'
        : '\n\nThe user is communicating in English. Respond in English.';

      const apiMessages = newMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      console.log('[Conversation] 🤖 Sending transcript to AI:', text);
      const response = await sendToAI(apiMessages, {
        userRole: userProfile?.role || 'mother',
        languageInstruction: langInstruction,
        healthContext,
        proactiveContext,
        signal: aiAbortController.signal,
      });

      if (destroyed || aiAbortController?.signal.aborted) return;

      const assistantMsg = { role: 'assistant', content: response };
      setMessages([...newMessages, assistantMsg]);
      lastSpokenText = response;
      console.log('[Conversation] 🤖 AI replied:', response.substring(0, 100) + (response.length > 100 ? '...' : ''));

      // Recognition stays running — barge-in is handled by onInterimTranscript
      console.log('[Conversation] 🔊 Speaking response...');

      try {
        await speakText(response, aiAbortController.signal);
      } catch (speakErr) {
        if (speakErr.name === 'AbortError') {
          // Barge-in — state already changed by onInterimTranscript
          return;
        }
        console.error('[ConversationManager] Speech error:', speakErr);
        onError?.('speech_error');
      }

      if (destroyed) return;

      if (state === CONVERSATION_STATES.PROCESSING || state === CONVERSATION_STATES.SPEAKING) {
        forceState(CONVERSATION_STATES.LISTENING);
      }
    } catch (err) {
      if (destroyed) return;
      if (err.name === 'AbortError') return;
      console.error('[ConversationManager] Processing error:', err);
      onError?.('processing_error');
      if (state === CONVERSATION_STATES.PROCESSING) {
        forceState(CONVERSATION_STATES.LISTENING);
      }
    } finally {
      aiAbortController = null;
    }
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

  // ---- Conversation Summary ----
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
      if (keywords.some(kw => lower.includes(kw))) foundTopics.push(topic);
    }
    return foundTopics.length > 0 ? foundTopics : ['general'];
  }

  // ---- Public API ----
  return {
    getState: () => state,
    getMessages: () => messages,

    async init(opts = {}) {
      language = opts.language || 'en';
      userProfile = opts.userProfile || null;
      conversationStartTime = new Date().toISOString();
      messageCount = 0;

      forceState(CONVERSATION_STATES.IDLE);

      const welcome = await generatePersonalizedGreeting();
      setMessages([{ role: 'assistant', content: welcome }]);

      onGreeting?.({
        text: welcome,
        motherName: healthContext.match(/Name: ([^\n]+)/)?.[1]?.trim(),
        pregnancyWeek: healthContext.match(/Week (\d+)/)?.[1] ? parseInt(healthContext.match(/Week (\d+)/)[1]) : null,
      });

      forceState(CONVERSATION_STATES.GREETING);
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

      console.log('[Conversation] 🎤 Greeting complete, listening...');
      forceState(CONVERSATION_STATES.LISTENING);
    },

    /**
     * Called when an interim recognition result arrives.
     * Drives VAD state transitions and auto-barge-in.
     */
    onInterimTranscript(text) {
      if (destroyed) return;
      onTranscriptChange?.(text);

      if (state === CONVERSATION_STATES.SPEAKING) {
        console.log('[Conversation] 🔇 User interrupted — stopping speech');
        stopSpeech();
        forceState(CONVERSATION_STATES.INTERRUPTED);
        forceState(CONVERSATION_STATES.USER_SPEAKING);
        return;
      }

      if (state === CONVERSATION_STATES.LISTENING) {
        setState(CONVERSATION_STATES.USER_SPEAKING);
        return;
      }
    },

    /**
     * Called when a final recognition result arrives.
     * Only processes if the user was actively speaking.
     */
    onFinalTranscript(text) {
      if (destroyed || !text) return;
      if (state !== CONVERSATION_STATES.USER_SPEAKING) return;

      // Ignore TTS echo: if the transcript looks like a fragment of what we just spoke
      if (lastSpokenText && text.length < 50) {
        const lowerText = text.toLowerCase().trim();
        const lowerLast = lastSpokenText.toLowerCase();
        if (lowerLast.startsWith(lowerText) || lowerLast.includes(lowerText)) {
          console.log('[Conversation] 🚫 Ignored TTS echo:', text);
          forceState(CONVERSATION_STATES.LISTENING);
          return;
        }
      }

      handleUserSpeech(text);
    },

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

    pause() {
      cancelCurrentWork();
      forceState(CONVERSATION_STATES.PAUSED);
    },

    resume() {
      if (destroyed) return;
      forceState(CONVERSATION_STATES.LISTENING);
    },

    bargeIn() {
      if (state === CONVERSATION_STATES.SPEAKING) {
        stopSpeech();
        forceState(CONVERSATION_STATES.INTERRUPTED);
        forceState(CONVERSATION_STATES.LISTENING);
      }
    },

    onSpeechStarted() {
      if (state === CONVERSATION_STATES.PROCESSING || state === CONVERSATION_STATES.GREETING) {
        setState(CONVERSATION_STATES.SPEAKING);
      }
    },

    onSpeechEnded() {
      if (destroyed) return;
      if (state === CONVERSATION_STATES.SPEAKING) {
        forceState(CONVERSATION_STATES.LISTENING);
      }
    },

    setLanguage(lang) { language = lang; },
    setUserProfile(profile) { userProfile = profile; },

    setHealthContext(ctx) {
      healthContext = ctx;
      if (ctx) {
        const alertMatch = ctx.match(/\[PROACTIVE HEALTH ALERTS[^\]]*\]\n([\s\S]*?)(?=\n===|\n\n\[|\n$)/);
        if (alertMatch) proactiveContext = alertMatch[1].trim();
      }
    },

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

    destroy() {
      destroyed = true;
      saveConversationSummary();
      cancelCurrentWork();
    },
  };
}
