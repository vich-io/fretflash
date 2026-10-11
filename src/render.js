import {
  DEFAULT_TUNING,
  NOTE_PRESETS,
  TUNING_PRESETS,
  createTuningStrings,
} from './music.js?v=a4ebea2a326f3f0a';

import {
  BPM_MAX,
  BPM_MIN,
  DEFAULT_FRET_RANGE,
  DEFAULT_LOCATION_MODE,
  FRET_MAX,
  FRET_MIN,
  LOCATION_MODES,
  cloneFretRange,
  cloneTuning,
  createSetup,
  isValidFretRange,
  normalizeFretRange,
  normalizeSelectedStringIndexes,
  parseFretBoundInput,
} from './settings.js?v=a4ebea2a326f3f0a';

import {
  createRangeFilteredRound,
  formatRoundDuration,
  getFretRangeLabel,
  getRoundClickCount,
} from './round.js?v=a4ebea2a326f3f0a';

const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const PROMPT_DECK_LABELS = NOTE_LETTERS.flatMap(letter => [letter, `${letter}b`, `${letter}#`]);

import { FRET_RANGE_ERROR } from './browser/setup-drafts.js?v=a4ebea2a326f3f0a';
import { getSpokenBpmMax } from './speech.js?v=a4ebea2a326f3f0a';
export { FRET_RANGE_ERROR };

