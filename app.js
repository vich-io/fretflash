// Musical model and defaults
export const PITCHES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NOTE_PROMPTS = [
  { label: 'B#', soundGroup: 'C' },
  { label: 'C', soundGroup: 'C' },
  { label: 'C#', soundGroup: 'C#/Db' },
  { label: 'Db', soundGroup: 'C#/Db' },
  { label: 'D', soundGroup: 'D' },
  { label: 'D#', soundGroup: 'D#/Eb' },
  { label: 'Eb', soundGroup: 'D#/Eb' },
  { label: 'E', soundGroup: 'E' },
  { label: 'Fb', soundGroup: 'E' },
  { label: 'E#', soundGroup: 'F' },
  { label: 'F', soundGroup: 'F' },
  { label: 'F#', soundGroup: 'F#/Gb' },
  { label: 'Gb', soundGroup: 'F#/Gb' },
  { label: 'G', soundGroup: 'G' },
  { label: 'G#', soundGroup: 'G#/Ab' },
  { label: 'Ab', soundGroup: 'G#/Ab' },
  { label: 'A', soundGroup: 'A' },
  { label: 'A#', soundGroup: 'A#/Bb' },
  { label: 'Bb', soundGroup: 'A#/Bb' },
  { label: 'B', soundGroup: 'B' },
  { label: 'Cb', soundGroup: 'B' },
];
const KNOWN_NOTE_LABELS = NOTE_PROMPTS.map((prompt) => prompt.label);
const KNOWN_NOTE_LABEL_SET = new Set(KNOWN_NOTE_LABELS);
const NOTE_PROMPT_GROUPS = NOTE_PROMPTS.reduce((groups, prompt) => {
  const currentGroup = groups.at(-1);
  if (currentGroup && currentGroup.soundGroup === prompt.soundGroup) {
    currentGroup.prompts.push(prompt);
  } else {
    groups.push({ soundGroup: prompt.soundGroup, prompts: [prompt] });
  }
  return groups;
}, []);
const NOTE_PRESET_BUTTONS = [
  ['flats', 'Flats'],
  ['sharps', 'Sharps'],
  ['naturals', 'Naturals'],
  ['all', 'All'],
  ['clear', 'Clear'],
];

