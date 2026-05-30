import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import {
  PITCHES,
  advanceAfterClick,
  createIdleState,
  createAppController,
  createWebAudioClickPlayer,
  getViewModel,
  isValidBpm,
  getClickIntervalMs,
  parseBpmInput,
  renderHtml,
  shufflePitches,
  startRound,
} from '../app.js';

const requiredFiles = ['index.html', 'style.css', 'app.js'];

test('static app entry files exist', async () => {
  await Promise.all(requiredFiles.map((path) => access(path)));
});

test('index.html loads the local stylesheet and app module', async () => {
  const html = await readFile('index.html', 'utf8');

  assert.match(html, /<link rel="stylesheet" href="style\.css">/);
  assert.match(html, /<script type="module" src="app\.js"><\/script>/);
});

test('v0 pitch set uses all 12 flat-spelled pitch classes', () => {
  assert.deepEqual(PITCHES, ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
});

test('BPM validation accepts only integer numbers from 30 to 240', () => {
  assert.equal(isValidBpm(30), true);
  assert.equal(isValidBpm(60), true);
  assert.equal(isValidBpm(240), true);

  assert.equal(isValidBpm(29), false);
  assert.equal(isValidBpm(241), false);
  assert.equal(isValidBpm('60'), false);
  assert.equal(isValidBpm(60.5), false);
  assert.equal(isValidBpm(Number.NaN), false);
  assert.equal(isValidBpm(Infinity), false);
});

test('parseBpmInput returns a valid integer BPM or null', () => {
  assert.equal(parseBpmInput('60'), 60);
  assert.equal(parseBpmInput(' 72 '), 72);
  assert.equal(parseBpmInput(''), null);
  assert.equal(parseBpmInput('abc'), null);
  assert.equal(parseBpmInput('60.5'), null);
  assert.equal(parseBpmInput('29'), null);
  assert.equal(parseBpmInput('241'), null);
});

test('getClickIntervalMs converts BPM to milliseconds per click', () => {
  assert.equal(getClickIntervalMs(60), 1000);
  assert.equal(getClickIntervalMs(80), 750);
  assert.equal(getClickIntervalMs(120), 500);
});

test('shufflePitches returns every pitch exactly once without mutating the source pitch list', () => {
  const randomValues = [0.1, 0.8, 0.3, 0.6, 0.2, 0.9, 0.4, 0.7, 0.05, 0.55, 0.15];
  let index = 0;
  const random = () => randomValues[index++];
  const original = [...PITCHES];

  const shuffled = shufflePitches(random);

  assert.deepEqual(PITCHES, original);
  assert.equal(shuffled.length, 12);
  assert.deepEqual([...shuffled].sort(), [...PITCHES].sort());
  assert.notDeepEqual(shuffled, PITCHES);
});

test('createIdleState returns the idle defaults', () => {
  assert.deepEqual(createIdleState(), {
    phase: 'idle',
    bpm: 60,
    order: [],
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  });
});

test('startRound validates BPM and creates a count-in state with a shuffled order', () => {
  const order = [...PITCHES].reverse();
  const state = startRound(72, () => order);

  assert.deepEqual(state, {
    phase: 'countin',
    bpm: 72,
    order,
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  });

  assert.throws(() => startRound(20, () => order), /BPM must be an integer from 30 to 240/);
});

test('advanceAfterClick moves four count-in clicks into the first visible pitch', () => {
  const order = [...PITCHES];
  let state = startRound(60, () => order);

  state = advanceAfterClick(state);
  assert.equal(state.phase, 'countin');
  assert.equal(state.countInBeat, 2);

  state = advanceAfterClick(state);
  state = advanceAfterClick(state);
  assert.equal(state.phase, 'countin');
  assert.equal(state.countInBeat, 4);

  state = advanceAfterClick(state);
  assert.equal(state.phase, 'running');
  assert.equal(state.noteIndex, 0);
  assert.equal(state.beatInNote, 1);
});

test('advanceAfterClick gives each pitch six clicks, advances notes, and stops after the final pitch', () => {
  const order = [...PITCHES];
  let state = { ...startRound(60, () => order), phase: 'running' };

  for (let expectedBeat = 2; expectedBeat <= 6; expectedBeat += 1) {
    state = advanceAfterClick(state);
    assert.equal(state.phase, 'running');
    assert.equal(state.noteIndex, 0);
    assert.equal(state.beatInNote, expectedBeat);
  }

  state = advanceAfterClick(state);
  assert.equal(state.phase, 'running');
  assert.equal(state.noteIndex, 1);
  assert.equal(state.beatInNote, 1);

  for (let i = 0; i < 66; i += 1) {
    state = advanceAfterClick(state);
  }

  assert.equal(state.phase, 'done');
  assert.equal(state.noteIndex, 11);
  assert.equal(state.beatInNote, 6);
});

test('getViewModel describes the idle screen', () => {
  assert.deepEqual(getViewModel(createIdleState()), {
    phase: 'idle',
    heading: 'FretFlash',
    prompt: 'Ready',
    status: 'Play the displayed pitch on all 6 strings, frets 0–12, one string per click.',
    detail: 'String order: low E → A → D → G → B → high E.',
    beat: '',
    note: '',
    previewLabel: '',
    preview: '',
    primaryButton: 'Start',
    showBpm: true,
    showStop: false,
  });
});

test('getViewModel describes count-in progress', () => {
  const state = { ...startRound(80, () => [...PITCHES]), countInBeat: 3 };

  assert.deepEqual(getViewModel(state), {
    phase: 'countin',
    heading: 'FretFlash',
    prompt: 'Get ready',
    status: 'Count-in: 3 / 4',
    detail: '',
    beat: '',
    note: '',
    previewLabel: 'Starting note',
    preview: 'C',
    primaryButton: '',
    showBpm: false,
    showStop: true,
  });
});

test('getViewModel describes running pitch progress', () => {
  const state = { ...startRound(60, () => ['Ab', ...PITCHES.filter((pitch) => pitch !== 'Ab')]), phase: 'running', beatInNote: 3 };

  assert.deepEqual(getViewModel(state), {
    phase: 'running',
    heading: 'FretFlash',
    prompt: 'Ab',
    status: '',
    detail: '',
    beat: 'Beat 3 / 6',
    note: 'Note 1 / 12',
    previewLabel: 'Next',
    preview: 'C',
    primaryButton: '',
    showBpm: false,
    showStop: true,
  });
});

test('getViewModel describes the done screen', () => {
  const state = { ...startRound(60, () => [...PITCHES]), phase: 'done', noteIndex: 11, beatInNote: 6 };

  assert.deepEqual(getViewModel(state), {
    phase: 'done',
    heading: 'FretFlash',
    prompt: 'Done',
    status: '',
    detail: '',
    beat: '',
    note: '',
    previewLabel: '',
    preview: '',
    primaryButton: 'Start again',
    showBpm: true,
    showStop: false,
  });
});

test('getViewModel previews Done on the final running note', () => {
  const state = { ...startRound(60, () => [...PITCHES]), phase: 'running', noteIndex: 11, beatInNote: 4 };

  assert.equal(getViewModel(state).previewLabel, 'Next');
  assert.equal(getViewModel(state).preview, 'Done');
});

test('renderHtml renders idle controls and validation errors', () => {
  const html = renderHtml(getViewModel(createIdleState()), 60, 'Choose a BPM between 30 and 240.');

  assert.match(html, /<label for="bpm">BPM<\/label>/);
  assert.match(html, /<input id="bpm"/);
  assert.match(html, /value="60"/);
  assert.match(html, /<button id="start-button" type="button">Start<\/button>/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Choose a BPM between 30 and 240\./);
});

test('renderHtml renders count-in with starting-note preview', () => {
  const state = { ...startRound(80, () => ['Eb', ...PITCHES.filter((pitch) => pitch !== 'Eb')]), countInBeat: 2 };
  const html = renderHtml(getViewModel(state), 80);

  assert.match(html, /Get ready/);
  assert.match(html, /Count-in: 2 \/ 4/);
  assert.match(html, /<div class="preview" aria-label="Starting note"><span>Starting note<\/span><strong>Eb<\/strong><\/div>/);
});

test('renderHtml renders running progress and stop control without BPM input', () => {
  const state = { ...startRound(60, () => ['Ab', ...PITCHES.filter((pitch) => pitch !== 'Ab')]), phase: 'running', beatInNote: 3 };
  const html = renderHtml(getViewModel(state), 60);

  assert.match(html, /<div class="prompt" aria-live="polite">Ab<\/div>/);
  assert.match(html, /<div class="preview" aria-label="Next note"><span>Next<\/span><strong>C<\/strong><\/div>/);
  assert.match(html, /Beat 3 \/ 6/);
  assert.match(html, /Note 1 \/ 12/);
  assert.match(html, /<button id="stop-button" type="button">Stop<\/button>/);
  assert.doesNotMatch(html, /<input id="bpm"/);
});

test('renderHtml renders Done as the final-note preview', () => {
  const state = { ...startRound(60, () => [...PITCHES]), phase: 'running', noteIndex: 11, beatInNote: 4 };
  const html = renderHtml(getViewModel(state), 60);

  assert.match(html, /<div class="prompt" aria-live="polite">B<\/div>/);
  assert.match(html, /<div class="preview" aria-label="Next note"><span>Next<\/span><strong>Done<\/strong><\/div>/);
});

test('renderHtml renders done with a start-again button', () => {
  const state = { ...startRound(60, () => [...PITCHES]), phase: 'done', noteIndex: 11, beatInNote: 6 };
  const html = renderHtml(getViewModel(state), 72);

  assert.match(html, /<div class="prompt" aria-live="polite">Done<\/div>/);
  assert.match(html, /value="72"/);
  assert.match(html, /<button id="start-button" type="button">Start again<\/button>/);
});

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
    createOrder: () => [...PITCHES],
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

  const started = harness.controller.start('20');

  assert.equal(started, false);
  assert.equal(harness.scheduled, null);
  assert.equal(harness.renders.at(-1).error, 'Choose a BPM between 30 and 240.');
  assert.equal(harness.renders.at(-1).state.phase, 'idle');
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
    createOrder: () => [...PITCHES],
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
  assert.equal(harness.renders.at(-1).state.countInBeat, 1);
});

