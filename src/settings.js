import {
  DEFAULT_SELECTED_LABELS,
  DEFAULT_TUNING,
  KNOWN_NOTE_LABEL_SET,
  TUNING_PRESET_BY_ID,
  normalizePitchLabel,
} from './music.js?v=8f147a0a6df7dadd';

export const BPM_MIN = 10;
export const BPM_MAX = 200;
export const DEFAULT_BPM = 40;
export const SETTINGS_STORAGE_KEY = 'fretflash.settings.v1';
export const LOCATION_MODES = ['one-per-string', 'all-in-range'];
export const DEFAULT_LOCATION_MODE = 'one-per-string';
export const DEFAULT_FRET_RANGE = { from: 0, to: 12 };
export const FRET_MIN = 0;
export const FRET_MAX = 24;

const LOCATION_MODE_SET = new Set(LOCATION_MODES);

export function cloneFretRange(fretRange = DEFAULT_FRET_RANGE) {
  return { from: fretRange.from, to: fretRange.to };
}

function normalizeTuning(tuning = DEFAULT_TUNING) {
  if (!tuning || typeof tuning !== 'object') {
    return DEFAULT_TUNING;
  }

  if (tuning.id !== 'custom') {
    const preset = TUNING_PRESET_BY_ID.get(tuning.id);
    if (preset) {
      return { id: preset.id, strings: [...preset.strings] };
    }
  }

  if (Array.isArray(tuning.strings) && isValidTuningLabels(tuning.strings)) {
    return { id: 'custom', strings: [...tuning.strings] };
  }

  return DEFAULT_TUNING;
}

function isValidSavedTuning(tuning) {
  if (!tuning || typeof tuning !== 'object') {
    return false;
  }

  if (tuning.id !== 'custom') {
    return TUNING_PRESET_BY_ID.has(tuning.id);
  }

  return isValidTuningLabels(tuning.strings);
}

export function cloneTuning(tuning = DEFAULT_TUNING) {
  const normalized = normalizeTuning(tuning);
  return { id: normalized.id, strings: [...normalized.strings] };
}

function isValidTuningLabels(labels) {
  return Array.isArray(labels)
    && (labels.length === 6 || labels.length === 7)
    && labels.every((label) => normalizePitchLabel(label) !== null);
}

export function parseTuningInput(input) {
  if (typeof input !== 'string') {
    return null;
  }
  const labels = input.trim().split(/\s+/).filter(Boolean);
  if (!isValidTuningLabels(labels)) {
    return null;
  }
  return { id: 'custom', strings: labels };
}

export function normalizeSelectedStringIndexes(indexes, stringCount) {
  const allIndexes = Array.from({ length: stringCount }, (_, index) => index);
  if (!Array.isArray(indexes) || indexes.length === 0) {
    return allIndexes;
  }
  const normalized = [...new Set(indexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < stringCount)
    .sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : allIndexes;
}

export function isValidNoteSelection(labels) {
  // Written enharmonic spellings are independent prompts.
  if (!Array.isArray(labels) || labels.length === 0) {
    return false;
  }

  const uniqueLabels = new Set(labels);
  return uniqueLabels.size === labels.length && labels.every((label) => KNOWN_NOTE_LABEL_SET.has(label));
}

export function isValidLocationMode(value) {
  return LOCATION_MODE_SET.has(value);
}

export function isValidFretRange(value) {
  return value !== null
    && typeof value === 'object'
    && Number.isInteger(value.from)
    && Number.isInteger(value.to)
    && value.from >= FRET_MIN
    && value.to <= FRET_MAX
    && value.from <= value.to;
}

export function parseFretBoundInput(value) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const fret = Number(trimmed);
  return Number.isInteger(fret) && fret >= FRET_MIN && fret <= FRET_MAX ? fret : null;
}

export function normalizeFretRange(fretRange) {
  return isValidFretRange(fretRange) ? cloneFretRange(fretRange) : cloneFretRange(DEFAULT_FRET_RANGE);
}

