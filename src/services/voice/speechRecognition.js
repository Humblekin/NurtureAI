export function createSpeechRecognition(options = {}) {
  const {
    language = 'en',
    onInterim,
    onFinal,
    onError,
    keepAlive = true,
  } = options;

  let recognition = null;
  let active = false;
  let shouldRestart = false;

  function start() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError?.('Speech recognition is not supported in this browser. Try Chrome.');
      return;
    }

    if (recognition) {
      try { recognition.abort(); } catch {}
      recognition = null;
    }

    shouldRestart = true;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language === 'dag' ? 'ha-Latn-NG' : 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) onInterim?.(interim);
      if (final) onFinal?.(final.trim());
    };

    recognition.onend = () => {
      active = false;
      if (keepAlive && shouldRestart) {
        try { recognition?.start(); active = true; } catch {}
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        shouldRestart = false;
        onError?.('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    try {
      recognition.start();
      active = true;
    } catch (err) {
      if (err.name !== 'InvalidStateError') throw err;
    }
  }

  function stop() {
    shouldRestart = false;
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
    active = false;
  }

  function destroy() {
    stop();
    recognition = null;
  }

  return { start, stop, destroy, get active() { return active; } };
}
