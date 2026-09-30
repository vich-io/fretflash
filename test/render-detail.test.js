import test from 'node:test';
import assert from 'node:assert/strict';



import {
  PITCHES,
  DEFAULT_SELECTED_LABELS,
  NOTE_PRESETS,
} from '../src/music.js';

import {
  DEFAULT_BPM,
  DEFAULT_FRET_RANGE,
  createSetup,
} from '../src/settings.js';

import {
  createIdleState,
  startRound,
} from '../src/state.js';

import { getViewModel } from '../src/view-model.js';

import {
  renderHtml,
} from '../src/render.js';

function defaultTuningSettings() {
  return {
    tuning: { id: 'standard-6', strings: ['E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 1, 2, 3, 4, 5],
  };
}


function testIdleState(
  bpm = DEFAULT_BPM,
  selectedLabels = PITCHES,
  fretRange = DEFAULT_FRET_RANGE,
  locationMode = 'one-per-string',
  tuning = defaultTuningSettings().tuning,
  selectedStringIndexes = defaultTuningSettings().selectedStringIndexes,
) {
  return createIdleState({ bpm, selectedLabels, fretRange, locationMode, tuning, selectedStringIndexes });
}

function testStartRound(bpm, selectedLabels, createOrder = undefined, options = {}) {
  const fallbackOrder = (groups) => groups;
  return startRound({ bpm, selectedLabels, ...options }, createOrder ?? fallbackOrder);
}

function orderGroupsByLabels(labels) {
  return (groups) => labels
    .map((label) => groups.find((group) => group.label === label))
    .filter(Boolean);
}
test('renderHtml accepts a setup object as the preferred API', () => {
  const state = createIdleState(createSetup({
    bpm: 72,
    selectedLabels: ['Ab', 'C'],
    fretRange: { from: 5, to: 9 },
    locationMode: 'all-in-range',
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [6, 0],
  }));
  const setup = createSetup(state);

  const error = 'Choose frets between 0 and 24, with From no higher than To.';

  const html = renderHtml(getViewModel(state), setup, error);

  assert.match(html, /<strong>72<\/strong>/);
  assert.match(html, /<strong>5–9<\/strong>/);
  assert.match(html, /<strong>All in range<\/strong>/);
  assert.match(html, /role="alert">Choose frets between 0 and 24, with From no higher than To\.<\/p>/);
});

test('renderHtml rejects legacy positional setup arguments', () => {
  assert.throws(() => renderHtml(getViewModel(createIdleState()), 60), /setup object/);
});

test('renderHtml renderFretRange override is display-only and escaped', () => {
  const state = createIdleState(createSetup({
    bpm: 72,
    selectedLabels: ['Ab', 'C'],
    fretRange: { from: 5, to: 9 },
  }));
  const setup = {
    ...createSetup(state),
    renderFretRange: { from: '8" autofocus="true', to: '3<script>' },
  };
  const html = renderHtml(
    getViewModel(state),
    setup,
    'Choose frets between 0 and 24, with From no higher than To.',
  );

  assert.match(html, /value="8&quot; autofocus=&quot;true"/);
  assert.match(html, /value="3&lt;script&gt;"/);
  assert.doesNotMatch(html, /autofocus="true"/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<p class="note-pool-summary">2 notes · 5 clicks · 4s · shuffled<\/p>/);
});

test('renderHtml renders the compact setup shell and validation errors', () => {
  const html = renderHtml(getViewModel(createIdleState()), createSetup({ bpm: 60 }), 'Choose a BPM between 20 and 240.');

  assert.match(html, /class="app-shell app-shell-setup"/);
  assert.match(html, /<div class="setup-launcher">/);
  assert.match(html, /<div class="setup-app-bar">/);
  assert.match(html, /<h1 class="brand-heading"><button id="brand-home-button" class="app-brand" type="button" aria-label="FretFlash — return to setup">/);
  assert.match(html, /<img class="brand-mark" src="assets\/icons\/fretflash-six-line-f\.svg" alt="" aria-hidden="true" width="28" height="28">/);
  assert.doesNotMatch(html, />✦</);
  const brandButton = html.match(/<button id="brand-home-button"[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.match(brandButton, /<span class="brand-wordmark">fretflash\.<\/span>/);
  assert.doesNotMatch(brandButton, /brand-subtitle/);
  assert.doesNotMatch(brandButton, /<(?:h1|p|div)(?:\s|>)/);
  assert.doesNotMatch(html, /<h1>FretFlash<\/h1>|<h1>FRETFLASH<\/h1>/);
  assert.match(html, /<section class="drill-header" aria-label="Drill setup">/);
  ['BPM', 'Frets', 'Strings', 'Tuning', 'Targets'].forEach((label) => {
    assert.match(html, new RegExp(`<span class="drill-cell-label">${label}<\\/span>`));
  });

  assert.match(html, /<a class="home-link" href="https:\/\/vich\.io\/">vich\.io<\/a>/);
  assert.ok(html.indexOf('class="app-footer"') > html.indexOf('id="start-button"'));
  assert.match(html, /class="drill-cell-chevron" aria-hidden="true">⌄<\/span>/);
  assert.match(html, / · shuffled<\/p>/);
  assert.doesNotMatch(html, /drill-cell-static/);
  assert.doesNotMatch(html, /data-popover-target="order"/);
  assert.doesNotMatch(html, /data-popover="order"/);
  assert.match(html, /<footer class="deck-footer"><button id="start-button" class="primary-action" type="button">Start<\/button><\/footer>/);
  assert.doesNotMatch(html, /Selected notes will be used to generate prompts\./);
  assert.doesNotMatch(html, /<\/section>\s*<div class="actions"><button id="start-button"/);
  assert.match(html, /SPACE Start/);
  assert.doesNotMatch(html, /ESC Close/);
  assert.doesNotMatch(html, /Space start\/pause\/resume|P Pause|S Stop|N New/i);
  assert.match(html, /role="alert"/);
  assert.match(html, /Choose a BPM between 20 and 240\./);

  const errorHtml = renderHtml(getViewModel(createIdleState()), { ...createSetup(createIdleState()), openPopover: 'fret-range', renderFretRange: { from: 14, to: 3 } }, 'Choose frets between 0 and 24, with From no higher than To.');
  assert.match(errorHtml, /<div class="header-popover"[^>]*data-popover="fret-range" data-open="true"/);
  assert.match(errorHtml, /role="alert">Choose frets between 0 and 24, with From no higher than To\.<\/p>/);
  assert.match(errorHtml, /style="--fret-from: 0%; --fret-width: 52%;"/);
  assert.doesNotMatch(errorHtml, /--fret-width: -|NaN|undefined/);
  assert.match(errorHtml, /<button id="start-button" class="primary-action" type="button" disabled aria-disabled="true">Start<\/button>/);
  assert.doesNotMatch(errorHtml, /<p class="error" role="alert">Choose frets/);
});

test('renderHtml groups independent spellings by written letter, never by enharmonic equivalence', () => {
  const setup = createSetup({ bpm: 80, selectedLabels: ['C', 'Db'] });
  const html = renderHtml(getViewModel(createIdleState(setup)), setup);
  const labels = ['C', 'Cb', 'C#', 'D', 'Db', 'D#', 'E', 'Eb', 'E#', 'F', 'Fb', 'F#', 'G', 'Gb', 'G#', 'A', 'Ab', 'A#', 'B', 'Bb', 'B#'];
  assert.equal((html.match(/class="note-group"/g) ?? []).length, 7);

  assert.match(html, /<section class="prompt-deck" aria-label="Note prompt deck">/);
  assert.doesNotMatch(html, /Build your prompt deck\./);
  assert.match(html, /<h2>Notes to practice<\/h2>/);
  assert.match(html, /class="note-pool-summary"/);
  assert.match(html, /data-preset="all"/);
  assert.match(html, /data-preset="naturals"/);
  assert.match(html, /data-preset="sharps"/);
  assert.match(html, /data-preset="flats"/);
  assert.match(html, /data-preset="clear"/);
  labels.forEach((label) => {
    assert.match(html, new RegExp(`data-note-label="${label.replace('#', '\\#')}"`));
  });
  const renderedLabels = [...html.matchAll(/data-note-label="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(renderedLabels, labels);
  assert.match(html, /data-note-label="C" aria-pressed="true"/);
  assert.match(html, /data-note-label="Db" aria-pressed="true"/);
  assert.match(html, /data-note-label="C#" aria-pressed="false"/);
  assert.doesNotMatch(html, /B# \/ C|C# \/ Db|B \/ Cb/);
  assert.doesNotMatch(html, /B and Cb are independent options and can be selected separately\./);
});

test('renderHtml marks the matching note preset as selected', () => {
  const naturalsHtml = renderHtml(getViewModel(testIdleState(60, NOTE_PRESETS.naturals)), createSetup({ ...createIdleState(), selectedLabels: NOTE_PRESETS.naturals }));
  assert.match(naturalsHtml, /<button class="preset-button is-selected" type="button" data-preset="naturals" aria-pressed="true">Naturals<\/button>/);
  assert.match(naturalsHtml, /<button class="preset-button" type="button" data-preset="sharps" aria-pressed="false">Sharps<\/button>/);

  const manualSharps = [...NOTE_PRESETS.sharps];
  const sharpsHtml = renderHtml(getViewModel(testIdleState(60, manualSharps)), createSetup({ ...createIdleState(), selectedLabels: manualSharps }));
  assert.match(sharpsHtml, /<button class="preset-button is-selected" type="button" data-preset="sharps" aria-pressed="true">Sharps<\/button>/);

  const customHtml = renderHtml(getViewModel(testIdleState(60, ['C', 'Db'])), createSetup({ ...createIdleState(), selectedLabels: ['C', 'Db'] }));
  assert.doesNotMatch(customHtml, /class="preset-button is-selected"/);
});

test('renderHtml renders setup popovers for header cells', () => {
  const setup = { ...createSetup(createIdleState()), openPopover: 'targets' };
  const html = renderHtml(getViewModel(createIdleState()), setup);

  assert.match(html, /data-popover-target="bpm"/);
  assert.match(html, /<div class="bpm-field" aria-label="BPM value">/);
  assert.match(html, /<input id="bpm" name="bpm" type="number"[^>]*aria-label="BPM"[^>]*value="40">/);
  assert.match(html, /data-bpm-step="-1" aria-label="Decrease BPM">−<\/button>/);
  assert.match(html, /data-bpm-step="1" aria-label="Increase BPM">\+<\/button>/);
  assert.match(html, /data-close-editor>Done<\/button>/);
  assert.doesNotMatch(html, /<label for="bpm">BPM<\/label>/);
  assert.deepEqual([...html.matchAll(/data-bpm="(\d+)"/g)].map((match) => match[1]), ['30', '40', '50', '60', '70', '80', '100']);
  assert.match(html, /<button class="is-selected" type="button" data-bpm="40" aria-pressed="true">40<\/button>/);
  assert.doesNotMatch(html, /data-bpm="72"/);
  assert.match(html, /data-popover-target="fret-range"/);
  assert.match(html, /data-popover-target="strings"/);
  assert.match(html, /data-popover-target="tuning"/);
  assert.match(html, /data-popover-target="targets"/);
  assert.doesNotMatch(html, /data-popover-target="order"/);
  assert.doesNotMatch(html, /data-popover="order"/);
  assert.doesNotMatch(html, /Repeat completed round/);
  assert.match(html, /<div class="header-popover" role="dialog" aria-label="Targets"[^>]*>/);
  assert.match(html, /data-popover="targets" data-open="true"/);
  assert.match(html, /<button class="drill-cell is-open" type="button" data-popover-target="targets" aria-expanded="true">/);
  assert.match(html, /data-location-mode="one-per-string"/);
  assert.match(html, /data-location-mode="all-in-range"/);
  assert.match(html, /One per string/);
  assert.match(html, /All in range/);
});

test('renderHtml renders done as the terminal state of the practice stage', () => {
  const activeState = testStartRound(60, PITCHES, orderGroupsByLabels([...PITCHES]));
  const state = {
    ...activeState,
    phase: 'done',
    noteIndex: 11,
    beatInNote: 6,
    completedOrder: activeState.order,
  };
  const html = renderHtml(getViewModel(state), state);

  assert.match(html, /<main class="app-shell app-shell-practice">/);
  assert.match(html, /<div class="practice-stage">/);
  assert.match(html, /<section class="practice-context" aria-label="Current drill setup">/);
  assert.match(html, /<section class="practice-display practice-done" aria-live="polite">/);
  assert.match(html, /<p class="practice-status" aria-hidden="true"><\/p><div class="practice-cue-row is-reserved" aria-hidden="true"><div class="practice-string"><strong><\/strong><\/div><div class="beat-meter"><strong><\/strong><\/div><\/div>/);
  assert.match(html, /<div class="current-note current-note-done" aria-label="Completed drill"><span class="hero-label" aria-hidden="true"><\/span><strong>Done\.<\/strong><\/div>/);
  assert.match(html, /<div class="next-note is-reserved" aria-hidden="true"><span><\/span><strong><\/strong><\/div>/);
  assert.doesNotMatch(html, />Complete</);
  assert.doesNotMatch(html, /class="done-summary"/);
  assert.match(html, /<div class="note-progress-rail" aria-label="Note progress">/);
  assert.equal((html.match(/class="progress-cell is-complete/g) ?? []).length, PITCHES.length);
  assert.match(html, /<span class="progress-cell is-complete is-current" data-progress-label="B" aria-current="step"><span class="progress-label">B<\/span><\/span>/);
  assert.doesNotMatch(html, /progress-check|✓/);
  assert.doesNotMatch(html, /class="app-shell-done"|class="done-panel"|class="done-sigil"/);
  assert.doesNotMatch(html, /Practice complete\./);
  assert.doesNotMatch(html, /New shuffle|Same order/);
  assert.match(html, /SPACE Shuffle/);
  assert.match(html, /<button id="same-order-button" class="secondary-action" type="button">Repeat<\/button>/);
  assert.match(html, /<button id="start-button" class="primary-action" type="button">Shuffle<\/button>/);
  assert.match(html, /<button id="setup-button" class="secondary-action" type="button">Setup<\/button>/);
  assert.match(html, /BPM/);
  assert.match(html, /Frets/);
  assert.match(html, /Shuffled/);
  assert.doesNotMatch(html, /class="prompt-deck"/);
  assert.doesNotMatch(html, /score|streak|stats|history/i);
});

test('renderHtml renders tuning presets, custom tuning input, and selected string toggles in popovers', () => {
  const setup = createSetup({
    bpm: 60,
    selectedLabels: ['C'],
    tuning: { id: 'standard-7', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
    selectedStringIndexes: [0, 2, 6],
  });
  const idleState = createIdleState(setup);
  const html = renderHtml(getViewModel(idleState), setup);

  assert.match(html, /<section class="prompt-deck" aria-label="Note prompt deck">/);
  assert.match(html, /data-tuning-id="standard-7" aria-pressed="true"/);
  assert.match(html, /<div class="tuning-custom-row"><label for="custom-tuning">Custom<\/label><input id="custom-tuning"[^>]*value="B E A D G B e"/);
  assert.doesNotMatch(html, /<div class="control-row compact-field"><label for="custom-tuning">Custom<\/label>/);
  assert.match(html, /data-string-index="0" aria-label="String 7 B" aria-pressed="true">B<\/button>/);
  assert.match(html, /data-string-index="1" aria-label="String 6 E" aria-pressed="false">E<\/button>/);
  assert.match(html, /data-string-index="5" aria-label="String 2 B" aria-pressed="false">B<\/button>/);
  assert.match(html, /data-string-index="6" aria-label="String 1 e" aria-pressed="true">e<\/button>/);
  assert.match(html, /At least one string is required\./);
  assert.match(html, /1 notes · 3 clicks · 3s/);
});

test('renderHtml renders custom fret range setup and active copy', () => {
  const idleState = createIdleState({ bpm: 60, selectedLabels: ['Ab', 'C'], fretRange: { from: 5, to: 9 } });
  const idleHtml = renderHtml(getViewModel(idleState), idleState);

  assert.doesNotMatch(idleHtml, /data-drill-mode=/);
  assert.match(idleHtml, /<input id="fret-from"[^>]*value="5"/);
  assert.match(idleHtml, /<label for="fret-to">To<\/label><input id="fret-to"[^>]*value="9"/);
  assert.doesNotMatch(idleHtml, /<span>to<\/span>/);
  assert.doesNotMatch(idleHtml, /data-fret-range=/);
  assert.match(idleHtml, /<span class="drill-cell-label">Targets<\/span>/);
  assert.match(idleHtml, /data-location-mode="one-per-string" aria-pressed="true"/);
  assert.match(idleHtml, /data-location-mode="all-in-range" aria-pressed="false"/);
  assert.match(idleHtml, /2 notes · 5 clicks · 5s/);

  const allInRangeState = createIdleState({ bpm: 60, selectedLabels: ['C'], fretRange: { from: 0, to: 24 }, locationMode: 'all-in-range' });
  const allInRangeHtml = renderHtml(getViewModel(allInRangeState), allInRangeState);
  assert.match(allInRangeHtml, /data-location-mode="all-in-range" aria-pressed="true"/);
  assert.match(allInRangeHtml, /1 notes · 12 clicks · 12s/);
  assert.doesNotMatch(allInRangeHtml, /fret 8|fret 20/i);

  const runningState = { ...testStartRound(60, ['Ab'], (groups) => groups, { fretRange: { from: 5, to: 9 } }), phase: 'running' };
  const runningHtml = renderHtml(getViewModel(runningState), runningState);

  assert.doesNotMatch(runningHtml, /<p class="fret-range">/);
  assert.match(runningHtml, /Beat 1 \/ 2/);
  assert.doesNotMatch(runningHtml, /id="fret-from"/);
  assert.doesNotMatch(runningHtml, /data-location-mode=/);
});

test('renderHtml hides prompt deck during count-in and running states', () => {
  const setup = createSetup({ bpm: 60, selectedLabels: ['C#', 'Db'] });
  const countIn = renderHtml(getViewModel(testStartRound(60, ['C#', 'Db'], orderGroupsByLabels(['C#', 'Db']))), setup);
  const runningState = { ...testStartRound(60, ['C#', 'Db'], orderGroupsByLabels(['C#', 'Db'])), phase: 'running' };
  const running = renderHtml(getViewModel(runningState), setup);

  assert.doesNotMatch(countIn, /class="prompt-deck"/);
  assert.doesNotMatch(running, /class="prompt-deck"/);
  assert.doesNotMatch(running, /data-note-label=/);
});

test('renderHtml renders count-in with the same hero note skeleton as running', () => {
  const firstEbOrder = ['Eb', ...PITCHES.filter((pitch) => pitch !== 'Eb')];
  const state = { ...testStartRound(80, PITCHES, orderGroupsByLabels(firstEbOrder)), countInBeat: 2 };
  const html = renderHtml(getViewModel(state), state);

  assert.match(html, /<section class="practice-display practice-countin"/);
  assert.match(html, /<p class="practice-status" aria-hidden="true"><\/p><div class="practice-cue-row"><div class="practice-string" aria-label="Current string"><strong>String 6 · E<\/strong><\/div><div class="beat-meter" aria-label="Beat 1 \/ 6"><strong>1 \/ 6<\/strong><\/div><\/div>/);
  assert.match(html, /<div class="current-note" aria-label="Starting note"><span class="hero-label">Starting in 3<\/span><strong>Eb<\/strong><\/div>/);
  assert.match(html, /<div class="next-note" aria-label="Next note"><span>Next after that<\/span><strong>/);
  assert.doesNotMatch(html, /<p class="fret-range">/);
  assert.doesNotMatch(html, /class="count-card"|class="beat-meter-slot"/);
  assert.doesNotMatch(html, /3 \/ 4|beat-dot|>Current string<|<span>Beat<\/span>/);
  assert.match(html, /<button id="stop-button" class="danger-action" type="button">Stop<\/button>/);
});

test('renderHtml renders paused count-in without countdown beat indicator or inserted rows', () => {
  const state = {
    ...testStartRound(80, PITCHES, orderGroupsByLabels(['Eb', ...PITCHES.filter((pitch) => pitch !== 'Eb')])),
    phase: 'paused',
    pausedFromPhase: 'countin',
    countInBeat: 2,
  };
  const html = renderHtml(getViewModel(state), state);

  assert.match(html, /<section class="practice-display practice-paused"/);
  assert.match(html, /<p class="practice-status is-paused">Paused<\/p><div class="practice-cue-row"><div class="practice-string" aria-label="Current string"><strong>String 6 · E<\/strong><\/div><div class="beat-meter" aria-label="Beat 1 \/ 6"><strong>1 \/ 6<\/strong><\/div><\/div>/);
  assert.match(html, /<div class="current-note" aria-label="Starting note"><span class="hero-label">Starting in 3<\/span><strong>Eb<\/strong><\/div>/);
  assert.doesNotMatch(html, /Paused · Starting|class="beat-meter-slot"|3 \/ 4|beat-dot|>Current string<|<span>Beat<\/span>/);
  assert.match(html, /<button id="resume-button" class="secondary-action" type="button">Resume<\/button>/);
});

test('renderHtml renders running hierarchy with next note and fixed progress cells', () => {
  const order = ['C', 'E', 'D', 'Bb', 'F', 'G', 'A', 'Cb'];
  const state = { ...testStartRound(60, order, orderGroupsByLabels(order)), phase: 'running', noteIndex: 2, beatInNote: 3 };
  const html = renderHtml(getViewModel(state), state);

  assert.match(html, /<section class="practice-display practice-running"/);
  assert.match(html, /<p class="practice-status" aria-hidden="true"><\/p><div class="practice-cue-row"><div class="practice-string" aria-label="Current string"><strong>String 4 · D<\/strong><\/div><div class="beat-meter" aria-label="Beat 3 \/ 6"><strong>3 \/ 6<\/strong><\/div><\/div>/);
  assert.match(html, /<div class="current-note" aria-label="Current note"><span class="hero-label" aria-hidden="true"><\/span><strong>D<\/strong><\/div>/);
  assert.match(html, /<div class="next-note" aria-label="Next note"><span>Next<\/span><strong>Bb<\/strong><\/div>/);
  assert.match(html, /3 \/ 6/);
  assert.doesNotMatch(html, /<p class="fret-range">/);
  assert.doesNotMatch(html, /beat-dot|>Current<|>Current string<|<span>Beat<\/span>/);
  assert.match(html, /<div class="note-progress-rail" aria-label="Note progress">/);
  assert.match(html, /data-progress-label="D"[^>]*aria-current="step"/);
  assert.match(html, /<span class="progress-cell is-complete" data-progress-label="C"><span class="progress-label">C<\/span><\/span>/);
  assert.match(html, /<span class="progress-cell is-current" data-progress-label="D"[^>]*><span class="progress-label">D<\/span><\/span>/);
  assert.doesNotMatch(html, /progress-check|✓|class="progress-chip"/);
  assert.ok(html.indexOf('data-progress-label="D"') < html.indexOf('data-progress-label="Bb"'));
  assert.match(html, /<button id="pause-button" class="secondary-action" type="button">Pause<\/button>/);
  assert.match(html, /<button id="stop-button" class="danger-action" type="button">Stop<\/button>/);
  assert.doesNotMatch(html, /<input id="bpm"/);
});

test('renderHtml frames active practice as the same app console without editable setup controls', () => {
  const state = { ...testStartRound(72, ['C', 'E', 'D'], orderGroupsByLabels(['C', 'E', 'D'])), phase: 'running', noteIndex: 1, beatInNote: 2 };
  const html = renderHtml(
    getViewModel(state),
    createSetup({
      ...state,
      bpm: 72,
      fretRange: { from: 5, to: 12 },
      locationMode: 'all-in-range',
    }),
  );

  assert.match(html, /<main class="app-shell app-shell-practice">/);
  assert.match(html, /<div class="practice-stage">/);
  assert.match(html, /<div class="setup-app-bar practice-app-bar">/);
  assert.match(html, /<p class="shortcut-hint"><span class="shortcut-plain">SPACE Pause · ESC Exit<\/span>/);
  assert.match(html, /<section class="practice-context" aria-label="Current drill setup">/);
  assert.match(html, /class="practice-tempo">72 BPM<\/span>/);
  assert.match(html, /<span>Frets 5–12<\/span>/);
  assert.match(html, /<details class="context-details"><summary>Setup details<\/summary>/);
  assert.match(html, /Strings .*<br>Tuning .*<br>Targets All in range · Shuffled/);
  assert.match(html, /<section class="practice-display practice-running"/);
  assert.doesNotMatch(html, /data-popover-target=/);
  assert.doesNotMatch(html, /class="header-popovers"/);
  assert.doesNotMatch(html, /data-note-label=/);
  assert.doesNotMatch(html, /<input /);
});

test('renderHtml renders Done as the final-note preview', () => {
  const state = { ...testStartRound(60, PITCHES, orderGroupsByLabels([...PITCHES])), phase: 'running', noteIndex: 11, beatInNote: 4 };
  const html = renderHtml(getViewModel(state), state);

  assert.match(html, /<div class="current-note" aria-label="Current note"><span class="hero-label" aria-hidden="true"><\/span><strong>B<\/strong><\/div>/);
  assert.match(html, /<div class="next-note" aria-label="Next note"><span>Next<\/span><strong>Done<\/strong><\/div>/);
});

test('renderHtml renders paused as an active drill state with resume and stop controls', () => {
  const state = {
    ...testStartRound(60, ['C', 'D'], orderGroupsByLabels(['C', 'D'])),
    phase: 'paused',
    pausedFromPhase: 'running',
    noteIndex: 0,
    beatInNote: 3,
  };
  const html = renderHtml(getViewModel(state), state);

  assert.match(html, /<section class="practice-display practice-paused"/);
  assert.match(html, /<p class="practice-status is-paused">Paused<\/p><div class="practice-cue-row"><div class="practice-string" aria-label="Current string"><strong>String 4 · D<\/strong><\/div><div class="beat-meter" aria-label="Beat 3 \/ 6"><strong>3 \/ 6<\/strong><\/div><\/div>/);
  assert.match(html, /<div class="current-note" aria-label="Current note"><span class="hero-label" aria-hidden="true"><\/span><strong>C<\/strong><\/div>/);
  assert.match(html, /String 4 · D/);
  assert.doesNotMatch(html, /beat-dot|>Current<|>Current string<|<span>Beat<\/span>/);
  assert.doesNotMatch(html, /<p class="fret-range">/);
  assert.match(html, /<button id="resume-button" class="secondary-action" type="button">Resume<\/button>/);
  assert.match(html, /<button id="restart-button" class="secondary-action" type="button">Restart<\/button>/);
  assert.match(html, /<button id="stop-button" class="danger-action" type="button">Stop<\/button>/);
  assert.doesNotMatch(html, /class="prompt-deck"/);
  assert.match(html, /<input id="bpm"/);
  assert.doesNotMatch(html, /<input id="fret-from"|data-tuning-id=/);

  const runningHtml = renderHtml(getViewModel({ ...state, phase: 'running', pausedFromPhase: undefined }), state);
  assert.doesNotMatch(runningHtml, /id="restart-button"/);
});

test('renderHtml keeps active pause/resume structure vertically stable', () => {
  const running = { ...testStartRound(60, ['C', 'D'], orderGroupsByLabels(['C', 'D'])), phase: 'running', noteIndex: 0, beatInNote: 3 };
  const pausedRunning = { ...running, phase: 'paused', pausedFromPhase: 'running' };
  const countIn = { ...testStartRound(60, ['C', 'D'], orderGroupsByLabels(['C', 'D'])), countInBeat: 2 };
  const pausedCountIn = { ...countIn, phase: 'paused', pausedFromPhase: 'countin' };

  const skeleton = (html) => [...html.matchAll(/<(p|div) class="([^"]+)"/g)]
    .map((match) => match[2].replace(/ is-paused\b/, ''))
    .filter((className) => [
      'practice-status',
      'practice-cue-row',
      'current-note',
      'next-note',
      'note-progress-rail',
      'actions practice-actions',
    ].some((expected) => className.startsWith(expected)));

  assert.deepEqual(skeleton(renderHtml(getViewModel(pausedRunning), pausedRunning)), skeleton(renderHtml(getViewModel(running), running)));
  assert.deepEqual(skeleton(renderHtml(getViewModel(pausedCountIn), pausedCountIn)), skeleton(renderHtml(getViewModel(countIn), countIn)));
});

test('renderHtml escapes invalid fret draft values in input attributes', () => {
  const setup = {
    ...createSetup({ bpm: 60, selectedLabels: DEFAULT_SELECTED_LABELS }),
    renderFretRange: { from: '8" autofocus="true', to: '3<script>' },
  };
  const html = renderHtml(
    getViewModel(createIdleState(setup)),
    setup,
    'Choose frets between 0 and 24, with From no higher than To.',
  );

  assert.match(html, /value="8&quot; autofocus=&quot;true"/);
  assert.match(html, /value="3&lt;script&gt;"/);
  assert.doesNotMatch(html, /autofocus="true"/);
  assert.doesNotMatch(html, /<script>/);
});

test('renderHtml escapes dynamic practice and done text', () => {
  const brandImage = '<img class="brand-mark" src="assets/icons/fretflash-six-line-f.svg" alt="" aria-hidden="true" width="28" height="28">';
  const maliciousRunning = renderHtml({
    phase: 'running',
    prompt: '<img src=x onerror=alert(1)>',
    status: '<script>alert(1)</script>',
    beatNumber: 1,
    beatCount: '6" onclick="alert(1)',
    note: 'Note 1 / 1',
    stringCue: 'String 1 · <svg onload=alert(1)>',
    previewLabel: 'Next',
    preview: '<b onclick=alert(1)>Db</b>',
    fretRange: 'Frets <script>alert(1)</script>',
    progressLabels: ['C<script>alert(1)</script>'],
    progressIndex: 0,
    showPause: true,
    showResume: false,
    showStop: true,
    showSameOrder: false,
  });

  assert.doesNotMatch(maliciousRunning.replace(brandImage, ''), /<script>|<img|<svg|<b\s/i);
  assert.match(maliciousRunning, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(maliciousRunning, /Beat 1 \/ 6&quot; onclick=&quot;alert\(1\)/);

  const maliciousDone = renderHtml({
    phase: 'done',
    prompt: '<script>alert(1)</script>',
    status: '<img src=x onerror=alert(1)>',
    primaryButton: '<b>New</b>',
    showSameOrder: true,
  }, createSetup({ tuning: { id: 'custom', strings: ['C', 'D', 'E', 'F', 'G', 'A'] } }));

  assert.doesNotMatch(maliciousDone.replace(brandImage, ''), /<script>|<img|<b>New<\/b>/i);
  assert.match(maliciousDone, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(maliciousDone, /&lt;b&gt;New&lt;\/b&gt;/);
});
