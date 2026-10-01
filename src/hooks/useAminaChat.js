import { useState, useRef, useEffect, useCallback } from 'react';
import { chatCompletion } from '../lib/groq';
import { createSpeechRecognition } from '../services/voice/speechRecognition';
import { createVAD } from '../services/voice/vad';
import { isSpeechSynthesisSupported } from '../services/voice/speechSynthesis';
import { khayaTranscribe, speakText as khayaSpeakText, stopSpeech as stopAllSpeech } from '../services/voice/khayaSpeech';
import { shouldUseKhayaAsr, shouldUseKhayaTts, getSpeechConfig } from '../services/voice/khayaLanguages';
import useAuthStore from '../stores/authStore';
import useAppStore from '../stores/appStore';
import { createConversationManager, CONVERSATION_STATES } from '../services/conversationManager';
import { buildHealthContext } from '../services/healthContext';

// Barge-in recorder tuning. Chunks are 250ms, so 4 chunks of lookback recovers
// roughly the last second — enough to keep the start of an interrupted sentence.
const BARGE_IN_CHUNK_MS = 250;
const BARGE_IN_LOOKBACK_CHUNKS = 4;
const MAX_BARGE_IN_CHUNKS = 48;
const MIN_BARGE_IN_BLOB_BYTES = 1200;

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
/**
 * Dictation for single-field contexts (the onboarding form, chat input boxes).
 *
 * `language` must be an app language key ('en' | 'dag'), NOT a raw locale.
 * Callers used to pass 'ha-Latn-NG' for Dagbani, and this hook compared against
 * 'dag', so Dagbani recognition silently ran in English — the user was asked in
 * Dagbani and answered into an English recognizer.
 *
 * Built on createSpeechRecognition so it inherits the restart/backoff that keeps
 * Android Chrome from killing the session permanently. The old inline
 * `new SpeechRecognition()` had no restart and no backoff, which is exactly the
 * failure that made voice capture go silent after the first utterance.
 */
