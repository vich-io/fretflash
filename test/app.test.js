import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import {
  PITCHES,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_SELECTED_LABELS,
  DRILL_MODES,
  DEFAULT_DRILL_MODE,
  DEFAULT_FRET_RANGE,
  LOCATION_MODES,
  DEFAULT_LOCATION_MODE,
  TUNING_PRESETS,
  DEFAULT_TUNING,
  DEFAULT_SELECTED_STRING_INDEXES,
  parseTuningInput,
  createTuningStrings,
  normalizeSelectedStringIndexes,
  NOTE_PRESETS,
  NOTE_PROMPTS,
  SETTINGS_STORAGE_KEY,
  STRING_ORDER,
  createRangeFilteredRound,
  getAvailableStringsForLabelInRange,
  getAvailableTargetsForLabelInRange,
  getRoundClickCount,
  isValidDrillMode,
  isValidFretRange,
  isValidLocationMode,
  isValidNoteSelection,
  advanceAfterClick,
  createIdleState,
  createAppController,
  createWebAudioClickPlayer,
  getViewModel,
  isValidBpm,
  getClickIntervalMs,
  formatRoundDuration,
  parseBpmInput,
  parseFretBoundInput,
  parseSavedSettings,
  loadSettings,
  renderHtml,
  saveSettings,
  shuffleSelectedLabels,
  startRound,
} from '../app.js';

// Static file and CSS contract tests
const requiredFiles = ['index.html', 'style.css', 'app.js'];

test('static app entry files exist', async () => {
  await Promise.all(requiredFiles.map((path) => access(path)));
});

test('index.html loads the local stylesheet and app module', async () => {
  const html = await readFile('index.html', 'utf8');

  assert.match(html, /<link rel="stylesheet" href="style\.css">/);
  assert.match(html, /<script type="module" src="app\.js"><\/script>/);
});

test('primary prompt typography does not use negative tracking', async () => {
  const css = await readFile('style.css', 'utf8');

  assert.match(css, /\.prompt \{[^}]*letter-spacing: 0;/s);
});

