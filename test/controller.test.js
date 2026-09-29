import test from 'node:test';
import assert from 'node:assert/strict';

import { PITCHES } from '../src/music.js';
import {
  DEFAULT_BPM,
  DEFAULT_FRET_RANGE,
  DEFAULT_LOCATION_MODE,
} from '../src/settings.js';
import { createAppController } from '../src/controller.js';
import { createIdleState } from '../src/state.js';
import { createRangeFilteredRound } from '../src/round.js';
import { getViewModel } from '../src/view-model.js';

function defaultTuningSettings() {
  return {
    tuning: { id: 'standard-6', strings: ['E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 1, 2, 3, 4, 5],
  };
}

function orderLabels(order) {
  return order.map((item) => item.label);
}

function testIdleState(
  bpm = DEFAULT_BPM,
  selectedLabels = PITCHES,
  fretRange = DEFAULT_FRET_RANGE,
  locationMode = DEFAULT_LOCATION_MODE,
  tuning = defaultTuningSettings().tuning,
  selectedStringIndexes = defaultTuningSettings().selectedStringIndexes,
) {
  return createIdleState({ bpm, selectedLabels, fretRange, locationMode, tuning, selectedStringIndexes });
}

function orderGroupsByLabels(labels) {
  return (groups) => labels
    .map((label) => groups.find((group) => group.label === label))
    .filter(Boolean);
}

// Controller timing and lifecycle
function createControllerHarness() {
  const renders = [];
  const clearedTimers = [];
  const clicks = [];
  let nextTimerId = 1;
  let scheduled = null;

  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => clicks.push('click'),
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { id: nextTimerId, callback, intervalMs };
      nextTimerId += 1;
      return scheduled.id;
    },
    clearIntervalFn: (timerId) => clearedTimers.push(timerId),
    createOrder: orderGroupsByLabels([...PITCHES]),
  });

  return {
    controller,
    renders,
    clearedTimers,
    clicks,
    get scheduled() {
      return scheduled;
    },
  };
}

test('createAppController rejects invalid BPM without scheduling a timer', () => {
  const harness = createControllerHarness();

  const started = harness.controller.start('19');

  assert.equal(started, false);
  assert.equal(harness.scheduled, null);
  assert.equal(harness.renders.at(-1).error, 'Choose a BPM between 20 and 240.');
  assert.equal(harness.renders.at(-1).state.phase, 'idle');
});

test('createAppController rejects empty note selection without audio, clicks, or timer', () => {
  const renders = [];
  const clicks = [];
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => clicks.push('click'),
    prepareAudio: () => assert.fail('audio should not prepare for empty selection'),
    setIntervalFn: () => assert.fail('timer should not be scheduled for empty selection'),
    clearIntervalFn: () => {},
  });

  controller.setSelectedLabels([]);
  const started = controller.start('60');

  assert.equal(started, false);
  assert.deepEqual(clicks, []);
  assert.equal(renders.at(-1).error, 'Select at least one note.');
  assert.equal(renders.at(-1).state.phase, 'idle');
  assert.deepEqual(renders.at(-1).state.selectedLabels, []);
});

test('createAppController reports invalid BPM before empty note selection', () => {
  const harness = createControllerHarness();

  harness.controller.setSelectedLabels([]);
  const started = harness.controller.start('19');

  assert.equal(started, false);
  assert.equal(harness.renders.at(-1).error, 'Choose a BPM between 20 and 240.');
});

test('createAppController preserves valid BPM when note selection is empty', () => {
  const harness = createControllerHarness();

  harness.controller.setSelectedLabels([]);
  const started = harness.controller.start('80');

  assert.equal(started, false);
  assert.equal(harness.scheduled, null);
  assert.equal(harness.renders.at(-1).error, 'Select at least one note.');
  assert.equal(harness.renders.at(-1).state.bpm, 80);
});

