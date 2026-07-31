export function createVAD(audioStream, options = {}) {
  const {
    onSpeechStart,
    onSpeechEnd,
    threshold = 0.015,
    silenceTimeoutMs = 500,
    minSpeechMs = 80,
  } = options;

  let audioContext = null;
  let analyser = null;
  let source = null;
  let dataArray = null;
  let rafId = null;
  let speaking = false;
  let silenceStart = 0;
  let speechStart = 0;
  let destroyed = false;

  function start() {
    if (destroyed) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    poll();
  }

  function poll() {
    if (destroyed) return;
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const now = performance.now();

    if (rms > threshold) {
      if (!speaking) {
        if (speechStart === 0) speechStart = now;
        if (now - speechStart >= minSpeechMs) {
          speaking = true;
          silenceStart = 0;
          speechStart = 0;
          onSpeechStart?.();
        }
      } else {
        silenceStart = 0;
      }
    } else {
      speechStart = 0;
      if (speaking) {
        if (silenceStart === 0) silenceStart = now;
        if (now - silenceStart >= silenceTimeoutMs) {
          speaking = false;
          onSpeechEnd?.();
        }
      }
    }

    rafId = requestAnimationFrame(poll);
  }

  function stop() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (source) source.disconnect();
    if (audioContext) audioContext.close().catch(() => {});
    audioContext = null;
  }

  function isCurrentlySpeaking() {
    return speaking;
  }

  return { start, stop, isCurrentlySpeaking };
}