export const DEFAULT_SELECTED_LABELS = [...PITCHES];
export const NOTE_PRESETS = {
  flats: [...DEFAULT_SELECTED_LABELS],
  sharps: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  naturals: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  all: ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'E#', 'Fb', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'B#', 'Cb'],
  clear: [],
};
export const BPM_MIN = 20;
export const BPM_MAX = 240;
export const SETTINGS_STORAGE_KEY = 'fretflash.settings.v1';
export const DRILL_MODES = ['classic', 'range-filtered'];
export const DEFAULT_DRILL_MODE = 'range-filtered';
export const LOCATION_MODES = ['one-per-string', 'all-in-range'];
export const DEFAULT_LOCATION_MODE = 'one-per-string';
const LEGACY_FRET_RANGES = [
  { id: '0-5', label: '0–5', from: 0, to: 5 },
  { id: '5-9', label: '5–9', from: 5, to: 9 },
  { id: '7-12', label: '7–12', from: 7, to: 12 },
];
export const DEFAULT_FRET_RANGE = { from: 0, to: 12 };
export const FRET_MIN = 0;
export const FRET_MAX = 24;
const FRET_RANGE_ERROR = `Choose frets between ${FRET_MIN} and ${FRET_MAX}, with From no higher than To.`;
export const TUNING_PRESETS = [
  { id: 'standard-6', label: 'Standard', strings: ['E', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'drop-d', label: 'Drop D', strings: ['D', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'd-standard', label: 'D standard', strings: ['D', 'G', 'C', 'F', 'A', 'd'] },
  { id: 'standard-7', label: '7-string standard', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
];
export const DEFAULT_TUNING = { id: 'standard-6', strings: ['E', 'A', 'D', 'G', 'B', 'e'] };
export const DEFAULT_SELECTED_STRING_INDEXES = [0, 1, 2, 3, 4, 5];
const DRILL_MODE_SET = new Set(DRILL_MODES);
const LOCATION_MODE_SET = new Set(LOCATION_MODES);
const TUNING_PRESET_BY_ID = new Map(TUNING_PRESETS.map((preset) => [preset.id, preset]));
const LEGACY_FRET_RANGE_BY_ID = new Map(LEGACY_FRET_RANGES.map((range) => [range.id, range]));
const PITCH_CLASS_INDEX = new Map(PITCHES.map((pitch, index) => [pitch, index]));
const SOUND_GROUP_INDEX = new Map([
  ['C', 0],
  ['C#/Db', 1],
  ['D', 2],
  ['D#/Eb', 3],
  ['E', 4],
  ['F', 5],
  ['F#/Gb', 6],
  ['G', 7],
  ['G#/Ab', 8],
  ['A', 9],
  ['A#/Bb', 10],
  ['B', 11],
]);
const NOTE_LABEL_TO_INDEX = new Map(NOTE_PROMPTS.map((prompt) => [prompt.label, SOUND_GROUP_INDEX.get(prompt.soundGroup)]));
const TUNING_LABEL_PATTERN = /^[A-Ga-g](?:#|b)?$/;

function normalizePitchLabel(label) {
  if (typeof label !== 'string' || !TUNING_LABEL_PATTERN.test(label)) {
    return null;
  }
  const letter = label[0].toUpperCase();
  const accidental = label.slice(1);
  const pitch = `${letter}${accidental}`;
  const pitchIndex = NOTE_LABEL_TO_INDEX.get(pitch);
  return pitchIndex === undefined ? null : PITCHES[pitchIndex];
}

export function createTuningStrings(labels = DEFAULT_TUNING.strings) {
  const count = labels.length;
  return labels.map((label, index) => ({
    number: count - index,
    label,
    pitch: normalizePitchLabel(label),
  }));
}

export const STRING_ORDER = createTuningStrings(DEFAULT_TUNING.strings);

// Persistence
function cloneFretRange(fretRange = DEFAULT_FRET_RANGE) {
  return { from: fretRange.from, to: fretRange.to };
}

function cloneTuning(tuning = DEFAULT_TUNING) {
  const normalized = normalizeTuning(tuning);
  return { id: normalized.id, strings: [...normalized.strings] };
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

function defaultSettings() {
  return {
    bpm: 60,
    selectedLabels: [...DEFAULT_SELECTED_LABELS],
    drillMode: DEFAULT_DRILL_MODE,
    fretRange: cloneFretRange(DEFAULT_FRET_RANGE),
    locationMode: DEFAULT_LOCATION_MODE,
    tuning: cloneTuning(DEFAULT_TUNING),
    selectedStringIndexes: [...DEFAULT_SELECTED_STRING_INDEXES],
  };
}

function parseLegacyFretRangeId(fretRangeId) {
  const range = LEGACY_FRET_RANGE_BY_ID.get(fretRangeId);
  return range ? { from: range.from, to: range.to } : cloneFretRange(DEFAULT_FRET_RANGE);
}

function withDefaultTuning(settings) {
  return {
    ...settings,
    tuning: cloneTuning(DEFAULT_TUNING),
    selectedStringIndexes: [...DEFAULT_SELECTED_STRING_INDEXES],
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

export function parseSavedSettings(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!isValidBpm(parsed?.bpm) || !isValidNoteSelection(parsed?.selectedLabels)) {
      return null;
    }

    if (parsed.version === 1) {
      return withDefaultTuning({
        bpm: parsed.bpm,
        selectedLabels: [...parsed.selectedLabels],
        drillMode: DEFAULT_DRILL_MODE,
        fretRange: cloneFretRange(DEFAULT_FRET_RANGE),
        locationMode: DEFAULT_LOCATION_MODE,
      });
    }

    if (parsed.version === 2) {
      if (!isValidDrillMode(parsed.drillMode)) {
        return null;
      }

      return withDefaultTuning({
        bpm: parsed.bpm,
        selectedLabels: [...parsed.selectedLabels],
        drillMode: normalizeDrillMode(parsed.drillMode),
        fretRange: migrateFretRangeForLegacyDrillMode(parsed.drillMode, parseLegacyFretRangeId(parsed.fretRangeId)),
        locationMode: migrateLocationModeForLegacyDrillMode(parsed.drillMode, DEFAULT_LOCATION_MODE),
      });
    }

    if (parsed.version === 3) {
      if (!isValidDrillMode(parsed.drillMode) || !isValidFretRange(parsed.fretRange)) {
        return null;
      }

      return withDefaultTuning({
        bpm: parsed.bpm,
        selectedLabels: [...parsed.selectedLabels],
        drillMode: normalizeDrillMode(parsed.drillMode),
        fretRange: migrateFretRangeForLegacyDrillMode(parsed.drillMode, parsed.fretRange),
        locationMode: migrateLocationModeForLegacyDrillMode(parsed.drillMode, DEFAULT_LOCATION_MODE),
      });
    }

    if (parsed.version === 4) {
      if (!isValidDrillMode(parsed.drillMode) || !isValidFretRange(parsed.fretRange)) {
        return null;
      }

      return withDefaultTuning({
        bpm: parsed.bpm,
        selectedLabels: [...parsed.selectedLabels],
        drillMode: normalizeDrillMode(parsed.drillMode),
        fretRange: migrateFretRangeForLegacyDrillMode(parsed.drillMode, parsed.fretRange),
        locationMode: migrateLocationModeForLegacyDrillMode(parsed.drillMode, parsed.locationMode),
      });
    }

    if (parsed.version === 5) {
      if (!isValidDrillMode(parsed.drillMode) || !isValidFretRange(parsed.fretRange)) {
        return null;
      }

      return withTuning({
        bpm: parsed.bpm,
        selectedLabels: [...parsed.selectedLabels],
        drillMode: normalizeDrillMode(parsed.drillMode),
        fretRange: migrateFretRangeForLegacyDrillMode(parsed.drillMode, parsed.fretRange),
        locationMode: migrateLocationModeForLegacyDrillMode(parsed.drillMode, parsed.locationMode),
      }, parsed.tuning, undefined);
    }

    if (parsed.version !== 6 || !isValidDrillMode(parsed.drillMode) || !isValidFretRange(parsed.fretRange)) {
      return null;
    }

    return withTuning({
      bpm: parsed.bpm,
      selectedLabels: [...parsed.selectedLabels],
      drillMode: normalizeDrillMode(parsed.drillMode),
      fretRange: migrateFretRangeForLegacyDrillMode(parsed.drillMode, parsed.fretRange),
      locationMode: migrateLocationModeForLegacyDrillMode(parsed.drillMode, parsed.locationMode),
    }, parsed.tuning, parsed.selectedStringIndexes);
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
    || !isValidBpm(state.bpm)
    || !isValidNoteSelection(state.selectedLabels)
    || !isValidDrillMode(state.drillMode)
    || !isValidFretRange(state.fretRange)
    || !isValidLocationMode(state.locationMode)
  ) {
    return;
  }

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      version: 6,
      bpm: state.bpm,
      selectedLabels: state.selectedLabels,
      drillMode: state.drillMode,
      fretRange: cloneFretRange(state.fretRange),
      locationMode: state.locationMode,
      tuning: cloneTuning(state.tuning),
      selectedStringIndexes: normalizeSelectedStringIndexes(
        state.selectedStringIndexes,
        cloneTuning(state.tuning).strings.length,
      ),
    }));
  } catch {
    // Persistence is a convenience only. The app must remain usable without it.
  }
}

// Validation and fret-range helpers
export function isValidNoteSelection(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    return false;
  }

  const uniqueLabels = new Set(labels);
  return uniqueLabels.size === labels.length && labels.every((label) => KNOWN_NOTE_LABEL_SET.has(label));
}

export function isValidDrillMode(value) {
  return DRILL_MODE_SET.has(value);
}

function normalizeDrillMode(value) {
  return isValidDrillMode(value) ? DEFAULT_DRILL_MODE : null;
}

function migrateFretRangeForLegacyDrillMode(drillMode, fretRange) {
  return drillMode === 'classic' ? cloneFretRange(DEFAULT_FRET_RANGE) : cloneFretRange(fretRange);
}