test('createAppController starts with selected labels and preserves them after stop', () => {
  const renders = [];
  const clearedTimers = [];
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => {},
    setIntervalFn: () => 1,
    clearIntervalFn: (timerId) => clearedTimers.push(timerId),
    createOrder: (labels) => [...labels].reverse(),
  });

  controller.setSelectedLabels(['C#', 'Db']);
  const started = controller.start('60');

  assert.equal(started, true);
  assert.deepEqual(orderLabels(renders.at(-1).state.order), ['Db', 'C#']);
  assert.deepEqual(renders.at(-1).state.selectedLabels, ['C#', 'Db']);

  controller.stop();

  assert.deepEqual(clearedTimers, [1]);
  assert.equal(renders.at(-1).state.phase, 'idle');
  assert.deepEqual(renders.at(-1).state.selectedLabels, ['C#', 'Db']);
});

test('createAppController reports audio startup failure without scheduling a timer', () => {
  const renders = [];
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => {},
    prepareAudio: () => {
      throw new Error('blocked');
    },
    setIntervalFn: () => assert.fail('timer should not be scheduled'),
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels([...PITCHES]),
  });

  const started = controller.start('60');

  assert.equal(started, false);
  assert.equal(renders.at(-1).error, 'Audio could not start. Try pressing Start again.');
  assert.equal(renders.at(-1).state.phase, 'idle');
});

test('createAppController starts a round and schedules ticks at the selected BPM', () => {
  const harness = createControllerHarness();

  const started = harness.controller.start('60');

  assert.equal(started, true);
  assert.equal(harness.scheduled.intervalMs, 1000);
  assert.equal(harness.renders.at(-1).state.phase, 'countin');
});

test('createAppController plays the first count-in click immediately on start', () => {
  const harness = createControllerHarness();

  const started = harness.controller.start('60');

  assert.equal(started, true);
  assert.deepEqual(harness.clicks, ['click']);
  assert.equal(harness.renders.at(-1).state.phase, 'countin');
  assert.equal(harness.renders.at(-1).state.countInBeat, 1);
});

test('createAppController pauses count-in without further stale clicks', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');
  const staleCallback = harness.scheduled.callback;

  const paused = harness.controller.pause();

  assert.equal(paused, true);
  assert.deepEqual(harness.clearedTimers, [1]);
  assert.equal(harness.renders.at(-1).state.phase, 'paused');
  assert.equal(harness.renders.at(-1).state.pausedFromPhase, 'countin');
  assert.equal(harness.renders.at(-1).state.countInBeat, 2);

  staleCallback();

  assert.deepEqual(harness.clicks, ['click']);
  assert.equal(harness.controller.getState().phase, 'paused');
});

test('createAppController pauses running and resumes the same sequence after a full interval', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');
  for (let i = 0; i < 5; i += 1) {
    harness.scheduled.callback();
  }
  assert.equal(harness.controller.getState().phase, 'running');
  assert.equal(harness.controller.getState().beatInNote, 3);
  const clicksBeforePause = harness.clicks.length;

  assert.equal(harness.controller.pause(), true);
  const pausedState = harness.controller.getState();
  assert.equal(pausedState.phase, 'paused');
  assert.equal(pausedState.pausedFromPhase, 'running');
  assert.equal(pausedState.noteIndex, 0);
  assert.equal(pausedState.beatInNote, 3);
  assert.equal(harness.clicks.length, clicksBeforePause);
  assert.deepEqual(harness.clearedTimers, [1]);

  assert.equal(harness.controller.resume(), true);
  assert.equal(harness.controller.getState().phase, 'running');
  assert.equal(harness.controller.getState().beatInNote, 3);
  assert.equal(harness.scheduled.id, 2);
  assert.equal(harness.scheduled.intervalMs, 1000);
  assert.equal(harness.clicks.length, clicksBeforePause);

  harness.scheduled.callback();
  assert.equal(harness.controller.getState().beatInNote, 4);
  assert.equal(harness.clicks.length, clicksBeforePause + 1);
});

test('createAppController ignores stale pre-pause callbacks after resume', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');
  const staleBeforePause = harness.scheduled.callback;
  harness.controller.pause();
  harness.controller.resume();
  const clickCountAfterResume = harness.clicks.length;

  staleBeforePause();

  assert.equal(harness.clicks.length, clickCountAfterResume);
  assert.equal(harness.controller.getState().phase, 'countin');
});

