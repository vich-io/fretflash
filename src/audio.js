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

  function play({ accent = false } = {}) {
    if (audioContext === null) {
      return;
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequency = accent ? 1800 : 1200;
    const peakGain = accent ? 0.28 : 0.2;

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }

  return { prepare, play };
}
