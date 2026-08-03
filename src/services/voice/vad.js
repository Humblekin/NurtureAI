export function createVAD(audioStream, options = {}) {
  const {
    onSpeechStart,
    onSpeechEnd,
    silenceTimeoutMs = 800,
    minSpeechMs = 100,
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
  let enabled = false;
  let graceUntil = 0;

  let noiseFloor = 0.01;
  const MIN_NOISE_FLOOR = 0.005;
  const MAX_NOISE_FLOOR = 0.05;
  const SNR_MULTIPLIER = 2.5;

  function start() {
    if (destroyed) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    poll();
  }

  // Enable/disable voice detection. When disabled (e.g. while Amina is
  // speaking) the analyser loop keeps running but ignores audio, so her own
  // TTS output picked up by the mic is never mistaken for the user speaking.
  // On enable, a short grace period ignores residual TTS audio.
  function setEnabled(value) {
    const next = !!value;
    if (enabled === next) return;
    enabled = next;
    speaking = false;
    silenceStart = 0;
    speechStart = 0;
    graceUntil = enabled ? performance.now() + 400 : 0;
  }

  function poll() {
    if (destroyed) return;
    if (!enabled || performance.now() < graceUntil) {
      rafId = requestAnimationFrame(poll);
      return;
    }
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const now = performance.now();

    if (rms < noiseFloor) {
      noiseFloor = noiseFloor * 0.99 + rms * 0.01;
    } else if (!speaking) {
      noiseFloor = noiseFloor * 0.999 + rms * 0.001;
    }
    noiseFloor = Math.max(MIN_NOISE_FLOOR, Math.min(noiseFloor, MAX_NOISE_FLOOR));

    const dynamicThreshold = noiseFloor * SNR_MULTIPLIER;
    const isLoud = rms > dynamicThreshold && rms > 0.015;

    if (isLoud) {
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

  return { start, stop, setEnabled, isCurrentlySpeaking };
}
