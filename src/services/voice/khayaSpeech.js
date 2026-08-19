// Khaya AI speech client.
//
// The Khaya API key NEVER touches the browser. Everything is proxied through
// the `khaya` Supabase Edge Function, which validates the caller's JWT and
// calls Khaya with the server-side secret.
//
// Two entry points are used by the voice layer:
//   - khayaTranscribe(blob, languageKey)  -> ASR text
//   - speakText(text, { language, ... })  -> TTS playback with browser fallback
//
// speakText mirrors the existing browser `speak` contract (Promise resolves on
// end, rejects with AbortError on abort, optional onSpeechStart/onSpeechEnd) so
// the conversation manager and avatar state machine are untouched.

import useAuthStore from '../../stores/authStore';
import { speak as browserSpeak, stopSpeaking as browserStopSpeaking } from './speechSynthesis';
import { getKhayaAsrCode, getKhayaTtsCode, shouldUseKhayaTts } from './khayaLanguages';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const KHAYA_TIMEOUT_MS = 20000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export function getKhayaFunctionBase() {
  if (!SUPABASE_URL) return null;
  const match = SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/);
  return match ? `https://${match[1]}.supabase.co/functions/v1/khaya` : null;
}

function authToken() {
  return useAuthStore.getState().session?.access_token || null;
}

function attachAbort(signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KHAYA_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else if (signal) signal.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    },
  };
}

// ---- ASR ----

export async function khayaTranscribe(audioBlob, languageKey) {
  const code = getKhayaAsrCode(languageKey);
  if (!code) throw new Error('Khaya ASR is not available for this language.');
  if (!audioBlob || audioBlob.size === 0) throw new Error('Empty audio for transcription.');
  if (audioBlob.size > MAX_AUDIO_BYTES) throw new Error('Audio is too large to transcribe.');

  const base = getKhayaFunctionBase();
  if (!base) throw new Error('Khaya voice service is not configured.');
  const token = authToken();
  if (!token) throw new Error('Authentication required for the voice service.');

  const { signal: ctrlSignal, cleanup } = attachAbort(null);
  try {
    const res = await fetch(`${base}?op=asr&language=${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': audioBlob.type || 'audio/webm', Authorization: `Bearer ${token}` },
      body: audioBlob,
      signal: ctrlSignal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.error || `Voice service error (${res.status}).`);
      err.code = data?.code || 'khaya_error';
      throw err;
    }
    const text = (data?.text || '').trim();
    if (!text) throw new Error('Voice service returned no transcript.');
    return text;
  } finally {
    cleanup();
  }
}

// ---- TTS ----

async function khayaSynthesize(text, languageKey, { signal } = {}) {
  const code = getKhayaTtsCode(languageKey);
  if (!code) throw new Error('Khaya TTS is not available for this language.');

  const base = getKhayaFunctionBase();
  if (!base) throw new Error('Khaya voice service is not configured.');
  const token = authToken();
  if (!token) throw new Error('Authentication required for the voice service.');

  const { signal: ctrlSignal, cleanup } = attachAbort(signal);
  try {
    const res = await fetch(`${base}?op=tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text,
        language: code,
        speaker_id: 'female',
        stream: true,
        format: 'wav',
      }),
      signal: ctrlSignal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const err = new Error(data?.error || `Voice service error (${res.status}).`);
      err.code = data?.code || 'khaya_error';
      throw err;
    }
    const contentType = res.headers.get('Content-Type') || 'audio/wav';
    if (!contentType.toLowerCase().includes('audio')) {
      throw new Error('Voice service returned invalid audio.');
    }
    const arrayBuffer = await res.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Voice service returned empty audio.');
    }
    return new Blob([arrayBuffer], { type: contentType });
  } finally {
    cleanup();
  }
}

// ---- Audio playback (Khaya) ----

let activeKhayaAudio = null;
let activeKhayaUrl = null;

function stopKhayaAudio() {
  if (activeKhayaAudio) {
    try { activeKhayaAudio.pause(); } catch { /* ignore */ }
    activeKhayaAudio = null;
  }
  if (activeKhayaUrl) {
    try { URL.revokeObjectURL(activeKhayaUrl); } catch { /* ignore */ }
    activeKhayaUrl = null;
  }
}

function playKhayaAudio(blob, { signal, onSpeechStart, onSpeechEnd }) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeKhayaAudio = audio;
    activeKhayaUrl = url;

    let settled = false;

    function cleanup() {
      if (activeKhayaAudio === audio) activeKhayaAudio = null;
      if (activeKhayaUrl === url) activeKhayaUrl = null;
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      audio.onended = audio.onerror = audio.onplay = null;
      if (signal) signal.removeEventListener('abort', onAbort);
    }

    function onAbort() {
      if (settled) return;
      settled = true;
      audio.pause();
      cleanup();
      onSpeechEnd?.();
      reject(new DOMException('Aborted', 'AbortError'));
    }

    audio.onplay = () => onSpeechStart?.();
    audio.onended = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onSpeechEnd?.();
      resolve();
    };
    audio.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      onSpeechEnd?.();
      reject(new Error('Khaya audio playback failed.'));
    };

    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    audio.play().catch((err) => {
      if (settled) return;
      settled = true;
      cleanup();
      onSpeechEnd?.();
      reject(err?.name === 'AbortError' ? new DOMException('Aborted', 'AbortError') : err);
    });
  });
}

// ---- Combined speech with mandatory browser fallback ----

/**
 * Speak `text` in the given app language. Tries Khaya TTS first when the
 * language config says so, otherwise (or on any Khaya failure) falls back to
 * the existing browser speech synthesis. Never throws for Khaya failures —
 * browser speech takes over. Aborts via `signal` like browser `speak`.
 */
export async function speakText(text, { language = 'en', signal, onSpeechStart, onSpeechEnd } = {}) {
  if (!text) {
    onSpeechEnd?.();
    return;
  }

  if (shouldUseKhayaTts(language)) {
    try {
      const blob = await khayaSynthesize(text, language, { signal });
      await playKhayaAudio(blob, { signal, onSpeechStart, onSpeechEnd });
      return;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[KhayaSpeech] Khaya TTS failed, falling back to browser speech:', err.code || err.message);
      stopKhayaAudio();
    }
  }

  return browserSpeak(text, { signal, onSpeechStart, onSpeechEnd });
}

/**
 * Stop any in-progress speech (Khaya and/or browser). Used by barge-in, pause,
 * clear and switch-language paths so audio never keeps playing across states.
 */
export function stopSpeech() {
  stopKhayaAudio();
  browserStopSpeaking();
}

export function isKhayaServiceConfigured() {
  return !!getKhayaFunctionBase();
}

export default { khayaTranscribe, speakText, stopSpeech };
