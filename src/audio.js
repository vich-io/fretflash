export function createWebAudioClickPlayer(AudioContextCtor) {
  let audioContext = null;

  function prepare() {
    if (!AudioContextCtor) {
      throw new Error('Web Audio is not available');
    }

    if (audioContext === null) {
      audioContext = new AudioContextCtor();
    }

    if (audioContext.state === 'suspended') {
      return audioContext.resume();
    }

    return undefined;
  }

  function now() {
    return audioContext?.currentTime ?? 0;
  }

  function play({ accent = false, when } = {}) {
    if (audioContext === null) {
      return;
    }

    const startAt = Math.max(audioContext.currentTime, when ?? audioContext.currentTime);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequency = accent ? 1800 : 1200;
    const peakGain = accent ? 0.28 : 0.2;

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.04);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.05);
    return { oscillator, gain, startAt };
  }

  function cancel(handle) {
    if (!handle || !audioContext || handle.startAt <= audioContext.currentTime) return;
    handle.gain.gain.cancelScheduledValues?.(audioContext.currentTime);
    handle.gain.gain.setValueAtTime(0, audioContext.currentTime);
    handle.oscillator.stop(audioContext.currentTime);
    handle.oscillator.disconnect?.();
    handle.gain.disconnect?.();
  }

  return { prepare, play, now, cancel };
}