export function useSpeechRecognition(language = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(undefined);
  const [error, setError] = useState(null);
  const [micPermission, setMicPermission] = useState('unknown');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(null);
  const onInterimRef = useRef(null);

  // Coerce anything to a known app language key so a bad caller cannot end up
  // with an English recognizer on a Dagbani screen.
  const languageKey = getSpeechConfig(language) ? language : 'en';

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
    if (!getSpeechConfig(languageKey)) {
      setIsSupported(false);
      return;
    }

    const recognition = createSpeechRecognition({
      language: languageKey,
      onInterim: (text) => {
        setTranscript(text);
        onInterimRef.current?.(text);
      },
      onFinal: (text) => {
        setTranscript(text);
        onFinalRef.current?.(text);
      },
      onError: (message) => {
        // Treat a denied mic as terminal so the UI can stop offering the button.
        if (/denied/i.test(message)) setMicPermission('denied');
        else setError(message);
      },
    });

    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      recognitionRef.current = null;
      recognition.stop();
    };
  }, [languageKey]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    setTranscript('');
    try {
      recognition.start();
      setIsListening(true);
    } catch { /* may already be started */ }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const onFinal = useCallback((cb) => { onFinalRef.current = cb; }, []);
  const onInterim = useCallback((cb) => { onInterimRef.current = cb; }, []);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    micPermission,
    startListening,
    stopListening,
    setTranscript,
    checkMicPermission,
    resetMicPermission,
    onFinal,
    onInterim,
  };
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
  const needsMicStreamRef = useRef(false);
  const interimWatchdogRef = useRef(null);
  // Whether Chrome has committed at least one final (whole-phrase) result for
  // the current utterance. Finals are a much stronger "that sentence is done"
  // signal than interim guesses, so they earn a much shorter quiet period.
  const finalSeenRef = useRef(false);
  const bargeInStreamRef = useRef(null);
  const bargeInVadRef = useRef(null);
  const bargeInRecorderRef = useRef(null);
  const bargeInChunksRef = useRef([]);
  const bargeInStartChunkRef = useRef(null);
  const bargeInInFlightRef = useRef(false);
  const voiceStateRef = useRef(voiceState);
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
    needsMicStreamRef.current = khayaAsrEnabledRef.current;
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
        // Deliberately NOT requesting noiseSuppression or autoGainControl: both
        // attenuate and normalize away the quiet, distant speech the VAD needs
        // to detect. Echo cancellation is unnecessary too, because the VAD is
        // switched off while Amina is talking.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: { ideal: 1 },
            sampleRate: { ideal: 16000 },
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
        if (!khayaAsrEnabledRef.current) {
          setTranscript(combined);
          armSettleTimer();
        }
      },
      onFinal: (text) => {
        textBufferRef.current += (textBufferRef.current && text ? ' ' : '') + text;
        lastInterimRef.current = textBufferRef.current;
        finalSeenRef.current = true;
        // With Khaya ASR active the final transcript comes from the recorded
        // audio, not the browser recognizer — it is only kept as a fallback.
        if (khayaAsrEnabledRef.current) return;
        setTranscript(textBufferRef.current);
        // Send immediately only when a VAD has already decided the utterance
        // ended — that path has a real end-of-speech signal. For browser-STT
        // languages there is no VAD, and Chrome commits finals phrase by phrase
        // WHILE the user is still talking, so sending here is what made Amina
        // respond to a half-finished sentence. Those languages wait for the
        // settle timer instead.
        if (pendingSendRef.current) sendBufferedTranscript();
        else armSettleTimer();
      },
      onEnd: () => {
        // Chrome ended the session (its own silence window, or an aborted
        // restart). The wrapper starts a fresh session, so if the user was only
        // pausing to think, their next words land in the buffer and re-arm the
        // settle timer before anything is sent.
        armSettleTimer();
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

  // ---- Settle timer (browser-STT languages) ----
  // No signal perfectly separates "finished speaking" from "thinking", so the
  // best available answer is a quiet period that every new piece of speech
  // resets. Chrome committing a final result is the one strong hint that a
  // complete phrase exists, so it earns a short wait; interim-only text gets a
  // long one, because sending that early is exactly how Amina ends up replying
  // to half a sentence. This replaced a previous pair of bugs: sending on the
  // first final (which Chrome emits mid-utterance) and a flat 2.5s timer (which
  // fired whenever anyone paused to think).
  function clearInterimWatchdog() {
    clearTimeout(interimWatchdogRef.current);
    interimWatchdogRef.current = null;
  }

  function armSettleTimer() {
    clearInterimWatchdog();
    interimWatchdogRef.current = setTimeout(() => {
      interimWatchdogRef.current = null;
      sendStalledTranscript('[Voice] quiet period elapsed — sending transcript');
    }, finalSeenRef.current ? 1800 : 6000);
  }

  function sendStalledTranscript(reason) {
    if (khayaAsrEnabledRef.current || vadRef.current || khayaAsrInFlightRef.current) return;
    if (bargeInInFlightRef.current) return;
    if (unmountedRef.current) return;
    if (managerRef.current?.getState?.() !== CONVERSATION_STATES.LISTENING) return;
    if (!textBufferRef.current.trim() && !lastInterimRef.current.trim()) return;
    console.log(reason);
    sendBufferedTranscript();
  }

  function sendBufferedTranscript() {
    pendingSendRef.current = false;
    finalSeenRef.current = false;
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
    clearInterimWatchdog();
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
      clearInterimWatchdog();
      stopRecognition();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState]);

  // Mirror of voiceState that async code can read without going stale. The
  // getUserMedia call below resolves a frame or two after the effect that
  // started it, by which time the captured voiceState is already out of date.
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  // ---- Barge-in (browser-STT languages) ----
  // Browser-STT languages deliberately hold no mic stream while listening, so
  // nothing is watching when Amina talks. While she is SPEAKING we open a
  // short-lived stream with echo cancellation (so her own voice is suppressed)
  // and roll a recorder, which lets an interruption be both detected AND
  // transcribed — the words spoken over her are not thrown away. The stream is
  // closed the moment listening resumes, so it never runs alongside the browser
  // recognizer, which is what used to break capture on Android.
  function stopBargeInMonitor() {
    if (bargeInVadRef.current) {
      bargeInVadRef.current.stop();
      bargeInVadRef.current = null;
    }
    if (bargeInRecorderRef.current) {
      const rec = bargeInRecorderRef.current;
      bargeInRecorderRef.current = null;
      try { rec.stop(); } catch { /* already stopped */ }
    }
    bargeInChunksRef.current = [];
    bargeInStartChunkRef.current = null;
    if (bargeInStreamRef.current) {
      bargeInStreamRef.current.getTracks().forEach(t => t.stop());
      bargeInStreamRef.current = null;
    }
  }

  function createBargeInRecorder(stream) {
    if (typeof MediaRecorder === 'undefined') return null;
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
    let rec;
    try {
      rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      try { rec = new MediaRecorder(stream); } catch { return null; }
    }
    rec.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      bargeInChunksRef.current.push(e.data);
      if (bargeInChunksRef.current.length > MAX_BARGE_IN_CHUNKS) bargeInChunksRef.current.shift();
    };
    return rec;
  }

  async function transcribeBargeInBlob(blob) {
    bargeInInFlightRef.current = true;
    try {
      const text = await khayaTranscribe(blob, languageRef.current);
      if (unmountedRef.current) return;
      const clean = (text || '').trim();
      // Anything this short is echo residue or a cough, not an interruption.
      if (clean.length < 2) return;
      console.log('[Voice] barge-in utterance transcribed:', clean.length, 'chars');
      managerRef.current?.onFinalTranscript(clean);
    } catch (err) {
      console.warn('[Voice] barge-in transcription failed:', err?.code || err?.message);
    } finally {
      bargeInInFlightRef.current = false;
    }
  }

  function onBargeInSpeechStart() {
    if (bargeInStartChunkRef.current !== null) return;
    if (bargeInInFlightRef.current) return;
    bargeInStartChunkRef.current = Math.max(0, bargeInChunksRef.current.length - BARGE_IN_LOOKBACK_CHUNKS);
    console.log('[Voice] barge-in detected — stopping Amina');
    managerRef.current?.vadSpeechStart();
  }

  function onBargeInSpeechEnd() {
    if (bargeInStartChunkRef.current === null) return;
    const start = bargeInStartChunkRef.current;
    const chunks = bargeInChunksRef.current.slice(start);
    const mime = bargeInRecorderRef.current?.mimeType || chunks[0]?.type || 'audio/webm';
    bargeInStartChunkRef.current = null;
    if (bargeInRecorderRef.current && bargeInRecorderRef.current.state !== 'inactive') {
      try { bargeInRecorderRef.current.stop(); } catch { /* already stopped */ }
    }
    managerRef.current?.vadSpeechEnd();
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: mime });
    if (blob.size < MIN_BARGE_IN_BLOB_BYTES) return;
    void transcribeBargeInBlob(blob);
  }

  async function startBargeInMonitor() {
    if (khayaAsrEnabledRef.current) return;
    if (bargeInStreamRef.current || unmountedRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    let stream;
    try {
      // Echo cancellation is essential here: it strips Amina's playback so the
      // VAD is effectively listening for the user only.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1 },
        },
      });
    } catch (err) {
      console.warn('[Voice] barge-in unavailable:', err?.name);
      return;
    }
    // The state may have moved on while the permission prompt was up. Bail out
    // and release the stream, otherwise it is installed after cleanup has
    // already run and never gets closed.
    const st = voiceStateRef.current;
    const stillWanted = st === CONVERSATION_STATES.SPEAKING || st === CONVERSATION_STATES.INTERRUPTING;
    if (unmountedRef.current || bargeInStreamRef.current !== null || !stillWanted) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    bargeInStreamRef.current = stream;

    const rec = createBargeInRecorder(stream);
    if (rec) {
      bargeInRecorderRef.current = rec;
      try { rec.start(BARGE_IN_CHUNK_MS); } catch { bargeInRecorderRef.current = null; }
    }

    const vad = createVAD(stream, {
      // Demanding settings on purpose: sustained voice only, so a door slam or
      // a cough cannot cut Amina off. adaptUp lets the floor settle onto her
      // playback, so only the user's closer, louder voice crosses it.
      minSpeechMs: 500,
      silenceTimeoutMs: 700,
      minRms: 0.02,
      snrMultiplier: 2.5,
      adaptUp: true,
      onSpeechStart: onBargeInSpeechStart,
      onSpeechEnd: onBargeInSpeechEnd,
    });
    vad.start();
    vad.setEnabled(true);
    bargeInVadRef.current = vad;
  }

  // ---- Barge-in monitor lifecycle ----
  // Opened while Amina speaks, closed once we are listening again. It is kept
  // alive through INTERRUPTING on purpose: that state is exactly the window in
  // which the user finishes their interrupted sentence.
  useEffect(() => {
    if (voiceState === CONVERSATION_STATES.SPEAKING) {
      void startBargeInMonitor();
      return;
    }
    if (voiceState === CONVERSATION_STATES.LISTENING ||
        voiceState === CONVERSATION_STATES.IDLE ||
        voiceState === CONVERSATION_STATES.PAUSED ||
        voiceState === CONVERSATION_STATES.ERROR) {
      stopBargeInMonitor();
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

  // ---- Validate that the browser can do voice input at all ----
  function checkRecognitionEnvironment() {
    const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!supported) return 'Voice input is not supported in this browser. Please use the text chat instead.';
    const isSecure = location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
    if (!isSecure) return 'Microphone requires HTTPS. Please open the app over HTTPS and try again.';
    return null;
  }

  // ---- Public: Start voice conversation (called from user gesture) ----
  const startConversation = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    // Refresh health context so the AI has the very latest data
    await refreshContext();

    // Exclusive mic ownership. Chrome's SpeechRecognition is backed by its own
    // native capture service and silently fails on Android when the page is
    // also holding a getUserMedia stream. So the stream is opened ONLY for
    // languages that record audio for Khaya ASR; browser-STT languages let the
    // recognizer own the microphone by itself.
    if (needsMicStreamRef.current) {
      const stream = await requestMicPermission();
      if (!stream) {
        initStartedRef.current = false;
        return;
      }
      startVAD(stream);
    } else {
      const envError = checkRecognitionEnvironment();
      if (envError) {
        setMicPermission('denied');
        setError(envError);
        initStartedRef.current = false;
        return;
      }
      destroyVAD();
      setMicReady(true);
      setMicPermission((p) => (p === 'unknown' ? 'granted' : p));
    }

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
      stopBargeInMonitor();
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
