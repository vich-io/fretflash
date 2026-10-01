import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebAudioClickPlayer } from '../src/audio.js';
import { createAppController } from '../src/controller.js';
import { createIdleState } from '../src/state.js';
import * as speech from '../src/speech.js';

function audioHarness(fetchFn = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })) {
  const sources = [], contexts = [], requests = [];
  class Context {
    constructor() { this.state = 'running'; this.currentTime = 2; this.destination = {}; this.sampleRate = 8000; contexts.push(this); }
    createBuffer(channels, length, sampleRate) { const data = new Float32Array(length); return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data }; }
    async decodeAudioData() { const bank = this.createBuffer(1, this.sampleRate * 40, this.sampleRate); bank.getChannelData(0).set(Float32Array.from({ length: bank.length }, (_, i) => 0.3 * Math.sin(i * .2))); return bank; }
    createBufferSource() {
      const source = { buffer: null, playbackRate: { value: 1 }, connects: [], starts: [], stops: [], connect(target) { this.connects.push(target); }, disconnect() { this.disconnected = true; }, start(at) { this.starts.push(at); }, stop(at) { this.stops.push(at); } };
      sources.push(source); return source;
    }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }; }
  }
  const player = createWebAudioClickPlayer(Context, { fetchFn: (...args) => { requests.push(args); return fetchFn(...args); } });
  return { player, sources, contexts, requests };
}

test('disabled speech never downloads a bank', () => {
  const h = audioHarness(); h.player.prepare({ spokenCues: false, bpm: 40, selectedLabels: ['C'] }); assert.equal(h.requests.length, 0);
});

test('each complete name starts once on the beat at natural length/rate, independent of tempo', async () => {
  const h = audioHarness();
  await h.player.prepare({ spokenCues: true, bpm: 40, selectedLabels: ['C', 'C#'] });
  h.player.speak({ label: 'C#', when: 3 });
  assert.equal(h.sources.length, 1); assert.deepEqual(h.sources[0].starts, [3]); assert.deepEqual(h.sources[0].stops, []);
  assert.equal(h.sources[0].playbackRate.value, 1);
  assert.ok(Math.abs(h.sources[0].buffer.duration - speech.getSpokenClip('C#').duration) <= 1/8000);
  const first = h.sources[0].buffer;
  await h.player.prepare({ spokenCues: true, bpm: 200, selectedLabels: ['C#'] });
  h.player.speak({ label: 'C#', when: 5 });
  assert.equal(h.sources[1].buffer, first); assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0][0], 'assets/voice/george.wav');
});

test('Stop cancels active and future whole-phrase sources immediately', async () => {
  const h = audioHarness(); await h.player.prepare({ spokenCues: true, selectedLabels: ['C#', 'Db'] });
  h.player.speak({ label: 'C#', when: 3 }); h.player.speak({ label: 'Db', when: 5 });
  h.contexts[0].currentTime = 3.2; h.player.stopSpeech();
  assert.deepEqual(h.sources.map(x => x.stops.at(-1)), [3.2, 3.2]); assert.ok(h.sources.every(x => x.disconnected));
});

test('failed George bank preparation allows retry', async () => {
  let attempts = 0; const h = audioHarness(async () => (++attempts === 1 ? { ok: false } : { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  const setup = { spokenCues: true, selectedLabels: ['C'] };
  await assert.rejects(Promise.resolve().then(() => h.player.prepare(setup))); await h.player.prepare(setup); assert.equal(attempts, 2);
});

function controllerHarness({ labels = ['C#', 'Db'], strings = [0, 1], bpm = 40 } = {}) {
  let tick; const speeches = [], clicks = [], preparations = [], errors = []; let stops = 0;
  const controller = createAppController({ initialState: createIdleState({ bpm, spokenCues: true, selectedLabels: labels, selectedStringIndexes: strings }), createOrder: xs => xs,
    render(state, error) { if (error) errors.push(error); }, playClick: options => clicks.push(options), playSpeech: options => speeches.push(options), stopSpeech: () => stops++,
    prepareAudio: setup => preparations.push(setup), setIntervalFn: fn => { tick = fn; return 1; }, clearIntervalFn() {} });
  return { controller, speeches, clicks, preparations, errors, tick: () => tick(), get stops() { return stops; } };
}

test('controller carries precise final-beat announcements through exact Repeat without a voice parameter', () => {
  const h = controllerHarness(); h.controller.start('40'); for (let i = 0; i < 7; i++) h.tick();
  assert.deepEqual(h.speeches.map(x => x.label), ['C#', 'Db']); assert.ok(h.speeches.every(x => !Object.hasOwn(x, 'voice')));
  assert.equal(h.controller.getState().phase, 'done'); h.controller.repeatSameOrder('40'); assert.equal(h.preparations.at(-1).spokenCues, true);
});

test('Start and exact Repeat support one-target 200-BPM speech without skipped cues', () => {
  const h = controllerHarness({ strings:[0] }); assert.equal(h.controller.start('200'),true);
  for(let i=0;i<6;i++) h.tick();
  assert.equal(h.controller.getState().phase,'done');
  assert.deepEqual(h.speeches.map(x=>x.label),['C#','Db']);
  assert.deepEqual(h.speeches.map(x=>x.variant),['tight','natural']);
  const before=h.preparations.length; assert.equal(h.controller.repeatSameOrder('200'),true);
  assert.equal(h.preparations.length,before+1); assert.deepEqual(h.errors,[]);
});

test('paused tempo edits to 200 support remaining Resume calls and complete Restart', () => {
  const h=controllerHarness({ strings:[0] }); h.controller.start('40'); h.controller.pause(); h.controller.setBpm(200);
  assert.equal(h.controller.resume(),true); h.controller.pause();
  assert.equal(h.controller.restartCurrent(),true);
  for(let i=0;i<6;i++) h.tick();
  assert.equal(h.controller.getState().phase,'done'); assert.deepEqual(h.errors,[]);
});

test('a sole final name may finish naturally into Done; Setup/Stop still revoke it', () => {
  const h = controllerHarness({ labels: ['C#'], strings: [0], bpm: 200 }); h.controller.start('200'); h.tick(); h.tick(); h.tick();
  const stops = h.stops; h.tick(); assert.equal(h.controller.getState().phase, 'done'); assert.equal(h.stops, stops);
  h.controller.stop(); assert.equal(h.stops, stops + 1);
});

test('Pause/Stop revoke speech and a late readiness result cannot announce', async () => {
  const h = controllerHarness(); h.controller.start('40'); h.tick(); h.tick(); h.tick(); const before = h.stops;
  h.controller.pause(); assert.ok(h.stops > before); h.controller.stop();
  let resolve; const spoken = []; const controller = createAppController({ render() {}, playClick() {}, playSpeech: x => spoken.push(x), prepareAudio: () => new Promise(r => { resolve = r; }), initialState: createIdleState({ spokenCues: true }) });
  const pending = controller.start('40'); controller.stop(); resolve(); assert.equal(await pending, false); assert.deepEqual(spoken, []);
});