test('createAppController clears an existing timer before starting a new round', () => {
  const harness = createControllerHarness();

  harness.controller.start('60');
  harness.controller.start('80');

  assert.deepEqual(harness.clearedTimers, [1]);
  assert.equal(harness.scheduled.id, 2);
  assert.equal(harness.scheduled.intervalMs, 750);
});

test('createAppController tick plays a click and advances state', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');

  harness.scheduled.callback();

  assert.deepEqual(harness.clicks, ['click']);
  assert.equal(harness.renders.at(-1).state.phase, 'countin');
  assert.equal(harness.renders.at(-1).state.countInBeat, 2);
});

test('createAppController stop clears the active timer and returns to idle with the selected BPM', () => {
  const harness = createControllerHarness();
  harness.controller.start('72');

  harness.controller.stop();

  assert.deepEqual(harness.clearedTimers, [1]);
  assert.equal(harness.renders.at(-1).state.phase, 'idle');
  assert.equal(harness.renders.at(-1).state.bpm, 72);
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
    createOrder: () => {
      orderCall += 1;
      return orderCall === 1 ? firstOrder : secondOrder;
    },
  });

  controller.start('60');
  for (let i = 0; i < 76; i += 1) {
    scheduled.callback();
  }
  controller.start('60');

  assert.equal(renders.at(-1).state.phase, 'countin');
  assert.deepEqual(renders.at(-1).state.order, secondOrder);
});

