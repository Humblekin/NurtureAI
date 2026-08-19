// Khaya AI language configuration layer.
//
// All speech language codes live HERE instead of being scattered across the
// app. The current Khaya API prefers ISO 639-3 codes (e.g. `dag`, `twi`,
// `atw`) — legacy two-letter codes such as `tw` or `ee` are intentionally
// NOT used anywhere.
//
// App language keys ('en', 'dag') map to:
//   - a Khaya ASR code (or null when Khaya has none / we prefer browser)
//   - a Khaya TTS code (or null)
//   - a browser locale used as the fallback
//   - which provider to try first for ASR / TTS

export const SPEECH_PROVIDERS = {
  en: {
    name: 'English',
    // Khaya supports English (ASR `eng`, TTS `eng`) but the browser handles it
    // reliably and for free, so English stays browser-first to preserve the
    // limited Khaya quota. Flip to 'khaya' to route it through Khaya.
    asrProvider: 'browser',
    ttsProvider: 'browser',
    browserLang: 'en-US',
    khaya: { asr: 'eng', tts: 'eng' },
  },
  dag: {
    name: 'Dagbani',
    // Browser STT/TTS have no Dagbani voice, so Khaya is tried first and the
    // browser is only a last-resort fallback to keep the voice loop alive.
    asrProvider: 'khaya',
    ttsProvider: 'khaya',
    browserLang: 'ha-Latn-NG',
    khaya: { asr: 'dag', tts: 'dag' },
  },
};

function isAppLanguageKey(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPEECH_PROVIDERS, value);
}

// Returns the provider config for an app language key, or null when the value
// is not one (e.g. a raw BCP-47 tag like 'ha-Latn-NG' passed by older callers).
export function getSpeechConfig(languageKey) {
  if (isAppLanguageKey(languageKey)) return SPEECH_PROVIDERS[languageKey];
  return null;
}

export function getKhayaAsrCode(languageKey) {
  return getSpeechConfig(languageKey)?.khaya?.asr || null;
}

export function getKhayaTtsCode(languageKey) {
  return getSpeechConfig(languageKey)?.khaya?.tts || null;
}

export function shouldUseKhayaAsr(languageKey) {
  const config = getSpeechConfig(languageKey);
  return !!config?.khaya?.asr && config.asrProvider === 'khaya';
}

export function shouldUseKhayaTts(languageKey) {
  const config = getSpeechConfig(languageKey);
  return !!config?.khaya?.tts && config.ttsProvider === 'khaya';
}

export function browserLanguageFor(languageKey) {
  return getSpeechConfig(languageKey)?.browserLang || 'en-US';
}
