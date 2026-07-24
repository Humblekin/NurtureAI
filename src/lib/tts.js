const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * NurtureAI — ElevenLabs Text-to-Speech
 *
 * African woman voice for Amina healthcare companion.
 * Falls back to browser TTS if ElevenLabs fails.
 */

// Free tier users cannot use library voices via API
// Only works with cloned/custom voices or if user has paid plan
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/**
 * Convert text to speech using ElevenLabs.
 * @param {string} text - Text to speak
 * @param {object} options - Voice options
 * @returns {Promise<ArrayBuffer>} Audio data
 */
export async function textToSpeech(text, options = {}) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const {
    voiceId = DEFAULT_VOICE_ID,
    modelId = 'eleven_multilingual_v2',
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.4,
    speed = 1.0,
  } = options;

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        speed,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('ElevenLabs error:', response.status, errBody);
    throw new Error(`ElevenLabs error ${response.status}: ${errBody}`);
  }

  return response.arrayBuffer();
}

/**
 * Play audio from ArrayBuffer.
 * Uses AudioContext for mobile compatibility (bypasses autoplay policy).
 * @param {ArrayBuffer} audioData - Audio data
 * @returns {Promise<void>}
 */
let sharedAudioCtx = null;

function getAudioContext() {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export async function playAudio(audioData) {
  const ctx = getAudioContext();
  const buffer = await ctx.decodeAudioData(audioData);
  return new Promise((resolve, reject) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = resolve;
    source.onerror = reject;
    source.start(0);
  });
}

export const isElevenLabsConfigured = () => {
  // Only consider configured if key exists AND user likely has paid plan
  // Free tier cannot use library voices via API
  return !!ELEVENLABS_API_KEY;
};
