import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SELECTED_LABELS,
  DEFAULT_SELECTED_STRING_INDEXES,
  DEFAULT_TUNING,
  NOTE_PRESETS,
  NOTE_PROMPTS,
  PITCHES,
  STRING_ORDER,
  TUNING_PRESETS,
  createTuningStrings,
  normalizePitchLabel,
} from '../src/music.js';

import {
  parseTuningInput,
  normalizeSelectedStringIndexes,
  isValidNoteSelection,
} from '../src/settings.js';

test('music model lives in a static ES module', () => {
  assert.deepEqual(createTuningStrings(['E', 'A']), [
    { number: 2, label: 'E', pitch: 'E' },
    { number: 1, label: 'A', pitch: 'A' },
  ]);
});

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
    { id: 'dadgad', label: 'DADGAD', strings: ['D', 'A', 'D', 'G', 'A', 'D'] },
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

  assert.equal(normalizePitchLabel('fb'), 'E');
  assert.equal(normalizePitchLabel('E#'), 'F');
  assert.equal(normalizePitchLabel('H'), null);

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