test('createWebAudioClickPlayer prepare fails when AudioContext is unavailable', () => {
  const player = createWebAudioClickPlayer(undefined);

  assert.throws(() => player.prepare(), /Web Audio is not available/);
});

test('createWebAudioClickPlayer prepares context and plays a short click', () => {
  const events = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 10;
      this.destination = 'destination';
    }

    resume() {
      events.push('resume');
      this.state = 'running';
    }

    createOscillator() {
      return {
        type: '',
        frequency: {
          setValueAtTime: (value, time) => events.push(['frequency', value, time]),
        },
        connect: () => events.push('oscillator-connect'),
        start: (time) => events.push(['start', time]),
        stop: (time) => events.push(['stop', time]),
      };
    }

    createGain() {
      return {
        gain: {
          setValueAtTime: (value, time) => events.push(['gain-set', value, time]),
          exponentialRampToValueAtTime: (value, time) => events.push(['gain-ramp', value, time]),
        },
        connect: (destination) => events.push(['gain-connect', destination]),
      };
    }
  }

  const player = createWebAudioClickPlayer(FakeAudioContext);

  player.prepare();
  player.play();

  assert.equal(events[0], 'resume');
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'frequency'), ['frequency', 1200, 10]);
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'start'), ['start', 10]);
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'stop'), ['stop', 10.05]);
});

