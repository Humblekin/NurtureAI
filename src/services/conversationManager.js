import { generateId } from '../lib/db';
import { upsertRecord } from '../lib/sync';

export const CONVERSATION_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  INTERRUPTING: 'interrupting',
  PAUSED: 'paused',
  ERROR: 'error',
};

const VALID_TRANSITIONS = {
  [CONVERSATION_STATES.IDLE]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.SPEAKING, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.LISTENING]: [CONVERSATION_STATES.PROCESSING, CONVERSATION_STATES.PAUSED, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.PROCESSING]: [CONVERSATION_STATES.SPEAKING, CONVERSATION_STATES.PAUSED, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.SPEAKING]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.INTERRUPTING, CONVERSATION_STATES.PAUSED, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.INTERRUPTING]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.PAUSED, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.PAUSED]: [CONVERSATION_STATES.LISTENING, CONVERSATION_STATES.IDLE, CONVERSATION_STATES.ERROR],
  [CONVERSATION_STATES.ERROR]: [CONVERSATION_STATES.IDLE, CONVERSATION_STATES.LISTENING],
};

const RATE_LIMIT_MSG = "I'm a little busy right now. Please wait a few seconds.";

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
  let ttsAbortController = null;
  let aiAbortController = null;
  let recentTranscripts = [];
  let currentRequestId = 0;
  let activeRequestId = null;
  let isProcessing = false;

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
    if (state === newState) return;
    state = newState;
    onStateChange?.(state);
  }

  function setMessages(msgs) {
    messages = msgs;
    onMessagesChange?.(msgs);
  }

  function cancelCurrentWork() {
    if (ttsAbortController) {
      ttsAbortController.abort();
      ttsAbortController = null;
    }
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    stopSpeech();
    onTranscriptChange?.('');
    if (activeRequestId) {
      activeRequestId = null;
      isProcessing = false;
    }
  }

  // ---- Hash text for duplicate detection ----
  function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }

  // ---- Retry loop with exponential backoff ----
  async function sendWithRetry(apiMessages, opts, requestId, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (activeRequestId !== requestId) throw new DOMException('Aborted', 'AbortError');

      try {
        return await sendToAI(apiMessages, opts);
      } catch (err) {
        if (err.name === 'AbortError') throw err;

        const isRateLimit = err.message?.includes('Too many requests') ||
                            err.message?.includes('429') ||
                            err.message?.includes('rate limit');

        if (isRateLimit && attempt < maxRetries) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          console.log(`[Conversation] Rate limited (retry ${attempt + 1}/${maxRetries}), waiting ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isRateLimit) {
          console.log(`[Conversation] Rate limit exhausted after ${maxRetries} retries`);
          return null;
        }

        throw err;
      }
    }
    return null;
  }

  // ---- Handle user speech (final transcript) with request ID ----
  async function handleUserSpeech(text, requestId) {
    if (!text || destroyed) return;

    console.log(`[Conversation] Request ${requestId}: "${text}"`);
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

      console.log('[Conversation] Sending transcript to AI:', text);
      const response = await sendWithRetry(apiMessages, {
        userRole: userProfile?.role || 'mother',
        languageInstruction: langInstruction,
        healthContext,
        proactiveContext,
        signal: aiAbortController.signal,
      }, requestId);

      if (destroyed || activeRequestId !== requestId) return;

      if (response === null) {
        const busyMsg = { role: 'assistant', content: RATE_LIMIT_MSG };
        setMessages([...newMessages, busyMsg]);
        console.log('[Conversation] Rate limit message displayed (not spoken)');
        forceState(CONVERSATION_STATES.LISTENING);
        return;
      }

      const assistantMsg = { role: 'assistant', content: response };
      setMessages([...newMessages, assistantMsg]);

      if (destroyed || activeRequestId !== requestId) return;

      setState(CONVERSATION_STATES.SPEAKING);
      ttsAbortController = new AbortController();

      try {
        await speakText(response, ttsAbortController.signal);
        if (!destroyed && state === CONVERSATION_STATES.SPEAKING) {
          forceState(CONVERSATION_STATES.LISTENING);
        }
      } catch (speakErr) {
        if (speakErr.name === 'AbortError') return;
        console.error('[ConversationManager] Speech error:', speakErr);
        onError?.('speech_error');
        if (!destroyed) forceState(CONVERSATION_STATES.LISTENING);
      } finally {
        ttsAbortController = null;
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
      if (activeRequestId === requestId) {
        aiAbortController = null;
        isProcessing = false;
      }
    }
  }

  // ---- Wrapper: single-request mutex + request ID ----
  function processUserSpeech(text) {
    if (isProcessing) {
      console.log('[Conversation] Already processing, ignoring transcript:', text);
      return;
    }
    isProcessing = true;
    const requestId = ++currentRequestId;
    activeRequestId = requestId;
    handleUserSpeech(text, requestId);
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

      await upsertRecord('ai_conversations', {
        id: generateId(),
        user_id: userProfile.id,
        summary: summaryParts.join(' '),
        topics,
        message_count: messages.length,
        last_message: assistantMessages[assistantMessages.length - 1]?.content?.substring(0, 200) || '',
        started_at: conversationStartTime || new Date().toISOString(),
        created_at: new Date().toISOString(),
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

      ttsAbortController = new AbortController();
      forceState(CONVERSATION_STATES.SPEAKING);

      try {
        await speakText(welcome, ttsAbortController.signal);
        if (!destroyed && state === CONVERSATION_STATES.SPEAKING) {
          forceState(CONVERSATION_STATES.LISTENING);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[ConversationManager] Greeting speech error:', err);
      }

      ttsAbortController = null;
    },

    /**
     * Called when a final transcription result arrives from STT.
     * Only acted upon in LISTENING state. Includes duplicate protection.
     */
    onFinalTranscript(text) {
      if (destroyed || !text) return;
      if (state !== CONVERSATION_STATES.LISTENING) return;

      const normalized = text.toLowerCase().trim();
      if (!normalized) return;

      const now = Date.now();
      recentTranscripts = recentTranscripts.filter(t => now - t.time < 3000);
      const hash = hashText(normalized);
      if (recentTranscripts.some(t => t.hash === hash)) {
        console.log('[Conversation] Duplicate transcript ignored:', text);
        return;
      }
      recentTranscripts.push({ hash, time: now });

      if (isProcessing) {
        console.log('[Conversation] Already processing, ignoring transcript:', text);
        return;
      }

      processUserSpeech(text);
    },

    /**
     * Called when an interim transcription result arrives from STT.
     * Only updates UI transcript display.
     */
    onInterimTranscript(text) {
      if (destroyed) return;
      onTranscriptChange?.(text);
    },

    /**
     * Called by VAD when the user starts speaking.
     * In SPEAKING state, triggers interruption.
     * In other states, ignored.
     */
    vadSpeechStart() {
      if (destroyed) return;
      if (state === CONVERSATION_STATES.SPEAKING) {
        console.log('[Conversation] VAD speech start → interrupting');
        if (ttsAbortController) {
          ttsAbortController.abort();
          ttsAbortController = null;
        }
        stopSpeech();
        forceState(CONVERSATION_STATES.INTERRUPTING);
      }
    },

    /**
     * Called by VAD when silence is detected (user stopped speaking).
     * In INTERRUPTING state, transitions to LISTENING.
     * In other states, ignored.
     */
    vadSpeechEnd() {
      if (destroyed) return;
      if (state === CONVERSATION_STATES.INTERRUPTING) {
        console.log('[Conversation] VAD speech end → listening');
        forceState(CONVERSATION_STATES.LISTENING);
      }
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
        if (ttsAbortController) {
          ttsAbortController.abort();
          ttsAbortController = null;
        }
        stopSpeech();
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
      isProcessing = false;
      activeRequestId = null;
      saveConversationSummary();
      cancelCurrentWork();
    },
  };
}
