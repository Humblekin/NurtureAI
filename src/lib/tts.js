/**
 * NurtureAI — TTS (Deepgram)
 *
 * Thin re-export of the Deepgram voice service for TTS.
 * All voice logic lives in services/deepgram.js.
 */

export { speak as textToSpeech, stopSpeaking as stopCurrentAudio } from '../services/deepgram';
export { isDeepgramConfigured as isElevenLabsConfigured, isDeepgramConfigured as isTtsConfigured } from '../services/deepgram';