export function isValidBpm(value) {
  return Number.isInteger(value) && value >= BPM_MIN && value <= BPM_MAX;
}

export function parseBpmInput(value) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const bpm = Number(trimmed);
  return isValidBpm(bpm) ? bpm : null;
}

function isSetupObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createSetup(setup = {}) {
  const source = isSetupObject(setup) ? setup : {};
  const activeTuning = cloneTuning(source.tuning);
  return {
    bpm: Object.hasOwn(source, 'bpm') ? source.bpm : DEFAULT_BPM,
    spokenCues: source.spokenCues === true,
    selectedLabels: Array.isArray(source.selectedLabels) ? [...source.selectedLabels] : [...DEFAULT_SELECTED_LABELS],
    fretRange: normalizeFretRange(source.fretRange),
    locationMode: isValidLocationMode(source.locationMode) ? source.locationMode : DEFAULT_LOCATION_MODE,
    tuning: activeTuning,
    selectedStringIndexes: normalizeSelectedStringIndexes(source.selectedStringIndexes, activeTuning.strings.length),
  };
}

function defaultSettings() {
  return createSetup();
}

function parseCurrentSavedSetup(parsed) {
  return {
    bpm: parsed.bpm,
    spokenCues: parsed.spokenCues ?? false,
    selectedLabels: [...parsed.selectedLabels],
    fretRange: cloneFretRange(parsed.fretRange),
    locationMode: parsed.locationMode,
  };
}

function withTuning(settings, tuning, selectedStringIndexes) {
  const normalizedTuning = cloneTuning(tuning);
  return {
    ...settings,
    tuning: normalizedTuning,
    selectedStringIndexes: normalizeSelectedStringIndexes(selectedStringIndexes, normalizedTuning.strings.length),
  };
}

function isValidSavedStringSelection(indexes, tuning) {
  const count = cloneTuning(tuning).strings.length;
  return Array.isArray(indexes) && indexes.length > 0
    && new Set(indexes).size === indexes.length
    && indexes.every(index => Number.isInteger(index) && index >= 0 && index < count);
}

export function parseSavedSettings(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!isValidBpm(parsed?.bpm) || !isValidNoteSelection(parsed?.selectedLabels)) {
      return null;
    }

    if (
      parsed.version !== 6
      || (Object.hasOwn(parsed, 'spokenCues') && typeof parsed.spokenCues !== 'boolean')
      || !isValidFretRange(parsed.fretRange)
      || !isValidLocationMode(parsed.locationMode)
      || !isValidSavedTuning(parsed.tuning)
      || !isValidSavedStringSelection(parsed.selectedStringIndexes, parsed.tuning)
    ) {
      return null;
    }

    return withTuning(parseCurrentSavedSetup(parsed), parsed.tuning, parsed.selectedStringIndexes);
  } catch {
    return null;
  }
}

export function loadSettings(storage) {
  const fallback = defaultSettings();
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (raw === null) {
      return fallback;
    }

    return parseSavedSettings(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveSettings(storage, state) {
  if (
    !storage
    || (Object.hasOwn(state, 'spokenCues') && typeof state.spokenCues !== 'boolean')
    || !isValidBpm(state.bpm)
    || !isValidNoteSelection(state.selectedLabels)
    || !isValidFretRange(state.fretRange)
    || !isValidLocationMode(state.locationMode)
    || !isValidSavedTuning(state.tuning)
    || !isValidSavedStringSelection(state.selectedStringIndexes, state.tuning)
  ) {
    return;
  }

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      version: 6,
      bpm: state.bpm,
      spokenCues: state.spokenCues === true,
      selectedLabels: state.selectedLabels,
      fretRange: cloneFretRange(state.fretRange),
      locationMode: state.locationMode,
      tuning: cloneTuning(state.tuning),
      selectedStringIndexes: [...state.selectedStringIndexes].sort((a, b) => a - b),
    }));
  } catch {
    // Persistence is a convenience only. The app must remain usable without it.
  }
}