test('createAppController preserves fret-constrained string progress across pause and resume', () => {
  const renders = [];
  const clicks = [];
  const clearedTimers = [];
  let scheduled = null;
  let nextTimerId = 1;
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: (options) => clicks.push(options),
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { id: nextTimerId, callback, intervalMs };
      nextTimerId += 1;
      return scheduled.id;
    },
    clearIntervalFn: (timerId) => clearedTimers.push(timerId),
    createOrder: (groups) => groups,
    initialState: createIdleState({ bpm: 60, selectedLabels: ['Ab', 'C'], fretRange: { from: 5, to: 9 } }),
  });

  controller.start('60');
  for (let i = 0; i < 4; i += 1) {
    scheduled.callback();
  }
  assert.equal(controller.getState().phase, 'running');
  assert.equal(getViewModel(controller.getState()).stringCue, 'String 2 · B');
  assert.equal(getViewModel(controller.getState()).beat, 'Beat 2 / 2');

  controller.pause();
  assert.equal(controller.getState().phase, 'paused');
  assert.equal(getViewModel(controller.getState()).stringCue, 'String 2 · B');
  assert.equal(getViewModel(controller.getState()).beat, 'Beat 2 / 2');
  assert.deepEqual(clearedTimers, [1]);

  controller.resume();
  assert.equal(controller.getState().phase, 'running');
  assert.equal(scheduled.id, 2);
  assert.equal(scheduled.intervalMs, 1000);
  scheduled.callback();

  assert.equal(controller.getState().noteIndex, 1);
  assert.equal(controller.getState().beatInNote, 1);
  assert.equal(getViewModel(controller.getState()).stringCue, 'String 6 · E');
  assert.equal(clicks.at(-1).accent, false);
  assert.equal(renders.at(-1).state.phase, 'running');
});

test('createAppController restarts the same generated drill from paused', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');
  const originalOrder = orderLabels(harness.controller.getState().order);
  for (let i = 0; i < 6; i += 1) {
    harness.scheduled.callback();
  }
  assert.equal(harness.controller.getState().phase, 'running');
  assert.equal(harness.controller.getState().beatInNote, 4);

  harness.controller.pause();
  const clicksBeforeRestart = harness.clicks.length;

  assert.equal(harness.controller.restartCurrent(), true);
  assert.equal(harness.controller.getState().phase, 'countin');
  assert.equal(harness.controller.getState().countInBeat, 2);
  assert.equal(harness.controller.getState().noteIndex, 0);
  assert.equal(harness.controller.getState().beatInNote, 1);
  assert.deepEqual(orderLabels(harness.controller.getState().order), originalOrder);
  assert.equal(harness.clicks.length, clicksBeforeRestart + 1);
  assert.equal(harness.scheduled.id, 2);
  assert.equal(harness.scheduled.intervalMs, 1000);

  harness.scheduled.callback();
  assert.equal(harness.controller.getState().countInBeat, 3);
  assert.deepEqual(orderLabels(harness.controller.getState().order), originalOrder);
});

