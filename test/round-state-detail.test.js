import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PITCHES,
  DEFAULT_SELECTED_LABELS,
  createTuningStrings,
} from '../src/music.js';

import {
  DEFAULT_BPM,
  DEFAULT_FRET_RANGE,
  DEFAULT_LOCATION_MODE,
  createSetup,
} from '../src/settings.js';

import {
  advanceAfterClick,
  createIdleState,
  startRound,
} from '../src/state.js';

import {
  createRangeFilteredRound,
  getAvailableStringsForLabelInRange,
  getAvailableTargetsForLabelInRange,
  getRoundClickCount,
  getClickIntervalMs,
  formatRoundDuration,
  shuffleSelectedLabels,
} from '../src/round.js';

import { getViewModel } from '../src/view-model.js';
test('range filtering keeps only strings where the note exists inside the custom fret range', () => {
  assert.deepEqual(getAvailableStringsForLabelInRange('Ab', { from: 5, to: 9 }), [
    { number: 4, label: 'D', pitch: 'D' },
    { number: 2, label: 'B', pitch: 'B' },
  ]);
  assert.deepEqual(getAvailableStringsForLabelInRange('C', { from: 0, to: 5 }), [
    { number: 5, label: 'A', pitch: 'A' },
    { number: 3, label: 'G', pitch: 'G' },
    { number: 2, label: 'B', pitch: 'B' },
  ]);
  assert.deepEqual(getAvailableStringsForLabelInRange('A', { from: 7, to: 12 }), [
    { number: 5, label: 'A', pitch: 'A' },
    { number: 4, label: 'D', pitch: 'D' },
    { number: 2, label: 'B', pitch: 'B' },
  ]);
  assert.deepEqual(getAvailableStringsForLabelInRange('E', { from: 12, to: 24 }), [
    { number: 6, label: 'E', pitch: 'E' },
    { number: 5, label: 'A', pitch: 'A' },
    { number: 4, label: 'D', pitch: 'D' },
    { number: 3, label: 'G', pitch: 'G' },
    { number: 2, label: 'B', pitch: 'B' },
    { number: 1, label: 'e', pitch: 'E' },
  ]);
});

test('range filtering skips unavailable labels and keeps enharmonic labels separate', () => {
  assert.deepEqual(getAvailableStringsForLabelInRange('F', 'unknown'), []);

  const round = createRangeFilteredRound(['F'], { from: 4, to: 4 }, (groups) => groups);

  assert.deepEqual(round, []);

  const enharmonicRound = createRangeFilteredRound(['C#', 'Db'], { from: 5, to: 9 }, (groups) => groups);

  assert.deepEqual(enharmonicRound.map((group) => group.label), ['C#', 'Db']);
  assert.deepEqual(enharmonicRound[0].targets, enharmonicRound[1].targets);
  assert.deepEqual(enharmonicRound[0].targets, [
    { number: 6, label: 'E', pitch: 'E' },
    { number: 3, label: 'G', pitch: 'G' },
    { number: 1, label: 'e', pitch: 'E' },
  ]);
});

test('all-in-range generation emits one target per matching fret location', () => {
  assert.deepEqual(getAvailableTargetsForLabelInRange('C', { from: 0, to: 24 }, 'all-in-range'), [
    { number: 6, label: 'E', pitch: 'E', fret: 8 },
    { number: 6, label: 'E', pitch: 'E', fret: 20 },
    { number: 5, label: 'A', pitch: 'A', fret: 3 },
    { number: 5, label: 'A', pitch: 'A', fret: 15 },
    { number: 4, label: 'D', pitch: 'D', fret: 10 },
    { number: 4, label: 'D', pitch: 'D', fret: 22 },
    { number: 3, label: 'G', pitch: 'G', fret: 5 },
    { number: 3, label: 'G', pitch: 'G', fret: 17 },
    { number: 2, label: 'B', pitch: 'B', fret: 1 },
    { number: 2, label: 'B', pitch: 'B', fret: 13 },
    { number: 1, label: 'e', pitch: 'E', fret: 8 },
    { number: 1, label: 'e', pitch: 'E', fret: 20 },
  ]);
  assert.deepEqual(getAvailableTargetsForLabelInRange('C', { from: 0, to: 24 }, 'one-per-string'), [
    { number: 6, label: 'E', pitch: 'E' },
    { number: 5, label: 'A', pitch: 'A' },
    { number: 4, label: 'D', pitch: 'D' },
    { number: 3, label: 'G', pitch: 'G' },
    { number: 2, label: 'B', pitch: 'B' },
    { number: 1, label: 'e', pitch: 'E' },
  ]);
});

