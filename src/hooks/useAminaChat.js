import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { chatCompletion } from '../lib/groq';
import { textToSpeech, playAudio, isElevenLabsConfigured } from '../lib/tts';
import useAuthStore from '../stores/authStore';

/**
 * Conversation states:
 *   initializing → greeting → listening → processing → speaking → listening
 *                                                    ↗ interrupted
 */
export const VOICE_STATES = {
  INITIALIZING: 'initializing',
  GREETING: 'greeting',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  PAUSED: 'paused',
  ERROR: 'error',
};

// ============================================================
// Speech Recognition — Continuous with auto-restart
// ============================================================
export function useSpeechRecognition(language = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const [micPermission, setMicPermission] = useState('unknown');
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const onFinalRef = useRef(null);
  const onInterimRef = useRef(null);

  // Check mic permission status on mount — informational only, doesn't block usage
  const checkMicPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'granted') {
          setMicPermission('granted');
        }
        status.onchange = () => setMicPermission(status.state);
        return status.state;
      }
    } catch {
      // Permissions API not supported for microphone — proceed anyway
    }
    setMicPermission('unknown');
    return 'unknown';
  }, []);

  useEffect(() => {
    checkMicPermission();
  }, [checkMicPermission]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setIsSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language === 'dag' ? 'ha-Latn-NG' : 'en-US';

    recognition.onresult = (event) => {
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
        setTranscript(interimText);
        onInterimRef.current?.(interimText);
      }

      if (finalText) {
        setTranscript(finalText);
        onFinalRef.current?.(finalText.trim());
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if we should still be listening
      if (shouldListenRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          // Already started or other error
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        shouldListenRef.current = false;
        setMicPermission('denied');
      } else if (event.error === 'network') {
        setError('Network error during speech recognition.');
      } else if (event.error === 'aborted') {
        // Intentional stop — do nothing
      } else if (event.error !== 'no-speech') {
        setError('Speech recognition error. Please try again.');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      try { recognition.stop(); } catch { /* ignore */ }
    };
  }, [language]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return;

    shouldListenRef.current = true;
    setError(null);
    setTranscript('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // May already be started — ignore
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
  }, []);

  const onFinal = useCallback((cb) => { onFinalRef.current = cb; }, []);
  const onInterim = useCallback((cb) => { onInterimRef.current = cb; }, []);
  const resetMicPermission = useCallback(() => setMicPermission('unknown'), []);

  return {
    isListening, transcript, isSupported, error, micPermission,
    startListening, stopListening, setTranscript, checkMicPermission,
    resetMicPermission,
    onFinal, onInterim,
  };
}

