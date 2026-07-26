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
export function startStreamingSTT(stream, callbacks) {
  if (!DEEPGRAM_API_KEY) {
    callbacks.onError?.('Deepgram API key not configured');
    return { stop: () => {} };
  }

  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-US',
    smart_format: 'true',
    interim_results: 'true',
    utterance_end_ms: '1000',
    vad_events: 'true',
    encoding: 'opus',
    sample_rate: '48000',
  });

  const ws = new WebSocket(`${DEEPGRAM_WS_URL}?${params.toString()}`);
  ws.binaryType = 'arraybuffer';

  let stopped = false;

  // Audio recorder: streams mic chunks to Deepgram
  let recorder = null;
  try {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        const buf = await e.data.arrayBuffer();
        ws.send(buf);
      }
    };
    recorder.start(100); // 100ms chunks for near-real-time
  } catch (err) {
    console.error('[Deepgram] MediaRecorder error:', err);
    callbacks.onError?.('Microphone access failed');
    return { stop: () => {} };
  }

  ws.onopen = () => {
    // Send config to Deepgram
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

  ws.onmessage = (event) => {
    if (stopped) return;
    try {
      const msg = JSON.parse(event.data);

      // Final transcript for an utterance
      if (msg.type === 'Results' && msg.is_final) {
        const transcript = msg.channel?.alternatives?.[0]?.transcript?.trim();
        if (transcript) callbacks.onFinal?.(transcript);
      }

      // Interim transcript (live display)
      if (msg.type === 'Results' && !msg.is_final) {
        const transcript = msg.channel?.alternatives?.[0]?.transcript?.trim();
        if (transcript) callbacks.onInterim?.(transcript);
      }

      // Utterance end — user stopped speaking
      if (msg.type === 'UtteranceEnd') {
        // Deepgram signals end of utterance; we rely on is_final above
      }
    } catch { /* ignore parse errors */ }
  };

  ws.onerror = (err) => {
    if (!stopped) {
      console.error('[Deepgram] WebSocket error:', err);
      callbacks.onError?.('Speech recognition connection error');
    }
  };

  ws.onclose = () => {
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* ignore */ }
    }
  };

  return {
    stop: () => {
      stopped = true;
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

  // Stop any current audio
  stopSpeaking();

  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const abortController = new AbortController();
  currentAbortController = abortController;

  if (options.signal) {
    options.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  }

  try {
    const response = await fetch(`${DEEPGRAM_REST_URL}/v1/speak`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model: 'aura-asteria-en',
      }),
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

    options.onSpeechStart?.();

    await new Promise((resolve, reject) => {
      const cleanup = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        currentAbortController = null;
        options.onSpeechEnd?.();
      };

      abortController.signal.addEventListener('abort', () => {
        audio.pause();
        audio.currentTime = 0;
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });

      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = (e) => { cleanup(); reject(e); };

      // Mobile browsers may block autoplay — retry with user gesture unlock
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === 'NotAllowedError') {
            console.warn('[TTS] Autoplay blocked, attempting audio unlock...');
            // Create a short silent audio to unlock the audio context
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = ctx.createBuffer(1, 1, 22050);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
            // Retry play after unlock
            setTimeout(() => {
              audio.play().then(resolve).catch(() => {
                cleanup();
                reject(err);
              });
            }, 100);
          } else {
            cleanup();
            reject(err);
          }
        });
      }
    });
  } catch (err) {
    currentAudio = null;
    currentAbortController = null;
    if (err.name === 'AbortError') throw err;
    throw err;
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