test('fret-constrained round shuffles surviving note groups without flattening targets', () => {
  const round = createRangeFilteredRound(['C', 'Ab'], { from: 5, to: 9 }, (groups) => [...groups].reverse());

  assert.deepEqual(round.map((group) => group.label), ['Ab', 'C']);
  assert.deepEqual(round.map((group) => group.targets.length), [2, 3]);
  assert.equal(Object.hasOwn(round[0], 'strings'), false);
  assert.equal(getRoundClickCount(round), 5);
});

test('all-in-range round preserves string order and counts repeated locations', () => {
  const round = createRangeFilteredRound(['C'], { from: 0, to: 24 }, (groups) => groups, 'all-in-range');

  assert.equal(round.length, 1);
  assert.deepEqual(round[0].targets.map((target) => `${target.number}:${target.fret}`), [
    '6:8',
    '6:20',
    '5:3',
    '5:15',
    '4:10',
    '4:22',
    '3:5',
    '3:17',
    '2:1',
    '2:13',
    '1:8',
    '1:20',
  ]);
  assert.equal(getRoundClickCount(round), 12);
});

test('range filtering uses active tuning and selected string subset', () => {
  const dropD = createTuningStrings(['D', 'A', 'D', 'G', 'B', 'e']);

  assert.deepEqual(getAvailableStringsForLabelInRange('D', { from: 0, to: 0 }, dropD), [
    { number: 6, label: 'D', pitch: 'D' },
    { number: 4, label: 'D', pitch: 'D' },
  ]);

  assert.deepEqual(getAvailableTargetsForLabelInRange('D', { from: 0, to: 12 }, 'all-in-range', dropD, [0]), [
    { number: 6, label: 'D', pitch: 'D', fret: 0 },
    { number: 6, label: 'D', pitch: 'D', fret: 12 },
  ]);

  const round = createRangeFilteredRound(['D'], { from: 0, to: 0 }, (groups) => groups, 'one-per-string', dropD, [0, 2]);
  assert.deepEqual(round[0].targets, [
    { number: 6, label: 'D', pitch: 'D' },
    { number: 4, label: 'D', pitch: 'D' },
  ]);
});

test('range filtering normalizes custom tuning accidentals by sound, not spelling', () => {
  const sharpTuning = createTuningStrings(['F#', 'B', 'E', 'A', 'D', 'G']);
  const enharmonicTuning = createTuningStrings(['B#', 'E', 'A', 'D', 'G', 'B']);

  assert.deepEqual(sharpTuning[0], { number: 6, label: 'F#', pitch: 'Gb' });
  assert.deepEqual(getAvailableStringsForLabelInRange('F#', { from: 0, to: 0 }, sharpTuning), [
    { number: 6, label: 'F#', pitch: 'Gb' },
  ]);
  assert.deepEqual(getAvailableStringsForLabelInRange('C', { from: 0, to: 0 }, enharmonicTuning), [
    { number: 6, label: 'B#', pitch: 'C' },
  ]);
});

test('getClickIntervalMs converts BPM to milliseconds per click', () => {
  assert.equal(getClickIntervalMs(60), 1000);
  assert.equal(getClickIntervalMs(80), 750);
  assert.equal(getClickIntervalMs(120), 500);
});

