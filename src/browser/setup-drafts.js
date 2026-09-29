import {
  BPM_MIN, BPM_MAX, FRET_MIN, FRET_MAX, createSetup,
  parseBpmInput, parseFretBoundInput, parseTuningInput, isValidFretRange,
} from '../settings.js';

export const FRET_RANGE_ERROR = `Choose frets between ${FRET_MIN} and ${FRET_MAX}, with From no higher than To.`;

// Drafts are UI state, never persisted. Valid fields can commit independently.
export function createSetupDrafts(initialSetup) {
  const values = {};
  const errors = { bpm: '', fretRange: '', tuning: '' };
  function reset(setup, fields = ['bpm', 'fretRange', 'tuning']) {
    if (fields.includes('bpm')) values.bpm = String(setup.bpm);
    if (fields.includes('fretRange')) {
      values.from = String(setup.fretRange.from);
      values.to = String(setup.fretRange.to);
    }
    if (fields.includes('tuning')) values.tuning = setup.tuning.strings.join(' ');
    fields.forEach(field => { errors[field] = ''; });
  }
  function read(currentSetup) {
    const setup = createSetup(currentSetup);
    const bpm = parseBpmInput(values.bpm);
    errors.bpm = bpm === null ? `Choose a BPM between ${BPM_MIN} and ${BPM_MAX}.` : '';
    if (bpm !== null) setup.bpm = bpm;
    const range = { from: parseFretBoundInput(values.from), to: parseFretBoundInput(values.to) };
    errors.fretRange = isValidFretRange(range) ? '' : FRET_RANGE_ERROR;
    if (!errors.fretRange) setup.fretRange = range;
    const tuning = parseTuningInput(values.tuning);
    errors.tuning = tuning ? '' : 'Use 6 or 7 tuning notes like E A D G B e.';
    if (tuning && tuning.strings.join(' ') !== setup.tuning.strings.join(' ')) {
      setup.tuning = tuning;
      setup.selectedStringIndexes = tuning.strings.map((_, index) => index);
    }
    return { setup, valid: !Object.values(errors).some(Boolean) };
  }
  reset(createSetup(initialSetup));
  return { values, errors, reset, read, edit(field, value) {
    if (Object.hasOwn(values, field)) values[field] = String(value);
  } };
}
