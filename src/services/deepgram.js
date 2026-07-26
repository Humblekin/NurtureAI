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

// ---- Speech-to-Text ----

/**
 * REST-based STT with silence detection. Records until the user finishes
 * speaking (1.8s of silence), then sends the complete utterance to Deepgram.
 */
function startRestSTT(stream, callbacks, options) {
  const sttLanguage = options?.language === 'dag' ? 'ha-Latn-NG' : 'en-US';
  const SILENCE_TIMEOUT_MS = 1800;
  const MIN_RECORDING_MS = 800;
  const MAX_RECORDING_MS = 30000;
  const LEVEL_CHECK_INTERVAL = 100;
  let speechThreshold = 0.08;

  let stopped = false;
  let recorder = null;
  let isRecording = false;
  let chunks = [];
  let speechDetectedInSegment = false;
  let lastSpeechTime = 0;
  let recordingStartTime = 0;
  let levelTimer = null;
  let maxRecordingTimer = null;
  let audioContext = null;
  let analyser = null;

  console.log('[STT] 📡 Silence-detection mode (threshold=' + speechThreshold + ', silence=' + SILENCE_TIMEOUT_MS + 'ms)');

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/mp4')
    ? 'audio/mp4'
    : 'audio/webm';

  async function sendSegment(blob) {
    if (stopped) return;
    try {
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
        callbacks.onError?.('Deepgram error ' + response.status + ': ' + errText);
        return;
      }
      const result = await response.json();
      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
      if (transcript) {
        console.log('[STT] ✅ Final transcript:', transcript);
        callbacks.onFinal?.(transcript);
      } else {
        console.log('[STT] 📡 No speech detected');
        // Silently go back to listening — no state change
      }
    } catch (err) {
      callbacks.onError?.('REST STT failed: ' + err.message);
    }
  }

  function stopRecording(reason) {
    if (!recorder || recorder.state === 'inactive') return;
    const duration = Date.now() - recordingStartTime;
    console.log('[STT] 🎙️ Stop. reason=' + reason + ' duration=' + duration + 'ms speech=' + speechDetectedInSegment);
    clearInterval(levelTimer);
    clearTimeout(maxRecordingTimer);
    recorder.stop();
  }

  function startRecording() {
    if (stopped || isRecording) return;
    isRecording = true;
    chunks = [];
    speechDetectedInSegment = false;
    lastSpeechTime = 0;
    recordingStartTime = Date.now();

    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      callbacks.onError?.('Microphone access failed: ' + err.message);
      isRecording = false;
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      console.error('[STT] ❌ MediaRecorder error:', e.error);
      isRecording = false;
    };

    recorder.onstop = async () => {
      isRecording = false;
      const duration = Date.now() - recordingStartTime;

      if (stopped) return;

      // No speech detected — restart silently, stay in "Listening..." state
      if (!speechDetectedInSegment || chunks.length === 0) {
        console.log('[STT] 🎙️ No speech in segment (' + duration + 'ms), restarting...');
        callbacks.onInterim?.('Listening...');
        if (!stopped) startRecording();
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      const speechDuration = lastSpeechTime > 0 ? lastSpeechTime - recordingStartTime : 0;
      console.log('[STT] 📡 Segment send: ' + blob.size + ' bytes, ' + duration + 'ms rec, ~' + speechDuration + 'ms speech');
      await sendSegment(blob);

      if (!stopped) startRecording();
    };

    recorder.start();
    callbacks.onInterim?.('Listening...');
    console.log('[STT] 🎙️ Recording started');

    // Set up audio level analysis for silence detection
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      levelTimer = setInterval(() => {
        const dataArray = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms > speechThreshold) {
          if (!speechDetectedInSegment) {
            speechDetectedInSegment = true;
            console.log('[STT] 🗣️ Speech detected');
          }
          lastSpeechTime = Date.now();
        }

        // Stop recording after silence (only if minimum time elapsed and speech was detected)
        const elapsed = Date.now() - recordingStartTime;
        if (elapsed > MIN_RECORDING_MS && speechDetectedInSegment) {
          const silenceDuration = Date.now() - lastSpeechTime;
          if (silenceDuration > SILENCE_TIMEOUT_MS && recorder && recorder.state === 'recording') {
            stopRecording('silence_timeout');
          }
        }
      }, LEVEL_CHECK_INTERVAL);
    } catch {
      console.warn('[STT] ⚠️ Audio level analysis unavailable, fallback to 3s segments');
      setTimeout(() => {
        if (recorder && recorder.state === 'recording') stopRecording('fallback_timeout');
      }, 3000);
    }

    maxRecordingTimer = setTimeout(() => {
      if (recorder && recorder.state === 'recording') stopRecording('max_duration');
    }, MAX_RECORDING_MS);
  }

  startRecording();

  return {
    stop: () => {
      stopped = true;
      clearInterval(levelTimer);
      clearTimeout(maxRecordingTimer);
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      if (audioContext) {
        try { audioContext.close(); } catch {}
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

// ---- Text-to-Speech (Web Audio API — no user-gesture restriction) ----

let audioCtx = null;
let currentSource = null;
let currentAbortController = null;

function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
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

function playBuffer(buffer, abortSignal) {
  const ctx = getAudioContext();
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
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      console.log('[TTS] 🔊 Playing chunk, duration:', audioBuffer.duration.toFixed(1) + 's');
      if (!started) { started = true; options.onSpeechStart?.(); }

      await playBuffer(audioBuffer, abortController.signal);
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
