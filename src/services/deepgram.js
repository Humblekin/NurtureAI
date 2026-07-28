import { isSupabaseConfigured } from '../lib/supabase';
import useAuthStore from '../stores/authStore';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getFunctionsBase() {
  if (!SUPABASE_URL) return null;
  const match = SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/);
  return match ? `https://${match[1]}.supabase.co/functions/v1` : null;
}

// ---- Deepgram temporary token ----

async function requestDeepgramToken() {
  const functionsBase = getFunctionsBase();
  if (!functionsBase) throw new Error('Voice features require Supabase configuration');

  const session = useAuthStore.getState().session;
  const token = session?.access_token;
  if (!token) throw new Error('You must be signed in to use voice features');

  const response = await fetch(`${functionsBase}/deepgram-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    let parsed;
    try { parsed = JSON.parse(errBody); } catch {}
    const msg = parsed?.error || `Token request failed: ${response.status}`;
    if (parsed?.detail) console.error('[STT] Token error detail:', parsed.detail);
    throw new Error(msg);
  }

  return await response.json();
}

// ---- Helpers ----

let audioUnlocked = false;

export function unlockAudio() {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
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
  return isSupabaseConfigured();
}

// ---- Speech-to-Text (Direct Deepgram WebSocket) ----

export function startStreamingSTT(stream, callbacks, options = {}) {
  if (!getFunctionsBase()) {
    console.error('[STT] Supabase not configured');
    callbacks.onError?.('Voice features require Supabase configuration');
    return { stop: () => {} };
  }

  let ws = null;
  let recorder = null;
  let micPaused = false;
  let destroyed = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 3;

  const tracks = stream.getAudioTracks();
  console.log('[STT] Audio stream:', tracks.map(t => ({
    label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState,
  })));

  if (tracks.length === 0) {
    callbacks.onError?.('No audio tracks in stream');
    return { stop: () => {} };
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/mp4')
    ? 'audio/mp4'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : '';

  function connect() {
    if (destroyed) return;

    requestDeepgramToken()
      .then(({ token }) => {
        if (destroyed) return;

        const wsUrl = `wss://api.deepgram.com/v1/listen?${new URLSearchParams({
          model: 'nova-2',
          language: options?.language === 'dag' ? 'ha-Latn-NG' : 'en-US',
          interim_results: 'true',
          endpointing: '1000',
        })}`;

        console.log('[STT] Connecting directly to Deepgram...');
        ws = new WebSocket(wsUrl, ['token', token]);

        ws.onopen = () => {
          console.log('[STT] Deepgram WebSocket connected');
          reconnectAttempts = 0;
          startRecorder();
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'Results' && msg.channel?.alternatives?.[0]) {
              const transcript = msg.channel.alternatives[0].transcript?.trim();
              if (transcript) {
                if (msg.is_final) {
                  console.log('[STT] Final transcript:', JSON.stringify(transcript));
                  callbacks.onFinal?.(transcript);
                  stopRecorder();
                  micPaused = true;
                } else {
                  callbacks.onInterim?.(transcript);
                }
              }
            }
          } catch (err) {
            console.warn('[STT] Parse error:', err.message);
          }
        };

        ws.onclose = (e) => {
          console.log('[STT] WebSocket closed:', e.code, e.reason);
          stopRecorder();

          if (e.code === 4001) {
            callbacks.onError?.('Voice authentication failed. Please sign in again.');
            return;
          }

          const connectionLifetime = Date.now() - connectTime;
          const isHardReject = e.code !== 1000 && reconnectAttempts === 0 && connectionLifetime < 500;

          if (isHardReject) {
            callbacks.onError?.('Voice service unavailable. Please try again.');
            return;
          }

          if (!destroyed && reconnectAttempts < MAX_RECONNECT) {
            reconnectAttempts++;
            console.log('[STT] Reconnecting (' + reconnectAttempts + '/' + MAX_RECONNECT + ')...');
            setTimeout(connect, 1000);
          } else if (!destroyed) {
            callbacks.onError?.('Connection lost. Please restart.');
          }
        };

        ws.onerror = () => {
          console.error('[STT] WebSocket error');
        };
      })
      .catch((err) => {
        console.error('[STT] Token request failed:', err);
        callbacks.onError?.(err.message || 'Failed to get voice credentials');
      });
  }

  let connectTime = 0;
  const origConnect = connect;
  connect = function() {
    connectTime = Date.now();
    origConnect.call(this);
  };

  function startRecorder() {
    if (destroyed || micPaused || recorder) return;

    try {
      recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
      console.log('[STT] MediaRecorder created mimeType=' + recorder.mimeType);
    } catch (err) {
      console.warn('[STT] MediaRecorder failed:', err.message, '- audio will not be captured');
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    recorder.onerror = (e) => {
      console.error('[STT] MediaRecorder error:', e.error);
    };

    recorder.onstop = () => {
      console.log('[STT] MediaRecorder stopped');
      recorder = null;
    };

    recorder.start(100);
    console.log('[STT] MediaRecorder started, chunk interval=100ms');
  }

  function stopRecorder() {
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
    recorder = null;
  }

  connect();

  return {
    stop: () => {
      destroyed = true;
      stopRecorder();
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },

    pauseMic: () => {
      micPaused = true;
      stopRecorder();
    },

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

// ---- Text-to-Speech (via Edge Function proxy) ----

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

export async function speak(text, options = {}) {
  const functionsBase = getFunctionsBase();
  if (!functionsBase) {
    throw new Error('TTS_NOT_CONFIGURED: Voice features require Supabase configuration');
  }
  if (!text?.trim()) return;

  const session = useAuthStore.getState().session;
  const token = session?.access_token;
  if (!token) {
    throw new Error('TTS_NOT_CONFIGURED: You must be signed in to use voice features');
  }

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

      console.log('[TTS] Generating:', chunk.substring(0, 50) + (chunk.length > 50 ? '...' : ''));
      const response = await fetch(`${functionsBase}/deepgram-proxy/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chunk }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        let parsed;
        try { parsed = JSON.parse(errBody); } catch {}
        throw new Error(`Deepgram TTS error: ${parsed?.error || `${response.status}: ${errBody.slice(0, 200)}`}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('TTS_DECODE_FAILED: Empty response from server');
      }
      const ctx = await getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (!audioBuffer || audioBuffer.duration <= 0) {
        throw new Error('TTS_DECODE_FAILED: Invalid audio data (duration=' + (audioBuffer?.duration || 0) + ')');
      }

      console.log('[TTS] Playing chunk, duration:', audioBuffer.duration.toFixed(1) + 's');

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
