/**
 * Real-time STT (REST chunked upload) + TTS (REST API).
 * Uses chunked HTTP POST for speech-to-text — works on all networks.
 */

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const DEEPGRAM_REST_URL = 'https://api.deepgram.com';

// ---- Helpers ----

let audioUnlocked = false;

export function unlockAudio() {
  try {
    // Create or reuse AudioContext (must be created during user gesture on mobile)
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Play silent buffer to unlock audio system
    if (!audioUnlocked) {
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
      audioUnlocked = true;
    }
  } catch (e) {
    console.warn('[Audio] Unlock failed:', e);
  }
}

export function isDeepgramConfigured() {
  return !!DEEPGRAM_API_KEY;
}

// ---- Speech-to-Text (WebSocket Streaming) ----

/**
 * WebSocket-based streaming STT.
 * Audio chunks flow continuously to Deepgram.
 * Interim results arrive in real-time.
 * Deepgram detects utterance end via endpointing (1s silence).
 * No fixed recording duration — the user speaks naturally.
 */
export function startStreamingSTT(stream, callbacks, options = {}) {
  if (!DEEPGRAM_API_KEY) {
    console.error('[STT] ❌ Deepgram API key not configured');
    callbacks.onError?.('Deepgram API key not configured');
    return { stop: () => {} };
  }

  const sttLanguage = options?.language === 'dag' ? 'ha-Latn-NG' : 'en-US';
  let ws = null;
  let recorder = null;
  let micPaused = false;
  let destroyed = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 3;

  // ---- Log stream info ----
  const tracks = stream.getAudioTracks();
  console.log('[STT] 🎤 Audio stream:', tracks.map(t => ({
    label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState,
  })));

  if (tracks.length === 0) {
    callbacks.onError?.('No audio tracks in stream');
    return { stop: () => {} };
  }

  // Pick best supported mime type
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/mp4')
    ? 'audio/mp4'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : '';

  // Deepgram endpointing: 1000ms silence = utterance end
  const ENDPOINTING_MS = 1000;

  // ---- WebSocket connection ----
  function connect() {
    if (destroyed) return;

    const params = new URLSearchParams({
      model: 'nova-2',
      language: sttLanguage,
      interim_results: 'true',
      endpointing: String(ENDPOINTING_MS),
      token: DEEPGRAM_API_KEY,
    });
    const url = `wss://api.deepgram.com/v1/listen?${params}`;

    console.log('[STT] 🔌 Connecting WebSocket...');
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[STT] ✅ WebSocket connected');
      reconnectAttempts = 0;
      startRecorder();
    };

    ws.onclose = (e) => {
      console.log('[STT] 🔌 WebSocket closed:', e.code, e.reason);
      stopRecorder();
      if (!destroyed && reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        console.log('[STT] 🔁 Reconnecting (' + reconnectAttempts + '/' + MAX_RECONNECT + ')...');
        setTimeout(connect, 1000);
      } else if (!destroyed) {
        callbacks.onError?.('Connection to Deepgram lost. Please restart.');
      }
    };

    ws.onerror = () => {
      console.error('[STT] ❌ WebSocket error');
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'Results' && msg.channel?.alternatives?.[0]) {
          const transcript = msg.channel.alternatives[0].transcript?.trim();
          if (transcript) {
            if (msg.is_final) {
              console.log('[STT] 🎯 Final transcript:', JSON.stringify(transcript));
              callbacks.onFinal?.(transcript);
              // Utterance complete — stop recorder but keep WebSocket alive.
              // pauseMic keeps the connection open for the next utterance,
              // avoiding the overhead of destroying and reconnecting every turn.
              stopRecorder();
              micPaused = true;
            } else {
              callbacks.onInterim?.(transcript);
            }
          }
        }
      } catch (err) {
        console.warn('[STT] ⚠️ Parse error:', err.message);
      }
    };
  }

  // ---- MediaRecorder ----
  function startRecorder() {
    if (destroyed || micPaused || recorder) return;

    try {
      recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
      console.log('[STT] 🎤 MediaRecorder created mimeType=' + recorder.mimeType);
    } catch (err) {
      console.warn('[STT] ⚠️ MediaRecorder failed:', err.message, '- audio will not be captured');
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    recorder.onerror = (e) => {
      console.error('[STT] ❌ MediaRecorder error:', e.error);
    };

    recorder.onstop = () => {
      console.log('[STT] 📴 MediaRecorder stopped');
      recorder = null;
    };

    recorder.start(100);
    console.log('[STT] 🎤 MediaRecorder started, chunk interval=100ms');
  }

  function stopRecorder() {
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
    recorder = null;
  }

  // ---- Public API ----
  connect();

  return {
    /** Full cleanup: close WebSocket + stop recorder */
    stop: () => {
      destroyed = true;
      stopRecorder();
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },

    /** Pause sending mic audio (keep WebSocket open for next utterance) */
    pauseMic: () => {
      micPaused = true;
      stopRecorder();
    },

    /** Resume sending mic audio (new recorder on same WebSocket).
     *  Returns true if successfully resumed, false if connection is dead. */
    resumeMic: () => {
      if (destroyed || ws?.readyState !== WebSocket.OPEN) return false;
      micPaused = false;
      if (!recorder) {
        startRecorder();
      }
      return true;
    },
  };
}

// ---- Text-to-Speech (Web Audio API — no user-gesture restriction) ----

let audioCtx = null;
let currentSource = null;
let currentAbortController = null;

async function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
}

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

async function playBuffer(buffer, abortSignal, onStart) {
  const ctx = await getAudioContext();
  if (!buffer || buffer.duration <= 0) {
    throw new Error('TTS_PLAY_FAILED: Invalid audio buffer (duration=' + (buffer?.duration || 0) + ')');
  }
  if (ctx.state !== 'running') {
    throw new Error('TTS_PLAY_FAILED: AudioContext state=' + ctx.state);
  }
  return new Promise((resolve, reject) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSource = source;

    const cleanup = () => {
      abortSignal.removeEventListener('abort', onAbort);
      currentSource = null;
    };

    const onAbort = () => {
      try { source.stop(); } catch {}
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    abortSignal.addEventListener('abort', onAbort, { once: true });
    source.onended = () => { cleanup(); resolve(); };
    source.start(0);
    onStart?.();
  });
}

/**
 * Convert text to speech using Deepgram TTS + Web Audio API.
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

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('TTS_DECODE_FAILED: Empty response from Deepgram');
      }
      const ctx = await getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (!audioBuffer || audioBuffer.duration <= 0) {
        throw new Error('TTS_DECODE_FAILED: Invalid audio data (duration=' + (audioBuffer?.duration || 0) + ')');
      }

      console.log('[TTS] 🔊 Playing chunk, duration:', audioBuffer.duration.toFixed(1) + 's');

      await playBuffer(audioBuffer, abortController.signal, () => {
        if (!started) { started = true; options.onSpeechStart?.(); }
      });
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('[TTS] Error:', err);
    throw err;
  } finally {
    currentSource = null;
    currentAbortController = null;
    options.onSpeechEnd?.();
  }
}

export function stopSpeaking() {
  if (currentSource) {
    try { currentSource.stop(); } catch {}
    currentSource = null;
  }
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}
