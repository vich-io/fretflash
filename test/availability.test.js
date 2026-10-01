import test from 'node:test';
import assert from 'node:assert/strict';
import { KNOWN_NOTE_LABELS } from '../src/music.js';
import { createSetup } from '../src/settings.js';
import { createIdleState } from '../src/state.js';
import { getViewModel } from '../src/view-model.js';
import { renderHtml } from '../src/render.js';

function render(overrides, error = '') {
  const setup = createSetup(overrides);
  return renderHtml(getViewModel(createIdleState(setup)), setup, error);
}

test('partial availability states both counts and lists only omitted spellings without changing selected intent', () => {
  const html = render({ selectedLabels: KNOWN_NOTE_LABELS, fretRange:{ from:0,to:0 }, selectedStringIndexes:[0] });
  assert.match(html, /2 of 21 notes available/);
  assert.match(html, /<details class="note-availability"><summary>19 omitted notes<\/summary>/);
  const detail = html.match(/<details class="note-availability">[\s\S]*?<p>(.*?)<\/p><\/details>/)[1];
  assert.equal(detail, KNOWN_NOTE_LABELS.filter(label => !['E','Fb'].includes(label)).join(' '));
  assert.equal([...html.matchAll(/class="note-pill is-selected"/g)].length,21);
  assert.doesNotMatch(html, /id="start-button"[^>]* disabled/);
  assert.doesNotMatch(detail, /fret|String|\d/);
});

test('zero coverage disables Start with an immediate explanation; empty pool never duplicates its alert', () => {
  const zero = render({ selectedLabels:['C'], fretRange:{ from:0,to:0 }, selectedStringIndexes:[0] });
  assert.match(zero, /0 of 1 notes available/);
  assert.match(zero, /id="start-button"[^>]* disabled aria-disabled="true"/);
  assert.match(zero, /role="alert">No selected notes are available in this fret range\.<\/p>/);
  for (const error of ['', 'Select at least one note.']) {
    const empty = render({ selectedLabels:[] },error);
    assert.match(empty, /id="start-button"[^>]* disabled aria-disabled="true"/);
    assert.equal([...empty.matchAll(/Select at least one note\./g)].length,1);
  }
});

test('fully available setup keeps the ordinary summary and no omission disclosure', () => {
  const html = render({ selectedLabels: KNOWN_NOTE_LABELS });
  assert.match(html, /21 notes · 126 clicks/);
  assert.doesNotMatch(html, /notes available|class="note-availability"|id="start-button"[^>]* disabled/);
});
