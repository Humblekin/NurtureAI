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
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const onFinalRef = useRef(null);
  const onInterimRef = useRef(null);

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
        setError('Microphone access was denied. Please allow microphone permission in your browser settings.');
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

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldListenRef.current = true;
    setError(null);
    setTranscript('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // May already be started
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

  return {
    isListening, transcript, isSupported, error,
    startListening, stopListening, setTranscript,
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
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
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

      const voices = window.speechSynthesis.getVoices();
      let selectedVoice = voices.find(v => v.lang === 'en-GB' && femalePatterns.some(f => v.name.toLowerCase().includes(f)));
      if (!selectedVoice) selectedVoice = voices.find(v => v.lang === 'en-GB');
      if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('en') && femalePatterns.some(f => v.name.toLowerCase().includes(f)));
      if (!selectedVoice) selectedVoice = voices.find(v => femalePatterns.some(f => v.name.toLowerCase().includes(f)));

      if (selectedVoice) {
        const nameLower = selectedVoice.name.toLowerCase();
        if (malePatterns.some(m => nameLower.includes(m))) {
          setIsSpeaking(false);
          onEndRef.current?.();
          return;
        }
        utterance.voice = selectedVoice;
      } else {
        setIsSpeaking(false);
        onEndRef.current?.();
        return;
      }

      utterance.lang = isDagbani ? 'en-GB' : (utterance.voice?.lang || 'en-GB');
      utterance.rate = isDagbani ? 0.85 : 0.9;
      utterance.pitch = isDagbani ? 1.2 : 1.1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); onEndRef.current?.(); };
      utterance.onerror = () => { setIsSpeaking(false); onEndRef.current?.(); };

      window.speechSynthesis.speak(utterance);
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
    isListening, isSupported: sttSupported, error: sttError,
    startListening, stopListening, onFinal, onInterim,
  } = useSpeechRecognition(language);

  const {
    isSpeaking, isSupported: ttsSupported, speak, stop: stopSpeaking, onEnd,
  } = useSpeechSynthesis(language);

  const greetingSpokenRef = useRef(false);
  const lastSpokenIdxRef = useRef(-1);
  const processingRef = useRef(false);

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

      const allMessages = [...messages, userMessage];
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
  }, [messages, language, profile?.role]);

  // Handle final speech result → process and respond
  const handleFinalSpeech = useCallback(async (text) => {
    if (!text || processingRef.current) return;
    setTranscript('');

    const response = await sendToAI(text);
    if (response) {
      setVoiceState(VOICE_STATES.SPEAKING);
      speak(response);
    }
  }, [sendToAI, speak]);

  // When Amina finishes speaking → start listening again
  const handleSpeechEnd = useCallback(() => {
    if (voiceState === VOICE_STATES.SPEAKING || voiceState === VOICE_STATES.GREETING) {
      setVoiceState(VOICE_STATES.LISTENING);
      startListening();
    }
  }, [voiceState, startListening]);

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
    if (voiceState === VOICE_STATES.LISTENING && !isListening) {
      startListening();
    }
  }, [voiceState, isListening, startListening]);

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
    processingRef.current = false;
    lastSpokenIdxRef.current = -1;
    greetingSpokenRef.current = false;
    setVoiceState(VOICE_STATES.INITIALIZING);
  }, [stopListening, stopSpeaking]);

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
    sttSupported,
    ttsSupported,
    togglePause,
    clearChat,
    switchLanguage,
  };
}