function migrateLocationModeForLegacyDrillMode(drillMode, locationMode) {
  if (drillMode === 'classic') {
    return DEFAULT_LOCATION_MODE;
  }

  return isValidLocationMode(locationMode) ? locationMode : DEFAULT_LOCATION_MODE;
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

function normalizeFretRange(fretRange) {
  return isValidFretRange(fretRange) ? cloneFretRange(fretRange) : cloneFretRange(DEFAULT_FRET_RANGE);
}

function getFretRangeLabel(fretRange) {
  const range = normalizeFretRange(fretRange);
  return `${range.from}–${range.to}`;
}

function getMatchingFretsForString(label, string, fretRange) {
  const targetIndex = NOTE_LABEL_TO_INDEX.get(label);
  const openIndex = PITCH_CLASS_INDEX.get(string.pitch ?? normalizePitchLabel(string.label));
  const range = normalizeFretRange(fretRange);
  if (targetIndex === undefined || openIndex === undefined) {
    return [];
  }

  const frets = [];
  const firstMatchingFret = (targetIndex - openIndex + 12) % 12;
  for (let fret = firstMatchingFret; fret <= FRET_MAX; fret += 12) {
    if (fret >= range.from && fret <= range.to) {
      frets.push(fret);
    }
  }

  return frets;
}

function noteExistsOnStringInRange(label, string, fretRange) {
  return getMatchingFretsForString(label, string, fretRange).length > 0;
}

function getSelectedTuningStrings(tuning = DEFAULT_TUNING, selectedStringIndexes) {
  const strings = createTuningStrings(cloneTuning(tuning).strings);
  const indexes = normalizeSelectedStringIndexes(selectedStringIndexes, strings.length);
  return indexes.map((index) => strings[index]);
}

export function getAvailableStringsForLabelInRange(label, fretRange, tuningStrings = STRING_ORDER, selectedStringIndexes) {
  if (!isValidFretRange(fretRange)) {
    return [];
  }

  const strings = Array.isArray(tuningStrings) ? tuningStrings : STRING_ORDER;
  const indexes = selectedStringIndexes === undefined
    ? strings.map((_, index) => index)
    : normalizeSelectedStringIndexes(selectedStringIndexes, strings.length);
  return indexes.map((index) => strings[index]).filter((string) => noteExistsOnStringInRange(label, string, fretRange));
}

export function getAvailableTargetsForLabelInRange(label, fretRange, locationMode = DEFAULT_LOCATION_MODE, tuningStrings = STRING_ORDER, selectedStringIndexes) {
  if (!isValidFretRange(fretRange)) {
    return [];
  }

  const strings = getAvailableStringsForLabelInRange(label, fretRange, tuningStrings, selectedStringIndexes);
  if (locationMode !== 'all-in-range') {
    return strings;
  }

  return strings.flatMap((string) => getMatchingFretsForString(label, string, fretRange)
    .map((fret) => ({ ...string, fret })));
}

export function createRangeFilteredRound(labels, fretRange, shuffleGroups = shuffleSelectedLabels, locationMode = DEFAULT_LOCATION_MODE, tuningStrings = STRING_ORDER, selectedStringIndexes) {
  const activeRange = normalizeFretRange(fretRange);
  const activeLocationMode = isValidLocationMode(locationMode) ? locationMode : DEFAULT_LOCATION_MODE;
  const groups = labels
    .map((label) => ({
      label,
      fretRange: cloneFretRange(activeRange),
      locationMode: activeLocationMode,
      strings: getAvailableTargetsForLabelInRange(label, activeRange, activeLocationMode, tuningStrings, selectedStringIndexes),
    }))
    .filter((group) => group.strings.length > 0);

  const shuffled = shuffleGroups(groups);
  if (shuffled.every((group) => typeof group === 'string')) {
    const groupByLabel = new Map(groups.map((group) => [group.label, group]));
    return shuffled.map((label) => groupByLabel.get(label)).filter(Boolean);
  }

  return shuffled;
}

export function getRoundClickCount(order, drillMode = DEFAULT_DRILL_MODE, selectedStringCount = DEFAULT_SELECTED_STRING_INDEXES.length) {
  if (order.every((group) => Array.isArray(group?.strings))) {
    return order.reduce((total, group) => total + group.strings.length, 0);
  }

  // Legacy callers may still pass a flat prompt array. Treat it as the old
  // all-selected-strings shape while runtime rounds use grouped targets.
  return order.length * selectedStringCount;
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

export function getClickIntervalMs(bpm) {
  return 60000 / bpm;
}

export function formatRoundDuration(clicks, bpm) {
  const totalSeconds = Math.round((clicks * 60) / bpm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

// View-model helpers
function formatActiveStringLabel(string) {
  return string.label;
}

function formatStringCue(string) {
  return `String ${string.number} · ${formatActiveStringLabel(string)}`;
}

function getStringCueForBeat(state, beatInNote) {
  return formatStringCue(getSelectedTuningStrings(state.tuning, state.selectedStringIndexes)[beatInNote - 1]);
}

function getStringCueForTarget(target) {
  return formatStringCue(target);
}

function getCurrentNoteGroup(state) {
  return state.order[state.noteIndex];
}

function getCurrentGroupBeatCount(state) {
  return getCurrentNoteGroup(state)?.strings.length ?? 0;
}

function getCurrentStringCue(state) {
  return getStringCueForTarget(getCurrentNoteGroup(state).strings[state.beatInNote - 1]);
}

function getCurrentPrompt(state) {
  const current = getCurrentNoteGroup(state);
  return current?.label;
}

function getNextPrompt(state) {
  const next = state.order[state.noteIndex + 1];
  if (!next) {
    return 'Done';
  }

  return next.label;
}

// Round and state machine
export function shuffleSelectedLabels(labels, random = Math.random) {
  const shuffled = [...labels];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function createIdleState(
  bpm = 60,
  selectedLabels = DEFAULT_SELECTED_LABELS,
  drillMode = DEFAULT_DRILL_MODE,
  fretRange = DEFAULT_FRET_RANGE,
  locationMode = DEFAULT_LOCATION_MODE,
  tuning = DEFAULT_TUNING,
  selectedStringIndexes,
) {
  const normalizedTuning = cloneTuning(tuning);
  return {
    phase: 'idle',
    bpm,
    order: [],
    selectedLabels: [...selectedLabels],
    drillMode: normalizeDrillMode(drillMode),
    fretRange: normalizeFretRange(fretRange),
    locationMode: isValidLocationMode(locationMode) ? locationMode : DEFAULT_LOCATION_MODE,
    tuning: normalizedTuning,
    selectedStringIndexes: normalizeSelectedStringIndexes(selectedStringIndexes, normalizedTuning.strings.length),
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  };
}

function cloneGeneratedOrder(order, drillMode = DEFAULT_DRILL_MODE) {
  if (order.every((group) => Array.isArray(group?.strings))) {
    return order.map((group) => ({
      ...group,
      strings: group.strings.map((string) => ({ ...string })),
    }));
  }

  return [...order];
}

export function startRound(bpm, selectedLabels = DEFAULT_SELECTED_LABELS, createOrder = shuffleSelectedLabels, options = {}) {
  if (!isValidBpm(bpm)) {
    throw new Error(`BPM must be an integer from ${BPM_MIN} to ${BPM_MAX}`);
  }

  const drillMode = isValidDrillMode(options.drillMode) ? options.drillMode : DEFAULT_DRILL_MODE;
  const fretRange = normalizeFretRange(options.fretRange);
  const locationMode = isValidLocationMode(options.locationMode) ? options.locationMode : DEFAULT_LOCATION_MODE;
  const tuning = cloneTuning(options.tuning);
  const selectedStringIndexes = normalizeSelectedStringIndexes(options.selectedStringIndexes, tuning.strings.length);
  const order = createRangeFilteredRound(selectedLabels, fretRange, createOrder, locationMode, createTuningStrings(tuning.strings), selectedStringIndexes);

  return {
    phase: 'countin',
    bpm,
    order,
    selectedLabels: [...selectedLabels],
    drillMode: normalizeDrillMode(drillMode),
    fretRange,
    locationMode,
    tuning,
    selectedStringIndexes,
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  };
}

export function advanceAfterClick(state) {
  if (state.phase === 'countin') {
    if (state.countInBeat < 4) {
      return { ...state, countInBeat: state.countInBeat + 1 };
    }

    return { ...state, phase: 'running', countInBeat: 4, noteIndex: 0, beatInNote: 1 };
  }

  if (state.phase === 'running') {
    const beatCount = getCurrentGroupBeatCount(state);
    if (state.beatInNote < beatCount) {
      return { ...state, beatInNote: state.beatInNote + 1 };
    }

    if (state.noteIndex < state.order.length - 1) {
      return { ...state, noteIndex: state.noteIndex + 1, beatInNote: 1 };
    }

    return {
      ...state,
      phase: 'done',
      beatInNote: beatCount,
      completedOrder: cloneGeneratedOrder(state.order, state.drillMode),
      completedDrillMode: state.drillMode,
      completedFretRange: cloneFretRange(state.fretRange),
      completedLocationMode: state.locationMode,
      completedTuning: cloneTuning(state.tuning),
      completedSelectedStringIndexes: [...state.selectedStringIndexes],
    };
  }

  return state;
}

export function getViewModel(state) {
  const base = {
    phase: state.phase,
    heading: 'FretFlash',
    prompt: '--',
    status: '',
    detail: '',
    beat: '',
    note: '',
    fretRange: '',
    previewLabel: '',
    preview: '',
    stringCueLabel: '',
    stringCue: '',
    primaryButton: '',
    showBpm: false,
    showPause: false,
    showResume: false,
    showStop: false,
    showSameOrder: false,
    shortcutHint: 'Space start/pause/resume · Esc stop',
  };

  if (state.phase === 'idle') {
    return {
      ...base,
      prompt: 'Ready',
      status: 'Play each displayed pitch on the selected strings within the selected fret range.',
      detail: `Frets ${getFretRangeLabel(state.fretRange)}, selected strings bottom-to-top.`,
      primaryButton: 'Start',
      showBpm: true,
    };
  }

  if (state.phase === 'countin') {
    return {
      ...base,
      prompt: 'Get ready',
      status: `Count-in: ${state.countInBeat} / 4`,
      previewLabel: 'Starting note',
      preview: getCurrentPrompt(state),
      stringCueLabel: 'Starts on',
      stringCue: getCurrentStringCue({ ...state, beatInNote: 1 }),
      fretRange: `Frets ${getFretRangeLabel(state.fretRange)}`,
      showPause: true,
      showStop: true,
    };
  }

  if (state.phase === 'running') {
    const beatCount = getCurrentGroupBeatCount(state);
    return {
      ...base,
      prompt: getCurrentPrompt(state),
      beat: `Beat ${state.beatInNote} / ${beatCount}`,
      stringCueLabel: 'Current string',
      stringCue: getCurrentStringCue(state),
      fretRange: `Frets ${getFretRangeLabel(state.fretRange)}`,
      note: `Note ${state.noteIndex + 1} / ${state.order.length}`,
      previewLabel: 'Next',
      preview: getNextPrompt(state),
      showPause: true,
      showStop: true,
    };
  }

  if (state.phase === 'paused') {
    const activePhase = state.pausedFromPhase ?? 'running';
    if (activePhase === 'countin') {
      return {
        ...base,
        prompt: 'Get ready',
        status: `Paused · Count-in: ${state.countInBeat} / 4`,
        previewLabel: 'Starting note',
        preview: getCurrentPrompt(state),
        stringCueLabel: 'Starts on',
        stringCue: getCurrentStringCue({ ...state, beatInNote: 1 }),
        fretRange: `Frets ${getFretRangeLabel(state.fretRange)}`,
        showResume: true,
        showStop: true,
      };
    }

    const beatCount = getCurrentGroupBeatCount(state);
    return {
      ...base,
      prompt: getCurrentPrompt(state),
      status: 'Paused',
      beat: `Beat ${state.beatInNote} / ${beatCount}`,
      stringCueLabel: 'Current string',
      stringCue: getCurrentStringCue(state),
      fretRange: `Frets ${getFretRangeLabel(state.fretRange)}`,
      note: `Note ${state.noteIndex + 1} / ${state.order.length}`,
      previewLabel: 'Next',
      preview: getNextPrompt(state),
      showResume: true,
      showStop: true,
    };
  }

  if (state.phase === 'done') {
    return {
      ...base,
      prompt: 'Done',
      status: 'Round complete.',
      primaryButton: 'New shuffle',
      showSameOrder: Array.isArray(state.completedOrder) && state.completedOrder.length > 0,
      showBpm: true,
    };
  }

  return base;
}

// HTML rendering
function escapeAttributeValue(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderModeSetup(drillMode, fretRange = DEFAULT_FRET_RANGE, locationMode = DEFAULT_LOCATION_MODE, fretRangeError = '') {
  const range = isValidFretRange(fretRange) ? cloneFretRange(fretRange) : {
    from: fretRange?.from ?? DEFAULT_FRET_RANGE.from,
    to: fretRange?.to ?? DEFAULT_FRET_RANGE.to,
  };
  const fromValue = escapeAttributeValue(range.from);
  const toValue = escapeAttributeValue(range.to);
  const rangeInputs = `<div class="fret-range-inputs" aria-label="Fret range inputs"><label for="fret-from">From</label><input id="fret-from" type="number" inputmode="numeric" enterkeyhint="done" min="${FRET_MIN}" max="${FRET_MAX}" step="1" value="${fromValue}"><label for="fret-to">To</label><input id="fret-to" type="number" inputmode="numeric" enterkeyhint="done" min="${FRET_MIN}" max="${FRET_MAX}" step="1" value="${toValue}"></div>${fretRangeError ? `<p class="field-error" role="alert">${escapeAttributeValue(fretRangeError)}</p>` : ''}`;
  const locationButtons = LOCATION_MODES
    .map((mode) => {
      const label = mode === 'all-in-range' ? 'All in range' : 'One per string';
      const selectedClass = locationMode === mode ? ' is-selected' : '';
      return `<button class="mode-button${selectedClass}" type="button" data-location-mode="${mode}" aria-pressed="${locationMode === mode}">${label}</button>`;
    })
    .join('');

  return `<section class="drill-mode" aria-label="Fret and location setup">
<h2>Frets</h2>${rangeInputs}<h2>Locations</h2><div class="preset-row" aria-label="Location mode presets">${locationButtons}</div>
</section>`;
}

function renderTuningSetup(tuning = DEFAULT_TUNING) {
  const activeTuning = cloneTuning(tuning);
  const presetButtons = TUNING_PRESETS
    .map((preset) => {
      const isSelected = activeTuning.id === preset.id;
      const selectedClass = isSelected ? ' is-selected' : '';
      return `<button class="mode-button${selectedClass}" type="button" data-tuning-id="${preset.id}" aria-pressed="${isSelected}">${preset.label}</button>`;
    })
    .join('');
  const customValue = escapeAttributeValue(activeTuning.strings.join(' '));
  return `<section class="tuning-setup" aria-label="Tuning">
<h2>Tuning</h2>
<div class="preset-row" aria-label="Tuning presets">${presetButtons}</div>
<div class="control-row"><label for="custom-tuning">Custom</label><input id="custom-tuning" name="custom-tuning" type="text" enterkeyhint="done" value="${customValue}"></div>
</section>`;
}

function renderStringSelection(tuning = DEFAULT_TUNING, selectedStringIndexes) {
  const activeTuning = cloneTuning(tuning);
  const selected = new Set(normalizeSelectedStringIndexes(selectedStringIndexes, activeTuning.strings.length));
  const buttons = createTuningStrings(activeTuning.strings).map((string, index) => {
    const isSelected = selected.has(index);
    const selectedClass = isSelected ? ' is-selected' : '';
    return `<button class="mode-button${selectedClass}" type="button" data-string-index="${index}" aria-label="String ${string.number} ${string.label}" aria-pressed="${isSelected}">${string.label}</button>`;
  }).join('');
  return `<section class="string-selection" aria-label="Strings">
<h2>Strings</h2>
<div class="preset-row" aria-label="Selected strings">${buttons}</div>
</section>`;
}

function getSetupSummary(selectedLabels, drillMode, fretRange = DEFAULT_FRET_RANGE, bpm = 60, locationMode = DEFAULT_LOCATION_MODE, tuning = DEFAULT_TUNING, selectedStringIndexes) {
  const activeTuning = cloneTuning(tuning);
  const activeIndexes = normalizeSelectedStringIndexes(selectedStringIndexes, activeTuning.strings.length);
  const groups = createRangeFilteredRound(selectedLabels, fretRange, (items) => items, locationMode, createTuningStrings(activeTuning.strings), activeIndexes);
  const clicks = getRoundClickCount(groups, drillMode, activeIndexes.length);
  return `${groups.length} notes · ${clicks} clicks · ${formatRoundDuration(clicks, bpm)}`;
}

function renderNotePool(selectedLabels, drillMode = DEFAULT_DRILL_MODE, fretRange = DEFAULT_FRET_RANGE, bpm = 60, locationMode = DEFAULT_LOCATION_MODE, tuning = DEFAULT_TUNING, selectedStringIndexes) {
  const selected = new Set(selectedLabels);
  const presetButtons = NOTE_PRESET_BUTTONS
    .map(([key, label]) => `<button class="preset-button" type="button" data-preset="${key}">${label}</button>`)
    .join('');

  const noteGroups = NOTE_PROMPT_GROUPS.map((group) => {
    const groupLabel = group.prompts.map((prompt) => prompt.label).join(' / ');
    const buttons = group.prompts.map((prompt) => {
      const isSelected = selected.has(prompt.label);
      const selectedClass = isSelected ? ' is-selected' : '';
      return `<button class="note-pill${selectedClass}" type="button" data-note-label="${prompt.label}" aria-pressed="${isSelected}">${prompt.label}</button>`;
    }).join('');

    return `<div class="note-group" aria-label="${groupLabel}">${buttons}</div>`;
  }).join('');

  return `<section class="note-pool" aria-label="Note pool">
<h2>Note pool</h2>
<div class="preset-row" aria-label="Note pool presets">${presetButtons}</div>
<p class="note-pool-summary">${getSetupSummary(selectedLabels, drillMode, fretRange, bpm, locationMode, tuning, selectedStringIndexes)}</p>
<div class="note-grid">${noteGroups}</div>
</section>`;
}

export function renderHtml(
  view,
  bpm = 60,
  error = '',
  selectedLabels = DEFAULT_SELECTED_LABELS,
  drillMode = DEFAULT_DRILL_MODE,
  fretRange = DEFAULT_FRET_RANGE,
  locationMode = DEFAULT_LOCATION_MODE,
  tuning = DEFAULT_TUNING,
  selectedStringIndexes,
) {
  const bpmControl = view.showBpm
    ? `<div class="control-row"><label for="bpm">BPM</label><input id="bpm" name="bpm" type="number" inputmode="numeric" enterkeyhint="done" min="${BPM_MIN}" max="${BPM_MAX}" step="1" value="${bpm}"></div>`
    : '';
  const primaryButton = view.primaryButton
    ? `<button id="start-button" type="button">${view.primaryButton}</button>`
    : '';
  const sameOrderButton = view.showSameOrder
    ? '<button id="same-order-button" type="button">Same order</button>'
    : '';
  const pauseButton = view.showPause
    ? '<button id="pause-button" type="button">Pause</button>'
    : '';
  const resumeButton = view.showResume
    ? '<button id="resume-button" type="button">Resume</button>'
    : '';
  const stopButton = view.showStop
    ? '<button id="stop-button" type="button">Stop</button>'
    : '';
  const fretRangeError = error === FRET_RANGE_ERROR ? error : '';
  const errorHtml = error && !fretRangeError ? `<p class="error" role="alert">${error}</p>` : '';
  const previewAriaLabel = view.previewLabel === 'Next' ? 'Next note' : view.previewLabel;
  const previewClass = view.phase === 'running' ? 'preview preview-running' : 'preview';
  const previewHtml = view.preview
    ? `<div class="${previewClass}" aria-label="${previewAriaLabel}"><span>${view.previewLabel}</span><strong>${view.preview}</strong></div>`
    : '';
  const previewBeforeProgress = view.phase === 'running' ? '' : previewHtml;
  const previewAfterProgress = view.phase === 'running' ? previewHtml : '';
  const stringCueHtml = view.stringCue
    ? `<div class="string-cue" aria-label="${view.stringCueLabel}"><span class="string-cue-label">${view.stringCueLabel}</span><strong class="string-cue-value">${view.stringCue}</strong></div>`
    : '';
  const progressHtml = view.beat || view.note
    ? `<div class="progress-row" aria-label="Round progress">${view.beat ? `<p class="beat">${view.beat}</p>` : ''}${view.note ? `<p class="note">${view.note}</p>` : ''}</div>`
    : '';
  const fretRangeHtml = view.fretRange ? `<p class="fret-range">${view.fretRange}</p>` : '';
  const shortcutHintHtml = view.shortcutHint ? `<p class="shortcut-hint">${view.shortcutHint}</p>` : '';
  const setupHtml = view.phase === 'idle' || view.phase === 'done'
    ? `${renderModeSetup(drillMode, fretRange, locationMode, fretRangeError)}${renderTuningSetup(tuning)}${renderStringSelection(tuning, selectedStringIndexes)}${renderNotePool(selectedLabels, drillMode, fretRange, bpm, locationMode, tuning, selectedStringIndexes)}`
    : '';

  return `<h1>${view.heading}</h1>
<div class="prompt" aria-live="polite">${view.prompt}</div>
${previewBeforeProgress}
${stringCueHtml}
${fretRangeHtml}
${view.status ? `<p class="status">${view.status}</p>` : ''}
${view.detail ? `<p class="detail">${view.detail}</p>` : ''}
${progressHtml}
${previewAfterProgress}
${bpmControl}
${setupHtml}
${errorHtml}
${shortcutHintHtml}
<div class="actions">${sameOrderButton}${primaryButton}${pauseButton}${resumeButton}${stopButton}</div>`;
}

// Controller and timing
export function createAppController({
  render,
  playClick,
  prepareAudio = () => {},
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  createOrder = shuffleSelectedLabels,
  initialState = createIdleState(),
} = {}) {
  let state = initialState;
  let timerId = null;
  let startSequence = 0;

  function clearTimer() {
    if (timerId !== null) {
      clearIntervalFn(timerId);
      timerId = null;
    }
  }

  function renderCurrent(error = '') {
    render(state, error);
  }

  function clickCurrentAndPrepareNext() {
    if (state.phase !== 'countin' && state.phase !== 'running') {
      return;
    }

    renderCurrent();
    playClick({ accent: state.phase === 'running' && state.beatInNote === 1 });
    state = advanceAfterClick(state);

    if (state.phase === 'done') {
      renderCurrent();
      clearTimer();
    }
  }

  function scheduleTimer(sequence) {
    timerId = setIntervalFn(() => {
      if (sequence === startSequence) {
        clickCurrentAndPrepareNext();
      }
    }, getClickIntervalMs(state.bpm));
  }

  function beginRound(bpm, sequence, selectedLabels, order, drillMode, fretRange, locationMode, tuning, selectedStringIndexes) {
    if (sequence !== startSequence) {
      return false;
    }

    state = startRound(bpm, selectedLabels, () => order, {
      drillMode,
      fretRange,
      locationMode,
      tuning,
      selectedStringIndexes,
    });
    clickCurrentAndPrepareNext();
    scheduleTimer(sequence);
    return true;
  }

  function beginExactRound(bpm, sequence, selectedLabels, order, drillMode, fretRange, locationMode, tuning, selectedStringIndexes) {
    if (sequence !== startSequence) {
      return false;
    }

    state = {
      phase: 'countin',
      bpm,
      order: cloneGeneratedOrder(order, drillMode),
      selectedLabels: [...selectedLabels],
      drillMode: normalizeDrillMode(drillMode),
      fretRange: normalizeFretRange(fretRange),
      locationMode: isValidLocationMode(locationMode) ? locationMode : DEFAULT_LOCATION_MODE,
      tuning: cloneTuning(tuning),
      selectedStringIndexes: normalizeSelectedStringIndexes(selectedStringIndexes, cloneTuning(tuning).strings.length),
      noteIndex: 0,
      beatInNote: 1,
      countInBeat: 1,
    };
    clickCurrentAndPrepareNext();
    scheduleTimer(sequence);
    return true;
  }

  function createSetupStateFromCurrent(overrides = {}) {
    return createIdleState(
      overrides.bpm ?? state.bpm,
      overrides.selectedLabels ?? state.selectedLabels,
      overrides.drillMode ?? state.drillMode,
      overrides.fretRange ?? state.fretRange,
      overrides.locationMode ?? state.locationMode,
      overrides.tuning ?? state.tuning,
      overrides.selectedStringIndexes ?? state.selectedStringIndexes,
    );
  }

  function updateSetup(overrides = {}) {
    if (state.phase === 'done') {
      startSequence += 1;
      clearTimer();
      state = createSetupStateFromCurrent(overrides);
      return;
    }

    if (state.phase === 'idle') {
      startSequence += 1;
      clearTimer();
    }

    state = { ...state, ...overrides };
  }

  return {
    getState() {
      return state;
    },

    setSelectedLabels(labels) {
      updateSetup({ selectedLabels: [...labels] });
      renderCurrent();
    },


    setFretRange(fretRange) {
      if (isValidFretRange(fretRange)) {
        updateSetup({ fretRange: cloneFretRange(fretRange) });
        renderCurrent();
      }
    },

    setLocationMode(locationMode) {
      if (isValidLocationMode(locationMode)) {
        updateSetup({ locationMode });
        renderCurrent();
      }
    },

    setTuning(tuning) {
      const normalizedTuning = cloneTuning(tuning);
      updateSetup({
        tuning: normalizedTuning,
        selectedStringIndexes: normalizeSelectedStringIndexes(undefined, normalizedTuning.strings.length),
      });
      renderCurrent();
    },

    setSelectedStringIndexes(indexes) {
      const tuning = cloneTuning(state.tuning);
      updateSetup({ selectedStringIndexes: normalizeSelectedStringIndexes(indexes, tuning.strings.length) });
      renderCurrent();
    },

    setBpm(bpm) {
      if (isValidBpm(bpm)) {
        if (state.phase === 'idle' || state.phase === 'done') {
          startSequence += 1;
          clearTimer();
        }
        state = { ...state, bpm };
        renderCurrent();
      }
    },

    start(bpmInput) {
      const bpm = parseBpmInput(bpmInput);
      if (bpm === null) {
        renderCurrent(`Choose a BPM between ${BPM_MIN} and ${BPM_MAX}.`);
        return false;
      }

      state = { ...state, bpm };
      const selectedLabels = [...state.selectedLabels];
      if (!isValidNoteSelection(selectedLabels)) {
        renderCurrent('Select at least one note.');
        return false;
      }

      const drillMode = state.drillMode;
      const fretRange = state.fretRange;
      const locationMode = state.locationMode;
      const tuning = state.tuning;
      const selectedStringIndexes = state.selectedStringIndexes;
      const order = createRangeFilteredRound(selectedLabels, fretRange, createOrder, locationMode, createTuningStrings(tuning.strings), selectedStringIndexes);
      if (order.length === 0) {
        renderCurrent('No selected notes are available in this fret range.');
        return false;
      }

      const sequence = startSequence + 1;
      startSequence = sequence;
      clearTimer();

      try {
        const prepared = prepareAudio();
        if (prepared && typeof prepared.then === 'function') {
          return prepared
            .then(() => beginRound(bpm, sequence, selectedLabels, order, drillMode, fretRange, locationMode, tuning, selectedStringIndexes))
            .catch(() => {
              if (sequence !== startSequence) {
                return false;
              }

              renderCurrent('Audio could not start. Try pressing Start again.');
              return false;
            });
        }
      } catch {
        renderCurrent('Audio could not start. Try pressing Start again.');
        return false;
      }

      return beginRound(bpm, sequence, selectedLabels, order, drillMode, fretRange, locationMode, tuning, selectedStringIndexes);
    },

    repeatSameOrder(bpmInput) {
      if (state.phase !== 'done' || !Array.isArray(state.completedOrder) || state.completedOrder.length === 0) {
        return false;
      }

      const bpm = parseBpmInput(bpmInput);
      if (bpm === null) {
        renderCurrent(`Choose a BPM between ${BPM_MIN} and ${BPM_MAX}.`);
        return false;
      }

      state = { ...state, bpm };
      const selectedLabels = [...state.selectedLabels];
      const order = cloneGeneratedOrder(state.completedOrder, state.completedDrillMode);
      const drillMode = state.completedDrillMode ?? state.drillMode;
      const fretRange = state.completedFretRange ?? state.fretRange;
      const locationMode = state.completedLocationMode ?? state.locationMode;
      const tuning = state.completedTuning ?? state.tuning;
      const selectedStringIndexes = state.completedSelectedStringIndexes ?? state.selectedStringIndexes;
      const sequence = startSequence + 1;
      startSequence = sequence;
      clearTimer();

      try {
        const prepared = prepareAudio();
        if (prepared && typeof prepared.then === 'function') {
          return prepared
            .then(() => beginExactRound(bpm, sequence, selectedLabels, order, drillMode, fretRange, locationMode, tuning, selectedStringIndexes))
            .catch(() => {
              if (sequence !== startSequence) {
                return false;
              }

              renderCurrent('Audio could not start. Try pressing Start again.');
              return false;
            });
        }
      } catch {
        renderCurrent('Audio could not start. Try pressing Start again.');
        return false;
      }

      return beginExactRound(bpm, sequence, selectedLabels, order, drillMode, fretRange, locationMode, tuning, selectedStringIndexes);
    },

    pause() {
      if (state.phase !== 'countin' && state.phase !== 'running') {
        return false;
      }

      startSequence += 1;
      clearTimer();
      state = { ...state, phase: 'paused', pausedFromPhase: state.phase };
      renderCurrent();
      return true;
    },

    resume() {
      if (state.phase !== 'paused') {
        return false;
      }

      clearTimer();
      const nextPhase = state.pausedFromPhase === 'countin' ? 'countin' : 'running';
      state = { ...state, phase: nextPhase, pausedFromPhase: undefined };
      const sequence = startSequence + 1;
      startSequence = sequence;
      scheduleTimer(sequence);
      renderCurrent();
      return true;
    },

    stop() {
      startSequence += 1;
      clearTimer();
      state = createIdleState(state.bpm, state.selectedLabels, state.drillMode, state.fretRange, state.locationMode, state.tuning, state.selectedStringIndexes);
      renderCurrent();
    },
  };
}

// Web Audio click player
export function createWebAudioClickPlayer(AudioContextCtor) {
  let audioContext = null;

  function prepare() {
    if (!AudioContextCtor) {
      throw new Error('Web Audio is not available');
    }

    if (audioContext === null) {
      audioContext = new AudioContextCtor();
    }

    if (audioContext.state === 'suspended') {
      return audioContext.resume();
    }

    return undefined;
  }

  function play({ accent = false } = {}) {
    if (audioContext === null) {
      return;
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequency = accent ? 1800 : 1200;
    const peakGain = accent ? 0.28 : 0.2;

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }

  return { prepare, play };
}

// Browser mounting and event wiring
function getBrowserStorage() {
  if (typeof document === 'undefined') {
    return undefined;
  }

  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function mountBrowserApp({
  root,
  AudioContextCtor,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  storage = getBrowserStorage(),
  documentTarget = typeof document === 'undefined' ? undefined : document,
  createOrder = shuffleSelectedLabels,
} = {}) {
  if (!root) {
    throw new Error('FretFlash root element not found');
  }

  const clickPlayer = createWebAudioClickPlayer(AudioContextCtor);
  const initialSettings = loadSettings(storage);
  let controller;

  function persistCurrentSettings() {
    saveSettings(storage, controller.getState());
  }

  function syncValidBpmFromInput(valueOverride) {
    const bpmInput = root.querySelector('#bpm');
    if (!bpmInput && valueOverride === undefined) {
      return false;
    }

    const bpm = parseBpmInput(valueOverride ?? bpmInput.value);
    if (bpm === null) {
      return false;
    }

    controller.setBpm(bpm);
    return true;
  }

  function getFretRangeInputDraft() {
    const stateRange = controller.getState().fretRange;
    const fromInput = root.querySelector('#fret-from');
    const toInput = root.querySelector('#fret-to');
    return {
      from: fromInput?.value ?? stateRange.from,
      to: toInput?.value ?? stateRange.to,
    };
  }

  function hasFretRangeInputs() {
    return Boolean(root.querySelector('#fret-from') && root.querySelector('#fret-to'));
  }

  function readFretRangeFromInputs() {
    const fromInput = root.querySelector('#fret-from');
    const toInput = root.querySelector('#fret-to');
    if (!fromInput || !toInput) {
      return { ok: true, range: controller.getState().fretRange };
    }

    const from = parseFretBoundInput(fromInput.value);
    const to = parseFretBoundInput(toInput.value);
    if (from === null || to === null || !isValidFretRange({ from, to })) {
      return { ok: false, range: null };
    }

    return { ok: true, range: { from, to } };
  }

  function renderFretRangeError() {
    render(controller.getState(), FRET_RANGE_ERROR);
  }

  function validateFretRangeInputDraft({ renderInvalid = false } = {}) {
    if (!hasFretRangeInputs()) {
      return true;
    }

    const result = readFretRangeFromInputs();
    if (!result.ok) {
      if (renderInvalid) {
        renderFretRangeError();
      }
      return false;
    }

    return true;
  }

  function syncValidFretRangeFromInput({ renderInvalid = false } = {}) {
    if (!validateFretRangeInputDraft({ renderInvalid })) {
      return false;
    }
    const result = readFretRangeFromInputs();
    if (result.ok && hasFretRangeInputs()) {
      controller.setFretRange(result.range);
    }
    return true;
  }

  function syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange = false } = {}) {
    const bpmInput = root.querySelector('#bpm');
    const bpmDraft = bpmInput?.value;
    const fretRangeOk = syncValidFretRangeFromInput({ renderInvalid: renderInvalidFretRange });
    syncValidBpmFromInput(bpmDraft);
    return fretRangeOk;
  }

  function startFromCurrentInput() {
    const bpmInput = root.querySelector('#bpm');
    const bpmDraft = bpmInput ? bpmInput.value : String(controller.getState().bpm);
    const fretResult = readFretRangeFromInputs();
    if (!fretResult.ok) {
      renderFretRangeError();
      return false;
    }
    if (hasFretRangeInputs()) {
      controller.setFretRange(fretResult.range);
    }
    const started = controller.start(bpmDraft);
    if (started && typeof started.then === 'function') {
      started.then((didStart) => {
        if (didStart) persistCurrentSettings();
      });
    } else if (started) {
      persistCurrentSettings();
    }
    return started;
  }

  function repeatSameOrderFromCurrentInput() {
    const bpmInput = root.querySelector('#bpm');
    const bpmDraft = bpmInput ? bpmInput.value : String(controller.getState().bpm);
    if (!validateFretRangeInputDraft({ renderInvalid: true })) {
      return false;
    }
    const started = controller.repeatSameOrder(bpmDraft);
    if (started && typeof started.then === 'function') {
      started.then((didStart) => {
        if (didStart) persistCurrentSettings();
      });
    } else if (started) {
      persistCurrentSettings();
    }
    return started;
  }

  function shouldIgnoreGlobalShortcut(event) {
    const target = event.target;
    if (!target) {
      return false;
    }

    const tagName = target.tagName?.toLowerCase();
    return target.isContentEditable
      || tagName === 'input'
      || tagName === 'textarea'
      || tagName === 'select'
      || tagName === 'button';
  }

  function handleGlobalKeydown(event) {
    if (shouldIgnoreGlobalShortcut(event)) {
      return;
    }

    const isSpace = event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space';
    if (isSpace) {
      const phase = controller.getState().phase;
      if (phase === 'idle' || phase === 'done') {
        event.preventDefault();
        startFromCurrentInput();
      } else if (phase === 'countin' || phase === 'running') {
        event.preventDefault();
        controller.pause();
      } else if (phase === 'paused') {
        event.preventDefault();
        controller.resume();
      }
      return;
    }

    if (event.key === 'Escape') {
      const phase = controller.getState().phase;
      if (phase === 'countin' || phase === 'running' || phase === 'paused') {
        event.preventDefault();
        controller.stop();
      }
    }
  }

  function render(state, error = '', renderFretRange = state.fretRange) {
    root.innerHTML = renderHtml(
      getViewModel(state),
      state.bpm,
      error,
      state.selectedLabels,
      state.drillMode,
      renderFretRange,
      state.locationMode,
      state.tuning,
      state.selectedStringIndexes,
    );

    const bpmInput = root.querySelector('#bpm');
    if (bpmInput) {
      bpmInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const bpmDraft = bpmInput.value;
          const showFretError = !syncValidFretRangeFromInput({ renderInvalid: true });
          if (syncValidBpmFromInput(bpmDraft)) {
            persistCurrentSettings();
            if (showFretError) renderFretRangeError();
          }
          bpmInput.blur();
        }
      });
      bpmInput.addEventListener('blur', () => {
        const bpmDraft = bpmInput.value;
        const showFretError = !syncValidFretRangeFromInput({ renderInvalid: true });
        if (syncValidBpmFromInput(bpmDraft)) {
          persistCurrentSettings();
          if (showFretError) renderFretRangeError();
        }
      });
    }

    ['#fret-from', '#fret-to'].forEach((selector) => {
      const input = root.querySelector(selector);
      if (!input) {
        return;
      }

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (syncValidFretRangeFromInput({ renderInvalid: true })) {
            persistCurrentSettings();
          }
          input.blur();
        }
      });
      input.addEventListener('blur', () => {
        if (syncValidFretRangeFromInput({ renderInvalid: true })) {
          persistCurrentSettings();
        }
      });
    });

    const customTuningInput = root.querySelector('#custom-tuning');
    if (customTuningInput) {
      const applyCustomTuning = () => {
        const tuning = parseTuningInput(customTuningInput.value);
        if (!tuning) {
          render(controller.getState(), 'Use 6 or 7 tuning notes like E A D G B e.', getFretRangeInputDraft());
          return false;
        }
        const showFretError = !syncValidFretRangeFromInput({ renderInvalid: true });
        const bpmInput = root.querySelector('#bpm');
        syncValidBpmFromInput(bpmInput?.value);
        controller.setTuning(tuning);
        persistCurrentSettings();
        if (showFretError) renderFretRangeError();
        return true;
      };
      customTuningInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyCustomTuning();
          customTuningInput.blur();
        }
      });
      customTuningInput.addEventListener('blur', applyCustomTuning);
    }

    const startButton = root.querySelector('#start-button');
    if (startButton) {
      startButton.addEventListener('click', () => {
        startFromCurrentInput();
      });
    }

    const sameOrderButton = root.querySelector('#same-order-button');
    if (sameOrderButton) {
      sameOrderButton.addEventListener('click', () => {
        repeatSameOrderFromCurrentInput();
      });
    }

    const pauseButton = root.querySelector('#pause-button');
    if (pauseButton) {
      pauseButton.addEventListener('click', () => controller.pause());
    }

    const resumeButton = root.querySelector('#resume-button');
    if (resumeButton) {
      resumeButton.addEventListener('click', () => controller.resume());
    }

    const stopButton = root.querySelector('#stop-button');
    if (stopButton) {
      stopButton.addEventListener('click', () => controller.stop());
    }

    root.querySelectorAll('[data-note-label]').forEach((button) => {
      button.addEventListener('click', () => {
        const showFretError = !syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange: true });
        const label = button.dataset.noteLabel;
        const selected = new Set(controller.getState().selectedLabels);
        if (selected.has(label)) {
          selected.delete(label);
        } else {
          selected.add(label);
        }
        const nextLabels = KNOWN_NOTE_LABELS.filter((knownLabel) => selected.has(knownLabel));
        controller.setSelectedLabels(nextLabels);
        persistCurrentSettings();
        if (showFretError) renderFretRangeError();
      });
    });

    root.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const showFretError = !syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange: true });
        controller.setSelectedLabels(NOTE_PRESETS[button.dataset.preset] ?? controller.getState().selectedLabels);
        persistCurrentSettings();
        if (showFretError) renderFretRangeError();
      });
    });

    root.querySelectorAll('[data-location-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const showFretError = !syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange: true });
        controller.setLocationMode(button.dataset.locationMode);
        persistCurrentSettings();
        if (showFretError) renderFretRangeError();
      });
    });

    root.querySelectorAll('[data-tuning-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const showFretError = !syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange: true });
        const preset = TUNING_PRESET_BY_ID.get(button.dataset.tuningId);
        if (preset) {
          controller.setTuning({ id: preset.id, strings: preset.strings });
          persistCurrentSettings();
          if (showFretError) renderFretRangeError();
        }
      });
    });

    root.querySelectorAll('[data-string-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const showFretError = !syncSetupInputsAndRequireValidFretRange({ renderInvalidFretRange: true });
        const index = Number(button.dataset.stringIndex);
        const selected = new Set(controller.getState().selectedStringIndexes);
        if (selected.has(index) && selected.size > 1) {
          selected.delete(index);
        } else {
          selected.add(index);
        }
        controller.setSelectedStringIndexes([...selected]);
        persistCurrentSettings();
        if (showFretError) renderFretRangeError();
      });
    });

  }

  controller = createAppController({
    render,
    prepareAudio: clickPlayer.prepare,
    playClick: clickPlayer.play,
    setIntervalFn,
    clearIntervalFn,
    createOrder,
    initialState: createIdleState(
      initialSettings.bpm,
      initialSettings.selectedLabels,
      initialSettings.drillMode,
      initialSettings.fretRange,
      initialSettings.locationMode,
      initialSettings.tuning,
      initialSettings.selectedStringIndexes,
    ),
  });

  render(controller.getState());
  if (documentTarget) {
    documentTarget.addEventListener('keydown', handleGlobalKeydown);
  }
  return controller;
}

if (typeof document !== 'undefined') {
  const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  mountBrowserApp({ root: document.getElementById('app'), AudioContextCtor });
}
