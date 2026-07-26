import { useState, useRef, useEffect, useCallback } from 'react';
import { chatCompletion } from '../lib/groq';
import { isDeepgramConfigured, startStreamingSTT, speak as deepgramSpeak, stopSpeaking as deepgramStopSpeaking } from '../services/deepgram';
import useAuthStore from '../stores/authStore';
import { createConversationManager, CONVERSATION_STATES } from '../services/conversationManager';
import { buildHealthContext } from '../services/healthContext';

export { CONVERSATION_STATES };
export const VOICE_STATES = CONVERSATION_STATES;

// ============================================================
// Speech Recognition — browser fallback for ChatMode mic button only
// ============================================================
export function useSpeechRecognition(language = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(undefined);
  const [error, setError] = useState(null);
  const [micPermission, setMicPermission] = useState('unknown');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const listeningActiveRef = useRef(false);
  const onFinalRef = useRef(null);
  const onInterimRef = useRef(null);

  const checkMicPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'granted') setMicPermission('granted');
        status.onchange = () => setMicPermission(status.state);
        return status.state;
      }
    } catch { /* ignore */ }
    setMicPermission('unknown');
    return 'unknown';
  }, []);

  const resetMicPermission = useCallback(() => setMicPermission('unknown'), []);

  useEffect(() => { checkMicPermission(); }, [checkMicPermission]);

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
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (interimText) { setTranscript(interimText); onInterimRef.current?.(interimText); }
      if (finalText) { setTranscript(finalText); onFinalRef.current?.(finalText.trim()); }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (listeningActiveRef.current) {
        try { recognition.start(); setIsListening(true); } catch { /* already started */ }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') { shouldListenRef.current = false; listeningActiveRef.current = false; setMicPermission('denied'); }
      else if (event.error === 'network') setError('Network error during speech recognition.');
      else if (event.error !== 'aborted' && event.error !== 'no-speech') setError('Speech recognition error. Please try again.');
    };

    recognitionRef.current = recognition;
    return () => { shouldListenRef.current = false; listeningActiveRef.current = false; try { recognition.stop(); } catch { /* ignore */ } };
  }, [language]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return;
    shouldListenRef.current = true;
    listeningActiveRef.current = true;
    setError(null);
    setTranscript('');
    try { recognitionRef.current.start(); setIsListening(true); } catch { /* may already be started */ }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    listeningActiveRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* ignore */ } }
    setIsListening(false);
  }, []);

  const onFinal = useCallback((cb) => { onFinalRef.current = cb; }, []);
  const onInterim = useCallback((cb) => { onInterimRef.current = cb; }, []);

  return { isListening, transcript, isSupported, error, micPermission, startListening, stopListening, setTranscript, checkMicPermission, resetMicPermission, onFinal, onInterim, setListeningActive: (v) => { listeningActiveRef.current = v; } };
}

// ============================================================
// Speech Synthesis — Deepgram TTS for ChatMode
// ============================================================
export function useSpeechSynthesis(_language = 'en') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const abortRef = useRef(null);
  const onEndRef = useRef(null);
  const onStartRef = useRef(null);

  useEffect(() => { setIsSupported(isDeepgramConfigured()); }, []);

  const speak = useCallback(async (text) => {
    if (!text || !isDeepgramConfigured()) {
      setIsSpeaking(false);
      onEndRef.current?.();
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      setIsSpeaking(true);
      onStartRef.current?.();
      await deepgramSpeak(text, {
        signal: abortRef.current.signal,
        onSpeechStart: () => setIsSpeaking(true),
        onSpeechEnd: () => { setIsSpeaking(false); onEndRef.current?.(); },
      });
    } catch (err) {
      if (err.name === 'AbortError') { setIsSpeaking(false); return; }
      console.error('Deepgram TTS error:', err);
      setIsSpeaking(false);
      onEndRef.current?.();
    }
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    deepgramStopSpeaking();
    setIsSpeaking(false);
  }, []);

  const onEnd = useCallback((cb) => { onEndRef.current = cb; }, []);
  const onStart = useCallback((cb) => { onStartRef.current = cb; }, []);

  return { isSpeaking, isSupported, speak, stop, onEnd, onStart };
}

