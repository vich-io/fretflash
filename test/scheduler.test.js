import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../src/controller.js';
import { createIdleState } from '../src/state.js';
import { BPM_MAX } from '../src/settings.js';

const PERIOD = 60 / BPM_MAX;

function clockHarness() {
  let time = 0;
  let nextId = 0;
  const tasks = new Map();
  const plays = [];
  const cancelled = [];
  const renders = [];
  const controller = createAppController({
    initialState: createIdleState({ bpm: BPM_MAX, selectedLabels: ['C'], selectedStringIndexes: [0, 1] }),
    render: (state) => renders.push({ time, phase: state.phase, beat: state.beatInNote, count: state.countInBeat }),
    playClick: ({ accent, when }) => {
      const handle = { when: when ?? time, accent, cancelled: false };
      plays.push(handle);
      return handle;
    },
    cancelClick: (handle) => { handle.cancelled = true; cancelled.push(handle); },
    audioClock: () => time,
    setIntervalFn: (fn, milliseconds) => { const id = ++nextId; tasks.set(id, { fn, milliseconds, next: time + milliseconds / 1000, recurring: true }); return id; },
    clearIntervalFn: (id) => tasks.delete(id),
    setTimeoutFn: (fn, milliseconds) => { const id = ++nextId; tasks.set(id, { fn, next: time + milliseconds / 1000, recurring: false }); return id; },
    clearTimeoutFn: (id) => tasks.delete(id),
    createOrder: (groups) => groups,
  });
  function advance(seconds) {
    const end = time + seconds;
    while (true) {
      let id = null;
      let due = Infinity;
      for (const [key, task] of tasks) if (task.next < due && task.next <= end + 1e-8) { id = key; due = task.next; }
      if (id === null) break;
      time = due;
      const task = tasks.get(id);
      if (task.recurring) task.next += task.milliseconds / 1000;
      else tasks.delete(id);
      task.fn();
    }
    time = end;
  }
  function stall(seconds) { time += seconds; for (const [id, task] of [...tasks]) if (task.recurring && task.next <= time) { task.next = time + task.milliseconds / 1000; task.fn(); } }
  return { controller, advance, stall, plays, cancelled, renders, get time() { return time; } };
}

test('audio-clock final target completes on its own cue, and Repeat retains order', () => {
  const h = clockHarness();
  h.controller.start(String(BPM_MAX));
  h.advance(5 * PERIOD);
  assert.equal(h.controller.getState().phase, 'done');
  assert.equal(h.plays.length, 6);
  assert.deepEqual(h.plays.map(cue => cue.accent), [false, false, false, false, true, false]);
  const exact = h.controller.getState().completedOrder;
  assert.equal(h.controller.repeatSameOrder(String(BPM_MAX)), true);
  assert.deepEqual(h.controller.getState().order, exact);
  assert.equal(h.plays.length, 7);
});

test('short scheduling stall preserves audio-clock cadence and stop cancels prequeued click', () => {
  const h = clockHarness();
  h.controller.start(String(BPM_MAX));
  h.stall(0.08);
  h.advance(PERIOD - 0.18);
  assert.equal(h.plays[1].when, PERIOD);
  h.controller.stop();
  assert.equal(h.plays[1].cancelled, true);
  h.advance(0.4);
  assert.equal(h.controller.getState().phase, 'idle');
  assert.equal(h.plays.length, 2);
});

test('audio clock prequeues exact future timestamps without exposing future cues', () => {
  const h = clockHarness();
  assert.equal(h.controller.start(String(BPM_MAX)), true);
  assert.equal(h.plays[0].when, 0);
  h.advance(PERIOD - 0.1);
  assert.equal(h.plays[1].when, PERIOD);
  assert.equal(h.controller.getState().countInBeat, 1);
  h.advance(0.1);
  assert.equal(h.controller.getState().countInBeat, 2);
  assert.equal(h.renders.at(-1).time, PERIOD);
  h.advance(3 * PERIOD);
  assert.equal(h.plays[4].when, 4 * PERIOD);
  assert.equal(h.plays[4].accent, true);
  assert.equal(h.controller.getState().phase, 'running');
});

test('pause cancels queued audio, resume starts full interval later without replay', () => {
  const h = clockHarness();
  h.controller.start(String(BPM_MAX));
  h.advance(PERIOD - 0.1);
  assert.equal(h.plays[1].cancelled, false);
  h.controller.pause();
  assert.equal(h.plays[1].cancelled, true);
  h.advance(0.5);
  assert.equal(h.controller.getState().countInBeat, 1);
  const resumeAt = h.time;
  h.controller.resume();
  h.advance(PERIOD - 0.1);
  assert.equal(h.plays.at(-1).when, resumeAt + PERIOD);
  assert.equal(h.controller.getState().countInBeat, 1);
  h.advance(0.1);
  assert.equal(h.controller.getState().countInBeat, 2);
});

test('long main-thread stall pauses safely without a burst of missed beats', () => {
  const h = clockHarness();
  h.controller.start(String(BPM_MAX));
  h.stall(2);
  assert.equal(h.controller.getState().phase, 'paused');
  assert.equal(h.plays.length, 1);
  h.controller.resume();
  h.advance(PERIOD);
  assert.equal(h.controller.getState().countInBeat, 2);
  assert.equal(h.plays.length, 2);
});
