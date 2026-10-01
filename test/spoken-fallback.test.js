import test from 'node:test';
import assert from 'node:assert/strict';
import * as speech from '../src/speech.js';
import { BPM_MIN, BPM_MAX, createSetup, isValidBpm } from '../src/settings.js';
import { KNOWN_NOTE_LABELS } from '../src/music.js';
import { createWebAudioClickPlayer } from '../src/audio.js';
import { createSetupDrafts } from '../src/browser/setup-drafts.js';
import { createIdleState } from '../src/state.js';
import { getViewModel } from '../src/view-model.js';
import { renderHtml } from '../src/render.js';

const group = (label, count) => ({ label, targets: Array.from({ length: count }, () => ({})) });

test('BPM range is 10–200, including both endpoints', () => {
  assert.equal(BPM_MIN, 10); assert.equal(BPM_MAX, 200);
  for (const bpm of [10, 20, 40, 200]) assert.equal(isValidBpm(bpm), true);
  for (const bpm of [9, 201]) assert.equal(isValidBpm(bpm), false);
});

test('natural names stay natural where they fit; crowded calls use the least compression that fits', () => {
  for (const label of KNOWN_NOTE_LABELS) {
    const natural = speech.getSpokenPlayback(label, 200, 3);
    assert.equal(natural.variant, 'natural');
    assert.equal(natural.duration, speech.getSpokenClip(label).duration);
    const two = speech.getSpokenPlayback(label, 200, 2);
    assert.ok(two.duration + .05 <= .6 + 1e-9);
    assert.equal(two.variant, /[#b]/.test(label) ? 'fast' : 'natural');
    assert.equal(speech.getSpokenPlayback(label, 200, 1).variant, 'tight');
  }
  assert.equal(speech.getSpokenPlayback('C#', 120, 2).variant, 'natural');
  assert.equal(speech.getSpokenPlayback('C#', 200, 1, false).variant, 'natural', 'final tail is unrestricted');
});

test('calculated timing supports the global maximum for one target as well as remaining calls', () => {
  const setup = createSetup({ spokenCues: true, selectedLabels: KNOWN_NOTE_LABELS, selectedStringIndexes: [0] });
  assert.equal(speech.getSpokenBpmMax(setup), 200);
  assert.equal(speech.getSpokenBpmMax({ ...setup, selectedStringIndexes: [0, 1] }), 200);
  assert.equal(speech.getSpokenBpmMax({ ...setup, spokenCues: false }), 200);
  assert.equal(speech.getSpokenBpmMax({ ...setup, selectedLabels: ['C#'] }), 200);
  const order = [group('C#', 1), group('Db', 1)];
  assert.equal(speech.getSpokenBpmMax(setup, order), 200);
  assert.equal(speech.getSpokenBpmMax(setup, order, 1), 200);
  assert.equal(speech.spokenCueError({ ...setup, bpm: 200 }, order), '');
  assert.equal(speech.spokenCueError({ ...setup, bpm: 200 }, order, 1), '');
});

test('visible input and drafts allow the full spoken range while rejecting values above the global maximum', () => {
  const setup = createSetup({ bpm: 200, spokenCues: true, selectedLabels: KNOWN_NOTE_LABELS, selectedStringIndexes: [0] });
  const drafts = createSetupDrafts(setup);
  assert.equal(drafts.read(setup).valid, true);
  const html = renderHtml(getViewModel(createIdleState(setup)), setup);
  assert.match(html, /id="bpm"[^>]*min="10"[^>]*max="200"/);
  assert.doesNotMatch(html, /Spoken cues: maximum/);
  drafts.edit('bpm', '201');
  assert.equal(drafts.read(setup).valid, false); assert.match(drafts.errors.bpm, /10 and 200/);
  assert.equal(drafts.read({ ...setup, bpm: 40 }).setup.bpm, 40);
  drafts.edit('bpm', '200'); assert.equal(drafts.read(setup).valid, true);
});

test('natural, moderate and tight buffers prepare lazily with playbackRate 1 and independent caches', async () => {
  const requests = [], sources = [];
  class Context {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createBuffer(c, n, sr) { const data = new Float32Array(n); return { duration: n / sr, sampleRate: sr, getChannelData: () => data }; }
    async decodeAudioData() { return this.createBuffer(1, 44100 * 20, 44100); }
    createBufferSource() { const s = { playbackRate: { value: 1 }, connect() {}, disconnect() {}, start() {}, stop() {} }; sources.push(s); return s; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
  }
  const player = createWebAudioClickPlayer(Context, { fetchFn: async p => { requests.push(p); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; } });
  const setup={ spokenCues:true,bpm:200,selectedLabels:['C#','Db'] };
  await player.prepare({ ...setup,spokenOrder:[group('C#',2),group('Db',2)] });
  player.speak({ label:'C#',variant:'fast' }); assert.ok(sources.at(-1).buffer.duration<=.55+1/44100);
  assert.deepEqual(requests.sort(),['assets/voice/george-fast.webm','assets/voice/george.webm']);
  await player.prepare({ ...setup,spokenOrder:[group('C#',1),group('Db',1)] });
  player.speak({ label:'C#',variant:'tight' }); assert.ok(sources.at(-1).buffer.duration<=.25+1/44100);
  assert.equal(requests.length,3); assert.ok(requests.includes('assets/voice/george-tight.webm'));
  await player.prepare({ ...setup,bpm:40,spokenOrder:[group('C#',1),group('Db',1)] });
  player.speak({ label:'C#' }); assert.equal(sources.at(-1).buffer.duration,speech.getSpokenClip('C#').duration);
  assert.equal(requests.length,3); assert.ok(sources.every(source=>source.playbackRate.value===1));
});
