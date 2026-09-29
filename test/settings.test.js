import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BPM,
  DEFAULT_FRET_RANGE,
  DEFAULT_LOCATION_MODE,
  LOCATION_MODES,
  SETTINGS_STORAGE_KEY,
  createSetup,
  isValidBpm,
  isValidFretRange,
  isValidLocationMode,
  loadSettings,
  parseBpmInput,
  parseFretBoundInput,
  parseSavedSettings,
  parseTuningInput,
  saveSettings,
} from '../src/settings.js';

import {
  DEFAULT_SELECTED_LABELS,
  DEFAULT_TUNING,
} from '../src/music.js';

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

function settingsPayload(overrides = {}) {
  return {
    version: 6,
    bpm: DEFAULT_BPM,
    selectedLabels: DEFAULT_SELECTED_LABELS,
    fretRange: { from: 0, to: 12 },
    locationMode: 'one-per-string',
    tuning: DEFAULT_TUNING,
    selectedStringIndexes: [0, 1, 2, 3, 4, 5],
    ...overrides,
  };
}

test('settings module exposes current setup constants and validators', () => {
  assert.equal(SETTINGS_STORAGE_KEY, 'fretflash.settings.v1');
  assert.equal(DEFAULT_BPM, 40);
  assert.deepEqual(DEFAULT_FRET_RANGE, { from: 0, to: 12 });
  assert.deepEqual(LOCATION_MODES, ['one-per-string', 'all-in-range']);
  assert.equal(DEFAULT_LOCATION_MODE, 'one-per-string');
  assert.equal(isValidBpm(60), true);
  assert.equal(isValidBpm(19), false);
  assert.equal(isValidFretRange({ from: 3, to: 7 }), true);
  assert.equal(isValidFretRange({ from: 7, to: 3 }), false);
  assert.equal(isValidLocationMode('all-in-range'), true);
  assert.equal(isValidLocationMode('all'), false);
});

test('settings module parses setup inputs without accepting invalid drafts', () => {
  assert.equal(parseBpmInput(' 72 '), 72);
  assert.equal(parseBpmInput('19'), null);
  assert.equal(parseFretBoundInput('24'), 24);
  assert.equal(parseFretBoundInput('25'), null);
  assert.deepEqual(parseTuningInput('D A D G A D'), { id: 'custom', strings: ['D', 'A', 'D', 'G', 'A', 'D'] });
  assert.equal(parseTuningInput('D A D'), null);
});

test('settings module normalizes setup without sharing mutable values', () => {
  assert.equal(createSetup().bpm, DEFAULT_BPM);

  const source = {
    bpm: 84,
    selectedLabels: ['C#', 'Db'],
    fretRange: { from: 5, to: 9 },
    locationMode: 'all-in-range',
    tuning: { id: 'custom', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [6, 0, 6],
  };
  const setup = createSetup(source);

  assert.deepEqual(setup, {
    bpm: 84,
    selectedLabels: ['C#', 'Db'],
    fretRange: { from: 5, to: 9 },
    locationMode: 'all-in-range',
    tuning: { id: 'custom', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 6],
  });

  source.fretRange.from = 0;
  source.tuning.strings[0] = 'C';
  setup.selectedLabels.push('E');

  assert.deepEqual(setup.fretRange, { from: 5, to: 9 });
  assert.deepEqual(setup.tuning.strings, ['B', 'E', 'A', 'D', 'G', 'B', 'e']);
  assert.deepEqual(createSetup(setup).selectedLabels, ['C#', 'Db', 'E']);
});

test('settings module restores only current saved payloads and falls back otherwise', () => {
  assert.deepEqual(parseSavedSettings(JSON.stringify(settingsPayload({
    bpm: 76,
    selectedLabels: ['C'],
    fretRange: { from: 7, to: 12 },
    locationMode: 'all-in-range',
  }))), {
    bpm: 76,
    selectedLabels: ['C'],
    fretRange: { from: 7, to: 12 },
    locationMode: 'all-in-range',
    tuning: DEFAULT_TUNING,
    selectedStringIndexes: [0, 1, 2, 3, 4, 5],
  });

  assert.equal(parseSavedSettings(JSON.stringify({ version: 5, bpm: 76, selectedLabels: ['C'] })), null);
  assert.equal(parseSavedSettings(JSON.stringify(settingsPayload({ locationMode: 'invalid' }))), null);
  assert.equal(parseSavedSettings(JSON.stringify(settingsPayload({ tuning: undefined }))), null);
  assert.equal(parseSavedSettings(JSON.stringify(settingsPayload({ tuning: { id: 'weird-preset', strings: ['E', 'A', 'D', 'G', 'B', 'e'] } }))), null);
  assert.equal(parseSavedSettings(JSON.stringify(settingsPayload({ tuning: { id: 'custom', strings: ['C', 'D'] } }))), null);
});

test('settings module loads defaults and saves current-only payloads', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadSettings(storage), createSetup());

  saveSettings(storage, createSetup({ bpm: 80, selectedLabels: ['C#', 'Db'], fretRange: { from: 3, to: 7 }, locationMode: 'all-in-range' }));
  assert.equal(storage.getItem(SETTINGS_STORAGE_KEY), JSON.stringify(settingsPayload({
    bpm: 80,
    selectedLabels: ['C#', 'Db'],
    fretRange: { from: 3, to: 7 },
    locationMode: 'all-in-range',
  })));
});