test('createAppController setup edits cancel a pending async paused restart', async () => {
  const editCases = [
    {
      name: 'selected labels',
      edit: (controller) => controller.setSelectedLabels(['C']),
      assertState: (state) => assert.deepEqual(state.selectedLabels, ['C']),
    },
    {
      name: 'fret range',
      edit: (controller) => controller.setFretRange({ from: 7, to: 12 }),
      assertState: (state) => assert.deepEqual(state.fretRange, { from: 7, to: 12 }),
    },
    {
      name: 'location mode',
      edit: (controller) => controller.setLocationMode('all-in-range'),
      assertState: (state) => assert.equal(state.locationMode, 'all-in-range'),
    },
    {
      name: 'tuning',
      edit: (controller) => controller.setTuning({ id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] }),
      assertState: (state) => {
        assert.deepEqual(state.tuning, { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] });
        assert.deepEqual(state.selectedStringIndexes, [0, 1, 2, 3, 4, 5, 6]);
      },
    },
    {
      name: 'selected strings',
      edit: (controller) => controller.setSelectedStringIndexes([0, 2]),
      assertState: (state) => assert.deepEqual(state.selectedStringIndexes, [0, 2]),
    },
    {
      name: 'BPM',
      edit: (controller) => controller.setBpm(90),
      assertState: (state) => assert.equal(state.bpm, 90),
    },
  ];

  for (const editCase of editCases) {
    const renders = [];
    const clicks = [];
    const timers = [];
    let resolvePrepare;
    let prepareCallCount = 0;
    const restartPreparePromise = new Promise((resolve) => {
      resolvePrepare = resolve;
    });
    const controller = createAppController({
      render: (state, error) => renders.push({ state, error }),
      playClick: () => clicks.push('click'),
      prepareAudio: () => {
        prepareCallCount += 1;
        return prepareCallCount === 1 ? undefined : restartPreparePromise;
      },
      setIntervalFn: (callback, intervalMs) => {
        const timer = { id: timers.length + 1, callback, intervalMs };
        timers.push(timer);
        return timer.id;
      },
      clearIntervalFn: () => {},
      createOrder: orderGroupsByLabels([...PITCHES]),
    });

    assert.equal(controller.start('60'), true, editCase.name);
    for (let i = 0; i < 4; i += 1) {
      timers.at(-1).callback();
    }
    assert.equal(controller.getState().phase, 'running', editCase.name);
    controller.pause();
    const clickCountBeforeRestart = clicks.length;
    const timerCountBeforeRestart = timers.length;

    const restartResult = controller.restartCurrent();
    editCase.edit(controller);
    resolvePrepare();

    assert.equal(await restartResult, false, editCase.name);
    assert.equal(controller.getState().phase, 'paused', editCase.name);
    editCase.assertState(controller.getState());
    assert.equal(clicks.length, clickCountBeforeRestart, editCase.name);
    assert.equal(timers.length, timerCountBeforeRestart, editCase.name);
  }
});

test('createAppController stops from paused and discards the generated sequence', () => {
  const harness = createControllerHarness();
  harness.controller.start('72');
  harness.scheduled.callback();
  harness.controller.pause();

  harness.controller.stop();

  assert.equal(harness.controller.getState().phase, 'idle');
  assert.equal(harness.controller.getState().bpm, 72);
  assert.deepEqual(harness.controller.getState().order, []);
  assert.deepEqual(harness.clearedTimers, [1]);
});

test('createAppController waits for async audio preparation before the first count-in click', async () => {
  const renders = [];
  const clicks = [];
  let scheduled = null;
  let resolvePrepare;
  const preparePromise = new Promise((resolve) => {
    resolvePrepare = resolve;
  });
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => clicks.push('click'),
    prepareAudio: () => preparePromise,
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { callback, intervalMs };
      return 1;
    },
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels([...PITCHES]),
  });

  const startedPromise = controller.start('60');

  assert.deepEqual(clicks, []);
  assert.equal(scheduled, null);

  resolvePrepare();
  const started = await startedPromise;

  assert.equal(started, true);
  assert.deepEqual(clicks, ['click']);
  assert.equal(scheduled.intervalMs, 1000);
  assert.equal(renders.at(-1).state.phase, 'countin');
  assert.equal(renders.at(-1).state.countInBeat, 1);
});

