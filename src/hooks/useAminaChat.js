import { useState, useRef, useEffect, useCallback } from 'react';
import { chatCompletion } from '../lib/groq';
import { createSpeechRecognition } from '../services/voice/speechRecognition';
import { createVAD } from '../services/voice/vad';
import { isSpeechSynthesisSupported } from '../services/voice/speechSynthesis';
import { khayaTranscribe, speakText as khayaSpeakText, stopSpeech as stopAllSpeech } from '../services/voice/khayaSpeech';
import { shouldUseKhayaAsr, shouldUseKhayaTts } from '../services/voice/khayaLanguages';
import useAuthStore from '../stores/authStore';
import useAppStore from '../stores/appStore';
import { createConversationManager, CONVERSATION_STATES } from '../services/conversationManager';
import { buildHealthContext } from '../services/healthContext';

// Map internal voice-conversation error codes to friendly, user-facing text.
function mapVoiceError(code) {
  if (code === 'processing_error') return 'I had trouble processing that. Please try again.';
  if (code === 'speech_error') return 'Voice recognition ran into a problem. Please try again.';
  if (typeof code === 'string') return code;
  return 'Something went wrong. Please try again.';
}

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
// Speech Synthesis — Browser TTS for ChatMode
// ============================================================
export function useSpeechSynthesis(language = 'en') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const abortRef = useRef(null);
  const onEndRef = useRef(null);
  const onStartRef = useRef(null);

  useEffect(() => { setIsSupported(isSpeechSynthesisSupported()); }, []);

  const speak = useCallback(async (text) => {
    if (!text || (!isSpeechSynthesisSupported() && !shouldUseKhayaTts(language))) {
      setIsSpeaking(false);
      onEndRef.current?.();
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      setIsSpeaking(true);
      onStartRef.current?.();
      await khayaSpeakText(text, {
        language,
        signal: abortRef.current.signal,
        onSpeechStart: () => setIsSpeaking(true),
        onSpeechEnd: () => { setIsSpeaking(false); onEndRef.current?.(); },
      });
    } catch (err) {
      if (err.name === 'AbortError') { setIsSpeaking(false); return; }
      console.error('TTS error:', err);
      setIsSpeaking(false);
      onEndRef.current?.();
    }
  }, [language]);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    stopAllSpeech();
    setIsSpeaking(false);
  }, []);

  const onEnd = useCallback((cb) => { onEndRef.current = cb; }, []);
  const onStart = useCallback((cb) => { onStartRef.current = cb; }, []);

  return { isSpeaking, isSupported, speak, stop, onEnd, onStart };
}

