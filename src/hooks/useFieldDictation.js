import { useState, useRef, useCallback, useEffect } from 'react';
import { createSpeechRecognition } from '../services/voice/speechRecognition.js';
import { shouldUseKhayaAsr } from '../services/voice/khayaLanguages.js';

// Chrome finalizes speech phrase by phrase. Committing the first phrase would
// clip a sentence in half ("my name is" / "amina" -> field saves "my name is"),
// so results are collected and only emitted once the speaker has gone quiet.
const FINAL_SETTLE_MS = 1800;
const INTERIM_SETTLE_MS = 6000;

/**
 * Dictation for a single form field.
 *
 * Two providers, because the browser only covers one of them:
 *
 *   - English -> browser SpeechRecognition. Free and instant, with live interim
 *     text so the mother can see she is being heard.
 *   - Dagbani -> no browser recognizer exists for it, so the clip is recorded
 *     and sent to Khaya ASR when she stops talking. There are no interim
 *     results on this path (transcribing every 250ms chunk would burn the
 *     monthly quota), so the UI shows "Listening…" instead of live text.
 *
 * Both paths wrap `createSpeechRecognition` / Khaya rather than reaching for a
 * raw recognizer, so the restart-and-backoff behaviour that keeps Android
 * Chrome alive is preserved.
 *
 * Only ever fills the field it was aimed at. It never navigates the form and
 * never submits.
 */
export function useFieldDictation(languageKey = 'en') {
  const usesKhaya = shouldUseKhayaAsr(languageKey);
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const busyRef = useRef(false);
  const settleTimerRef = useRef(null);
  const collectedRef = useRef('');
  const onFinalRef = useRef(null);
  const onInterimRef = useRef(null);
  const unmountedRef = useRef(false);

  const hasBrowserStt = typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const canRecord = typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== 'undefined';

  const isSupported = usesKhaya ? canRecord : hasBrowserStt;

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* already stopped */ }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ---- Shared cleanup --------------------------------------------------

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }, []);

  const flushCollected = useCallback(() => {
    clearSettle();
    const text = collectedRef.current.trim();
    collectedRef.current = '';
    if (text && !unmountedRef.current) onFinalRef.current?.(text);
  }, [clearSettle]);

  // `keepOpen` is set when speech is still arriving after a final, which means
  // the mother is mid-sentence rather than finished.
  const collect = useCallback((text, delayMs) => {
    collectedRef.current = `${collectedRef.current} ${text}`.trim();
    clearSettle();
    settleTimerRef.current = setTimeout(flushCollected, delayMs);
  }, [clearSettle, flushCollected]);

  const emitNow = useCallback((text) => {
    const clean = (text || '').trim();
    if (clean && !unmountedRef.current) onFinalRef.current?.(clean);
  }, []);

  const release = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* already stopped */ }
    }
    chunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    setInterim('');
  }, []);

  // Stopping is always deliberate, so anything already collected is worth
  // keeping rather than thrown away with the session.
  const cancelSession = useCallback(() => {
    if (collectedRef.current.trim()) {
      flushCollected();
      return;
    }
    clearSettle();
    collectedRef.current = '';
  }, [clearSettle, flushCollected]);

  const ensureRecognition = useCallback(() => {
    if (usesKhaya || !hasBrowserStt) return null;
    if (!recognitionRef.current) {
      const recognition = createSpeechRecognition({
        language: languageKey,
        onInterim: (text) => {
          if (unmountedRef.current) return;
          setInterim(text);
          onInterimRef.current?.(text);
          if (settleTimerRef.current) collect(text, INTERIM_SETTLE_MS);
        },
        onFinal: (text) => {
          if (unmountedRef.current) return;
          setInterim('');
          collect(text, FINAL_SETTLE_MS);
        },
        onError: (message) => {
          if (!unmountedRef.current) setError(message);
        },
      });
      recognitionRef.current = recognition;
    }
    return recognitionRef.current;
  }, [collect, hasBrowserStt, languageKey, usesKhaya]);

  useEffect(() => {
    if (usesKhaya || !hasBrowserStt) return undefined;
    const recognition = ensureRecognition();
    if (!recognition) return undefined;
    return () => {
      recognitionRef.current = null;
      recognition.stop();
    };
  }, [ensureRecognition, hasBrowserStt, usesKhaya]);

  // ---- Khaya path ------------------------------------------------------

  const startKhaya = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: { ideal: 1 } },
    });
    if (unmountedRef.current) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    streamRef.current = stream;

    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(250);
    recorderRef.current = recorder;
  }, []);

  const stopKhaya = useCallback(async () => {
    const recorder = recorderRef.current;
    const mimeType = recorder?.mimeType || chunksRef.current[0]?.type || 'audio/webm';
    const chunks = chunksRef.current;
    release();

    if (busyRef.current || !chunks.length) return;
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 1200) return; // too short to be a word

    busyRef.current = true;
    try {
      const { khayaTranscribe } = await import('../services/voice/khayaSpeech.js');
      const text = await khayaTranscribe(blob, languageKey);
      if (unmountedRef.current) return;
      emitNow(text);
    } catch (err) {
      if (!unmountedRef.current) {
        console.warn('[Dictation] Khaya transcription failed:', err?.code || err?.message);
        setError('I could not hear that clearly. Please try again.');
      }
    } finally {
      busyRef.current = false;
    }
  }, [languageKey, release, emitNow]);

  // ---- Public API ------------------------------------------------------

  const start = useCallback(async () => {
    if (isListening || !isSupported) return;
    setError(null);
    setInterim('');
    collectedRef.current = '';
    clearSettle();
    try {
      if (usesKhaya) {
        await startKhaya();
      } else {
        const recognition = ensureRecognition();
        if (recognition) recognition.start();
      }
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      if (err?.name === 'NotAllowedError') {
        setError('Microphone access is blocked. Allow it in your browser settings to speak.');
      } else {
        setError('Could not start the microphone. Please try again.');
      }
    }
  }, [clearSettle, ensureRecognition, isListening, isSupported, usesKhaya, startKhaya]);

  const stop = useCallback(() => {
    if (usesKhaya) {
      cancelSession();
      void stopKhaya();
    } else {
      recognitionRef.current?.stop();
      cancelSession();
      setInterim('');
      setIsListening(false);
    }
  }, [usesKhaya, stopKhaya, cancelSession]);

  const onFinal = useCallback((cb) => { onFinalRef.current = cb; }, []);
  const onInterim = useCallback((cb) => { onInterimRef.current = cb; }, []);

  return { isListening, interim, error, isSupported, start, stop, onFinal, onInterim };
}

export default useFieldDictation;