// ============================================================
// Speech Synthesis — with interruption support
// ============================================================
export function useSpeechSynthesis(language = 'en') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const abortRef = useRef(null);
  const onEndRef = useRef(null);

  useEffect(() => {
    setIsSupported(isElevenLabsConfigured() || 'speechSynthesis' in window);
  }, []);

  const speak = useCallback(async (text) => {
    if (!text) return;

    // Cancel any ongoing speech
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // Try ElevenLabs first
    if (isElevenLabsConfigured()) {
      try {
        setIsSpeaking(true);
        const audioData = await textToSpeech(text, {
          modelId: 'eleven_multilingual_v2',
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.4,
          speed: language === 'dag' ? 0.9 : 1.0,
        });
        if (!abortRef.current.signal.aborted) {
          await playAudio(audioData);
        }
        setIsSpeaking(false);
        onEndRef.current?.();
        return;
      } catch (err) {
        console.error('ElevenLabs TTS error, falling back to browser TTS:', err);
      }
    }

    // Fallback: Browser TTS
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      onEndRef.current?.();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const isDagbani = language === 'dag';
    const malePatterns = [
      'david', 'james', 'john', 'mike', 'daniel', 'mark', 'robert',
      'richard', 'william', 'thomas', 'christopher', 'matthew',
      'google uk english male', 'google us male',
      'microsoft david', 'microsoft mark', 'microsoft james',
      'microsoft richard', 'microsoft george',
    ];
    const femalePatterns = [
      'female', 'woman', 'girl', 'she',
      'samantha', 'zira', 'karen', 'moira', 'tessa', 'veena',
      'susan', 'sarah', 'linda', 'michelle', 'heather', 'hazel',
      'google uk english female', 'google us female',
      'microsoft zira', 'microsoft hazel', 'microsoft susan',
    ];

    function selectVoice() {
      const voices = synth.getVoices();
      if (!voices.length) return null;

      // Prefer English female voice
      let v = voices.find(x => x.lang.startsWith('en') && femalePatterns.some(f => x.name.toLowerCase().includes(f)));
      if (v) return v;

      // Any English voice (prefer female by name, skip known male)
      v = voices.find(x => x.lang.startsWith('en') && !malePatterns.some(m => x.name.toLowerCase().includes(m)));
      if (v) return v;

      // Any voice at all — just speak
      return voices[0] || null;
    }

    function startSpeaking() {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = selectVoice();

      if (voice) {
        utterance.voice = voice;
        utterance.lang = isDagbani ? 'en-GB' : (voice.lang || 'en-GB');
      } else {
        utterance.lang = isDagbani ? 'en-GB' : 'en-US';
      }

      utterance.rate = isDagbani ? 0.85 : 0.9;
      utterance.pitch = isDagbani ? 1.2 : 1.1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); onEndRef.current?.(); };
      utterance.onerror = () => { setIsSpeaking(false); onEndRef.current?.(); };

      synth.speak(utterance);
    }

    // On mobile, voices load asynchronously
    if (synth.getVoices().length) {
      startSpeaking();
    } else {
      const onVoicesChanged = () => {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        startSpeaking();
      };
      synth.addEventListener('voiceschanged', onVoicesChanged);
      // Fallback: if voiceschanged never fires, speak anyway after 500ms
      setTimeout(() => {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        if (!synth.speaking) startSpeaking();
      }, 500);
    }
  }, [language]);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const onEnd = useCallback((cb) => { onEndRef.current = cb; }, []);

  return { isSpeaking, isSupported, speak, stop, onEnd };
}