// ============================================================
// Voice Conversation — Browser STT/TTS + ConversationManager + VAD
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
  const currentPatient = useAppStore((state) => state.currentPatient);
  const managerRef = useRef(null);
  const healthContextRef = useRef('');
  const streamRef = useRef(null);
  const sttRef = useRef(null);
  const vadRef = useRef(null);
  const initStartedRef = useRef(false);
  const textBufferRef = useRef('');
  const lastInterimRef = useRef('');
  const pendingSendRef = useRef(false);
  const pendingSendTimerRef = useRef(null);
  const languageRef = useRef(language);
  const khayaAsrEnabledRef = useRef(false);
  const unmountedRef = useRef(false);
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const recordingActiveRef = useRef(false);
  const khayaAsrInFlightRef = useRef(false);

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

  // ---- Track Khaya ASR availability for the current language ----
  useEffect(() => {
    languageRef.current = language;
    khayaAsrEnabledRef.current = shouldUseKhayaAsr(language) && typeof MediaRecorder !== 'undefined';
  }, [language]);

  // ---- Request microphone access (must be called from user gesture) ----
  const requestMicPermission = useCallback(async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!isSecure) {
          setError('Microphone requires HTTPS. Your current connection is not secure. Please use HTTPS or access via localhost.');
        } else {
          setError('Microphone access is not available in this browser.');
        }
        return null;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
            sampleRate: { ideal: 16000 },
            channelCount: { ideal: 1 },
          }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
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

  // ---- SpeechRecognition lifecycle ----
  function startRecognition() {
    stopRecognition();
    setTranscript('');
    textBufferRef.current = '';
    lastInterimRef.current = '';
    const recognition = createSpeechRecognition({
      language,
      onInterim: (text) => {
        const combined = textBufferRef.current + (textBufferRef.current && text ? ' ' : '') + text;
        lastInterimRef.current = combined;
        if (!khayaAsrEnabledRef.current) setTranscript(combined);
      },
      onFinal: (text) => {
        textBufferRef.current += (textBufferRef.current && text ? ' ' : '') + text;
        lastInterimRef.current = textBufferRef.current;
        // With Khaya ASR active the final transcript comes from the recorded
        // audio, not the browser recognizer — it is only kept as a fallback.
        if (khayaAsrEnabledRef.current) return;
        setTranscript(textBufferRef.current);
        // Send when VAD already ended the utterance, or when STT finalized
        // the text after the VAD timer already fired (late final — otherwise
        // the user's first utterance is silently dropped and they repeat it).
        if (pendingSendRef.current || (!vadRef.current?.isCurrentlySpeaking?.() && textBufferRef.current)) {
          sendBufferedTranscript();
        }
      },
      onError: (err) => {
        console.error('[Hook] STT error:', err);
        setError(`Voice recognition error: ${err}`);
      },
    });
    recognition.start();
    sttRef.current = recognition;
  }

  function stopRecognition() {
    if (sttRef.current) {
      sttRef.current.stop();
      sttRef.current = null;
    }
  }

  // ---- Pending transcript send (coordinates VAD silence with STT finalization) ----
  function clearPendingSend() {
    pendingSendRef.current = false;
    clearTimeout(pendingSendTimerRef.current);
    pendingSendTimerRef.current = null;
  }

  function sendBufferedTranscript() {
    pendingSendRef.current = false;
    clearTimeout(pendingSendTimerRef.current);
    pendingSendTimerRef.current = null;
    const finalSentence = textBufferRef.current.trim() || lastInterimRef.current.trim();
    textBufferRef.current = '';
    lastInterimRef.current = '';
    setTranscript('');
    managerRef.current?.vadSpeechEnd();
    if (finalSentence) {
      managerRef.current?.onFinalTranscript(finalSentence);
    }
  }

  // ---- Khaya ASR (records only while the user is speaking) ----
  function createKhayaRecorder(stream) {
    if (typeof MediaRecorder === 'undefined') return null;
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    let mimeType = '';
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
    }
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      try { recorder = new MediaRecorder(stream); } catch { return null; }
    }
    recorderChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recorderChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      recordingActiveRef.current = false;
      const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      recorderChunksRef.current = [];
      if (unmountedRef.current || blob.size === 0) return;
      transcribeKhayaBlob(blob);
    };
    return recorder;
  }

  function startKhayaRecorder(stream) {
    if (!khayaAsrEnabledRef.current) return;
    if (recorderRef.current && recordingActiveRef.current) return;
    recorderRef.current = createKhayaRecorder(stream);
    if (!recorderRef.current) return;
    try {
      recorderRef.current.start(250);
      recordingActiveRef.current = true;
    } catch {
      recorderRef.current = null;
      recordingActiveRef.current = false;
    }
  }

  function stopKhayaRecorder() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder || recorder.state === 'inactive') {
      fallbackAfterKhayaMiss();
      return;
    }
    try { recorder.stop(); } catch { fallbackAfterKhayaMiss(); }
  }

  function destroyKhayaRecorder() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    recordingActiveRef.current = false;
    recorderChunksRef.current = [];
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* ignore */ }
    }
  }

  async function transcribeKhayaBlob(blob) {
    if (unmountedRef.current) return;
    khayaAsrInFlightRef.current = true;
    clearPendingSend();
    const langAtUtterance = languageRef.current;
    try {
      const text = await khayaTranscribe(blob, langAtUtterance);
      textBufferRef.current = '';
      lastInterimRef.current = '';
      setTranscript('');
      if (text) managerRef.current?.onFinalTranscript(text);
    } catch (err) {
      if (unmountedRef.current) return;
      if (err.name === 'AbortError') return;
      console.warn('[Voice] Khaya ASR failed, falling back to browser transcript:', err.code || err.message);
      fallbackAfterKhayaMiss();
    } finally {
      khayaAsrInFlightRef.current = false;
    }
  }

  function fallbackAfterKhayaMiss() {
    if (unmountedRef.current) return;
    const fallback = textBufferRef.current.trim() || lastInterimRef.current.trim();
    textBufferRef.current = '';
    lastInterimRef.current = '';
    setTranscript('');
    if (fallback) {
      managerRef.current?.onFinalTranscript(fallback);
    } else {
      setError('Voice recognition is temporarily unavailable. Please try again in a moment.');
    }
  }

  // ---- VAD Lifecycle ----
  function startVAD(stream) {
    destroyVAD();
    const vad = createVAD(stream, {
      onSpeechStart: () => {
        managerRef.current?.vadSpeechStart();
        startKhayaRecorder(stream);
      },
      onSpeechEnd: () => {
        if (khayaAsrEnabledRef.current) {
          managerRef.current?.vadSpeechEnd();
          stopKhayaRecorder();
          return;
        }
        pendingSendRef.current = true;
        clearTimeout(pendingSendTimerRef.current);
        pendingSendTimerRef.current = setTimeout(() => {
          sendBufferedTranscript();
        }, 2500);
      },
    });
    vad.start();
    vadRef.current = vad;
  }

  function destroyVAD() {
    clearPendingSend();
    if (vadRef.current) {
      vadRef.current.stop();
      vadRef.current = null;
    }
  }

  // ---- State-driven SpeechRecognition lifecycle ----
  useEffect(() => {
    if (voiceState === CONVERSATION_STATES.LISTENING) {
      startRecognition();
    } else if (voiceState === CONVERSATION_STATES.PROCESSING ||
               voiceState === CONVERSATION_STATES.SPEAKING ||
               voiceState === CONVERSATION_STATES.INTERRUPTING ||
               voiceState === CONVERSATION_STATES.PAUSED ||
               voiceState === CONVERSATION_STATES.IDLE ||
               voiceState === CONVERSATION_STATES.ERROR) {
      stopRecognition();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState]);

  // ---- Keep VAD aligned with conversation state ----
  // Only detect the user's voice while LISTENING. During PROCESSING/SPEAKING
  // (and other states) Amina's own TTS would be picked up by the mic and
  // wrongly treated as a barge-in, aborting her response.
  useEffect(() => {
    if (voiceState === CONVERSATION_STATES.LISTENING) {
      vadRef.current?.setEnabled?.(true);
    } else {
      vadRef.current?.setEnabled?.(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState]);

  // ---- Fetch health context when profile or selected patient changes ----
  useEffect(() => {
    if (profile?.id && profile?.role) {
      buildHealthContext(profile, { patientId: currentPatient?.id }).then(ctx => {
        healthContextRef.current = ctx;
        if (managerRef.current) managerRef.current.setHealthContext(ctx);
      }).catch(err => console.error('Failed to build health context:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, currentPatient?.id]);

  // ---- Patient switch while mounted: reset the voice conversation ----
  // The manager is created once per [language, profile.id], so without this a
  // worker switching from one patient's record to another would keep the
  // previous patient's conversation history (and that history would be sent to
  // the AI as if it belonged to the new patient).
  const voicePatientIdRef = useRef(null);
  useEffect(() => {
    if (voicePatientIdRef.current !== currentPatient?.id) {
      voicePatientIdRef.current = currentPatient?.id;
      if (managerRef.current) managerRef.current.reset();
      setTranscript('');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatient?.id]);

  // ---- Refresh health context on demand (e.g. before starting a conversation) ----
  const refreshContext = useCallback(async () => {
    if (!profile?.id || !profile?.role) return;
    try {
      const ctx = await buildHealthContext(profile, { patientId: currentPatient?.id });
      healthContextRef.current = ctx;
      if (managerRef.current) managerRef.current.setHealthContext(ctx);
    } catch (err) {
      console.error('Failed to refresh health context:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, currentPatient?.id]);

  // ---- Rebuild context when clinical data changes (markDataChanged) ----
  // So a worker who just logged a visit (or edited a record) can immediately
  // ask Amina about the fresh data without starting a new conversation first.
  const dataVersion = useAppStore((s) => s.dataVersion);
  useEffect(() => {
    if (dataVersion === 0) return;
    const t = setTimeout(() => { refreshContext(); }, 350);
    return () => clearTimeout(t);
  }, [dataVersion, refreshContext]);

  // ---- Create ConversationManager ----
  useEffect(() => {
    const manager = createConversationManager({
      sendToAI: async (apiMessages, opts) => chatCompletion(apiMessages, opts),

      speakText: async (text, signal) => {
        vadRef.current?.setEnabled?.(false);
        await khayaSpeakText(text, { language, signal });
        if (managerRef.current?.getState?.() === CONVERSATION_STATES.LISTENING) {
          vadRef.current?.setEnabled?.(true);
        }
      },

      stopSpeech: () => { stopAllSpeech(); },

      onStateChange: (state) => setVoiceState(state),
      onMessagesChange: (msgs) => setMessages(msgs),
      onTranscriptChange: (t) => setTranscript(t),
      onError: (err) => setError(mapVoiceError(err)),
    });

    managerRef.current = manager;
    return () => { manager.destroy(); managerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, profile?.id]);

  // ---- Auto-clear errors ----
  useEffect(() => {
    if (error) { const timer = setTimeout(() => setError(null), 8000); return () => clearTimeout(timer); }
  }, [error]);

  // ---- Public: Start voice conversation (called from user gesture) ----
  const startConversation = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    // Refresh health context so the AI has the very latest data
    await refreshContext();

    const stream = await requestMicPermission();
    if (!stream) {
      initStartedRef.current = false;
      return;
    }

    startVAD(stream);

    const mgr = managerRef.current;
    if (!mgr) {
      initStartedRef.current = false;
      return;
    }
    mgr.setLanguage(language);
    mgr.setUserProfile(profile);
    if (healthContextRef.current) mgr.setHealthContext(healthContextRef.current);
    await mgr.init({ language, userProfile: profile });
    initStartedRef.current = false;
  }, [language, profile, requestMicPermission, refreshContext]);

  // ---- Public: Retry after permission error ----
  const retryMicPermission = useCallback(async () => {
    initStartedRef.current = false;
    setError(null);
    setMicPermission('unknown');
    stopRecognition();
    stopAllSpeech();
    setVoiceState(CONVERSATION_STATES.IDLE);
    setMicReady(false);
    await new Promise(r => setTimeout(r, 100));
    await startConversation();
  }, [startConversation]);

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
    stopRecognition();
    destroyVAD();
    destroyKhayaRecorder();
    stopAllSpeech();
    initStartedRef.current = false;
    setMicReady(false);
    setMessages([]);
    setTranscript('');
    setError(null);
    setVoiceState(CONVERSATION_STATES.IDLE);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const switchLanguage = useCallback((lang) => {
    setLanguage(lang);
    const mgr = managerRef.current;
    if (mgr) { mgr.reset(); mgr.setLanguage(lang); }
    stopRecognition();
    destroyVAD();
    destroyKhayaRecorder();
    stopAllSpeech();
    initStartedRef.current = false;
    setMicReady(false);
    setMessages([]);
    setTranscript('');
    setVoiceState(CONVERSATION_STATES.IDLE);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ---- Cleanup mic stream on unmount ----
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      stopRecognition();
      destroyVAD();
      destroyKhayaRecorder();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    voiceState, messages, transcript, isListening, isSpeaking,
    error, language, micPermission, micReady,
    startConversation, retryMicPermission, refreshContext,
    togglePause, bargeIn, clearChat, switchLanguage,
  };
}
