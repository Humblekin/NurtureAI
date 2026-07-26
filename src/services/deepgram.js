/**
 * Real-time STT (WebSocket streaming) + TTS (REST API).
 * Replaces browser SpeechRecognition and ElevenLabs.
 */

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;
const DEEPGRAM_REST_URL = 'https://api.deepgram.com';
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

// ---- Helpers ----

let audioUnlocked = false;

/**
 * Unlock audio playback on mobile browsers.
 * MUST be called from a user gesture (click/tap) BEFORE any async work.
 * Without this, iOS/Safari will block audio.play() even with user gesture
 * if the play() call happens in a different microtask.
 */
export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    audioUnlocked = true;
  } catch (e) {
    console.warn('[Audio] Unlock failed:', e);
  }
}

export function isDeepgramConfigured() {
  return !!DEEPGRAM_API_KEY;
}

// ---- Speech-to-Text (WebSocket streaming) ----

/**
 * Start streaming STT from a MediaStream.
 *
 * @param {MediaStream} stream - Microphone stream from getUserMedia
 * @param {object} callbacks
 * @param {function} callbacks.onInterim - (text) live interim transcript
 * @param {function} callbacks.onFinal   - (text) final transcript (speech ended)
 * @param {function} callbacks.onError   - (error) connection or recognition error
 * @returns {{ stop: () => void }} Call stop() to close the WebSocket
 */
export function startStreamingSTT(stream, callbacks, options = {}) {
  if (!DEEPGRAM_API_KEY) {
    console.error('[STT] ❌ Deepgram API key not configured');
    callbacks.onError?.('Deepgram API key not configured');
    return { stop: () => {} };
  }

  console.log('[STT] 🎤 Microphone stream:', stream);
  console.log('[STT] 🎤 Audio tracks:', stream.getAudioTracks().map(t => ({
    kind: t.kind, enabled: t.enabled, readyState: t.readyState, label: t.label
  })));

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0 || audioTracks[0].readyState !== 'live') {
    console.error('[STT] ❌ No active audio track');
    callbacks.onError?.('No active microphone track found');
    return { stop: () => {} };
  }

  const sttLanguage = options?.language === 'dag' ? 'ha-Latn-NG' : 'en-US';

  const params = new URLSearchParams({
    token: DEEPGRAM_API_KEY,
    model: 'nova-2',
    language: sttLanguage,
    smart_format: 'true',
    interim_results: 'true',
    utterance_end_ms: '1000',
    vad_events: 'true',
    encoding: 'opus',
    sample_rate: '48000',
  });

  const wsUrl = `${DEEPGRAM_WS_URL}?${params.toString()}`;
  console.log('[STT] 🔌 Connecting to Deepgram: wss://api.deepgram.com/v1/listen?...token=<redacted>&model=nova-2&language=' + sttLanguage);

  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  let stopped = false;
  let chunkCount = 0;

  ws.onopen = () => {
    console.log('[STT] ✅ Deepgram WebSocket connected');
    ws.send(JSON.stringify({
      type: 'Configure',
      processing: {
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        smart_format: true,
      },
    }));
    console.log('[STT] 📤 Sent Configure message');
  };

  ws.onerror = (err) => {
    if (!stopped) {
      console.error('[STT] ❌ WebSocket error:', err);
      callbacks.onError?.('Cannot connect to Deepgram. Check your API key and network connection.');
    }
  };

  ws.onclose = (event) => {
    console.log('[STT] 🔌 WebSocket closed: code=' + event.code + ' reason=' + event.reason + ' wasClean=' + event.wasClean);
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* ignore */ }
    }
    if (!stopped && event.code !== 1000) {
      let msg = 'Voice connection lost';
      if (event.code === 1006) msg = 'Connection lost — check your internet connection';
      else if (event.code === 1002) msg = 'Invalid API key — check VITE_DEEPGRAM_API_KEY';
      else if (event.code === 1003) msg = 'Unsupported audio format';
      else if (event.code === 1008) msg = 'API key rejected — check your Deepgram plan';
      else if (event.code === 1011) msg = 'Deepgram server error — try again';
      else msg = 'Voice disconnected (code ' + event.code + ')';
      if (event.reason) msg += ': ' + event.reason;
      callbacks.onError?.(msg);
    }
  };

  // Audio recorder: streams mic chunks to Deepgram
  let recorder = null;
  try {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    console.log('[STT] 🎙️ Creating MediaRecorder with mimeType:', mimeType);
    recorder = new MediaRecorder(stream, { mimeType });

    recorder.onstart = () => {
      console.log('[STT] 🎙️ MediaRecorder started');
    };

    recorder.onerror = (e) => {
      console.error('[STT] ❌ MediaRecorder error:', e.error);
    };

    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        const buf = await e.data.arrayBuffer();
        chunkCount++;
        if (chunkCount % 20 === 1) { // Log every ~2 seconds (20 * 100ms)
          console.log(`[STT] 📦 Sent ${chunkCount} chunks, latest: ${buf.byteLength} bytes`);
        }
        ws.send(buf);
      } else if (e.data.size > 0 && ws.readyState !== WebSocket.OPEN) {
        console.warn('[STT] ⚠️ WebSocket not open, dropping chunk:', buf.byteLength, 'bytes, state:', ws.readyState);
      }
    };

    recorder.start(100); // 100ms chunks for near-real-time
    console.log('[STT] 🎙️ MediaRecorder initialized, waiting for WebSocket...');
  } catch (err) {
    console.error('[STT] ❌ MediaRecorder error:', err);
    callbacks.onError?.('Microphone access failed');
    return { stop: () => {} };
  }

  ws.onmessage = (event) => {
    if (stopped) return;
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'Results') {
        const transcript = msg.channel?.alternatives?.[0]?.transcript?.trim();
        const confidence = msg.channel?.alternatives?.[0]?.confidence;

        if (msg.is_final && transcript) {
          console.log('[STT] ✅ Final transcript:', transcript, `(confidence: ${confidence})`);
          callbacks.onFinal?.(transcript);
        } else if (transcript) {
          console.log('[STT] 📝 Interim transcript:', transcript);
          callbacks.onInterim?.(transcript);
        }
      } else if (msg.type === 'UtteranceEnd') {
        console.log('[STT] 🛑 UtteranceEnd received');
      } else {
        console.log('[STT] 📩 Deepgram message:', msg.type);
      }
    } catch { /* ignore parse errors */ }
  };

  return {
    stop: () => {
      stopped = true;
      console.log('[STT] 🛑 Stopping STT, total chunks sent:', chunkCount);
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch { /* ignore */ }
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
  };
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
 * @param {string} text - Text to speak
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - Abort signal
 * @param {function} [options.onSpeechStart] - Called when audio starts playing
 * @param {function} [options.onSpeechEnd] - Called when audio finishes
 * @returns {Promise<void>} Resolves when playback ends
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

      console.log('[TTS] 🔊 Generating speech for chunk:', chunk.substring(0, 50) + (chunk.length > 50 ? '...' : ''));
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

      console.log('[TTS] 🔊 Playing speech, blob size:', blob.size, 'bytes');

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

/**
 * Stop any currently playing TTS audio immediately.
 */
export function stopSpeaking() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch { /* ignore */ }
    currentAudio = null;
  }
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}