test('createAppController idle setup edits cancel a pending async start', async () => {
  const editCases = [
    {
      name: 'selected labels',
      edit: (controller) => controller.setSelectedLabels(['C']),
      assertState: (state) => assert.deepEqual(state.selectedLabels, ['C']),
    },
    {
      name: 'fret range',
      edit: (controller) => controller.setFretRange({ from: 7, to: 12 }),
      assertState: (state) => assert.deepEqual(state.fretRange, { from: 7, to: 12 }),
    },
    {
      name: 'location mode',
      edit: (controller) => controller.setLocationMode('all-in-range'),
      assertState: (state) => assert.equal(state.locationMode, 'all-in-range'),
    },
    {
      name: 'tuning',
      edit: (controller) => controller.setTuning({ id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] }),
      assertState: (state) => {
        assert.deepEqual(state.tuning, { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] });
        assert.deepEqual(state.selectedStringIndexes, [0, 1, 2, 3, 4, 5, 6]);
      },
    },
    {
      name: 'selected strings',
      edit: (controller) => controller.setSelectedStringIndexes([0, 2]),
      assertState: (state) => assert.deepEqual(state.selectedStringIndexes, [0, 2]),
    },
    {
      name: 'BPM',
      edit: (controller) => controller.setBpm(90),
      assertState: (state) => assert.equal(state.bpm, 90),
    },
  ];

  for (const editCase of editCases) {
    const renders = [];
    const clicks = [];
    const timers = [];
    let resolvePrepare;
    const preparePromise = new Promise((resolve) => {
      resolvePrepare = resolve;
    });
    const controller = createAppController({
      render: (state, error) => renders.push({ state, error }),
      playClick: () => clicks.push('click'),
      prepareAudio: () => preparePromise,
      setIntervalFn: (callback) => {
        timers.push({ callback });
        return timers.length;
      },
      clearIntervalFn: () => {},
      createOrder: (items) => items,
      initialState: createIdleState({ bpm: 60, selectedLabels: ['Ab'], fretRange: { from: 5, to: 9 } }),
    });

    const startedPromise = controller.start('60');
    editCase.edit(controller);
    resolvePrepare();
    const started = await startedPromise;

    assert.equal(started, false, editCase.name);
    assert.deepEqual(clicks, [], editCase.name);
    assert.deepEqual(timers, [], editCase.name);
    assert.equal(controller.getState().phase, 'idle', editCase.name);
    editCase.assertState(controller.getState());
  }
});

test('createAppController reports async audio startup failure without scheduling a timer', async () => {
  const renders = [];
  const clicks = [];
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => clicks.push('click'),
    prepareAudio: () => Promise.reject(new Error('blocked')),
    setIntervalFn: () => assert.fail('timer should not be scheduled'),
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels([...PITCHES]),
  });

  const started = await controller.start('60');

  assert.equal(started, false);
  assert.deepEqual(clicks, []);
  assert.equal(renders.at(-1).error, 'Audio could not start. Try pressing Start again.');
  assert.equal(renders.at(-1).state.phase, 'idle');
});

test('createAppController ignores stale async starts so timers cannot overlap', async () => {
  const renders = [];
  const clicks = [];
  const timers = [];
  const prepareResolves = [];
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => clicks.push('click'),
    prepareAudio: () => new Promise((resolve) => prepareResolves.push(resolve)),
    setIntervalFn: (callback, intervalMs) => {
      const timer = { id: timers.length + 1, callback, intervalMs };
      timers.push(timer);
      return timer.id;
    },
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels([...PITCHES]),
  });

  const firstStart = controller.start('60');
  const secondStart = controller.start('80');

  prepareResolves[0]();
  assert.equal(await firstStart, false);
  assert.deepEqual(clicks, []);
  assert.deepEqual(timers, []);

  prepareResolves[1]();
  assert.equal(await secondStart, true);
  assert.deepEqual(clicks, ['click']);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].intervalMs, 750);
  assert.equal(renders.at(-1).state.bpm, 80);
});

test('createAppController stop invalidates a pending async start before it can click or schedule', async () => {
  const renders = [];
  const clicks = [];
  const timers = [];
  let resolvePrepare;
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => clicks.push('click'),
    prepareAudio: () => new Promise((resolve) => {
      resolvePrepare = resolve;
    }),
    setIntervalFn: (callback, intervalMs) => {
      const timer = { id: timers.length + 1, callback, intervalMs };
      timers.push(timer);
      return timer.id;
    },
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels([...PITCHES]),
  });

  const startResult = controller.start('60');
  controller.stop();
  resolvePrepare();

  assert.equal(await startResult, false);
  assert.deepEqual(clicks, []);
  assert.deepEqual(timers, []);
  assert.equal(renders.at(-1).state.phase, 'idle');
});

test('createAppController clears an existing timer before starting a new round', () => {
  const harness = createControllerHarness();

  harness.controller.start('60');
  harness.controller.start('80');

  assert.deepEqual(harness.clearedTimers, [1]);
  assert.equal(harness.scheduled.id, 2);
  assert.equal(harness.scheduled.intervalMs, 750);
});

