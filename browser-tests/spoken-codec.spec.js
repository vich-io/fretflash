import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { SPOKEN_BANKS } from '../src/speech.js';

for (const sampleRate of [44100, 48000]) {
  test(`native Opus decoding preserves every crop at ${sampleRate} Hz`, async ({ page }) => {
    const references = Object.fromEntries(Object.entries(SPOKEN_BANKS).map(([name, metadata]) => {
      expect(metadata.path).toMatch(/\.webm$/);
      // An independent decode provides a lossless, same-rate reference to compare
      // against the browser's native demux/decode/resampling path.
      return [name, execFileSync('ffmpeg', ['-v', 'error', '-i', metadata.path, '-c:a', 'flac', '-sample_fmt', 's32', '-f', 'flac', '-'], { maxBuffer: 4 * 1024 * 1024 }).toString('base64')];
    }));
    await page.goto('/');
    const proof = await page.evaluate(async ({ sampleRate, references }) => {
      const { SPOKEN_BANKS, getSpokenClip } = await import('/src/speech.js');
      const context = new AudioContext({ sampleRate });
      try {
        const banks = [];
        for (const [name, metadata] of Object.entries(SPOKEN_BANKS)) {
          const response = await fetch(metadata.path);
          if (!response.ok) throw new Error(`Missing ${metadata.path}`);
          const actual = await context.decodeAudioData(await response.arrayBuffer());
          const bytes = Uint8Array.from(atob(references[name]), x => x.charCodeAt(0));
          const reference = await context.decodeAudioData(bytes.buffer);
          const a = actual.getChannelData(0), b = reference.getChannelData(0);
          let maxDifference = 0;
          for (let i = 0; i < Math.min(a.length, b.length); i++) maxDifference = Math.max(maxDifference, Math.abs(a[i] - b[i]));
          const clips = Object.keys(metadata.clips).map(label => {
            const clip = getSpokenClip(label, name);
            const start = Math.round(clip.startFrame / metadata.sampleRate * actual.sampleRate);
            const end = Math.round(clip.endFrame / metadata.sampleRate * actual.sampleRate);
            const samples = a.subarray(start, end);
            let peak = 0; for (const value of samples) peak = Math.max(peak, Math.abs(value));
            return { label, peak, missingFrames: end - start - samples.length };
          });
          banks.push({ name, channels: actual.numberOfChannels, rate: actual.sampleRate, frameDifference: Math.abs(a.length - b.length), durationError: Math.abs(actual.duration - metadata.frames / metadata.sampleRate), maxDifference, clips });
        }
        return banks;
      } finally { await context.close(); }
    }, { sampleRate, references });
    for (const bank of proof) {
      expect(bank.rate).toBe(sampleRate); expect(bank.channels).toBe(1);
      expect(bank.frameDifference).toBeLessThanOrEqual(1);
      expect(bank.durationError).toBeLessThanOrEqual(1 / sampleRate + 1e-9);
      expect(bank.maxDifference).toBeLessThan(2e-6);
      expect(bank.clips).toHaveLength(bank.name === 'fast' ? 14 : 21);
      for (const clip of bank.clips) { expect(clip.peak).toBeGreaterThan(.01); expect(clip.peak).toBeLessThan(1); expect(clip.missingFrames).toBeLessThanOrEqual(1); }
    }
  });
}
