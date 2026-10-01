import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml } from '../src/render.js';
import { createIdleState } from '../src/state.js';
import { getViewModel } from '../src/view-model.js';
import { createSetup } from '../src/settings.js';

const htmlFor = (range, draft = range) => {
  const state = createIdleState({ fretRange: range });
  return renderHtml(getViewModel(state), { ...createSetup(state), renderFretRange: draft });
};

test('string fret drafts drive the same inclusive rail and selected chip as numeric bounds', () => {
  const html = htmlFor({ from: 12, to: 17 }, { from: '12', to: '17' });
  assert.match(html, /--fret-from: 48%; --fret-width: 24%;/);
  assert.match(html, /data-fret-preset="high"[^>]*aria-pressed="true"/);
  assert.match(html, /aria-label="Selected fret span 12 to 17"/);
});

test('invalid fret drafts retain committed rail bounds, not the default or invalid range', () => {
  const html = htmlFor({ from: 12, to: 17 }, { from: '', to: '3' });
  assert.match(html, /--fret-from: 48%; --fret-width: 24%;/);
  assert.match(html, /aria-label="Selected fret span 12 to 17"/);
  assert.match(html, /id="fret-from"[^>]*value=""/);
});

test('both fret bounds have separately named decrement and increment controls', () => {
  const html = htmlFor({ from: 0, to: 12 });
  for (const bound of ['from', 'to']) {
    for (const delta of [-1, 1]) assert.match(html, new RegExp(`data-fret-bound="${bound}" data-fret-step="${delta}"`));
  }
});

test('BPM has exactly six broad quick choices, retaining the full numeric range', () => {
  const html = htmlFor({ from: 0, to: 12 });
  assert.deepEqual([...html.matchAll(/data-bpm="(\d+)"/g)].map(match => Number(match[1])), [30, 40, 60, 80, 120, 160]);
  assert.match(html, /id="bpm"[^>]*min="10" max="200"/);
});
