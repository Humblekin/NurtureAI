const voiceCache = [];

function loadVoices() {
  if (window.speechSynthesis) {
    voiceCache.length = 0;
    voiceCache.push(...(window.speechSynthesis.getVoices() || []));
  }
}

export function unlockVoice() {
  loadVoices();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function getVoice(lang) {
  if (voiceCache.length === 0) {
    loadVoices();
  }
  const tag = lang === 'dag' ? 'ha-Latn-NG' : 'en-US';
  return voiceCache.find(v => v.lang.startsWith(tag.split('-')[0]))
    || voiceCache.find(v => v.lang.startsWith('en'))
    || null;
}

export function speak(text, options = {}) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      options.onSpeechEnd?.();
      reject(new Error('Speech synthesis not supported in this browser'));
      return;
    }

    window.speechSynthesis.cancel();

    if (options.signal?.aborted) {
      options.onSpeechEnd?.();
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const lang = options.language === 'dag' ? 'ha-Latn-NG' : 'en-US';
    utterance.lang = lang;
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = 1;

    const voice = getVoice(lang);
    if (voice) utterance.voice = voice;

    let finished = false;

    function done() {
      if (finished) return;
      finished = true;
      if (options.signal) {
        options.signal.removeEventListener('abort', abortHandler);
      }
      options.onSpeechEnd?.();
    }

    const abortHandler = () => {
      if (!finished) {
        window.speechSynthesis.cancel();
        done();
        reject(new DOMException('Aborted', 'AbortError'));
      }
    };

    if (options.signal) {
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    utterance.onstart = () => {
      options.onSpeechStart?.();
    };

    utterance.onend = () => {
      done();
      resolve();
    };

    utterance.onerror = (event) => {
      if (finished) return;
      if (event.error === 'canceled' || event.error === 'interrupted') {
        done();
        resolve();
      } else {
        done();
        reject(new Error(`Speech synthesis error: ${event.error}`));
      }
    };

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSynthesisSupported() {
  return !!window.speechSynthesis;
}
