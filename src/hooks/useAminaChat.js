import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { chatCompletion } from '../lib/groq';
import { textToSpeech, playAudio, isElevenLabsConfigured } from '../lib/tts';
import useAuthStore from '../stores/authStore';
import { createConversationManager, CONVERSATION_STATES } from '../services/conversationManager';
import { buildHealthContext } from '../services/healthContext';

export { CONVERSATION_STATES };

// Backward-compatible alias for existing components
export const VOICE_STATES = CONVERSATION_STATES;

// ============================================================
// Speech Recognition — standalone hook for ChatMode mic button
// ============================================================
export function useSpeechRecognition(language = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(undefined);
  const [error, setError] = useState(null);
  const [micPermission, setMicPermission] = useState('unknown');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const onFinalRef = useRef(null);
  const onInterimRef = useRef(null);

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
      // Permissions API not supported for microphone
    }
    setMicPermission('unknown');
    return 'unknown';
  }, []);

  const resetMicPermission = useCallback(() => setMicPermission('unknown'), []);

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
        // Intentional stop
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
    isListening, transcript, isSupported, error, micPermission,
    startListening, stopListening, setTranscript, checkMicPermission,
    resetMicPermission,
    onFinal, onInterim,
  };
}

// ============================================================
// Speech Synthesis — standalone hook for ChatMode auto-speak
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
      let v = voices.find(x => x.lang.startsWith('en') && femalePatterns.some(f => x.name.toLowerCase().includes(f)));
      if (v) return v;
      v = voices.find(x => x.lang.startsWith('en') && !malePatterns.some(m => x.name.toLowerCase().includes(m)));
      if (v) return v;
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

    if (synth.getVoices().length) {
      startSpeaking();
    } else {
      const onVoicesChanged = () => {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        startSpeaking();
      };
      synth.addEventListener('voiceschanged', onVoicesChanged);
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
// Voice Conversation — wires ConversationManager into React
// ============================================================
export function useVoiceConversation() {
  const [voiceState, setVoiceState] = useState(CONVERSATION_STATES.INITIALIZING);
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [micPermission, setMicPermission] = useState('unknown');
  const { profile } = useAuthStore();

  const {
    isListening, isSupported: sttSupported, error: sttError,
    startListening, stopListening, resetMicPermission,
  } = useSpeechRecognition(language);

  const {
    isSpeaking, isSupported: ttsSupported, speak, stop: stopSpeaking, onEnd,
  } = useSpeechSynthesis(language);

  const managerRef = useRef(null);
  const healthContextRef = useRef('');

  // Fetch health context whenever profile changes
  useEffect(() => {
    if (profile?.id && profile?.role) {
      buildHealthContext(profile).then(ctx => {
        healthContextRef.current = ctx;
        // Update manager if it exists
        if (managerRef.current) {
          managerRef.current.setHealthContext(ctx);
        }
      }).catch(err => {
        console.error('Failed to build health context:', err);
      });
    }
  }, [profile]);

  // Create manager
  useEffect(() => {
    const manager = createConversationManager({
      sendToAI: async (apiMessages, opts) => {
        return chatCompletion(apiMessages, opts);
      },
      speakText: async (text) => {
        await speak(text);
        // Wait for speech to finish
        return new Promise((resolve) => {
          const check = () => {
            if (!isSpeaking) resolve();
            else setTimeout(check, 100);
          };
          // Small delay to let speaking state update
          setTimeout(check, 50);
        });
      },
      stopSpeech: () => {
        stopSpeaking();
      },
      onStateChange: (state) => setVoiceState(state),
      onMessagesChange: (msgs) => setMessages(msgs),
      onTranscriptChange: (t) => setTranscript(t),
      onError: (err) => setError(err),
    });
    managerRef.current = manager;

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  // speak and stopSpeaking are stable refs from useSpeechSynthesis
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync micPermission from STT hook
  useEffect(() => {
    if (sttError?.includes('permission') || sttError?.includes('not-allowed')) {
      setMicPermission('denied');
    }
  }, [sttError]);

  // STT errors → error state
  useEffect(() => {
    if (sttError && voiceState !== CONVERSATION_STATES.ERROR) {
      setError(sttError);
    }
  }, [sttError, voiceState]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Detect mic permission denied from speech recognition
  useEffect(() => {
    const checkPerm = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'microphone' });
          setMicPermission(status.state);
          status.onchange = () => setMicPermission(status.state);
          return;
        }
      } catch { /* ignore */ }
      setMicPermission('unknown');
    };
    checkPerm();
  }, []);

  // Barge-in: user speaks while Amina is speaking → stop speech
  useEffect(() => {
    if (isListening && isSpeaking) {
      const mgr = managerRef.current;
      if (mgr) {
        stopSpeaking();
        mgr.onSpeechStopped();
      }
    }
  }, [isListening, isSpeaking, stopSpeaking]);

  const initConversation = useCallback(async () => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.setLanguage(language);
    mgr.setUserProfile(profile);
    if (healthContextRef.current) {
      mgr.setHealthContext(healthContextRef.current);
    }
    await mgr.init({ language, userProfile: profile });
  }, [language, profile]);

  const togglePause = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    if (voiceState === CONVERSATION_STATES.PAUSED) {
      mgr.resume();
    } else {
      mgr.pause();
    }
  }, [voiceState]);

  const clearChat = useCallback(() => {
    const mgr = managerRef.current;
    if (mgr) {
      mgr.reset();
    }
    resetMicPermission();
    setMessages([]);
    setTranscript('');
    setError(null);
    setVoiceState(CONVERSATION_STATES.INITIALIZING);
  }, [resetMicPermission]);

  const switchLanguage = useCallback((lang) => {
    setLanguage(lang);
    const mgr = managerRef.current;
    if (mgr) {
      mgr.reset();
      mgr.setLanguage(lang);
    }
    resetMicPermission();
    setMessages([]);
    setTranscript('');
    setVoiceState(CONVERSATION_STATES.INITIALIZING);
  }, [resetMicPermission]);

  // Auto-init when component mounts
  useEffect(() => {
    if (voiceState === CONVERSATION_STATES.INITIALIZING && sttSupported !== undefined) {
      if (sttSupported || ttsSupported) {
        initConversation();
      } else {
        setVoiceState(CONVERSATION_STATES.ERROR);
        setError('Voice features are not supported in this browser.');
      }
    }
  }, [voiceState, sttSupported, ttsSupported, initConversation]);

  return {
    voiceState,
    messages,
    transcript,
    isListening,
    isSpeaking,
    error: error || sttError,
    language,
    micPermission,
    togglePause,
    clearChat,
    switchLanguage,
  };
}