// HTML rendering
function escapeAttributeValue(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtml(value) {
  return escapeAttributeValue(value);
}

const FRET_RANGE_PRESETS = [
  { id: 'open', label: 'Open', from: 0, to: 3 },
  { id: 'low', label: 'Low', from: 0, to: 5 },
  { id: 'default', label: 'Default', from: 0, to: 12 },
  { id: 'high', label: 'High', from: 12, to: 17 },
  { id: 'dusty', label: 'Dusty end', from: 17, to: 24 },
  { id: 'all', label: 'All', from: 0, to: 24 },
];

function getFretRailStyle(range) {
  const safeRange = isValidFretRange(range) ? range : DEFAULT_FRET_RANGE;
  const span = FRET_MAX - FRET_MIN + 1;
  const fromPercent = Math.round(((safeRange.from - FRET_MIN) / span) * 100);
  const widthPercent = Math.round((((safeRange.to - safeRange.from) + 1) / span) * 100);
  return `--fret-from: ${fromPercent}%; --fret-width: ${widthPercent}%;`;
}

function renderFretRangeControls(fretRange = DEFAULT_FRET_RANGE, fretRangeError = '', committedRange = DEFAULT_FRET_RANGE) {
  const range = isValidFretRange(fretRange) ? cloneFretRange(fretRange) : {
    from: fretRange?.from ?? DEFAULT_FRET_RANGE.from,
    to: fretRange?.to ?? DEFAULT_FRET_RANGE.to,
  };
  const fromValue = escapeAttributeValue(range.from);
  const toValue = escapeAttributeValue(range.to);
  const parsed = { from: parseFretBoundInput(String(range.from)), to: parseFretBoundInput(String(range.to)) };
  const displayRange = isValidFretRange(parsed) ? parsed : committedRange;
  const presetButtons = FRET_RANGE_PRESETS
    .map((preset) => {
      const isSelected = isValidFretRange(parsed) && parsed.from === preset.from && parsed.to === preset.to;
      const selectedClass = isSelected ? ' is-selected' : '';
      return `<button class="fret-preset-button${selectedClass}" type="button" data-fret-preset="${escapeAttributeValue(preset.id)}" data-fret-from="${preset.from}" data-fret-to="${preset.to}" aria-pressed="${isSelected}"><strong>${escapeHtml(preset.label)}</strong><span>${preset.from}–${preset.to}</span></button>`;
    })
    .join('');
  const boundField = (bound, label, value) => `<div class="fret-bound-field"><label for="fret-${bound}">${label}</label><div class="bpm-field" aria-label="${label} fret"><button class="bpm-stepper-button" type="button" data-fret-bound="${bound}" data-fret-step="-1" aria-label="Decrease ${label.toLowerCase()} fret">−</button><input id="fret-${bound}" data-fret-bound="${bound}" type="number" inputmode="numeric" enterkeyhint="done" min="${FRET_MIN}" max="${FRET_MAX}" step="1" value="${value}"><button class="bpm-stepper-button" type="button" data-fret-bound="${bound}" data-fret-step="1" aria-label="Increase ${label.toLowerCase()} fret">+</button></div></div>`;
  return `<div class="fret-range-picker" aria-label="Fret range picker"><div class="fret-range-quick-label">Common ranges</div><div class="fret-range-presets" aria-label="Common fret ranges">${presetButtons}</div><div class="fret-span-rail" aria-label="Selected fret span ${displayRange.from} to ${displayRange.to}"><span>0</span><div class="fret-span-track" style="${getFretRailStyle(displayRange)}"><div class="fret-span-fill"></div></div><span>24</span></div><div class="fret-range-custom-label">Custom range</div><div class="fret-range-inputs" aria-label="Fret range inputs">${boundField('from', 'From', fromValue)}${boundField('to', 'To', toValue)}</div></div>${fretRangeError ? `<p class="field-error" role="alert">${escapeAttributeValue(fretRangeError)}</p>` : ''}`;
}

function renderLocationModeControls(locationMode = DEFAULT_LOCATION_MODE) {
  return LOCATION_MODES
    .map((mode) => {
      const label = mode === 'all-in-range' ? 'All in range' : 'One per string';
      const description = mode === 'all-in-range'
        ? 'Every matching location on each selected string, lowest fret first.'
        : 'One target per selected string within the range.';
      const selectedClass = locationMode === mode ? ' is-selected' : '';
      return `<button class="choice-row${selectedClass}" type="button" data-location-mode="${escapeAttributeValue(mode)}" aria-pressed="${locationMode === mode}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(description)}</span></button>`;
    })
    .join('');
}

function renderTuningControls(tuning = DEFAULT_TUNING, draft) {
  const activeTuning = cloneTuning(tuning);
  const presetButtons = TUNING_PRESETS
    .map((preset) => {
      const isSelected = activeTuning.id === preset.id;
      const selectedClass = isSelected ? ' is-selected' : '';
      return `<button class="choice-row${selectedClass}" type="button" data-tuning-id="${escapeAttributeValue(preset.id)}" aria-pressed="${isSelected}"><strong>${escapeHtml(preset.label)}</strong><span>${escapeHtml(preset.strings.join(' '))}</span></button>`;
    })
    .join('');
  const customValue = escapeAttributeValue(draft ?? activeTuning.strings.join(' '));
  return `<div class="choice-stack" aria-label="Tuning presets">${presetButtons}</div><div class="tuning-custom-row"><label for="custom-tuning">Custom</label><input id="custom-tuning" name="custom-tuning" type="text" enterkeyhint="done" value="${customValue}"></div>`;
}

function renderStringControls(tuning = DEFAULT_TUNING, selectedStringIndexes) {
  const activeTuning = cloneTuning(tuning);
  const selected = new Set(normalizeSelectedStringIndexes(selectedStringIndexes, activeTuning.strings.length));
  return createTuningStrings(activeTuning.strings).map((string, index) => {
    const isSelected = selected.has(index);
    const selectedClass = isSelected ? ' is-selected' : '';
    return `<button class="string-chip${selectedClass}" type="button" data-string-index="${index}" aria-label="String ${escapeAttributeValue(string.number)} ${escapeAttributeValue(string.label)}" aria-pressed="${isSelected}"><span class="string-number" aria-hidden="true">${escapeHtml(string.number)}</span><span>${escapeHtml(string.label)}</span></button>`;
  }).join('');
}

function getSetupCoverage({ selectedLabels: labels, fretRange, bpm, locationMode, tuning, selectedStringIndexes }) {
  const range = normalizeFretRange(fretRange);
  const activeTuning = cloneTuning(tuning);
  const strings = createTuningStrings(activeTuning.strings);
  const activeIndexes = normalizeSelectedStringIndexes(selectedStringIndexes, activeTuning.strings.length);
  const groups = createRangeFilteredRound(labels, range, (items) => items, locationMode, strings, activeIndexes);
  const available = new Set(groups.map(group => group.label));
  const omitted = labels.filter(label => !available.has(label));
  const notes = omitted.length ? `${groups.length} of ${labels.length} notes available` : `${groups.length} notes`;
  const clicks = getRoundClickCount(groups);
  return {
    summary: `${notes} · ${clicks} clicks · ${formatRoundDuration(clicks, bpm)}`,
    omitted,
    error: labels.length === 0 ? 'Select at least one note.' : groups.length === 0 ? 'No selected notes are available in this fret range.' : '',
  };
}

function getTuningLabel(tuning = DEFAULT_TUNING) {
  const activeTuning = cloneTuning(tuning);
  return TUNING_PRESETS.find((preset) => preset.id === activeTuning.id)?.label ?? 'Custom';
}

function getStringSummary(tuning = DEFAULT_TUNING, selectedStringIndexes) {
  const activeTuning = cloneTuning(tuning);
  const selected = normalizeSelectedStringIndexes(selectedStringIndexes, activeTuning.strings.length);
  return selected.map((index) => activeTuning.strings[index]).join(' ');
}

function getLocationModeLabel(locationMode = DEFAULT_LOCATION_MODE) {
  return locationMode === 'all-in-range' ? 'All in range' : 'One per string';
}

function renderBrand() {
  return `<h1 class="brand-heading"><button id="brand-home-button" class="app-brand" type="button" aria-label="fretflash — return to setup"><img class="brand-mark" src="assets/icons/fretflash-six-line-f.svg?v=a4ebea2a326f3f0a" alt="" aria-hidden="true" width="28" height="28"><span class="brand-wordmark">fretflash.</span></button></h1>`;
}

function renderDrillCell(id, label, value, openPopover, error = '') {
  const isOpen = openPopover === id;
  return `<button class="drill-cell${isOpen ? ' is-open' : ''}" type="button" data-popover-target="${escapeAttributeValue(id)}" aria-expanded="${isOpen}"${error ? ' aria-invalid="true"' : ''}><span class="drill-cell-label">${escapeHtml(label)}${error ? ' · Check' : ''}</span><strong>${escapeHtml(value)}</strong><span class="drill-cell-chevron" aria-hidden="true">⌄</span></button>`;
}

function renderDrillHeader(setup, renderFretRange, openPopover = '', errors = {}) {
  return `<section class="drill-header" aria-label="Drill setup">
${renderDrillCell('bpm', 'BPM', setup.bpm, openPopover, errors.bpm)}
${renderDrillCell('fret-range', 'Frets', getFretRangeLabel(isValidFretRange(renderFretRange) ? renderFretRange : setup.fretRange), openPopover, errors.fretRange)}
${renderDrillCell('strings', 'Strings', getStringSummary(setup.tuning, setup.selectedStringIndexes), openPopover)}
${renderDrillCell('tuning', 'Tuning', getTuningLabel(setup.tuning), openPopover, errors.tuning)}
${renderDrillCell('targets', 'Targets', getLocationModeLabel(setup.locationMode), openPopover)}
${renderSpokenCues(setup)}
</section>`;
}

const BPM_QUICK_PICKS = [30, 40, 60, 80, 120, 160];

function renderBpmControls(setup, draft) {
  const maximum = setup.bpmMax ?? getSpokenBpmMax(setup);
  const quickPickButtons = BPM_QUICK_PICKS.map((bpm) => {
    const selectedClass = setup.bpm === bpm ? ' class="is-selected"' : '';
    return `<button${selectedClass} type="button" data-bpm="${bpm}" aria-pressed="${setup.bpm === bpm ? 'true' : 'false'}"${bpm > maximum ? ' disabled' : ''}>${bpm}</button>`;
  }).join('');

  return `<div class="bpm-field" aria-label="BPM value"><button class="bpm-stepper-button" type="button" data-bpm-step="-1" aria-label="Decrease BPM">−</button><input id="bpm" name="bpm" type="number" inputmode="numeric" enterkeyhint="done" aria-label="BPM" min="${BPM_MIN}" max="${maximum}" step="1" value="${escapeAttributeValue(draft ?? setup.bpm)}"><button class="bpm-stepper-button" type="button" data-bpm-step="1" aria-label="Increase BPM">+</button></div><div class="quick-picks" aria-label="BPM quick picks">${quickPickButtons}</div>${maximum < BPM_MAX ? `<p class="microcopy">Spoken cues: maximum ${maximum} BPM for this drill.</p>` : ''}`;
}

function renderEditor(id, title, body, openPopover) {
  return `<div class="header-popover" role="dialog" aria-label="${escapeAttributeValue(title)}" data-popover="${escapeAttributeValue(id)}"${openPopover === id ? ' data-open="true"' : ''}><div class="editor-heading"><h2>${escapeHtml(title)}</h2><button type="button" data-close-editor aria-label="Close ${escapeAttributeValue(title)}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>${body}</div>`;
}

function renderHeaderPopovers(setup, renderFretRange, fretRangeError = '', openPopover = '', drafts = {}) {
  const popover = (id, title, body) => renderEditor(id, title, body, openPopover);
  return `<div class="header-popovers" aria-live="polite">
${popover('bpm', 'BPM', renderBpmControls(setup, drafts.bpm))}
${popover('fret-range', 'Fret range', renderFretRangeControls(renderFretRange, fretRangeError, setup.fretRange))}
${popover('strings', 'Strings', `<div class="string-grid${setup.tuning.strings.length === 7 ? ' string-grid-seven' : ''}" aria-label="Selected strings">${renderStringControls(setup.tuning, setup.selectedStringIndexes)}</div><p class="microcopy">Toggle strings to include or exclude targets. At least one string is required.</p>`)}
${popover('tuning', 'Tuning', renderTuningControls(setup.tuning, drafts.tuning))}
${popover('targets', 'Targets', `<div class="choice-stack">${renderLocationModeControls(setup.locationMode)}</div>`)}
</div>`;
}

function selectedLabelsMatchPreset(selectedLabels, presetLabels) {
  if (!Array.isArray(selectedLabels) || !Array.isArray(presetLabels) || selectedLabels.length !== presetLabels.length) {
    return false;
  }
  const selected = new Set(selectedLabels);
  return presetLabels.every((label) => selected.has(label));
}

function renderPromptDeck(selectedLabels) {
  const selected = new Set(selectedLabels);
  const presetButtons = [['all', 'All'], ['naturals', 'Naturals'], ['sharps', 'Sharps'], ['flats', 'Flats']]
    .map(([key, label]) => {
      const isSelected = selectedLabelsMatchPreset(selectedLabels, NOTE_PRESETS[key]);
      const selectedClass = isSelected ? ' is-selected' : '';
      return `<button class="preset-button${selectedClass}" type="button" data-preset="${escapeAttributeValue(key)}" aria-pressed="${isSelected ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
    })
    .join('');
  const clearButton = '<button class="preset-button ghost" type="button" data-preset="clear">Clear all</button>';
  const noteButtons = NOTE_LETTERS.map(letter => `<div class="note-group" role="group" aria-label="${letter} spellings">${[letter, `${letter}b`, `${letter}#`].map((label) => {
    const isSelected = selected.has(label);
    const selectedClass = isSelected ? ' is-selected' : '';
    return `<button class="note-pill${selectedClass}" type="button" data-note-label="${escapeAttributeValue(label)}" aria-pressed="${isSelected}">${escapeHtml(label)}</button>`;
  }).join('')}</div>`).join('');

  return `<section class="prompt-deck" aria-label="Note prompt deck">
<div class="deck-heading"><h2>Notes to practice</h2></div>
<div class="deck-tools"><div class="preset-row" aria-label="Note pool presets">${presetButtons}</div>${clearButton}</div>
<div class="note-grid">${noteButtons}</div>
</section>`;
}

function renderShortcutBar(phase) {
  const primary = phase === 'idle' ? 'Start' : phase === 'done' ? 'Shuffle' : phase === 'paused' ? 'Resume' : 'Pause';
  const home = '<a class="home-link" href="https://vich.io/"><span class="footer-label">vich.io</span></a>';
  if (phase === 'idle') {
    return `<footer class="app-footer"><p class="shortcut-hint"><span class="shortcut-plain">SPACE ${primary}</span><kbd><span class="footer-label">SPACE</span></kbd> <span class="footer-label">${primary}</span></p>${home}</footer>`;
  }
  const esc = 'Exit';
  return `<footer class="app-footer"><p class="shortcut-hint"><span class="shortcut-plain">SPACE ${primary} · ESC ${esc}</span><kbd><span class="footer-label">SPACE</span></kbd> <span class="footer-label">${primary}</span> <span class="footer-label">·</span> <kbd><span class="footer-label">ESC</span></kbd> <span class="footer-label">${esc}</span></p>${home}</footer>`;
}

function renderPracticeContext(setup, phase) {
  const tempoLabel = `<span class="drill-cell-label">BPM</span><strong>${setup.bpm}</strong>`;
  const tempo = ['paused', 'done'].includes(phase)
    ? `<button class="drill-cell" type="button" data-popover-target="bpm" aria-expanded="${setup.openPopover === 'bpm'}"${setup.fieldErrors?.bpm ? ' aria-invalid="true"' : ''}>${tempoLabel}<span class="drill-cell-chevron" aria-hidden="true">⌄</span></button>`
    : `<div class="drill-cell practice-tempo">${tempoLabel}</div>`;
  return `<section class="practice-context" aria-label="Current drill setup"><div class="context-line">${tempo}<div class="drill-cell"><span class="drill-cell-label">Frets</span><strong>${escapeHtml(getFretRangeLabel(setup.fretRange))}</strong></div>${renderSpokenCues(setup)}</div><details class="context-details"><summary>Setup details</summary><p>Strings ${escapeHtml(getStringSummary(setup.tuning, setup.selectedStringIndexes))}<br>Tuning ${escapeHtml(getTuningLabel(setup.tuning))}<br>Targets ${escapeHtml(getLocationModeLabel(setup.locationMode))} · Shuffled</p></details></section>`;
}

function renderSpokenCues(setup) {
  return `<button id="spoken-cues-button" class="drill-cell spoken-cues-toggle" type="button" aria-pressed="${setup.spokenCues}" aria-busy="${Boolean(setup.spokenPending)}"><span class="drill-cell-label">Spoken cues</span><strong class="spoken-cues-state" aria-hidden="true">${setup.spokenPending ? 'Loading…' : setup.spokenCues ? 'On' : 'Off'}</strong></button>`;
}

function renderPracticeStage(content, setup, phase, feedback) {
  const editor = ['paused', 'done'].includes(phase) ? renderEditor('bpm', 'BPM', renderBpmControls(setup, setup.drafts?.bpm), setup.openPopover) : '';
  return `<main class="app-shell app-shell-practice">
<div class="practice-stage">
<div class="setup-app-bar practice-app-bar">
${renderBrand()}<div data-maintenance-slot></div>
</div>
${renderPracticeContext(setup, phase)}
<div class="practice-editor">${editor}</div>
${content}
${feedback}
${renderShortcutBar(phase)}
</div>
</main>`;
}

export function renderHtml(
  view,
  setupInput = createSetup(),
  error = '',
) {
  if (setupInput === null || typeof setupInput !== 'object' || Array.isArray(setupInput)) {
    throw new TypeError('renderHtml expects a setup object');
  }
  const setup = { ...createSetup(setupInput), bpmMax: setupInput.bpmMax, openPopover: setupInput.openPopover, drafts: setupInput.drafts, fieldErrors: setupInput.fieldErrors, spokenPending: setupInput.spokenPending };
  const renderFretRange = Object.hasOwn(setupInput, 'renderFretRange') ? setupInput.renderFretRange : setup.fretRange;
  const { selectedLabels } = setup;
  const openPopover = setupInput?.openPopover ?? '';
  const fretRangeError = setupInput.fieldErrors?.fretRange || (error === FRET_RANGE_ERROR ? error : '');
  const invalidRange = setupInput.invalidDraft ?? !isValidFretRange(renderFretRange);
  const errorHtml = error && error !== FRET_RANGE_ERROR ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : '';
  const hiddenErrors = [['bpm', 'BPM', setupInput.fieldErrors?.bpm], ['fret-range', 'Frets', fretRangeError], ['tuning', 'Tuning', setupInput.fieldErrors?.tuning]].filter(([id,, message]) => message && id !== openPopover);
  const recovery = hiddenErrors.map(([id, label, message]) => `<div class="draft-recovery" role="alert"><p>${escapeHtml(message)}</p><button type="button" data-recover-editor="${id}">Fix ${label}</button></div>`).join('');
  const feedback = `<div id="app-feedback">${recovery}${hiddenErrors.some(([, , message]) => message === error) ? '' : errorHtml}</div>`;

  if (view.phase === 'idle') {
    const coverage = getSetupCoverage(setup);
    const startDisabled = Boolean(invalidRange || coverage.error);
    const coverageError = coverage.error && error !== coverage.error && !invalidRange && !Object.values(setupInput.fieldErrors ?? {}).some(Boolean)
      ? `<p class="error" role="alert">${escapeHtml(coverage.error)}</p>` : '';
    const omissions = coverage.omitted.length
      ? `<details class="note-availability"><summary>${coverage.omitted.length} omitted ${coverage.omitted.length === 1 ? 'note' : 'notes'}</summary><p>${coverage.omitted.map(escapeHtml).join(' ')}</p></details>` : '';
    return `<main class="app-shell app-shell-setup">
<div class="setup-launcher">
<div class="setup-scroll">
<div class="setup-app-bar">
${renderBrand()}<div data-maintenance-slot></div>
</div>
${renderDrillHeader(setup, renderFretRange, openPopover, setupInput.fieldErrors)}
${renderHeaderPopovers(setup, renderFretRange, fretRangeError, openPopover, setupInput.drafts)}
<p class="visually-hidden">${escapeHtml(view.prompt)}</p>
${renderPromptDeck(selectedLabels)}
</div>
<div class="setup-transport">${feedback}${coverageError}<div class="setup-start-row"><p class="note-pool-summary">${escapeHtml(coverage.summary)} · shuffled</p><footer class="deck-footer"><button id="start-button" class="primary-action" type="button"${startDisabled ? ' disabled aria-disabled="true"' : ''}>${escapeHtml(view.primaryButton ?? 'Start')}</button></footer></div>${omissions}</div>
<div class="setup-tail"><div id="quick-reference-slot"></div>
${renderShortcutBar(view.phase)}</div>
</div>
</main>`;
  }

  const isCountIn = view.countdown !== undefined && view.countdown !== null;
  const phaseClass = view.phase === 'done' ? 'practice-done' : view.phase === 'paused' ? 'practice-paused' : view.phase === 'countin' ? 'practice-countin' : 'practice-running';
  const progressChips = (view.progressLabels ?? []).map((label, index, labels) => {
    const terminalDoneIndex = view.phase === 'done' ? labels.length - 1 : -1;
    const isComplete = index < view.progressIndex;
    const isCurrent = index === view.progressIndex || index === terminalDoneIndex;
    const chipClass = `${isComplete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}`;
    const current = isCurrent ? ' aria-current="step"' : '';
    return `<span class="progress-cell${chipClass}" data-progress-label="${escapeAttributeValue(label)}"${current}><span class="progress-label">${escapeHtml(label)}</span></span>`;
  }).join('');
  const beatValue = `${view.beatNumber} / ${view.beatCount}`;
  const statusSlot = view.phase === 'paused'
    ? '<p class="practice-status is-paused">Paused</p>'
    : '<p class="practice-status" aria-hidden="true"></p>';
  const renderCueRow = () => `<div class="practice-cue-row"><div class="practice-string" aria-label="Current string"><strong>${escapeHtml(view.stringCue)}</strong></div><div class="beat-meter" aria-label="Beat ${escapeAttributeValue(beatValue)}"><strong>${escapeHtml(beatValue)}</strong></div></div>`;
  const noteProgress = `<div class="note-progress-rail" aria-label="Note progress">${progressChips}</div>`;
  const controls = `<div class="actions practice-actions">${view.showPause ? '<button id="pause-button" class="secondary-action" type="button">Pause</button>' : ''}${view.showResume ? '<button id="resume-button" class="secondary-action" type="button">Resume</button>' : ''}${view.showRestart ? '<button id="restart-button" class="secondary-action" type="button">Restart</button>' : '<span class="transport-reserve" aria-hidden="true"></span>'}${view.showStop ? '<button id="stop-button" class="danger-action" type="button">Stop</button>' : ''}</div>`;

  const renderNext = (label, caption = 'Next') => label
    ? `<div class="next-note" aria-label="Next note"><span>${escapeHtml(caption)}</span><strong>${escapeHtml(label)}</strong></div>`
    : '<div class="next-note is-reserved" aria-hidden="true"><span></span><strong></strong></div>';

  if (view.phase === 'done') {
    const sameOrderButton = view.showSameOrder
      ? '<button id="same-order-button" class="secondary-action" type="button">Repeat</button>'
      : '';
    const doneControls = `<div class="actions done-actions">${sameOrderButton}<button id="start-button" class="primary-action" type="button">${escapeHtml(view.primaryButton)}</button><button id="setup-button" class="secondary-action" type="button">Setup</button></div>`;
    const reservedCueRow = '<div class="practice-cue-row is-reserved" aria-hidden="true"><div class="practice-string"><strong></strong></div><div class="beat-meter"><strong></strong></div></div>';
    const reservedNext = '<div class="next-note is-reserved" aria-hidden="true"><span></span><strong></strong></div>';
    return renderPracticeStage(`<section class="practice-display ${phaseClass}" aria-live="polite">${statusSlot}${reservedCueRow}<div class="current-note current-note-done" aria-label="Completed drill"><span class="hero-label" aria-hidden="true"></span><strong>${escapeHtml(view.prompt)}</strong></div>${reservedNext}${noteProgress}${doneControls}</section>`, setup, view.phase, feedback);
  }

  if (isCountIn) {
    const countInNumber = view.countdown;
    return renderPracticeStage(`<section class="practice-display ${phaseClass}" aria-live="polite"><p class="visually-hidden">${escapeHtml(`Starting in ${countInNumber}`)}</p>${statusSlot}${renderCueRow()}<div class="current-note" aria-label="Starting note"><span class="hero-label">${escapeHtml(`Starting in ${countInNumber}`)}</span><strong>${escapeHtml(view.preview)}</strong></div>${renderNext(view.progressLabels?.[1], 'Next after that')}${noteProgress}${controls}</section>`, setup, view.phase, feedback);
  }

  return renderPracticeStage(`<section class="practice-display ${phaseClass}" aria-live="polite">${statusSlot}${renderCueRow()}<div class="current-note" aria-label="Current note"><span class="hero-label" aria-hidden="true"></span><strong>${escapeHtml(view.prompt)}</strong></div>${renderNext(view.preview)}${noteProgress}${controls}</section>`, setup, view.phase, feedback);
}