// ============================================================
// Voice Conversation — State machine + auto-flow
// ============================================================
export function useVoiceConversation() {
  const [voiceState, setVoiceState] = useState(VOICE_STATES.INITIALIZING);
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState('');
  const { profile } = useAuthStore();

  const {
    isListening, isSupported: sttSupported, error: sttError, micPermission,
    startListening, stopListening, resetMicPermission, onFinal, onInterim,
  } = useSpeechRecognition(language);

  const {
    isSpeaking, isSupported: ttsSupported, speak, stop: stopSpeaking, onEnd,
  } = useSpeechSynthesis(language);

  const greetingSpokenRef = useRef(false);
  const lastSpokenIdxRef = useRef(-1);
  const processingRef = useRef(false);
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const welcomeMessages = useMemo(() => ({
    en: "Hello! I'm Amina, your healthcare companion. I'm here to help you with pregnancy, child health, nutrition, and more. How can I help you today?",
    dag: "Mani n nyɛ Amina. Adaa laafee yuligu lana. Bihi alaafee yulibu lana, bihi laafeehi yulibu lana, abindira alaafee yulibu lana. Yelima wula ka nyen soŋa zaŋkpa n ni kali a binyerishaŋa?",
  }), []);

  // Send message to AI and get response
  const sendToAI = useCallback(async (userText) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setVoiceState(VOICE_STATES.PROCESSING);

    const userMessage = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMessage]);

    try {
      const langInstruction = language === 'dag'
        ? '\n\nIMPORTANT: The user is communicating in Dagbani. You MUST respond entirely in Dagbani. The official welcome message has already been shown by the app — do NOT repeat it. Use simple Dagbani with occasional English medical terms in parentheses when needed for clarity. Follow the Dagbani Language Behavior Rules in your system prompt.'
        : '\n\nThe user is communicating in English. Respond in English.';

      const allMessages = [...messagesRef.current, userMessage];
      const apiMessages = allMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await chatCompletion(apiMessages, {
        userRole: profile?.role || 'mother',
        languageInstruction: langInstruction,
      });

      const assistantMessage = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);
      return response;
    } catch (err) {
      console.error('AI error:', err);
      const errorMsg = 'I apologize, I encountered an error. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      return errorMsg;
    } finally {
      processingRef.current = false;
    }
  }, [language, profile?.role]);

  // Handle final speech result → process and respond
  const handleFinalSpeech = useCallback(async (text) => {
    if (!text || processingRef.current) return;
    setTranscript('');

    try {
      const response = await sendToAI(text);
      if (response) {
        setVoiceState(VOICE_STATES.SPEAKING);
        speak(response);
      } else {
        console.warn('Amina: No response from AI');
        setVoiceState(VOICE_STATES.LISTENING);
        startListening();
      }
    } catch (err) {
      console.error('Amina: handleFinalSpeech error:', err);
      setVoiceState(VOICE_STATES.LISTENING);
      startListening();
    }
  }, [sendToAI, speak, startListening]);

  // When Amina finishes speaking → start listening again
  const handleSpeechEnd = useCallback(() => {
    const currentState = voiceStateRef.current;
    if (currentState === VOICE_STATES.SPEAKING || currentState === VOICE_STATES.GREETING) {
      setVoiceState(VOICE_STATES.LISTENING);
      startListening();
    }
  }, [startListening]);

  // Register callbacks
  useEffect(() => { onFinal(handleFinalSpeech); }, [onFinal, handleFinalSpeech]);
  useEffect(() => { onEnd(handleSpeechEnd); }, [onEnd, handleSpeechEnd]);
  useEffect(() => { onInterim((text) => setTranscript(text)); }, [onInterim]);

  // Interruption: user speaks while Amina is speaking → stop and listen
  useEffect(() => {
    if (isListening && isSpeaking) {
      stopSpeaking();
      // Don't start listening here — the onEnd callback will handle it
    }
  }, [isListening, isSpeaking, stopSpeaking]);

  // Auto-start greeting when ready
  useEffect(() => {
    if (voiceState === VOICE_STATES.INITIALIZING && sttSupported !== undefined) {
      if (sttSupported || ttsSupported) {
        greetingSpokenRef.current = true;
        setVoiceState(VOICE_STATES.GREETING);
        const welcome = welcomeMessages[language] || welcomeMessages.en;
        setMessages([{ role: 'assistant', content: welcome }]);
        speak(welcome);
      } else {
        setVoiceState(VOICE_STATES.ERROR);
        setError('Voice features are not supported in this browser.');
      }
    }
  }, [voiceState, sttSupported, ttsSupported, language, speak, welcomeMessages]);

  // Sync listening state
  useEffect(() => {
    if (voiceState === VOICE_STATES.LISTENING && !isListening && micPermission !== 'denied') {
      startListening();
    }
  }, [voiceState, isListening, startListening, micPermission]);

  // STT errors (not-allowed, network) → transition to error state
  useEffect(() => {
    if (sttError && voiceState !== VOICE_STATES.ERROR) {
      stopListening();
      setVoiceState(VOICE_STATES.ERROR);
      setError(sttError);
    }
  }, [sttError, voiceState, stopListening]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error || sttError) {
      const timer = setTimeout(() => { setError(null); }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, sttError]);

  const togglePause = useCallback(() => {
    if (voiceState === VOICE_STATES.PAUSED) {
      setVoiceState(VOICE_STATES.LISTENING);
      startListening();
    } else {
      stopListening();
      stopSpeaking();
      setVoiceState(VOICE_STATES.PAUSED);
    }
  }, [voiceState, startListening, stopListening, stopSpeaking]);

  const clearChat = useCallback(() => {
    stopListening();
    stopSpeaking();
    setMessages([]);
    setTranscript('');
    resetMicPermission();
    processingRef.current = false;
    lastSpokenIdxRef.current = -1;
    greetingSpokenRef.current = false;
    setVoiceState(VOICE_STATES.INITIALIZING);
  }, [stopListening, stopSpeaking, resetMicPermission]);

  const switchLanguage = useCallback((lang) => {
    setLanguage(lang);
    clearChat();
  }, [clearChat]);

  return {
    voiceState,
    messages,
    transcript,
    isListening,
    isSpeaking,
    error: error || sttError,
    language,
    micPermission,
    sttSupported,
    ttsSupported,
    togglePause,
    clearChat,
    switchLanguage,
  };
}