test('createAppController scheduled ticks show and click count-in beats two through four', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');

  harness.scheduled.callback();
  assert.deepEqual(harness.clicks, ['click', 'click']);
  assert.equal(harness.renders.at(-1).state.phase, 'countin');
  assert.equal(harness.renders.at(-1).state.countInBeat, 2);

  harness.scheduled.callback();
  assert.deepEqual(harness.clicks, ['click', 'click', 'click']);
  assert.equal(harness.renders.at(-1).state.phase, 'countin');
  assert.equal(harness.renders.at(-1).state.countInBeat, 3);

  harness.scheduled.callback();
  assert.deepEqual(harness.clicks, ['click', 'click', 'click', 'click']);
  assert.equal(harness.renders.at(-1).state.phase, 'countin');
  assert.equal(harness.renders.at(-1).state.countInBeat, 4);
});

test('createAppController first post-count-in tick shows and clicks the first note', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');

  for (let i = 0; i < 4; i += 1) {
    harness.scheduled.callback();
  }

  assert.deepEqual(harness.clicks, ['click', 'click', 'click', 'click', 'click']);
  assert.equal(harness.renders.at(-1).state.phase, 'running');
  assert.equal(harness.renders.at(-1).state.noteIndex, 0);
  assert.equal(harness.renders.at(-1).state.beatInNote, 1);
});

test('createAppController keeps count-in normal and accents running beat one only', () => {
  const clicks = [];
  let scheduled = null;
  const controller = createAppController({
    render: () => {},
    playClick: (options) => clicks.push(options),
    setIntervalFn: (callback) => {
      scheduled = { callback };
      return 1;
    },
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels(['C', 'D']),
  });

  controller.start('60');
  for (let i = 0; i < 10; i += 1) {
    scheduled.callback();
  }

  assert.deepEqual(clicks.map((options) => options.accent), [
    false, // count-in 1
    false, // count-in 2
    false, // count-in 3
    false, // count-in 4
    true, // first prompt beat 1
    false,
    false,
    false,
    false,
    false,
    true, // next prompt beat 1
  ]);
});

test('createAppController runs fret-constrained groups with first-string accents', () => {
  const renders = [];
  const clicks = [];
  let scheduled = null;
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: (options) => clicks.push(options),
    setIntervalFn: (callback) => {
      scheduled = { callback };
      return 1;
    },
    clearIntervalFn: () => {},
    createOrder: (groups) => groups,
    initialState: createIdleState({ bpm: 60, selectedLabels: ['Ab', 'C'], fretRange: { from: 5, to: 9 } }),
  });

  assert.equal(controller.start('60'), true);
  for (let i = 0; i < 9; i += 1) {
    scheduled.callback();
  }

  assert.deepEqual(clicks.map((options) => options.accent), [
    false, false, false, false,
    true, false,
    true, false, false,
  ]);
  assert.equal(renders.at(-1).state.phase, 'done');
  assert.equal(renders.at(-1).state.beatInNote, 3);
});

test('createAppController rejects rounds with no surviving note groups before audio', () => {
  const renders = [];
  const clicks = [];
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: (options) => clicks.push(options),
    prepareAudio: () => assert.fail('audio should not prepare for an empty generated round'),
    setIntervalFn: () => assert.fail('empty generated round must not schedule'),
    clearIntervalFn: () => {},
    initialState: createIdleState({ bpm: 60, selectedLabels: ['F'], fretRange: { from: 4, to: 4 } }),
    createOrder: () => [],
  });

  const started = controller.start('60');

  assert.equal(started, false);
  assert.deepEqual(clicks, []);
  assert.equal(renders.at(-1).error, 'No selected notes are available in this fret range.');
  assert.equal(renders.at(-1).state.phase, 'idle');
});

test('createAppController stop clears the active timer and returns to idle with the selected BPM', () => {
  const harness = createControllerHarness();
  harness.controller.start('72');

  harness.controller.stop();

  assert.deepEqual(harness.clearedTimers, [1]);
  assert.equal(harness.renders.at(-1).state.phase, 'idle');
  assert.equal(harness.renders.at(-1).state.bpm, 72);
});

test('createAppController stale tick after Stop does not click or advance idle state', () => {
  const harness = createControllerHarness();
  harness.controller.start('72');
  const staleCallback = harness.scheduled.callback;

  harness.controller.stop();
  const clickCountAfterStop = harness.clicks.length;
  const renderCountAfterStop = harness.renders.length;

  staleCallback();

  assert.equal(harness.clicks.length, clickCountAfterStop);
  assert.equal(harness.renders.length, renderCountAfterStop);
  assert.equal(harness.controller.getState().phase, 'idle');
});

