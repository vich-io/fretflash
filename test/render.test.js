import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FRET_RANGE_ERROR,
  PROMPT_DECK_LABELS,
  escapeHtml,
  renderHtml,
} from '../src/render.js';
import {
  DEFAULT_FRET_RANGE,
  createSetup,
} from '../src/settings.js';
import {
  createIdleState,
  startRound,
} from '../src/state.js';
import { getViewModel } from '../src/view-model.js';
import {
  DEFAULT_SELECTED_LABELS,
} from '../src/music.js';


test('render module owns escaping and setup shell rendering', () => {
  assert.equal(escapeHtml('<b>"x" & y</b>'), '&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  assert.deepEqual(PROMPT_DECK_LABELS.slice(0, 4), ['B#', 'C', 'C#', 'Db']);

  const setup = {
    ...createSetup({
    bpm: 72,
    selectedLabels: ['C', 'F#'],
    }),
    renderFretRange: { from: '<img', to: '12"' },
    openPopover: 'fret-range',
  };
  const html = renderHtml(getViewModel(createIdleState(setup)), setup, FRET_RANGE_ERROR);

  assert.match(html, /class="app-shell app-shell-setup"/);
  assert.match(html, /Notes to practice/);
  assert.match(html, /data-popover="fret-range" data-open="true"/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img[^>]+12"/);
});

test('render module owns practice and done shells without browser wiring', () => {
  const setup = createSetup({ selectedLabels: DEFAULT_SELECTED_LABELS, fretRange: DEFAULT_FRET_RANGE });
  const countIn = startRound(setup, (groups) => groups);
  const running = { ...countIn, phase: 'running' };
  const done = {
    ...running,
    phase: 'done',
    completedOrder: running.order,
  };

  const runningHtml = renderHtml(getViewModel(running), setup);
  const doneHtml = renderHtml(getViewModel(done), setup);

  assert.match(runningHtml, /class="app-shell app-shell-practice"/);
  assert.match(runningHtml, /id="pause-button"/);
  assert.match(runningHtml, /class="note-progress-rail"/);
  assert.match(doneHtml, /Done\./);
  assert.match(doneHtml, /id="same-order-button"/);
  assert.match(doneHtml, /id="setup-button"/);
  assert.doesNotMatch(doneHtml, /Practice complete|Complete<\/strong>/);
});
