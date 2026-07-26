/**
 * Real-time STT (WebSocket with REST fallback) + TTS (REST API).
 * Falls back to chunked REST upload when WebSocket is blocked by carrier.
 */

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const DEEPGRAM_REST_URL = 'https://api.deepgram.com';
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

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
 * Attempt WebSocket STT. Returns a promise that resolves { ok: true, stop }
 * if WebSocket connects, or { ok: false } if it fails (carrier block, etc).
 */
function tryWebSocketSTT(stream, callbacks, options) {
  return new Promise((resolve) => {
    const sttLanguage = options?.language === 'dag' ? 'ha-Latn-NG' : 'en-US';
    const params = new URLSearchParams({
      token: DEEPGRAM_API_KEY,
      model: 'nova-2',
      language: sttLanguage,
      smart_format: 'true',
      interim_results: 'true',
      utterance_end_ms: '1000',
      vad_events: 'true',
      encoding: 'webm',
      sample_rate: '48000',
    });

    const wsUrl = `${DEEPGRAM_WS_URL}?${params.toString()}`;
    console.log('[STT] 🔌 Trying WebSocket...');

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    let stopped = false;
    let connected = false;
    let chunkCount = 0;

    const connectTimeout = setTimeout(() => {
      if (!connected) {
        console.warn('[STT] ⚠️ WebSocket connect timeout — carrier may be blocking WSS');
        try { ws.close(); } catch {}
        resolve({ ok: false });
      }
    }, 5000);

    ws.onopen = () => {
      connected = true;
      clearTimeout(connectTimeout);
      console.log('[STT] ✅ WebSocket connected');
      ws.send(JSON.stringify({
        type: 'Configure',
        processing: {
          interim_results: true,
          utterance_end_ms: 1000,
          vad_events: true,
          smart_format: true,
        },
      }));
    };

    ws.onerror = () => {
      if (!connected) {
        clearTimeout(connectTimeout);
        resolve({ ok: false });
      }
    };

    ws.onclose = (event) => {
      if (!connected) {
        clearTimeout(connectTimeout);
        resolve({ ok: false });
        return;
      }
      console.log('[STT] 🔌 WebSocket closed: code=' + event.code);
      if (!stopped && event.code !== 1000) {
        let msg = 'Voice connection lost';
        if (event.code === 1006) msg = 'Connection lost — check your internet';
        else if (event.code === 1002) msg = 'Invalid API key';
        else if (event.code === 1008) msg = 'API key rejected — check Deepgram plan';
        else msg = 'Voice disconnected (code ' + event.code + ')';
        if (event.reason) msg += ': ' + event.reason;
        callbacks.onError?.(msg);
      }
    };

    ws.onmessage = (event) => {
      if (stopped) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'Results') {
          const transcript = msg.channel?.alternatives?.[0]?.transcript?.trim();
          if (msg.is_final && transcript) {
            console.log('[STT] ✅ Final:', transcript);
            callbacks.onFinal?.(transcript);
          } else if (transcript) {
            callbacks.onInterim?.(transcript);
          }
        }
      } catch { /* ignore */ }
    };

    let recorder = null;
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          const buf = await e.data.arrayBuffer();
          chunkCount++;
          ws.send(buf);
        }
      };
      recorder.start(100);
    } catch (err) {
      console.error('[STT] ❌ MediaRecorder error:', err);
      clearTimeout(connectTimeout);
      resolve({ ok: false });
      return;
    }

    resolve({
      ok: true,
      stop: () => {
        stopped = true;
        console.log('[STT] 🛑 Stopping WebSocket STT, chunks:', chunkCount);
        if (recorder && recorder.state !== 'inactive') {
          try { recorder.stop(); } catch {}
        }
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      },
    });
  });
}

/**
 * REST-based STT fallback. Records audio in segments, sends via HTTP POST.
 * Works on networks that block WebSocket connections.
 */
function startRestSTT(stream, callbacks, options) {
  const sttLanguage = options?.language === 'dag' ? 'ha-Latn-NG' : 'en-US';
  const SEGMENT_MS = 3000; // 3-second audio segments
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
    if (stopped || blob.size < 100) return; // skip empty/tiny blobs
    try {
      console.log('[STT] 📡 Sending audio segment:', blob.size, 'bytes');
      const params = new URLSearchParams({
        model: 'nova-2',
        language: sttLanguage,
        smart_format: 'true',
        detect_language: 'true',
      });
      const response = await fetch(`${DEEPGRAM_REST_URL}/v1/listen?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': mimeType,
        },
        body: blob,
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error('[STT] ❌ REST STT error:', response.status, errText);
        return;
      }
      const result = await response.json();
      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
      if (transcript) {
        console.log('[STT] ✅ Final transcript:', transcript);
        callbacks.onFinal?.(transcript);
      }
    } catch (err) {
      console.error('[STT] ❌ REST STT fetch error:', err);
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
      callbacks.onError?.('Microphone access failed');
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      isRecording = false;
      if (stopped) return;
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: mimeType });
        await sendSegment(blob);
      }
      // Immediately start next segment
      if (!stopped) startRecording();
    };

    recorder.start();
    console.log('[STT] 🎙️ REST mode: recording segment...');

    // Stop and send after SEGMENT_MS
    setTimeout(() => {
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
    }, SEGMENT_MS);
  }

  // Start the first segment
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
 * Start streaming STT. Tries WebSocket first, falls back to REST if blocked.
 */
export async function startStreamingSTT(stream, callbacks, options = {}) {
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

  // Try WebSocket first
  const wsResult = await tryWebSocketSTT(stream, callbacks, options);

  if (wsResult.ok) {
    console.log('[STT] ✅ Using WebSocket mode');
    callbacks.onMode?.('websocket');
    return { stop: wsResult.stop };
  }

  // WebSocket failed — fall back to REST
  console.log('[STT] ⚠️ WebSocket failed, falling back to REST mode');
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