test('createAppController final pitch click reaches done without an extra click', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');

  for (let i = 0; i < 75; i += 1) {
    harness.scheduled.callback();
  }

  assert.equal(harness.clicks.length, 76);
  assert.equal(harness.renders.at(-1).state.phase, 'done');
  assert.deepEqual(harness.clearedTimers, [1]);

  harness.scheduled.callback();
  assert.equal(harness.clicks.length, 76);
});

test('createAppController clears the timer when the round reaches done', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');

  for (let i = 0; i < 76; i += 1) {
    harness.scheduled.callback();
  }

  assert.equal(harness.renders.at(-1).state.phase, 'done');
  assert.deepEqual(harness.clearedTimers, [1]);
});

test('createAppController start after done creates a fresh order', () => {
  const firstOrder = [...PITCHES];
  const secondOrder = [...PITCHES].reverse();
  const renders = [];
  let orderCall = 0;
  let scheduled = null;
  let nextTimerId = 1;

  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => {},
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { id: nextTimerId, callback, intervalMs };
      nextTimerId += 1;
      return scheduled.id;
    },
    clearIntervalFn: () => {},
    createOrder: (groups) => {
      orderCall += 1;
      return orderGroupsByLabels(orderCall === 1 ? firstOrder : secondOrder)(groups);
    },
  });

  controller.start('60');
  for (let i = 0; i < 76; i += 1) {
    scheduled.callback();
  }
  controller.start('60');

  assert.equal(renders.at(-1).state.phase, 'countin');
  assert.deepEqual(orderLabels(renders.at(-1).state.order), secondOrder);
});

test('createAppController same order after Done repeats the exact completed full-range order', () => {
  const firstOrder = ['D', 'C'];
  const regeneratedOrder = ['C', 'D'];
  const renders = [];
  let scheduled = null;
  let nextTimerId = 1;
  let orderCall = 0;
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => {},
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { id: nextTimerId, callback, intervalMs };
      nextTimerId += 1;
      return scheduled.id;
    },
    clearIntervalFn: () => {},
    createOrder: (groups) => {
      orderCall += 1;
      return orderGroupsByLabels(orderCall === 1 ? firstOrder : regeneratedOrder)(groups);
    },
    initialState: testIdleState(60, ['C', 'D']),
  });

  controller.start('60');
  while (controller.getState().phase !== 'done') {
    scheduled.callback();
  }
  assert.deepEqual(orderLabels(controller.getState().order), firstOrder);

  const repeated = controller.repeatSameOrder('90');

  assert.equal(repeated, true);
  assert.equal(controller.getState().phase, 'countin');
  assert.equal(controller.getState().bpm, 90);
  assert.deepEqual(orderLabels(controller.getState().order), firstOrder);
  assert.equal(orderCall, 1);
});

test('createAppController same order after Done repeats exact fret-constrained groups', () => {
  const firstOrder = createRangeFilteredRound(['C'], { from: 0, to: 24 }, (groups) => groups, 'all-in-range');
  const regeneratedOrder = [...firstOrder].reverse();
  let scheduled = null;
  let orderCall = 0;
  const controller = createAppController({
    render: () => {},
    playClick: () => {},
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { callback, intervalMs };
      return 1;
    },
    clearIntervalFn: () => {},
    createOrder: () => {
      orderCall += 1;
      return orderCall === 1 ? firstOrder : regeneratedOrder;
    },
    initialState: createIdleState({ bpm: 60, selectedLabels: ['C'], fretRange: { from: 0, to: 24 }, locationMode: 'all-in-range' }),
  });

  controller.start('60');
  while (controller.getState().phase !== 'done') {
    scheduled.callback();
  }

  const repeated = controller.repeatSameOrder('72');

  assert.equal(repeated, true);
  assert.equal(controller.getState().phase, 'countin');
  assert.deepEqual(controller.getState().fretRange, { from: 0, to: 24 });
  assert.equal(controller.getState().locationMode, 'all-in-range');
  assert.deepEqual(controller.getState().order, firstOrder);
  assert.equal(controller.getState().order[0].targets.length, 12);
  assert.equal(orderCall, 1);
});