test('formatRoundDuration renders human-readable time from clicks and BPM', () => {
  assert.equal(formatRoundDuration(72, 60), '1m 12s');
  assert.equal(formatRoundDuration(5, 60), '5s');
  assert.equal(formatRoundDuration(30, 80), '23s');
  assert.equal(formatRoundDuration(300, 90), '3m 20s');
});

function defaultTuningSettings() {
  return {
    tuning: { id: 'standard-6', strings: ['E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 1, 2, 3, 4, 5],
  };
}

function orderLabels(order) {
  return order.map((item) => (typeof item === 'string' ? item : item.label));
}

function testIdleState(
  bpm = DEFAULT_BPM,
  selectedLabels = DEFAULT_SELECTED_LABELS,
  fretRange = DEFAULT_FRET_RANGE,
  locationMode = DEFAULT_LOCATION_MODE,
  tuning = defaultTuningSettings().tuning,
  selectedStringIndexes = defaultTuningSettings().selectedStringIndexes,
) {
  return createIdleState({ bpm, selectedLabels, fretRange, locationMode, tuning, selectedStringIndexes });
}

function testStartRound(bpm, selectedLabels, createOrder = shuffleSelectedLabels, options = {}) {
  return startRound({ bpm, selectedLabels, ...options }, createOrder);
}

function orderGroupsByLabels(labels) {
  return (groups) => labels
    .map((label) => groups.find((group) => group.label === label))
    .filter(Boolean);
}

test('shuffleSelectedLabels returns every selected label once without enharmonic deduping', () => {
  const selectedLabels = ['C#', 'Db', 'B#', 'C'];
  const randomValues = [0.9, 0.1, 0.6];
  let index = 0;

  const shuffled = shuffleSelectedLabels(selectedLabels, () => randomValues[index++]);

  assert.deepEqual(selectedLabels, ['C#', 'Db', 'B#', 'C']);
  assert.equal(shuffled.length, 4);
  assert.deepEqual([...shuffled].sort(), ['B#', 'C', 'C#', 'Db']);
});

test('shuffleSelectedLabels supports one-note targeted rounds', () => {
  assert.deepEqual(shuffleSelectedLabels(['Bb'], () => 0.5), ['Bb']);
});

test('createIdleState accepts a setup object as the preferred API', () => {
  const state = createIdleState(createSetup({
    bpm: 72,
    selectedLabels: ['C#', 'Db'],
    fretRange: { from: 3, to: 7 },
    locationMode: 'all-in-range',
    tuning: { id: 'custom', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [6, 0],
  }));

  assert.equal(state.phase, 'idle');
  assert.equal(state.bpm, 72);
  assert.deepEqual(state.selectedLabels, ['C#', 'Db']);
  assert.deepEqual(state.fretRange, { from: 3, to: 7 });
  assert.equal(state.locationMode, 'all-in-range');
  assert.deepEqual(state.tuning, { id: 'custom', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] });
  assert.deepEqual(state.selectedStringIndexes, [0, 6]);
});

test('createIdleState rejects legacy positional setup arguments', () => {
  assert.throws(() => createIdleState(72), /setup object/);
});

test('createIdleState returns the idle defaults', () => {
  assert.deepEqual(createIdleState(), {
    phase: 'idle',
    bpm: DEFAULT_BPM,
    order: [],
    selectedLabels: DEFAULT_SELECTED_LABELS,
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  });
});

test('createIdleState accepts selected note labels, custom fret range, location mode, tuning, and selected strings', () => {
  const state = createIdleState({
    bpm: 72,
    selectedLabels: ['C#', 'Db'],
    fretRange: { from: 3, to: 7 },
    locationMode: 'all-in-range',
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 2, 6],
  });

  assert.deepEqual(state.selectedLabels, ['C#', 'Db']);
  assert.deepEqual(state.fretRange, { from: 3, to: 7 });
  assert.equal(state.locationMode, 'all-in-range');
  assert.deepEqual(state.tuning, { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] });
  assert.deepEqual(state.selectedStringIndexes, [0, 2, 6]);
});

