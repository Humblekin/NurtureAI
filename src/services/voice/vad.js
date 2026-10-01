// Voice activity detection over a live getUserMedia stream.
//
// Drives two things in the voice conversation: when to start/stop recording an
// utterance (Khaya ASR languages), and when the user has finished speaking.
//
// Two platform realities shape this implementation:
//
//   1. The poll loop is driven by setTimeout, NOT requestAnimationFrame. rAF is
//      suspended whenever the page is backgrounded or the screen dims — on
//      Android Chrome that silently stops detection mid-conversation, so no
//      utterance is ever recorded.
//   2. The noise floor only ever adapts DOWNWARD, toward quieter frames. A
//      floor that also climbs toward loud audio learns the user's own speech as
//      background noise, after which quiet speech can never cross it.

export function createVAD(audioStream, options = {}) {
  const {
    onSpeechStart,
    onSpeechEnd,
    silenceTimeoutMs = 800,
    minSpeechMs = 100,
    pollIntervalMs = 50,
    // Absolute RMS gate. Kept low because getUserMedia is opened without
    // aggressive noise suppression so quiet, distant voices still register.
    minRms = 0.008,
    snrMultiplier = 2.5,
    // Barge-in detection runs while Amina is talking, so here the floor SHOULD
    // climb toward loud audio: the goal is for the floor to settle on her
    // playback level, leaving only the user's own (louder, closer) voice able
    // to cross the threshold. Without this she interrupts herself.
    adaptUp = false,
  } = options;

  let audioContext = null;
  let analyser = null;
  let source = null;
  let dataArray = null;
  let timerId = null;
  let speaking = false;
  let silenceStart = 0;
  let speechStart = 0;
  let destroyed = false;
  let enabled = false;
  let graceUntil = 0;

  const MIN_NOISE_FLOOR = 0.004;
  let noiseFloor = 0.012;

  function start() {
    if (destroyed) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    schedule();
  }

  // Enable/disable voice detection. When disabled (e.g. while Amina is
  // speaking) the poll loop keeps running but ignores audio, so her own TTS
  // output picked up by the mic is never mistaken for the user speaking.
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

  function schedule() {
    if (destroyed) return;
    timerId = setTimeout(poll, pollIntervalMs);
  }

  function poll() {
    if (destroyed) return;
    if (!enabled || performance.now() < graceUntil) {
      schedule();
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

    // Adapt the floor only from quiet frames, and only while no utterance is
    // being built up. speechStart !== 0 means we are inside a candidate
    // utterance whose first syllable is still ramping — adapting there is
    // exactly what makes quiet speech undetectable.
    if (rms < noiseFloor && !speaking && speechStart === 0) {
      noiseFloor = noiseFloor * 0.98 + rms * 0.02;
      noiseFloor = Math.max(MIN_NOISE_FLOOR, noiseFloor);
    } else if (adaptUp && rms > noiseFloor && !speaking && speechStart === 0) {
      noiseFloor = noiseFloor * 0.995 + rms * 0.005;
    }

    const threshold = Math.max(noiseFloor * snrMultiplier, minRms);
    const isLoud = rms > threshold;

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

    schedule();
  }

  function stop() {
    destroyed = true;
    if (timerId) clearTimeout(timerId);
    timerId = null;
    if (source) source.disconnect();
    if (audioContext) audioContext.close().catch(() => {});
    audioContext = null;
  }

  function isCurrentlySpeaking() {
    return speaking;
  }

  return { start, stop, setEnabled, isCurrentlySpeaking };
}