test('createAppController same order is unavailable after stop before Done', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');
  harness.controller.stop();

  const repeated = harness.controller.repeatSameOrder('60');

  assert.equal(repeated, false);
  assert.equal(harness.controller.getState().phase, 'idle');
  assert.deepEqual(harness.controller.getState().order, []);
});

test('createAppController setup edits after Done return to idle and clear same-order repeat', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');
  while (harness.controller.getState().phase !== 'done') {
    harness.scheduled.callback();
  }
  assert.equal(harness.controller.getState().phase, 'done');
  assert.equal(getViewModel(harness.controller.getState()).showSameOrder, true);

  harness.controller.setSelectedLabels(['C', 'D']);

  assert.equal(harness.controller.getState().phase, 'idle');
  assert.deepEqual(harness.controller.getState().order, []);
  assert.equal(harness.controller.getState().completedOrder, undefined);
  assert.equal(getViewModel(harness.controller.getState()).primaryButton, 'Start');
  assert.equal(getViewModel(harness.controller.getState()).showSameOrder, false);
  assert.equal(harness.controller.repeatSameOrder('60'), false);

  harness.controller.start('60');
  while (harness.controller.getState().phase !== 'done') {
    harness.scheduled.callback();
  }
  harness.controller.setLocationMode('all-in-range');

  assert.equal(harness.controller.getState().phase, 'idle');
  assert.equal(harness.controller.getState().locationMode, 'all-in-range');
  assert.equal(getViewModel(harness.controller.getState()).showSameOrder, false);
});

test('createAppController setup edit cancels pending async Repeat after Done', async () => {
  const renders = [];
  const clicks = [];
  let scheduled = null;
  let resolvePrepare;
  let prepareCallCount = 0;
  const preparePromise = new Promise((resolve) => {
    resolvePrepare = resolve;
  });
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: () => clicks.push('click'),
    prepareAudio: () => {
      prepareCallCount += 1;
      return prepareCallCount === 1 ? undefined : preparePromise;
    },
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { callback, intervalMs };
      return 1;
    },
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels(['C']),
    initialState: testIdleState(60, ['C']),
  });

  controller.start('60');
  while (controller.getState().phase !== 'done') {
    scheduled.callback();
  }
  const repeatPromise = controller.repeatSameOrder('60');
  controller.setSelectedLabels(['C', 'D']);

  resolvePrepare();
  const repeated = await repeatPromise;

  assert.equal(repeated, false);
  assert.equal(controller.getState().phase, 'idle');
  assert.deepEqual(controller.getState().selectedLabels, ['C', 'D']);
  assert.deepEqual(controller.getState().order, []);
  assert.deepEqual(clicks, Array(10).fill('click'));
  assert.equal(renders.at(-1).state.phase, 'idle');
});

test('createAppController setup edit cancels pending async Shuffle after Done', async () => {
  const clicks = [];
  let scheduled = null;
  let resolvePrepare;
  let prepareCallCount = 0;
  const preparePromise = new Promise((resolve) => {
    resolvePrepare = resolve;
  });
  const controller = createAppController({
    render: () => {},
    playClick: () => clicks.push('click'),
    prepareAudio: () => {
      prepareCallCount += 1;
      return prepareCallCount === 1 ? undefined : preparePromise;
    },
    setIntervalFn: (callback, intervalMs) => {
      scheduled = { callback, intervalMs };
      return 1;
    },
    clearIntervalFn: () => {},
    createOrder: orderGroupsByLabels(['C']),
    initialState: testIdleState(60, ['C']),
  });

  controller.start('60');
  while (controller.getState().phase !== 'done') {
    scheduled.callback();
  }
  const startPromise = controller.start('60');
  controller.setLocationMode('all-in-range');

  resolvePrepare();
  const started = await startPromise;

  assert.equal(started, false);
  assert.equal(controller.getState().phase, 'idle');
  assert.equal(controller.getState().locationMode, 'all-in-range');
  assert.deepEqual(controller.getState().order, []);
  assert.deepEqual(clicks, Array(10).fill('click'));
});