test('startRound accepts a setup object as the preferred API', () => {
  const setup = createSetup({
    bpm: 72,
    selectedLabels: ['Ab', 'C'],
    fretRange: { from: 5, to: 9 },
    locationMode: 'all-in-range',
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [6, 0],
  });
  const createOrder = (groups) => [...groups].reverse();

  const state = startRound(setup, createOrder);

  assert.equal(state.bpm, 72);
  assert.deepEqual(orderLabels(state.order), ['C', 'Ab']);
  assert.deepEqual(state.fretRange, { from: 5, to: 9 });
  assert.equal(state.locationMode, 'all-in-range');
  assert.deepEqual(state.selectedStringIndexes, [0, 6]);
});

test('startRound rejects legacy positional setup arguments', () => {
  assert.throws(() => startRound(72, ['C']), /setup object/);
});

test('startRound validates BPM and creates a count-in state with a shuffled grouped order', () => {
  const order = [...PITCHES].reverse();
  const state = testStartRound(72, PITCHES, orderGroupsByLabels(order));

  assert.equal(state.phase, 'countin');
  assert.equal(state.bpm, 72);
  assert.deepEqual(orderLabels(state.order), order);
  assert.deepEqual(state.order.map((group) => group.targets.length), Array.from({ length: PITCHES.length }, () => 6));
  assert.deepEqual(state.selectedLabels, PITCHES);
  assert.deepEqual(state.fretRange, { from: 0, to: 12 });
  assert.equal(state.locationMode, 'one-per-string');
  assert.deepEqual(state.tuning, defaultTuningSettings().tuning);
  assert.deepEqual(state.selectedStringIndexes, defaultTuningSettings().selectedStringIndexes);
  assert.equal(state.noteIndex, 0);
  assert.equal(state.beatInNote, 1);
  assert.equal(state.countInBeat, 1);

  assert.throws(() => testStartRound(19, PITCHES, orderGroupsByLabels(order)), /BPM must be an integer from 20 to 240/);
  for (const bpm of [null, '72', 72.5, 19, 241]) {
    assert.throws(() => startRound({ bpm, selectedLabels: PITCHES }, orderGroupsByLabels(order)), /BPM must be an integer from 20 to 240/);
  }
});

test('startRound creates dynamic selected-label rounds without enharmonic deduping', () => {
  const state = testStartRound(60, ['C#', 'Db'], (labels) => [...labels].reverse());

  assert.deepEqual(orderLabels(state.order), ['Db', 'C#']);
  assert.deepEqual(state.selectedLabels, ['C#', 'Db']);
});

test('startRound uses active tuning and selected strings for full-range click count and cues', () => {
  const state = testStartRound(60, ['C'], (labels) => labels, {
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 6],
  });

  assert.deepEqual(state.selectedStringIndexes, [0, 6]);
  assert.equal(getRoundClickCount(state.order), 2);
  assert.equal(getViewModel({ ...state, phase: 'running', beatInNote: 1 }).stringCue, 'String 7 · B');
  assert.equal(getViewModel({ ...state, phase: 'running', beatInNote: 2 }).stringCue, 'String 1 · e');
});

test('startRound creates variable-length fret-constrained note groups', () => {
  const state = testStartRound(60, ['Ab', 'C'], (groups) => [...groups].reverse(), {
    fretRange: { from: 5, to: 9 },
  });

  assert.deepEqual(state.fretRange, { from: 5, to: 9 });
  assert.equal(state.locationMode, 'one-per-string');
  assert.deepEqual(state.order.map((group) => group.label), ['C', 'Ab']);
  assert.deepEqual(state.order.map((group) => group.targets.length), [3, 2]);
});

