// Browser SpeechRecognition wrapper.
//
// Chrome ends a recognition session on its own after a short internal silence
// window even when `continuous` is true, and always after stop()/abort(). An
// `onend` handler that does nothing therefore leaves the recognizer permanently
// dead for the rest of the conversation, so the user speaks and nothing is
// captured. This wrapper restarts the session with exponential backoff and
// gives up (with a visible error) if the mic looks genuinely unavailable.

import { browserLanguageFor } from './khayaLanguages.js';

const MIN_RESTART_DELAY_MS = 200;
const MAX_RESTART_DELAY_MS = 4000;
const MAX_CONSECUTIVE_RESTARTS = 12;

export function createSpeechRecognition(options = {}) {
  const {
    language = 'en',
    onInterim,
    onFinal,
    onError,
    onStart,
    onEnd,
  } = options;

  function isAndroidChrome() {
    const userAgent = navigator.userAgent || '';
    const isAndroid = /android/i.test(userAgent);
    const isChrome = /crios|chrome/i.test(userAgent) && !/edg|opr\//i.test(userAgent);
    return isAndroid && isChrome;
  }

  let recognition = null;
  let wantActive = false;
  let restartTimer = null;
  let restartDelay = MIN_RESTART_DELAY_MS;
  let restartCount = 0;

  function resolveCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function teardown() {
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onstart = null;
      try { recognition.abort(); } catch { /* already stopped */ }
      recognition = null;
    }
  }

  function clearRestart() {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = null;
  }

  function scheduleRestart() {
    if (!wantActive) return;
    restartCount += 1;
    if (restartCount > MAX_CONSECUTIVE_RESTARTS) {
      wantActive = false;
      onError?.('Microphone stopped responding. Please try again.');
      return;
    }
    clearRestart();
    restartTimer = setTimeout(() => {
      restartTimer = null;
      begin();
    }, restartDelay);
    restartDelay = Math.min(restartDelay * 2, MAX_RESTART_DELAY_MS);
  }

  function begin() {
    if (!wantActive) return;
    const SpeechRecognition = resolveCtor();
    if (!SpeechRecognition) {
      onError?.('Speech recognition not supported');
      return;
    }

    teardown();

    const session = new SpeechRecognition();
    const androidChrome = isAndroidChrome();
    session.continuous = !androidChrome;
    session.interimResults = true;
    session.maxAlternatives = 1;
    session.lang = browserLanguageFor(language);

    if (androidChrome) {
      session.onaudiostart = () => {
        restartDelay = MIN_RESTART_DELAY_MS;
      };
    }

    session.onstart = () => {
      restartDelay = MIN_RESTART_DELAY_MS;
      restartCount = 0;
      onStart?.();
    };

    session.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim) onInterim?.(interim);
      if (final) onFinal?.(final.trim());
    };

    session.onend = () => {
      if (recognition === session) recognition = null;
      onEnd?.();
      // Chrome ends sessions on its own after a silence window; only a caller
      // that no longer wants audio (`stop()`) suppresses the restart.
      scheduleRestart();
    };

    session.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantActive = false;
        onError?.('Microphone access denied. Please allow microphone access in your browser settings.');
        return;
      }
      if (event.error === 'audio-capture') {
        wantActive = false;
        onError?.('No microphone was found. Please check your device settings and try again.');
        return;
      }
      if (event.error === 'network') {
        if (wantActive) scheduleRestart();
        return;
      }
      // 'no-speech' and 'aborted' are routine (silence, or our own stop()).
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        if (wantActive) scheduleRestart();
        else onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    recognition = session;
    try {
      session.start();
    } catch (err) {
      // InvalidStateError just means a session is already live.
      if (err?.name !== 'InvalidStateError') {
        recognition = null;
        scheduleRestart();
      }
    }
  }

  function start() {
    const SpeechRecognition = resolveCtor();
    if (!SpeechRecognition) {
      onError?.('Speech recognition not supported');
      return;
    }
    wantActive = true;
    restartCount = 0;
    restartDelay = MIN_RESTART_DELAY_MS;
    clearRestart();
    begin();
  }

  function stop() {
    wantActive = false;
    clearRestart();
    teardown();
  }

  return { start, stop };
}