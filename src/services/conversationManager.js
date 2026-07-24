/**
 * NurtureAI — ConversationManager
 *
 * A modular, framework-agnostic service that manages the full voice
 * conversation lifecycle. Designed to be swappable — today it uses
 * Web Speech API + OpenRouter; tomorrow it could use a realtime
 * voice API without rewriting any React components.
 *
 * States: INITIALIZING → GREETING → LISTENING → PROCESSING → SPEAKING → LISTENING
 */

export const CONVERSATION_STATES = {
  INITIALIZING: 'initializing',
  GREETING: 'greeting',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  PAUSED: 'paused',
  ERROR: 'error',
};

/**
 * Creates a ConversationManager instance.
 *
 * @param {object} deps - Dependencies to inject
 * @param {function} deps.sendToAI - async (messages, options) => string
 * @param {function} deps.speakText - async (text) => void (resolves when done)
 * @param {function} deps.stopSpeech - () => void
 * @param {function} deps.onStateChange - (state) => void
 * @param {function} deps.onMessagesChange - (messages) => void
 * @param {function} deps.onTranscriptChange - (transcript) => void
 * @param {function} deps.onError - (error) => void
 */
export function createConversationManager(deps) {
  const {
    sendToAI,
    speakText,
    stopSpeech,
    onStateChange,
    onMessagesChange,
    onTranscriptChange,
    onError,
  } = deps;

  // ---- Internal state ----
  let state = CONVERSATION_STATES.INITIALIZING;
  let messages = [];
  let recognition = null;
  let shouldListen = false;
  let destroyed = false;
  let language = 'en';
  let userProfile = null;
  let greetingSpoken = false;
  let healthContext = '';

  // Silence detection
  let lastSpeechTime = 0;
  let silenceTimer = null;
  const SILENCE_THRESHOLD_MS = 1500; // 1.5s of silence = end of utterance

  // ---- State transitions ----
  function setState(newState) {
    if (state === newState) return;
    state = newState;
    onStateChange?.(state);
  }

  function setMessages(msgs) {
    messages = msgs;
    onMessagesChange?.(msgs);
  }

  // ---- Speech Recognition ----
  function createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = language === 'dag' ? 'ha-Latn-NG' : 'en-US';

    rec.onresult = (event) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (interimText) {
        onTranscriptChange?.(interimText);
        lastSpeechTime = Date.now();
      }

      if (finalText) {
        lastSpeechTime = Date.now();
        onTranscriptChange?.(finalText.trim());
        handleUserSpeech(finalText.trim());
      }
    };

    rec.onend = () => {
      // Auto-restart if we should still be listening
      if (shouldListen && !destroyed) {
        try {
          rec.start();
        } catch {
          // Already started or other error — retry after brief delay
          setTimeout(() => {
            if (shouldListen && !destroyed) {
              try { rec.start(); } catch { /* give up */ }
            }
          }, 100);
        }
      }
    };

    rec.onerror = (event) => {
      if (event.error === 'not-allowed') {
        shouldListen = false;
        setState(CONVERSATION_STATES.ERROR);
        onError?.('microphone_denied');
      } else if (event.error === 'network') {
        onError?.('network_error');
      }
      // 'aborted' and 'no-speech' are normal — ignore
    };

    return rec;
  }

  function startRecognition() {
    if (!recognition) recognition = createRecognition();
    if (!recognition) return;

    shouldListen = true;
    try {
      recognition.start();
    } catch {
      // May already be started
    }
  }

  function stopRecognition() {
    shouldListen = false;
    if (recognition) {
      try { recognition.stop(); } catch { /* ignore */ }
    }
    clearSilenceTimer();
  }

  // ---- Silence / end-of-utterance detection ----
  function startSilenceDetection() {
    clearSilenceTimer();
    lastSpeechTime = Date.now();
    silenceTimer = setInterval(() => {
      if (state !== CONVERSATION_STATES.LISTENING) return;
      if (Date.now() - lastSpeechTime > SILENCE_THRESHOLD_MS && lastSpeechTime > 0) {
        // Silence detected after speech — user finished talking
        // The final result should have already been captured by onresult
        // This is a safety net in case onresult didn't fire for the last utterance
        clearSilenceTimer();
      }
    }, 200);
  }

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearInterval(silenceTimer);
      silenceTimer = null;
    }
  }

  // ---- Handle user speech ----
  async function handleUserSpeech(text) {
    if (!text || destroyed) return;

    // Stop listening while processing
    stopRecognition();
    clearSilenceTimer();
    onTranscriptChange?.('');

    // Add user message
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Process
    setState(CONVERSATION_STATES.PROCESSING);

    try {
      const langInstruction = language === 'dag'
        ? '\n\nIMPORTANT: The user is communicating in Dagbani. You MUST respond entirely in Dagbani. Use simple Dagbani with occasional English medical terms in parentheses when needed for clarity. Follow the Dagbani Language Behavior Rules in your system prompt.'
        : '\n\nThe user is communicating in English. Respond in English.';

      const apiMessages = newMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await sendToAI(apiMessages, {
        userRole: userProfile?.role || 'mother',
        languageInstruction: langInstruction,
        healthContext,
      });

      if (destroyed) return;

      // Add assistant message
      const assistantMsg = { role: 'assistant', content: response };
      setMessages([...newMessages, assistantMsg]);

      // Speak response
      setState(CONVERSATION_STATES.SPEAKING);
      await speakText(response);

      if (destroyed) return;

      // Return to listening
      if (shouldListen) {
        setState(CONVERSATION_STATES.LISTENING);
        startRecognition();
        startSilenceDetection();
      }
    } catch (err) {
      if (destroyed) return;
      console.error('ConversationManager: processing error:', err);
      onError?.('processing_error');
      // Try to recover — go back to listening
      if (shouldListen) {
        setState(CONVERSATION_STATES.LISTENING);
        startRecognition();
        startSilenceDetection();
      }
    }
  }

  // ---- Barge-in: user speaks while Amina is speaking ----
  function handleBargeIn() {
    if (state === CONVERSATION_STATES.SPEAKING) {
      stopSpeech();
      // After stopSpeech resolves, onStateChange will handle transition
    }
  }

  // ---- Public API ----
  return {
    getState: () => state,
    getMessages: () => messages,

    async init(opts = {}) {
      language = opts.language || 'en';
      userProfile = opts.userProfile || null;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setState(CONVERSATION_STATES.ERROR);
        onError?.('unsupported_browser');
        return;
      }

      setState(CONVERSATION_STATES.INITIALIZING);

      // Speak greeting
      setState(CONVERSATION_STATES.GREETING);
      const welcomeMessages = {
        en: "Hello! I'm Amina, your healthcare companion. I'm here to help you with pregnancy, child health, nutrition, and more. How can I help you today?",
        dag: "Mani n nyɛ Amina. Adaa laafee yuligu lana. Bihi alaafee yulibu lana, bihi laafeehi yulibu lana, abindira alaafee yulibu lana. Yelima wula ka nyen soŋa zaŋkpa n ni kali a binyerishaŋa?",
      };
      const welcome = welcomeMessages[language] || welcomeMessages.en;
      setMessages([{ role: 'assistant', content: welcome }]);

      greetingSpoken = true;
      await speakText(welcome);

      if (destroyed) return;

      // Start listening
      setState(CONVERSATION_STATES.LISTENING);
      startRecognition();
      startSilenceDetection();
    },

    /**
     * Send a text message (for chat mode integration).
     * Returns the AI response string.
     */
    async sendText(text) {
      if (!text?.trim()) return null;

      stopRecognition();
      clearSilenceTimer();
      onTranscriptChange?.('');

      const userMsg = { role: 'user', content: text.trim() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);

      setState(CONVERSATION_STATES.PROCESSING);

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
     * Start/resume voice conversation.
     */
    start() {
      if (destroyed) return;
      shouldListen = true;
      setState(CONVERSATION_STATES.LISTENING);
      startRecognition();
      startSilenceDetection();
    },

    /**
     * Pause the conversation.
     */
    pause() {
      shouldListen = false;
      stopRecognition();
      clearSilenceTimer();
      stopSpeech();
      setState(CONVERSATION_STATES.PAUSED);
    },

    /**
     * Resume from pause.
     */
    resume() {
      if (destroyed) return;
      shouldListen = true;
      setState(CONVERSATION_STATES.LISTENING);
      startRecognition();
      startSilenceDetection();
    },

    /**
     * Stop barge-in — called when speech is interrupted by user.
     */
    onSpeechStopped() {
      if (destroyed) return;
      // Speech was stopped (barge-in) — start listening
      if (shouldListen) {
        setState(CONVERSATION_STATES.LISTENING);
        startRecognition();
        startSilenceDetection();
      }
    },

    /**
     * Barge-in: user started speaking while Amina was talking.
     */
    bargeIn() {
      handleBargeIn();
    },

    /**
     * Switch language.
     */
    setLanguage(lang) {
      language = lang;
      if (recognition) {
        recognition.lang = lang === 'dag' ? 'ha-Latn-NG' : 'en-US';
      }
    },

    /**
     * Set user profile (for role-based AI behavior).
     */
    setUserProfile(profile) {
      userProfile = profile;
    },

    /**
     * Set health context (patient data injected into AI prompts).
     */
    setHealthContext(ctx) {
      healthContext = ctx;
    },

    /**
     * Clear conversation and reset to initial state.
     */
    reset() {
      stopRecognition();
      clearSilenceTimer();
      stopSpeech();
      messages = [];
      greetingSpoken = false;
      onMessagesChange?.([]);
      onTranscriptChange?.('');
      setState(CONVERSATION_STATES.INITIALIZING);
    },

    /**
     * Destroy the manager — clean up all resources.
     */
    destroy() {
      destroyed = true;
      stopRecognition();
      clearSilenceTimer();
      stopSpeech();
      if (recognition) {
        try { recognition.abort(); } catch { /* ignore */ }
        recognition = null;
      }
    },
  };
}
