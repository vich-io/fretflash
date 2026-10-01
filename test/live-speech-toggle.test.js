import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../src/controller.js';
import { createIdleState } from '../src/state.js';

function harness() {
  let now = 0, pump, id = 0, prepare = () => {};
  const tasks = new Map(), clicks = [], words = [], renders = [], cancellations = [];
  const controller = createAppController({
    initialState: createIdleState({ bpm: 60, selectedLabels: ['C', 'D', 'E'], selectedStringIndexes: [0] }),
    createOrder: groups => groups, audioClock: () => now,
    render: (state, error) => renders.push({ state, error }),
    prepareAudio: setup => prepare(setup), playClick: cue => { clicks.push(cue); return cue; },
    cancelClick: cue => cancellations.push(cue), playSpeech: cue => words.push({ ...cue, stopped: false }),
    stopSpeech: () => words.forEach(word => { word.stopped = true; }),
    setIntervalFn: fn => { pump = fn; return 1; }, clearIntervalFn: () => { pump = null; },
    setTimeoutFn: (fn, ms) => { tasks.set(++id, { fn, at: now + ms / 1000 }); return id; },
    clearTimeoutFn: id => tasks.delete(id),
  });
  return { controller, clicks, words, renders, cancellations,
    prepare(fn) { prepare = fn; },
    advance(to) {
      while (now < to - 1e-8) {
        now = Math.min(to, Math.round((now + .025) * 1e6) / 1e6);
        pump?.();
        for (const [id, task] of tasks) if (task.at <= now + 1e-8) { tasks.delete(id); task.fn(); }
      }
    },
  };
}

test('live speech toggle preserves click grid, queued state, order and exact Repeat', async () => {
  const h = harness(), c = h.controller; c.start('60');
  const order = c.getState().order;
  h.advance(2.9); // Beat four is queued without speech.
  await c.setSpokenCues(true); h.advance(3);
  assert.equal(c.getState().spokenCues, true); assert.equal(h.words.length, 0, 'never replay the queued onset');
  h.advance(3.9); assert.equal(h.words[0].label, 'D'); assert.equal(h.words[0].when, 4);
  c.setSpokenCues(false); assert.equal(h.words[0].stopped, true);
  h.advance(4); assert.equal(c.getState().spokenCues, false, 'queued callback cannot restore old preference');
  await c.setSpokenCues(true); h.advance(6);
  assert.equal(c.getState().phase, 'done'); assert.deepEqual(c.getState().order, order);
  assert.deepEqual(h.words.map(word => word.label), ['D', 'E']);
  assert.deepEqual(h.clicks.map(cue => cue.when), [undefined, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(h.cancellations, []);
  c.setSpokenCues(false); assert.equal(c.getState().phase, 'done');
  c.repeatSameOrder('60'); assert.deepEqual(c.getState().order, order);
  assert.equal(c.getState().spokenCues, false);
});

test('live preparation keeps clicks moving and announces only future ready calls', async () => {
  const h = harness(), c = h.controller; c.start('60');
  let resolve, setup; h.prepare(value => { setup = value; return new Promise(r => { resolve = r; }); });
  const pending = c.setSpokenCues(true);
  assert.equal(c.getState().spokenPending, true); assert.equal(c.getState().startPending, false);
  h.advance(3.2); assert.equal(h.clicks.length, 4); assert.equal(h.words.length, 0);
  assert.equal(c.getState().spokenPending, true, 'pending state survives cue callbacks');
  resolve(); assert.equal(await pending, true); assert.equal(c.getState().spokenPending, false);
  assert.equal(setup.spokenCues, true); assert.deepEqual(setup.spokenOrder, c.getState().order);
  h.advance(4); assert.deepEqual(h.words.map(word => word.label), ['D']);
});

for (const cancel of ['off', 'stop', 'pause', 'done']) {
  test(`late live speech readiness cannot override ${cancel}`, async () => {
    const h = harness(), c = h.controller; c.start('60');
    let resolve; h.prepare(() => new Promise(r => { resolve = r; }));
    const pending = c.setSpokenCues(true);
    if (cancel === 'off') c.setSpokenCues(false);
    else if (cancel === 'done') h.advance(6);
    else c[cancel]();
    const state = c.getState(); resolve(); assert.equal(await pending, false);
    assert.deepEqual(c.getState(), state); assert.equal(c.getState().spokenPending, false); assert.equal(h.words.length, 0);
  });
}

test('failed live enable leaves a stable retry error while clicks continue; newer enable owns readiness', async () => {
  const h = harness(), c = h.controller; c.start('60');
  h.prepare(() => Promise.reject(new Error('network')));
  assert.equal(await c.setSpokenCues(true), false);
  assert.equal(c.getState().spokenCues, false); h.advance(1);
  assert.match(h.renders.at(-1).error, /Spoken cues.*try again/i);
  const resolvers = []; h.prepare(() => new Promise(resolve => resolvers.push(resolve)));
  const old = c.setSpokenCues(true); c.setSpokenCues(false); const latest = c.setSpokenCues(true);
  resolvers[0](); assert.equal(await old, false); assert.equal(c.getState().spokenPending, true);
  resolvers[1](); assert.equal(await latest, true); h.advance(3);
  assert.equal(h.words[0].label, 'C'); assert.equal(h.renders.at(-1).error, '');
});

test('paused speech changes cancel pending Resume and preserve cue/order for the next Resume', async () => {
  const h = harness(), c = h.controller; c.start('60'); h.advance(1); c.pause();
  const order = c.getState().order, beat = c.getState().countInBeat;
  c.setSpokenCues(true);
  let resolve; h.prepare(() => new Promise(r => { resolve = r; }));
  const pending = c.resume(); c.setSpokenCues(false); resolve();
  assert.equal(await pending, false); assert.equal(c.getState().phase, 'paused');
  assert.equal(c.getState().countInBeat, beat); assert.deepEqual(c.getState().order, order);
  h.prepare(() => {}); c.resume(); h.advance(2);
  assert.equal(c.getState().spokenCues, false); assert.equal(h.words.length, 0);
});
