import { getSpokenClip, getSpokenPlayback, SPOKEN_BANKS } from './speech.js';

export function createWebAudioClickPlayer(AudioContextCtor, { fetchFn = globalThis.fetch } = {}) {
  let audioContext = null;
  const bankPromises = new Map();
  const prepared = new Map();
  const voices = new Set();

  async function prepareVoice({ selectedLabels, bpm, spokenOrder, firstAnnouncement = 0 }) {
    const calls = spokenOrder
      ? spokenOrder.slice(firstAnnouncement).map((group, index, remaining) => {
        const playback = getSpokenPlayback(group.label, bpm, group.targets.length, index < remaining.length - 1);
        if (!playback) throw new Error('Unsafe spoken cue');
        return { label: group.label, variant: playback.variant };
      })
      : selectedLabels.map(label => ({ label, variant: 'natural' }));
    await Promise.all(calls.map(async ({ label, variant }) => {
      const key = `${variant}:${label}`;
      if (prepared.has(key)) return;
      const metadata = SPOKEN_BANKS[variant];
      if (!bankPromises.has(metadata.path)) {
        bankPromises.set(metadata.path, Promise.resolve().then(async () => {
          const response = await fetchFn(metadata.path);
          if (!response.ok) throw new Error('Spoken voice could not load');
          const bank = await audioContext.decodeAudioData(await response.arrayBuffer());
          if (bank.duration + 1 / bank.sampleRate < metadata.frames / metadata.sampleRate) throw new Error('Incomplete spoken voice');
          return bank;
        }).catch(error => { bankPromises.delete(metadata.path); throw error; }));
      }
      const bank = await bankPromises.get(metadata.path);
      const region = getSpokenClip(label, variant);
      if (!region) throw new Error('Unknown spoken note');
      const sr = bank.sampleRate;
      const samples = bank.getChannelData(0).subarray(Math.round(region.startFrame / metadata.sampleRate * sr), Math.round(region.endFrame / metadata.sampleRate * sr));
      const buffer = audioContext.createBuffer(1, samples.length, sr);
      buffer.getChannelData(0).set(samples);
      prepared.set(key, buffer);
    }));
  }

  function prepare(setup = {}) {
    if (!AudioContextCtor) {
      throw new Error('Web Audio is not available');
    }

    if (audioContext === null) {
      audioContext = new AudioContextCtor();
    }

    const resumed = audioContext.state === 'suspended' ? audioContext.resume() : undefined;
    return setup.spokenCues ? Promise.all([resumed, prepareVoice(setup)]) : resumed;
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

  function speak({ label, variant = 'natural', when = audioContext.currentTime }) {
    const buffer = prepared.get(`${variant}:${label}`);
    if (!buffer) throw new Error('Spoken name was not prepared');
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.65;
    source.connect(gain);
    gain.connect(audioContext.destination);
    const handle = { source, gain };
    voices.add(handle);
    source.onended = () => { source.disconnect(); gain.disconnect(); voices.delete(handle); };
    source.start(when);
  }

  function stopSpeech() {
    for (const { source, gain } of voices) {
      source.stop(audioContext.currentTime);
      source.disconnect();
      gain.disconnect();
    }
    voices.clear();
  }

  return { prepare, play, now, cancel, speak, stopSpeech };
}
