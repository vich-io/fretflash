import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetup, parseSavedSettings, saveSettings, SETTINGS_STORAGE_KEY } from '../src/settings.js';
import { createIdleState, startPreparedRound, advanceAfterClick } from '../src/state.js';
import { renderHtml } from '../src/render.js';
import { getViewModel } from '../src/view-model.js';
import * as speech from '../src/speech.js';
import { KNOWN_NOTE_LABELS } from '../src/music.js';
const group = (label, count) => ({ label, targets: Array.from({ length: count }, (_, i) => ({ number: 6 - i, label: 'E', pitch: 4 })) });

test('spoken cues default off and persist without a selectable voice field', () => {
  assert.equal(createSetup().spokenCues, false); assert.equal(Object.hasOwn(createSetup(), 'spokenVoice'), false);
  const setup = createSetup({ bpm: 73, spokenCues: true }); let raw;
  const storage = { setItem(key, value) { assert.equal(key, SETTINGS_STORAGE_KEY); raw = value; } };
  saveSettings(storage, setup); assert.deepEqual(parseSavedSettings(raw), setup);
  const valid = raw;
  for (const spokenCues of [null, 'yes', 1, {}]) {
    saveSettings(storage, { ...setup, spokenCues }); assert.equal(raw, valid);
    assert.equal(parseSavedSettings(JSON.stringify({ ...JSON.parse(valid), spokenCues })), null);
  }
  assert.equal(Object.hasOwn(JSON.parse(valid), 'spokenVoice'), false);
  const unused = { ...JSON.parse(valid), spokenVoice: 'Lucy' };
  assert.deepEqual(parseSavedSettings(JSON.stringify(unused)), setup);
  const older = JSON.parse(valid); delete older.spokenCues;
  const restored = parseSavedSettings(JSON.stringify(older));
  assert.equal(restored.bpm, 73); assert.equal(restored.spokenCues, false); assert.equal(Object.hasOwn(restored, 'spokenVoice'), false);
});

test('speech preference survives every phase without redundant voice state', () => {
  let state = startPreparedRound(createSetup({ spokenCues: true }), [group('C#', 2)]);
  for (let i = 0; i < 6; i++) { assert.equal(state.spokenCues, true); assert.equal(Object.hasOwn(state, 'spokenVoice'), false); state = advanceAfterClick(state); }
  assert.equal(state.phase, 'done'); assert.equal(createIdleState(state).spokenCues, true);
});

test('the optional speech toggle has no voice chooser and practice uses George', () => {
  const idle = createIdleState(); const off = renderHtml(getViewModel(idle), idle);
  assert.match(off, /id="spoken-cues-button"[^>]*aria-pressed="false"/); assert.doesNotMatch(off, /data-spoken-voice=/);
  const setup = createSetup({ spokenCues: true });
  const on = renderHtml(getViewModel(idle), setup);
  assert.match(on, /id="spoken-cues-button"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(on, /data-spoken-voice=|spoken-voice-choice|Lucy/);
  const active = startPreparedRound(setup, [group('C', 1)]);
  const running = renderHtml(getViewModel(active), active);
  assert.doesNotMatch(running, /data-spoken-voice=|id="spoken-cues-button"/); assert.match(running, /Spoken cues on · George/);
});

test('all written spellings have natural George clips without multi-voice or fitted-word APIs', () => {
  assert.equal(typeof speech.getSpokenClip, 'function');
  assert.equal(speech.fitSpokenWord, undefined); assert.equal(speech.spokenWordSlots, undefined);
  assert.equal(speech.SPOKEN_VOICES, undefined); assert.equal(speech.isValidSpokenVoice, undefined);
  assert.equal(speech.SPOKEN_BANK.path, 'assets/voice/george.wav');
  assert.deepEqual(Object.keys(speech.SPOKEN_BANK.clips).sort(), [...KNOWN_NOTE_LABELS].sort());
  for (const label of KNOWN_NOTE_LABELS) {
    const c = speech.getSpokenClip(label); assert.ok(c.endFrame > c.startFrame); assert.ok(c.duration > .2 && c.duration < 1.1);
  }
  assert.notDeepEqual(speech.getSpokenClip('C#'), speech.getSpokenClip('Db'));
  assert.equal(speech.getSpokenClip('Done'), null);
});

test('announcement belongs to count-in 4 or the current group final target only', () => {
  let state = startPreparedRound(createSetup({ spokenCues: true }), [group('C#', 2), group('Db', 1), group('E', 3)]);
  const labels = [];
  while (state.phase !== 'done') { labels.push(speech.upcomingSpokenLabel(state)); state = advanceAfterClick(state); }
  assert.deepEqual(labels, [null, null, null, 'C#', null, 'Db', 'E', null, null, null]);
  assert.equal(speech.upcomingSpokenLabel({ ...state, phase: 'paused' }), null);
});

test('overlap checks actual gaps between calls, not a one-beat tempo cap or the final natural tail', () => {
  assert.equal(typeof speech.spokenCueError, 'function');
  const setup = createSetup({ spokenCues: true, bpm: 200 });
  assert.equal(speech.spokenCueError(setup, [group('C#', 1), group('Db', 6)]), '');
  assert.equal(speech.spokenCueError(setup, [group('C#', 4), group('Db', 1)]), '');
  assert.equal(speech.spokenCueError(setup, [group('C#', 1)]), '');
  assert.equal(speech.spokenCueError({ ...setup, spokenCues: false }, [group('C#', 1), group('Db', 1)]), '');
  assert.equal(speech.spokenCueError(setup, [group('C#', 1), group('Db', 1)], 1), '', 'Resume checks only remaining announcements');
});