test('startRound creates all-in-range repeated location targets', () => {
  const state = testStartRound(60, ['C'], (groups) => groups, {
    fretRange: { from: 0, to: 24 },
    locationMode: 'all-in-range',
  });

  assert.equal(state.locationMode, 'all-in-range');
  assert.equal(state.order[0].targets.length, 12);
  assert.deepEqual(state.order[0].targets.slice(0, 2), [
    { number: 6, label: 'E', pitch: 'E', fret: 8 },
    { number: 6, label: 'E', pitch: 'E', fret: 20 },
  ]);
});

test('advanceAfterClick uses filtered target counts', () => {
  let state = {
    ...testStartRound(60, ['Ab', 'C'], (groups) => groups, { fretRange: { from: 5, to: 9 } }),
    phase: 'running',
  };

  assert.equal(state.order[0].targets.length, 2);
  state = advanceAfterClick(state);
  assert.equal(state.phase, 'running');
  assert.equal(state.noteIndex, 0);
  assert.equal(state.beatInNote, 2);

  state = advanceAfterClick(state);
  assert.equal(state.phase, 'running');
  assert.equal(state.noteIndex, 1);
  assert.equal(state.beatInNote, 1);

  state = advanceAfterClick(state);
  state = advanceAfterClick(state);
  state = advanceAfterClick(state);
  assert.equal(state.phase, 'done');
  assert.equal(state.noteIndex, 1);
  assert.equal(state.beatInNote, 3);
});

test('advanceAfterClick uses all-in-range target counts and repeated string cues', () => {
  let state = {
    ...testStartRound(60, ['C'], (groups) => groups, { fretRange: { from: 0, to: 24 }, locationMode: 'all-in-range' }),
    phase: 'running',
  };

  assert.equal(getViewModel(state).stringCue, 'String 6 · E');
  assert.equal(getViewModel(state).beat, 'Beat 1 / 12');
  state = advanceAfterClick(state);
  assert.equal(state.phase, 'running');
  assert.equal(state.beatInNote, 2);
  assert.equal(getViewModel(state).stringCue, 'String 6 · E');
  assert.equal(getViewModel(state).beat, 'Beat 2 / 12');

  for (let i = 0; i < 11; i += 1) {
    state = advanceAfterClick(state);
  }
  assert.equal(state.phase, 'done');
  assert.equal(state.beatInNote, 12);
});

test('getViewModel renders fret-constrained count-in and running progress', () => {
  const idle = getViewModel(createIdleState({ bpm: 60, selectedLabels: ['Ab', 'C'], fretRange: { from: 5, to: 9 } }));
  assert.match(idle.status, /selected fret range/);
  assert.equal(idle.detail, 'Frets 5–9, selected strings bottom-to-top.');

  const state = testStartRound(60, ['Ab', 'C'], (groups) => groups, { fretRange: { from: 5, to: 9 } });
  const countIn = getViewModel(state);

  assert.equal(countIn.preview, 'Ab');
  assert.equal(countIn.stringCue, 'String 4 · D');
  assert.equal(countIn.beat, 'Beat 1 / 2');
  assert.equal(countIn.fretRange, 'Frets 5–9');

  const running = getViewModel({ ...state, phase: 'running', beatInNote: 2 });
  assert.equal(running.prompt, 'Ab');
  assert.equal(running.stringCue, 'String 2 · B');
  assert.equal(running.fretRange, 'Frets 5–9');
  assert.equal(running.beat, 'Beat 2 / 2');
  assert.equal(running.note, 'Note 1 / 2');
  assert.equal(running.preview, 'C');
});