// ============================================================
// Voice Conversation — Deepgram STT/TTS + ConversationManager
// ============================================================
export function useVoiceConversation() {
  const [voiceState, setVoiceState] = useState(CONVERSATION_STATES.IDLE);
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [micPermission, setMicPermission] = useState('unknown');
  const [micReady, setMicReady] = useState(false);
  const { profile } = useAuthStore();
  const managerRef = useRef(null);
  const healthContextRef = useRef('');
  const streamRef = useRef(null);
  const sttRef = useRef(null);
  const initStartedRef = useRef(false);

  const isListening = voiceState === CONVERSATION_STATES.LISTENING;
  const isSpeaking = voiceState === CONVERSATION_STATES.SPEAKING;

  // ---- Detect mic permission on mount (no popup) ----
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

  // ---- Request microphone access (must be called from user gesture) ----
  const requestMicPermission = useCallback(async () => {
    try {
      setError(null);
      // Check if mediaDevices API is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!isSecure) {
          setError('Microphone requires HTTPS. Your current connection is not secure. Please use HTTPS or access via localhost.');
        } else {
          setError('Microphone access is not available in this browser.');
        }
        return null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicPermission('granted');
      setMicReady(true);
      return stream;
    } catch (err) {
      console.error('[Voice] getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermission('denied');
        setError('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicPermission('prompt');
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const extra = !isSecure ? ' Also make sure you are using HTTPS — microphone access is blocked on HTTP connections.' : '';
        setError(`No microphone detected. Please connect a microphone or check your device settings, then tap Retry.${extra}`);
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Your microphone is being used by another app. Please close other apps using the mic and try again.');
      } else {
        setError(`Could not access microphone (${err.name}). Please check your settings and try again.`);
      }
      return null;
    }
  }, []);

  // ---- Start Deepgram listening ----
  const startListening = useCallback(() => {
    console.log('[Hook] 🎤 startListening called, stream:', !!streamRef.current, 'deepgram:', isDeepgramConfigured());
    if (!streamRef.current || !isDeepgramConfigured()) {
      console.warn('[Hook] ⚠️ Cannot start listening: stream or deepgram not ready');
      return;
    }

    // Stop any previous STT session
    if (sttRef.current) {
      try { sttRef.current.stop(); } catch {}
      sttRef.current = null;
    }

    setTranscript('');

    const sttHandle = startStreamingSTT(streamRef.current, {
      onInterim: (text) => setTranscript(text),
      onFinal: (text) => {
        console.log('[Hook] ✅ onFinal received:', text);
        setTranscript('');
        if (managerRef.current) managerRef.current.onFinalTranscript(text);
      },
      onError: (err) => {
        console.error('[Voice] STT error:', err);
        if (err.includes('permission')) setMicPermission('denied');
        setError(`Voice recognition error: ${err}`);
      },
    }, { language });
    sttRef.current = sttHandle;
    console.log('[Hook] 🎤 STT started, handle:', !!sttHandle);
  }, [language]);

  const stopListening = useCallback(() => {
    if (sttRef.current) {
      sttRef.current.stop();
      sttRef.current = null;
    }
    setTranscript('');
  }, []);

  // ---- Fetch health context when profile changes ----
  useEffect(() => {
    if (profile?.id && profile?.role) {
      buildHealthContext(profile).then(ctx => {
        healthContextRef.current = ctx;
        if (managerRef.current) managerRef.current.setHealthContext(ctx);
      }).catch(err => console.error('Failed to build health context:', err));
    }
  }, [profile]);

  // ---- Create ConversationManager ----
  useEffect(() => {
    const manager = createConversationManager({
      sendToAI: async (apiMessages, opts) => chatCompletion(apiMessages, opts),

      speakText: async (text, signal) => {
        if (!isDeepgramConfigured()) {
          throw new Error('TTS_NOT_CONFIGURED: Deepgram API key not set');
        }
        await deepgramSpeak(text, {
          signal,
          onSpeechStart: () => managerRef.current?.onSpeechStarted?.(),
          onSpeechEnd: () => managerRef.current?.onSpeechEnded(),
        });
      },

      stopSpeech: () => {
        deepgramStopSpeaking();
      },

      startListening: () => startListening(),
      stopListening: () => stopListening(),

      onStateChange: (state) => setVoiceState(state),
      onMessagesChange: (msgs) => setMessages(msgs),
      onTranscriptChange: (t) => setTranscript(t),
      onError: (err) => setError(err),
    });

    managerRef.current = manager;
    return () => { manager.destroy(); managerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ---- Auto-clear errors ----
  useEffect(() => {
    if (error) { const timer = setTimeout(() => setError(null), 8000); return () => clearTimeout(timer); }
  }, [error]);

  // ---- Public: Start voice conversation (called from user gesture) ----
  const startConversation = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    // Step 1: Request mic permission (user gesture required for mobile)
    const stream = await requestMicPermission();
    if (!stream) {
      initStartedRef.current = false;
      return;
    }

    // Step 2: Start the conversation
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.setLanguage(language);
    mgr.setUserProfile(profile);
    if (healthContextRef.current) mgr.setHealthContext(healthContextRef.current);
    await mgr.init({ language, userProfile: profile });
  }, [language, profile, requestMicPermission]);

  // ---- Public: Retry after permission error ----
  const retryMicPermission = useCallback(async () => {
    initStartedRef.current = false;
    setError(null);
    setMicPermission('unknown');
    stopListening();
    deepgramStopSpeaking();
    setVoiceState(CONVERSATION_STATES.IDLE);
    setMicReady(false);
    await new Promise(r => setTimeout(r, 100));
    initStartedRef.current = false;
    await startConversation();
  }, [startConversation, stopListening]);

  // ---- Public actions ----
  const togglePause = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    if (voiceState === CONVERSATION_STATES.PAUSED) mgr.resume();
    else mgr.pause();
  }, [voiceState]);

  const bargeIn = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.bargeIn();
  }, []);

  const clearChat = useCallback(() => {
    const mgr = managerRef.current;
    if (mgr) mgr.reset();
    stopListening();
    deepgramStopSpeaking();
    initStartedRef.current = false;
    setMicReady(false);
    setMessages([]);
    setTranscript('');
    setError(null);
    setVoiceState(CONVERSATION_STATES.IDLE);
  }, [stopListening]);

  const switchLanguage = useCallback((lang) => {
    setLanguage(lang);
    const mgr = managerRef.current;
    if (mgr) { mgr.reset(); mgr.setLanguage(lang); }
    stopListening();
    deepgramStopSpeaking();
    initStartedRef.current = false;
    setMicReady(false);
    setMessages([]);
    setTranscript('');
    setVoiceState(CONVERSATION_STATES.IDLE);
  }, [stopListening]);

  // ---- Cleanup mic stream on unmount ----
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    voiceState, messages, transcript, isListening, isSpeaking,
    error, language, micPermission, micReady,
    startConversation, retryMicPermission,
    togglePause, bargeIn, clearChat, switchLanguage,
  };
}