// Musical model, prompt pool, and fret-range helpers
test('v0 pitch set uses all 12 flat-spelled pitch classes', () => {
  assert.deepEqual(PITCHES, ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
});

test('note prompt model exposes all 21 single-accidental labels grouped enharmonically', () => {
  assert.deepEqual(
    NOTE_PROMPTS.map((prompt) => prompt.label),
    ['B#', 'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'Fb', 'E#', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb'],
  );
  assert.equal(new Set(NOTE_PROMPTS.map((prompt) => prompt.label)).size, 21);
  assert.deepEqual(
    NOTE_PROMPTS.filter((prompt) => prompt.soundGroup === 'C').map((prompt) => prompt.label),
    ['B#', 'C'],
  );
  assert.deepEqual(
    NOTE_PROMPTS.filter((prompt) => prompt.soundGroup === 'C#/Db').map((prompt) => prompt.label),
    ['C#', 'Db'],
  );
});

test('default selected labels preserve the validated v0 flat chromatic round', () => {
  assert.deepEqual(DEFAULT_SELECTED_LABELS, PITCHES);
});

test('note presets match the configurable note pool spec', () => {
  assert.deepEqual(NOTE_PRESETS.flats, ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
  assert.deepEqual(NOTE_PRESETS.sharps, ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
  assert.deepEqual(NOTE_PRESETS.naturals, ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  assert.deepEqual(NOTE_PRESETS.all, ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'E#', 'Fb', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'B#', 'Cb']);
  assert.deepEqual(NOTE_PRESETS.clear, []);
});

test('note selection validation rejects empty, unknown, and duplicate labels', () => {
  assert.equal(isValidNoteSelection(['C']), true);
  assert.equal(isValidNoteSelection(['C#', 'Db']), true);

  assert.equal(isValidNoteSelection([]), false);
  assert.equal(isValidNoteSelection(['H']), false);
  assert.equal(isValidNoteSelection(['C', 'C']), false);
});

test('default tuning preserves the six-string standard guitar task', () => {
  assert.deepEqual(TUNING_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, strings: preset.strings })), [
    { id: 'standard-6', label: 'Standard', strings: ['E', 'A', 'D', 'G', 'B', 'e'] },
    { id: 'drop-d', label: 'Drop D', strings: ['D', 'A', 'D', 'G', 'B', 'e'] },
    { id: 'd-standard', label: 'D standard', strings: ['D', 'G', 'C', 'F', 'A', 'd'] },
    { id: 'standard-7', label: '7-string standard', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
  ]);
  assert.deepEqual(DEFAULT_TUNING, { id: 'standard-6', strings: ['E', 'A', 'D', 'G', 'B', 'e'] });
  assert.deepEqual(STRING_ORDER, [
    { number: 6, label: 'E', pitch: 'E' },
    { number: 5, label: 'A', pitch: 'A' },
    { number: 4, label: 'D', pitch: 'D' },
    { number: 3, label: 'G', pitch: 'G' },
    { number: 2, label: 'B', pitch: 'B' },
    { number: 1, label: 'e', pitch: 'E' },
  ]);
  assert.deepEqual(DEFAULT_SELECTED_STRING_INDEXES, [0, 1, 2, 3, 4, 5]);
});

test('custom tuning parser preserves labels and normalizes pitch classes', () => {
  assert.deepEqual(parseTuningInput('B E A D G B e'), {
    id: 'custom',
    strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'],
  });
  assert.deepEqual(createTuningStrings(['B', 'E', 'A', 'D', 'G', 'B', 'e']), [
    { number: 7, label: 'B', pitch: 'B' },
    { number: 6, label: 'E', pitch: 'E' },
    { number: 5, label: 'A', pitch: 'A' },
    { number: 4, label: 'D', pitch: 'D' },
    { number: 3, label: 'G', pitch: 'G' },
    { number: 2, label: 'B', pitch: 'B' },
    { number: 1, label: 'e', pitch: 'E' },
  ]);

  assert.equal(parseTuningInput('E A D G B'), null);
  assert.equal(parseTuningInput('F# B E A D G B e'), null);
  assert.equal(parseTuningInput('H A D G B e'), null);
  assert.equal(parseTuningInput('E## A D G B e'), null);
});

test('selected string index normalization is positional and safe', () => {
  assert.deepEqual(normalizeSelectedStringIndexes([2, 0, 2, 9, -1], 6), [0, 2]);
  assert.deepEqual(normalizeSelectedStringIndexes([], 6), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(normalizeSelectedStringIndexes([6], 7), [6]);
});

test('fret-range defaults preserve the former Classic full-string behavior', () => {
  assert.deepEqual(DRILL_MODES, ['classic', 'range-filtered']);
  assert.equal(DEFAULT_DRILL_MODE, 'range-filtered');
  assert.deepEqual(DEFAULT_FRET_RANGE, { from: 0, to: 12 });
});

test('location mode constants match the v9 location-count spec', () => {
  assert.deepEqual(LOCATION_MODES, ['one-per-string', 'all-in-range']);
  assert.equal(DEFAULT_LOCATION_MODE, 'one-per-string');
});

test('drill mode, location mode, and custom fret range validation are strict', () => {
  assert.equal(isValidDrillMode('classic'), true);
  assert.equal(isValidDrillMode('range-filtered'), true);
  assert.equal(isValidDrillMode('range-pairs'), false);
  assert.equal(isValidDrillMode(''), false);

  assert.equal(isValidLocationMode('one-per-string'), true);
  assert.equal(isValidLocationMode('all-in-range'), true);
  assert.equal(isValidLocationMode('all'), false);
  assert.equal(isValidLocationMode(''), false);

  assert.equal(isValidFretRange({ from: 0, to: 0 }), true);
  assert.equal(isValidFretRange({ from: 0, to: 12 }), true);
  assert.equal(isValidFretRange({ from: 3, to: 7 }), true);
  assert.equal(isValidFretRange({ from: 24, to: 24 }), true);
  assert.equal(isValidFretRange({ from: 8, to: 3 }), false);
  assert.equal(isValidFretRange({ from: -1, to: 3 }), false);
  assert.equal(isValidFretRange({ from: 0, to: 25 }), false);
  assert.equal(isValidFretRange({ from: 0.5, to: 3 }), false);
  assert.equal(isValidFretRange(null), false);
});

test('parseFretBoundInput returns a valid integer fret or null', () => {
  assert.equal(parseFretBoundInput('0'), 0);
  assert.equal(parseFretBoundInput(' 12 '), 12);
  assert.equal(parseFretBoundInput('24'), 24);
  assert.equal(parseFretBoundInput(''), null);
  assert.equal(parseFretBoundInput('abc'), null);
  assert.equal(parseFretBoundInput('3.5'), null);
  assert.equal(parseFretBoundInput('-1'), null);
  assert.equal(parseFretBoundInput('25'), null);
});

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
  assert.deepEqual(enharmonicRound[0].strings, enharmonicRound[1].strings);
  assert.deepEqual(enharmonicRound[0].strings, [
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

test('range-filtered round shuffles surviving note groups without flattening string targets', () => {
  const round = createRangeFilteredRound(['C', 'Ab'], { from: 5, to: 9 }, (groups) => [...groups].reverse());

  assert.deepEqual(round.map((group) => group.label), ['Ab', 'C']);
  assert.deepEqual(round.map((group) => group.strings.length), [2, 3]);
  assert.equal(getRoundClickCount(round, 'range-filtered'), 5);
  assert.equal(getRoundClickCount(['C', 'Ab'], 'classic'), 12);
});

test('all-in-range round preserves string order and counts repeated locations', () => {
  const round = createRangeFilteredRound(['C'], { from: 0, to: 24 }, (groups) => groups, 'all-in-range');

  assert.equal(round.length, 1);
  assert.deepEqual(round[0].strings.map((string) => `${string.number}:${string.fret}`), [
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
  assert.equal(getRoundClickCount(round, 'range-filtered'), 12);
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
  assert.deepEqual(round[0].strings, [
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

test('BPM bounds are centralized for validation and controls', () => {
  assert.equal(BPM_MIN, 20);
  assert.equal(BPM_MAX, 240);
});

test('BPM validation accepts only integer numbers from 20 to 240', () => {
  assert.equal(isValidBpm(20), true);
  assert.equal(isValidBpm(60), true);
  assert.equal(isValidBpm(240), true);

  assert.equal(isValidBpm(19), false);
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
  assert.equal(parseBpmInput('19'), null);
  assert.equal(parseBpmInput('20'), 20);
  assert.equal(parseBpmInput('241'), null);
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

// Settings persistence helpers
function createMemoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
  };
}

function defaultTuningSettings() {
  return {
    tuning: { id: 'standard-6', strings: ['E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 1, 2, 3, 4, 5],
  };
}

function orderLabels(order) {
  return order.map((item) => (typeof item === 'string' ? item : item.label));
}

function settingsPayload(overrides = {}) {
  return {
    version: 6,
    bpm: 60,
    selectedLabels: DEFAULT_SELECTED_LABELS,
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
    ...overrides,
  };
}

test('settings storage uses a versioned single localStorage key', () => {
  assert.equal(SETTINGS_STORAGE_KEY, 'fretflash.settings.v1');
});

test('parseSavedSettings accepts v6 settings and migrates valid v1-v5 settings', () => {
  assert.deepEqual(parseSavedSettings(JSON.stringify(settingsPayload({
    bpm: 80,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 3, to: 7 },
    locationMode: 'all-in-range',
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 2, 6],
  }))), {
    bpm: 80,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 3, to: 7 },
    locationMode: 'all-in-range',
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 2, 6],
  });

  assert.deepEqual(parseSavedSettings(JSON.stringify(settingsPayload({
    bpm: 76,
    selectedLabels: ['C'],
    drillMode: 'classic',
    fretRange: { from: 7, to: 12 },
    locationMode: 'all-in-range',
  }))), {
    bpm: 76,
    selectedLabels: ['C'],
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });

  assert.deepEqual(parseSavedSettings(JSON.stringify({
    version: 5,
    bpm: 82,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    tuning: { id: 'drop-d', strings: ['D', 'A', 'D', 'G', 'B', 'e'] },
  })), {
    bpm: 82,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    tuning: { id: 'drop-d', strings: ['D', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 1, 2, 3, 4, 5],
  });

  assert.deepEqual(parseSavedSettings(JSON.stringify({
    version: 1,
    bpm: 72,
    selectedLabels: ['C#', 'Db'],
  })), {
    bpm: 72,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });

  assert.deepEqual(parseSavedSettings(JSON.stringify({
    version: 3,
    bpm: 84,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 5, to: 9 },
  })), {
    bpm: 84,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 5, to: 9 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });

  assert.deepEqual(parseSavedSettings(JSON.stringify({
    version: 2,
    bpm: 90,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'classic',
    fretRangeId: '7-12',
  })), {
    bpm: 90,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });
});

test('parseSavedSettings rejects corrupt or invalid settings', () => {
  assert.equal(parseSavedSettings('not json'), null);
  assert.equal(parseSavedSettings(JSON.stringify({ version: 4, bpm: 80, selectedLabels: ['C'], drillMode: 'range-filtered', fretRange: { from: 0, to: 12 }, locationMode: 'invalid' }))?.locationMode, 'one-per-string');
  assert.equal(parseSavedSettings(JSON.stringify({ version: 4, bpm: 19, selectedLabels: ['C'], drillMode: 'range-filtered', fretRange: { from: 0, to: 12 }, locationMode: 'one-per-string' })), null);
  assert.equal(parseSavedSettings(JSON.stringify({ version: 4, bpm: 80, selectedLabels: [], drillMode: 'range-filtered', fretRange: { from: 0, to: 12 }, locationMode: 'one-per-string' })), null);
  assert.equal(parseSavedSettings(JSON.stringify({ version: 4, bpm: 80, selectedLabels: ['C', 'C'], drillMode: 'range-filtered', fretRange: { from: 0, to: 12 }, locationMode: 'one-per-string' })), null);
  assert.equal(parseSavedSettings(JSON.stringify({ version: 4, bpm: 80, selectedLabels: ['H'], drillMode: 'range-filtered', fretRange: { from: 0, to: 12 }, locationMode: 'one-per-string' })), null);
  assert.equal(parseSavedSettings(JSON.stringify({ version: 4, bpm: 80, selectedLabels: ['C'], drillMode: 'range-pairs', fretRange: { from: 0, to: 12 }, locationMode: 'one-per-string' })), null);
  assert.equal(parseSavedSettings(JSON.stringify({ version: 4, bpm: 80, selectedLabels: ['C'], drillMode: 'range-filtered', fretRange: { from: 7, to: 3 }, locationMode: 'one-per-string' })), null);
});

test('loadSettings falls back to defaults when storage is empty, corrupt, or unavailable', () => {
  assert.deepEqual(loadSettings(createMemoryStorage()), {
    bpm: 60,
    selectedLabels: DEFAULT_SELECTED_LABELS,
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });
  assert.deepEqual(loadSettings(createMemoryStorage({ [SETTINGS_STORAGE_KEY]: '{' })), {
    bpm: 60,
    selectedLabels: DEFAULT_SELECTED_LABELS,
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });
  assert.deepEqual(loadSettings({ getItem: () => { throw new Error('blocked'); } }), {
    bpm: 60,
    selectedLabels: DEFAULT_SELECTED_LABELS,
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });
});

test('loadSettings restores valid saved settings', () => {
  const storage = createMemoryStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 1, bpm: 72, selectedLabels: ['C#', 'Db'] }),
  });

  assert.deepEqual(loadSettings(storage), {
    bpm: 72,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
  });
});

test('saveSettings writes only valid playable settings and ignores storage failures', () => {
  const storage = createMemoryStorage();

  saveSettings(storage, createIdleState(80, ['C#', 'Db'], 'range-filtered', { from: 3, to: 7 }, 'all-in-range'));
  assert.equal(storage.getItem(SETTINGS_STORAGE_KEY), JSON.stringify(settingsPayload({
    bpm: 80,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 3, to: 7 },
    locationMode: 'all-in-range',
  })));

  saveSettings(storage, createIdleState(80, []));
  assert.equal(storage.getItem(SETTINGS_STORAGE_KEY), JSON.stringify(settingsPayload({
    bpm: 80,
    selectedLabels: ['C#', 'Db'],
    drillMode: 'range-filtered',
    fretRange: { from: 3, to: 7 },
    locationMode: 'all-in-range',
  })));

  assert.doesNotThrow(() => saveSettings({ setItem: () => { throw new Error('blocked'); } }, createIdleState()));
});

// Round generation, state machine, and view model
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

test('createIdleState returns the idle defaults', () => {
  assert.deepEqual(createIdleState(), {
    phase: 'idle',
    bpm: 60,
    order: [],
    selectedLabels: DEFAULT_SELECTED_LABELS,
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    ...defaultTuningSettings(),
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  });
});

test('createIdleState accepts selected note labels, drill mode, custom fret range, location mode, tuning, and selected strings', () => {
  const state = createIdleState(
    72,
    ['C#', 'Db'],
    'range-filtered',
    { from: 3, to: 7 },
    'all-in-range',
    { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    [0, 2, 6],
  );

  assert.deepEqual(state.selectedLabels, ['C#', 'Db']);
  assert.equal(state.drillMode, 'range-filtered');
  assert.deepEqual(state.fretRange, { from: 3, to: 7 });
  assert.equal(state.locationMode, 'all-in-range');
  assert.deepEqual(state.tuning, { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] });
  assert.deepEqual(state.selectedStringIndexes, [0, 2, 6]);
});

test('startRound validates BPM and creates a count-in state with a shuffled grouped order', () => {
  const order = [...PITCHES].reverse();
  const state = startRound(72, PITCHES, () => order);

  assert.equal(state.phase, 'countin');
  assert.equal(state.bpm, 72);
  assert.deepEqual(orderLabels(state.order), order);
  assert.deepEqual(state.order.map((group) => group.strings.length), Array.from({ length: PITCHES.length }, () => 6));
  assert.deepEqual(state.selectedLabels, PITCHES);
  assert.equal(state.drillMode, 'range-filtered');
  assert.deepEqual(state.fretRange, { from: 0, to: 12 });
  assert.equal(state.locationMode, 'one-per-string');
  assert.deepEqual(state.tuning, defaultTuningSettings().tuning);
  assert.deepEqual(state.selectedStringIndexes, defaultTuningSettings().selectedStringIndexes);
  assert.equal(state.noteIndex, 0);
  assert.equal(state.beatInNote, 1);
  assert.equal(state.countInBeat, 1);

  assert.throws(() => startRound(19, PITCHES, () => order), /BPM must be an integer from 20 to 240/);
});

test('startRound creates dynamic selected-label rounds without enharmonic deduping', () => {
  const state = startRound(60, ['C#', 'Db'], (labels) => [...labels].reverse());

  assert.deepEqual(orderLabels(state.order), ['Db', 'C#']);
  assert.deepEqual(state.selectedLabels, ['C#', 'Db']);
});

test('startRound uses active tuning and selected strings for Classic click count and cues', () => {
  const state = startRound(60, ['C'], (labels) => labels, {
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 6],
  });

  assert.deepEqual(state.selectedStringIndexes, [0, 6]);
  assert.equal(getRoundClickCount(state.order, 'classic', state.selectedStringIndexes.length), 2);
  assert.equal(getViewModel({ ...state, phase: 'running', beatInNote: 1 }).stringCue, 'String 7 · B');
  assert.equal(getViewModel({ ...state, phase: 'running', beatInNote: 2 }).stringCue, 'String 1 · e');
});

test('startRound creates range-filtered variable-length note groups', () => {
  const state = startRound(60, ['Ab', 'C'], (groups) => [...groups].reverse(), {
    drillMode: 'range-filtered',
    fretRange: { from: 5, to: 9 },
  });

  assert.equal(state.drillMode, 'range-filtered');
  assert.deepEqual(state.fretRange, { from: 5, to: 9 });
  assert.equal(state.locationMode, 'one-per-string');
  assert.deepEqual(state.order.map((group) => group.label), ['C', 'Ab']);
  assert.deepEqual(state.order.map((group) => group.strings.length), [3, 2]);
});

test('startRound creates all-in-range repeated location targets', () => {
  const state = startRound(60, ['C'], (groups) => groups, {
    drillMode: 'range-filtered',
    fretRange: { from: 0, to: 24 },
    locationMode: 'all-in-range',
  });

  assert.equal(state.drillMode, 'range-filtered');
  assert.equal(state.locationMode, 'all-in-range');
  assert.equal(state.order[0].strings.length, 12);
  assert.deepEqual(state.order[0].strings.slice(0, 2), [
    { number: 6, label: 'E', pitch: 'E', fret: 8 },
    { number: 6, label: 'E', pitch: 'E', fret: 20 },
  ]);
});

test('advanceAfterClick uses filtered string counts in range-filtered mode', () => {
  let state = {
    ...startRound(60, ['Ab', 'C'], (groups) => groups, { drillMode: 'range-filtered', fretRange: { from: 5, to: 9 } }),
    phase: 'running',
  };

  assert.equal(state.order[0].strings.length, 2);
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
    ...startRound(60, ['C'], (groups) => groups, { drillMode: 'range-filtered', fretRange: { from: 0, to: 24 }, locationMode: 'all-in-range' }),
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

test('getViewModel renders range-filtered count-in and running progress', () => {
  const idle = getViewModel(createIdleState(60, ['Ab', 'C'], 'range-filtered', { from: 5, to: 9 }));
  assert.match(idle.status, /selected fret range/);
  assert.equal(idle.detail, 'Frets 5–9, selected strings bottom-to-top.');

  const state = startRound(60, ['Ab', 'C'], (groups) => groups, { drillMode: 'range-filtered', fretRange: { from: 5, to: 9 } });
  const countIn = getViewModel(state);

  assert.equal(countIn.preview, 'Ab');
  assert.equal(countIn.stringCue, 'String 4 · D');
  assert.equal(countIn.fretRange, 'Frets 5–9');

  const running = getViewModel({ ...state, phase: 'running', beatInNote: 2 });
  assert.equal(running.prompt, 'Ab');
  assert.equal(running.stringCue, 'String 2 · B');
  assert.equal(running.fretRange, 'Frets 5–9');
  assert.equal(running.beat, 'Beat 2 / 2');
  assert.equal(running.note, 'Note 1 / 2');
  assert.equal(running.preview, 'C');
});

test('getViewModel keeps Classic progress unchanged', () => {
  const order = [...PITCHES];
  let state = startRound(60, PITCHES, () => order);

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
  let state = { ...startRound(60, PITCHES, () => order), phase: 'running' };

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
  let state = { ...startRound(60, ['C#', 'Db'], (labels) => labels), phase: 'running' };

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

  const countIn = getViewModel({ ...startRound(80, PITCHES, () => [...PITCHES]), countInBeat: 3 });
  assert.equal(countIn.prompt, 'Get ready');
  assert.equal(countIn.status, 'Count-in: 3 / 4');
  assert.equal(countIn.previewLabel, 'Starting note');
  assert.equal(countIn.preview, 'C');
  assert.equal(countIn.stringCueLabel, 'Starts on');
  assert.equal(countIn.stringCue, 'String 6 · E');
  assert.equal(countIn.showStop, true);

  const running = getViewModel({
    ...startRound(60, ['C#', 'Db'], () => ['C#', 'Db']),
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

  const done = getViewModel({
    ...startRound(60, PITCHES, () => [...PITCHES]),
    phase: 'done',
    noteIndex: 11,
    beatInNote: 6,
    completedOrder: [...PITCHES],
  });
  assert.equal(done.prompt, 'Done');
  assert.equal(done.primaryButton, 'New shuffle');
  assert.equal(done.showSameOrder, true);
  assert.equal(done.showBpm, true);
});

test('getViewModel maps running beats to the fixed string cue and resets on the next note', () => {
  const order = ['C', 'D'];
  const cues = [];
  let state = { ...startRound(60, order, () => order), phase: 'running' };

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

// HTML rendering
test('renderHtml renders idle controls and validation errors', () => {
  const html = renderHtml(getViewModel(createIdleState()), 60, 'Choose a BPM between 20 and 240.');

  assert.match(html, /<label for="bpm">BPM<\/label>/);
  assert.match(html, /<input id="bpm"/);
  assert.match(html, /inputmode="numeric"/);
  assert.match(html, /enterkeyhint="done"/);
  assert.match(html, /min="20"/);
  assert.match(html, /value="60"/);
  assert.match(html, /<button id="start-button" type="button">Start<\/button>/);
  assert.match(html, /<p class="shortcut-hint">Space start\/pause\/resume · Esc stop<\/p>/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Choose a BPM between 20 and 240\./);
});

test('renderHtml renders note pool setup on idle screens', () => {
  const html = renderHtml(getViewModel(createIdleState(80, ['C', 'Db'])), 80, '', ['C', 'Db']);

  assert.match(html, /<section class="drill-mode" aria-label="Fret and location setup">/);
  assert.doesNotMatch(html, /data-drill-mode=/);
  assert.match(html, /<input id="fret-from"[^>]*value="0"/);
  assert.match(html, /<input id="fret-to"[^>]*value="12"/);
  assert.doesNotMatch(html, /data-fret-range=/);
  assert.match(html, /<section class="note-pool" aria-label="Note pool">/);
  assert.match(html, /<button class="preset-button" type="button" data-preset="flats">Flats<\/button>/);
  assert.match(html, /<button class="preset-button" type="button" data-preset="sharps">Sharps<\/button>/);
  assert.match(html, /<button class="preset-button" type="button" data-preset="naturals">Naturals<\/button>/);
  assert.match(html, /<button class="preset-button" type="button" data-preset="all">All<\/button>/);
  assert.match(html, /<button class="preset-button" type="button" data-preset="clear">Clear<\/button>/);
  assert.match(html, /<p class="note-pool-summary">2 notes · 12 clicks · 9s<\/p>/);
  assert.match(html, /<div class="note-group" aria-label="B# \/ C">/);
  assert.match(html, /data-note-label="C" aria-pressed="true"/);
  assert.match(html, /data-note-label="Db" aria-pressed="true"/);
  assert.match(html, /data-note-label="C#" aria-pressed="false"/);
});

test('renderHtml renders note pool setup on done screens', () => {
  const state = { ...startRound(60, ['C#', 'Db'], () => ['C#', 'Db']), phase: 'done', noteIndex: 1, beatInNote: 6 };
  const html = renderHtml(getViewModel(state), 60, '', state.selectedLabels);

  assert.match(html, /<div class="prompt" aria-live="polite">Done<\/div>/);
  assert.match(html, /<section class="note-pool" aria-label="Note pool">/);
  assert.match(html, /<p class="note-pool-summary">2 notes · 12 clicks · 12s<\/p>/);
});

test('renderHtml renders tuning presets, custom tuning input, and selected string toggles', () => {
  const idleState = createIdleState(
    60,
    ['C'],
    'classic',
    DEFAULT_FRET_RANGE,
    DEFAULT_LOCATION_MODE,
    { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    [0, 2, 6],
  );
  const html = renderHtml(
    getViewModel(idleState),
    60,
    '',
    idleState.selectedLabels,
    idleState.drillMode,
    idleState.fretRange,
    idleState.locationMode,
    idleState.tuning,
    idleState.selectedStringIndexes,
  );

  assert.match(html, /<section class="tuning-setup" aria-label="Tuning">/);
  assert.match(html, /data-tuning-id="standard-7" aria-pressed="true"/);
  assert.match(html, /<input id="custom-tuning"[^>]*value="B E A D G B e"/);
  assert.match(html, /<section class="string-selection" aria-label="Strings">/);
  assert.match(html, /data-string-index="0" aria-label="String 7 B" aria-pressed="true">B<\/button>/);
  assert.match(html, /data-string-index="1" aria-label="String 6 E" aria-pressed="false">E<\/button>/);
  assert.match(html, /data-string-index="5" aria-label="String 2 B" aria-pressed="false">B<\/button>/);
  assert.match(html, /data-string-index="6" aria-label="String 1 e" aria-pressed="true">e<\/button>/);
  assert.match(html, /1 notes · 3 clicks · 3s/);
});

test('renderHtml renders Range filtered setup and active custom fret range copy', () => {
  const idleState = createIdleState(60, ['Ab', 'C'], 'range-filtered', { from: 5, to: 9 });
  const idleHtml = renderHtml(getViewModel(idleState), 60, '', idleState.selectedLabels, idleState.drillMode, idleState.fretRange, idleState.locationMode);

  assert.doesNotMatch(idleHtml, /data-drill-mode=/);
  assert.match(idleHtml, /<input id="fret-from"[^>]*value="5"/);
  assert.match(idleHtml, /<label for="fret-to">To<\/label><input id="fret-to"[^>]*value="9"/);
  assert.doesNotMatch(idleHtml, /<span>to<\/span>/);
  assert.doesNotMatch(idleHtml, /data-fret-range=/);
  assert.match(idleHtml, /<h2>Locations<\/h2>/);
  assert.match(idleHtml, /data-location-mode="one-per-string" aria-pressed="true"/);
  assert.match(idleHtml, /data-location-mode="all-in-range" aria-pressed="false"/);
  assert.match(idleHtml, /<p class="note-pool-summary">2 notes · 5 clicks · 5s<\/p>/);

  const allInRangeState = createIdleState(60, ['C'], 'range-filtered', { from: 0, to: 24 }, 'all-in-range');
  const allInRangeHtml = renderHtml(getViewModel(allInRangeState), 60, '', allInRangeState.selectedLabels, allInRangeState.drillMode, allInRangeState.fretRange, allInRangeState.locationMode);
  assert.match(allInRangeHtml, /data-location-mode="all-in-range" aria-pressed="true"/);
  assert.match(allInRangeHtml, /<p class="note-pool-summary">1 notes · 12 clicks · 12s<\/p>/);
  assert.doesNotMatch(allInRangeHtml, /fret 8|fret 20/i);

  const runningState = { ...startRound(60, ['Ab'], (groups) => groups, { drillMode: 'range-filtered', fretRange: { from: 5, to: 9 } }), phase: 'running' };
  const runningHtml = renderHtml(getViewModel(runningState), 60, '', runningState.selectedLabels, runningState.drillMode, runningState.fretRange, runningState.locationMode);

  assert.match(runningHtml, /<p class="fret-range">Frets 5–9<\/p>/);
  assert.match(runningHtml, /Beat 1 \/ 2/);
  assert.doesNotMatch(runningHtml, /id="fret-from"/);
  assert.doesNotMatch(runningHtml, /data-location-mode=/);
});

test('renderHtml hides note pool during count-in and running states', () => {
  const countIn = renderHtml(getViewModel(startRound(60, ['C#', 'Db'], () => ['C#', 'Db'])), 60, '', ['C#', 'Db']);
  const runningState = { ...startRound(60, ['C#', 'Db'], () => ['C#', 'Db']), phase: 'running' };
  const running = renderHtml(getViewModel(runningState), 60, '', ['C#', 'Db']);

  assert.doesNotMatch(countIn, /class="note-pool"/);
  assert.doesNotMatch(running, /class="note-pool"/);
  assert.doesNotMatch(running, /data-note-label=/);
});

test('renderHtml renders count-in with starting-note preview', () => {
  const state = { ...startRound(80, PITCHES, () => ['Eb', ...PITCHES.filter((pitch) => pitch !== 'Eb')]), countInBeat: 2 };
  const html = renderHtml(getViewModel(state), 80);

  assert.match(html, /Get ready/);
  assert.match(html, /Count-in: 2 \/ 4/);
  assert.match(html, /<div class="preview" aria-label="Starting note"><span>Starting note<\/span><strong>Eb<\/strong><\/div>/);
  assert.match(html, /<div class="string-cue" aria-label="Starts on"><span class="string-cue-label">Starts on<\/span><strong class="string-cue-value">String 6 · E<\/strong><\/div>/);
});

test('renderHtml renders running progress and stop control without BPM input', () => {
  const state = { ...startRound(60, PITCHES, () => ['Ab', ...PITCHES.filter((pitch) => pitch !== 'Ab')]), phase: 'running', beatInNote: 3 };
  const html = renderHtml(getViewModel(state), 60);

  assert.match(html, /<div class="prompt" aria-live="polite">Ab<\/div>/);
  assert.match(html, /<div class="string-cue" aria-label="Current string"><span class="string-cue-label">Current string<\/span><strong class="string-cue-value">String 4 · D<\/strong><\/div>/);
  assert.match(html, /<div class="progress-row" aria-label="Round progress"><p class="beat">Beat 3 \/ 6<\/p><p class="note">Note 1 \/ 12<\/p><\/div>/);
  assert.match(html, /<div class="preview preview-running" aria-label="Next note"><span>Next<\/span><strong>C<\/strong><\/div>/);
  assert.match(html, /<button id="stop-button" type="button">Stop<\/button>/);
  assert.doesNotMatch(html, /<input id="bpm"/);
  assert.ok(html.indexOf('String 4 · D') < html.indexOf('Beat 3 / 6'));
  assert.ok(html.indexOf('Beat 3 / 6') < html.indexOf('<span>Next</span>'));
});

test('renderHtml renders Done as the final-note preview', () => {
  const state = { ...startRound(60, PITCHES, () => [...PITCHES]), phase: 'running', noteIndex: 11, beatInNote: 4 };
  const html = renderHtml(getViewModel(state), 60);

  assert.match(html, /<div class="prompt" aria-live="polite">B<\/div>/);
  assert.match(html, /<div class="preview preview-running" aria-label="Next note"><span>Next<\/span><strong>Done<\/strong><\/div>/);
});

test('renderHtml renders paused as an active drill state with resume and stop controls', () => {
  const state = {
    ...startRound(60, ['C', 'D'], () => ['C', 'D']),
    phase: 'paused',
    pausedFromPhase: 'running',
    noteIndex: 0,
    beatInNote: 3,
  };
  const html = renderHtml(getViewModel(state), 60, '', state.selectedLabels, state.drillMode, state.fretRange);

  assert.match(html, /<div class="prompt" aria-live="polite">C<\/div>/);
  assert.match(html, /Paused/);
  assert.match(html, /Beat 3 \/ 6/);
  assert.match(html, /String 4 · D/);
  assert.match(html, /<button id="resume-button" type="button">Resume<\/button>/);
  assert.match(html, /<button id="stop-button" type="button">Stop<\/button>/);
  assert.doesNotMatch(html, /class="note-pool"/);
  assert.doesNotMatch(html, /<input id="bpm"/);
});

test('renderHtml renders done with same-order and new-shuffle controls', () => {
  const state = {
    ...startRound(60, PITCHES, () => [...PITCHES]),
    phase: 'done',
    noteIndex: 11,
    beatInNote: 6,
    completedOrder: [...PITCHES],
  };
  const html = renderHtml(getViewModel(state), 72);

  assert.match(html, /<div class="prompt" aria-live="polite">Done<\/div>/);
  assert.match(html, /value="72"/);
  assert.match(html, /Round complete\./);
  assert.match(html, /<button id="same-order-button" type="button">Same order<\/button>/);
  assert.match(html, /<button id="start-button" type="button">New shuffle<\/button>/);
  assert.doesNotMatch(html, /Start again/);
  assert.doesNotMatch(html, /Repeat the exact round/);
});

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

test('createAppController preserves Range filtered string progress across pause and resume', () => {
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
    initialState: createIdleState(60, ['Ab', 'C'], 'range-filtered', { from: 5, to: 9 }),
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
    createOrder: () => [...PITCHES],
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
      initialState: createIdleState(60, ['Ab'], 'range-filtered', { from: 5, to: 9 }),
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
    createOrder: () => [...PITCHES],
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
    createOrder: () => [...PITCHES],
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
    createOrder: () => [...PITCHES],
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
    createOrder: () => ['C', 'D'],
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

test('createAppController runs Range filtered groups with first-string accents', () => {
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
    initialState: createIdleState(60, ['Ab', 'C'], 'range-filtered', { from: 5, to: 9 }),
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

test('createAppController rejects Range filtered rounds with no surviving note groups before audio', () => {
  const renders = [];
  const clicks = [];
  const controller = createAppController({
    render: (state, error) => renders.push({ state, error }),
    playClick: (options) => clicks.push(options),
    prepareAudio: () => assert.fail('audio should not prepare for an empty generated round'),
    setIntervalFn: () => assert.fail('empty generated round must not schedule'),
    clearIntervalFn: () => {},
    initialState: createIdleState(60, ['F'], 'range-filtered', { from: 4, to: 4 }),
    createOrder: () => [],
  });

  const started = controller.start('60');

  assert.equal(started, false);
  assert.deepEqual(clicks, []);
  assert.equal(renders.at(-1).error, 'No selected notes are available in this fret range.');
  assert.equal(renders.at(-1).state.phase, 'idle');
});

test('createAppController tick plays a click and advances state', () => {
  const harness = createControllerHarness();
  harness.controller.start('60');

  harness.scheduled.callback();

  assert.deepEqual(harness.clicks, ['click', 'click']);
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
  assert.deepEqual(orderLabels(renders.at(-1).state.order), secondOrder);
});

test('createAppController same order after Done repeats the exact completed Classic order', () => {
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
    createOrder: () => {
      orderCall += 1;
      return orderCall === 1 ? firstOrder : regeneratedOrder;
    },
    initialState: createIdleState(60, ['C', 'D']),
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

test('createAppController same order after Done repeats exact Range filtered groups', () => {
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
    initialState: createIdleState(60, ['C'], 'range-filtered', { from: 0, to: 24 }, 'all-in-range'),
  });

  controller.start('60');
  while (controller.getState().phase !== 'done') {
    scheduled.callback();
  }

  const repeated = controller.repeatSameOrder('72');

  assert.equal(repeated, true);
  assert.equal(controller.getState().phase, 'countin');
  assert.equal(controller.getState().drillMode, 'range-filtered');
  assert.deepEqual(controller.getState().fretRange, { from: 0, to: 24 });
  assert.equal(controller.getState().locationMode, 'all-in-range');
  assert.deepEqual(controller.getState().order, firstOrder);
  assert.equal(controller.getState().order[0].strings.length, 12);
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

test('createAppController setup edit cancels pending async Same order after Done', async () => {
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
    createOrder: () => ['C'],
    initialState: createIdleState(60, ['C']),
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

test('createAppController setup edit cancels pending async New shuffle after Done', async () => {
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
    createOrder: () => ['C'],
    initialState: createIdleState(60, ['C']),
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

// Web Audio click player
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

test('createWebAudioClickPlayer plays accented clicks with a higher pitch and gain', () => {
  const events = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 20;
      this.destination = 'destination';
    }

    createOscillator() {
      return {
        type: '',
        frequency: {
          setValueAtTime: (value, time) => events.push(['frequency', value, time]),
        },
        connect: () => {},
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
        connect: () => {},
      };
    }
  }

  const player = createWebAudioClickPlayer(FakeAudioContext);

  player.prepare();
  player.play({ accent: true });

  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'frequency'), ['frequency', 1800, 20]);
  assert.ok(events.some((event) => Array.isArray(event) && event[0] === 'gain-ramp' && event[1] === 0.28));
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'stop'), ['stop', 20.05]);
});

// Fake browser harness and browser mount wiring
