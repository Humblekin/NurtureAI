/**
 * Real-time STT (REST chunked upload) + TTS (REST API).
 * Uses chunked HTTP POST for speech-to-text — works on all networks.
 */

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const DEEPGRAM_REST_URL = 'https://api.deepgram.com';

// ---- Helpers ----

let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    if (ctx.state === 'suspended') ctx.resume();
    audioUnlocked = true;
  } catch (e) {
    console.warn('[Audio] Unlock failed:', e);
  }
}

export function isDeepgramConfigured() {
  return !!DEEPGRAM_API_KEY;
}

// ---- Speech-to-Text ----

/**
 * REST-based STT fallback. Records audio in segments, sends via HTTP POST.
 * Works on networks that block WebSocket connections.
 */
function startRestSTT(stream, callbacks, options) {
  const sttLanguage = options?.language === 'dag' ? 'ha-Latn-NG' : 'en-US';
  const SEGMENT_MS = 3000;
  let stopped = false;
  let recorder = null;
  let isRecording = false;

  console.log('[STT] 📡 Using REST fallback (HTTP POST) for STT');

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/mp4')
    ? 'audio/mp4'
    : 'audio/webm';

  async function sendSegment(blob) {
    if (stopped) return;
    if (blob.size < 50) {
      console.log('[STT] 📡 Segment too small (' + blob.size + ' bytes), skipping');
      return;
    }
    try {
      console.log('[STT] 📡 Sending segment:', blob.size, 'bytes');
      callbacks.onInterim?.('Processing speech...');

      const params = new URLSearchParams({
        model: 'nova-2',
        language: sttLanguage,
        smart_format: 'true',
      });
      const response = await fetch(`${DEEPGRAM_REST_URL}/v1/listen?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm',
        },
        body: blob,
      });
      if (!response.ok) {
        const errText = await response.text();
        const errMsg = `Deepgram error ${response.status}: ${errText}`;
        console.error('[STT] ❌', errMsg);
        callbacks.onError?.(errMsg);
        return;
      }
      const result = await response.json();
      console.log('[STT] 📡 REST response:', JSON.stringify(result).substring(0, 200));
      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
      if (transcript) {
        console.log('[STT] ✅ Final transcript:', transcript);
        callbacks.onFinal?.(transcript);
      } else {
        console.log('[STT] 📡 No speech detected in segment');
      }
    } catch (err) {
      const errMsg = 'REST STT failed: ' + err.message;
      console.error('[STT] ❌', errMsg);
      callbacks.onError?.(errMsg);
    }
  }

  function startRecording() {
    if (stopped || isRecording) return;
    isRecording = true;

    const chunks = [];
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      console.error('[STT] ❌ MediaRecorder creation failed:', err);
      callbacks.onError?.('Microphone access failed: ' + err.message);
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      console.error('[STT] ❌ MediaRecorder error:', e.error);
      callbacks.onError?.('Recording error: ' + (e.error?.message || 'unknown'));
      isRecording = false;
    };

    recorder.onstop = async () => {
      isRecording = false;
      if (stopped) return;
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: mimeType });
        await sendSegment(blob);
      }
      if (!stopped) startRecording();
    };

    recorder.start();
    callbacks.onInterim?.('Listening...');
    console.log('[STT] 🎙️ REST mode: recording segment...');

    setTimeout(() => {
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
    }, SEGMENT_MS);
  }

  startRecording();

  return {
    stop: () => {
      stopped = true;
      console.log('[STT] 🛑 Stopping REST STT');
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
    },
  };
}

/**
 * Start streaming STT (synchronous — REST mode).
 * REST works on all networks including those blocking WebSocket.
 */
export function startStreamingSTT(stream, callbacks, options = {}) {
  if (!DEEPGRAM_API_KEY) {
    console.error('[STT] ❌ Deepgram API key not configured');
    callbacks.onError?.('Deepgram API key not configured');
    return { stop: () => {} };
  }

  console.log('[STT] 🎤 Audio tracks:', stream.getAudioTracks().map(t => ({
    kind: t.kind, enabled: t.enabled, readyState: t.readyState, label: t.label,
  })));

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0 || audioTracks[0].readyState !== 'live') {
    console.error('[STT] ❌ No active audio track');
    callbacks.onError?.('No active microphone track found');
    return { stop: () => {} };
  }

  // Always use REST — works on all networks (mobile carriers, firewalls, etc.)
  console.log('[STT] 📡 Starting REST STT mode');
  callbacks.onMode?.('rest');
  return startRestSTT(stream, callbacks, options);
}

// ---- Text-to-Speech (REST API) ----

let currentAudio = null;
let currentAbortController = null;

const TTS_MAX_CHUNK = 1000;

function chunkText(text, maxLen = TTS_MAX_CHUNK) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return [trimmed];
  const chunks = [];
  let rest = trimmed;
  while (rest.length > 0) {
    if (rest.length <= maxLen) { chunks.push(rest); break; }
    let cut = rest.lastIndexOf('. ', maxLen - 1);
    if (cut <= 0) cut = rest.lastIndexOf(' ', maxLen - 1);
    if (cut <= 0) cut = maxLen;
    else cut += 1;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return chunks.filter(Boolean);
}

function playAudioChunk(audio, abortSignal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => { audio.pause(); audio.currentTime = 0; reject(new DOMException('Aborted', 'AbortError')); };
    abortSignal.addEventListener('abort', onAbort, { once: true });
    audio.onended = () => { abortSignal.removeEventListener('abort', onAbort); resolve(); };
    audio.onerror = (e) => { abortSignal.removeEventListener('abort', onAbort); reject(e); };
    audio.play().catch((err) => {
      if (err.name === 'NotAllowedError') {
        unlockAudio();
        setTimeout(() => {
          audio.play().then(resolve).catch(() => { abortSignal.removeEventListener('abort', onAbort); reject(err); });
        }, 100);
      } else {
        abortSignal.removeEventListener('abort', onAbort);
        reject(err);
      }
    });
  });
}

/**
 * Convert text to speech using Deepgram TTS.
 */
export async function speak(text, options = {}) {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('TTS_NOT_CONFIGURED: Deepgram API key not set');
  }
  if (!text?.trim()) return;

  stopSpeaking();
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const abortController = new AbortController();
  currentAbortController = abortController;
  if (options.signal) {
    options.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  const chunks = chunkText(text);
  let started = false;

  try {
    for (const chunk of chunks) {
      if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');

      console.log('[TTS] 🔊 Generating:', chunk.substring(0, 50) + (chunk.length > 50 ? '...' : ''));
      const response = await fetch(`${DEEPGRAM_REST_URL}/v1/speak?model=aura-asteria-en`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chunk }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Deepgram TTS error ${response.status}: ${errBody}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = 'auto';
      currentAudio = audio;

      console.log('[TTS] 🔊 Playing, size:', blob.size, 'bytes');
      if (!started) { started = true; options.onSpeechStart?.(); }

      await playAudioChunk(audio, abortController.signal);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('[TTS] Error:', err);
    throw err;
  } finally {
    currentAudio = null;
    currentAbortController = null;
    options.onSpeechEnd?.();
  }
}

export function stopSpeaking() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch {}
    currentAudio = null;
  }
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}