test('getViewModel keeps full-range progress unchanged', () => {
  const order = [...PITCHES];
  let state = testStartRound(60, PITCHES, orderGroupsByLabels(order));

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
  let state = { ...testStartRound(60, PITCHES, orderGroupsByLabels(order)), phase: 'running' };

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

test('advanceAfterClick supports selected-label rounds of any length', () => {
  let state = { ...testStartRound(60, ['C#', 'Db'], (labels) => labels), phase: 'running' };

  for (let i = 0; i < 6; i += 1) {
    state = advanceAfterClick(state);
  }

  assert.equal(state.phase, 'running');
  assert.equal(state.noteIndex, 1);
  assert.equal(state.beatInNote, 1);

  for (let i = 0; i < 6; i += 1) {
    state = advanceAfterClick(state);
  }

  assert.equal(state.phase, 'done');
  assert.equal(state.noteIndex, 1);
  assert.equal(state.beatInNote, 6);
});

test('getViewModel covers idle, count-in, running, and done essentials', () => {
  const idle = getViewModel(createIdleState());
  assert.equal(idle.prompt, 'Ready');
  assert.equal(idle.primaryButton, 'Start');
  assert.equal(idle.showBpm, true);

  const countIn = getViewModel({ ...testStartRound(80, PITCHES, orderGroupsByLabels([...PITCHES])), countInBeat: 3 });
  assert.equal(countIn.prompt, 'Get ready');
  assert.equal(countIn.status, 'Count-in: 2 / 4');
  assert.equal(countIn.beat, 'Beat 1 / 6');
  assert.equal(countIn.previewLabel, 'Starting note');
  assert.equal(countIn.preview, 'C');
  assert.equal(countIn.stringCueLabel, 'Starts on');
  assert.equal(countIn.stringCue, 'String 6 · E');
  assert.equal(countIn.showStop, true);

  const running = getViewModel({
    ...testStartRound(60, ['C#', 'Db'], orderGroupsByLabels(['C#', 'Db'])),
    phase: 'running',
    noteIndex: 1,
    beatInNote: 4,
  });
  assert.equal(running.prompt, 'Db');
  assert.equal(running.beat, 'Beat 4 / 6');
  assert.equal(running.stringCueLabel, 'Current string');
  assert.equal(running.stringCue, 'String 3 · G');
  assert.equal(running.note, 'Note 2 / 2');
  assert.equal(running.previewLabel, 'Next');
  assert.equal(running.preview, 'Done');

  const doneState = testStartRound(60, PITCHES, orderGroupsByLabels([...PITCHES]));
  const done = getViewModel({
    ...doneState,
    phase: 'done',
    noteIndex: 11,
    beatInNote: 6,
    completedOrder: doneState.order,
  });
  assert.equal(done.prompt, 'Done.');
  assert.equal(done.primaryButton, 'Shuffle');
  assert.equal(done.showSameOrder, true);
  assert.equal(done.showBpm, true);
});

test('getViewModel maps running beats to the fixed string cue and resets on the next note', () => {
  const order = ['C', 'D'];
  const cues = [];
  let state = { ...testStartRound(60, order, orderGroupsByLabels(order)), phase: 'running' };

  for (let i = 0; i < 6; i += 1) {
    cues.push(getViewModel(state).stringCue);
    state = advanceAfterClick(state);
  }

  assert.deepEqual(cues, [
    'String 6 · E',
    'String 5 · A',
    'String 4 · D',
    'String 3 · G',
    'String 2 · B',
    'String 1 · e',
  ]);
  assert.equal(state.noteIndex, 1);
  assert.equal(state.beatInNote, 1);
  assert.equal(getViewModel(state).stringCue, 'String 6 · E');
});

test('getViewModel displays count-in numbers descending while internal beats advance upward', () => {
  const state = testStartRound(80, ['C'], orderGroupsByLabels(['C']));
  const displays = [];
  let current = state;

  while (current.phase === 'countin') {
    const view = getViewModel(current);
    displays.push({ status: view.status, beat: view.beat });
    current = advanceAfterClick(current);
  }

  assert.deepEqual(displays, [
    { status: 'Count-in: 4 / 4', beat: 'Beat 1 / 6' },
    { status: 'Count-in: 3 / 4', beat: 'Beat 1 / 6' },
    { status: 'Count-in: 2 / 4', beat: 'Beat 1 / 6' },
    { status: 'Count-in: 1 / 4', beat: 'Beat 1 / 6' },
  ]);
  assert.equal(current.phase, 'running');
  assert.equal(current.countInBeat, 4);
});
