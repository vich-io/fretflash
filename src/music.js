// Musical model and tuning primitives
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
export const KNOWN_NOTE_LABELS = NOTE_PROMPTS.map((prompt) => prompt.label);
export const KNOWN_NOTE_LABEL_SET = new Set(KNOWN_NOTE_LABELS);

export const DEFAULT_SELECTED_LABELS = [...PITCHES];
export const NOTE_PRESETS = {
  flats: [...DEFAULT_SELECTED_LABELS],
  sharps: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  naturals: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  all: ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'E#', 'Fb', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'B#', 'Cb'],
  clear: [],
};

export const TUNING_PRESETS = [
  { id: 'standard-6', label: 'Standard', strings: ['E', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'drop-d', label: 'Drop D', strings: ['D', 'A', 'D', 'G', 'B', 'e'] },
  { id: 'dadgad', label: 'DADGAD', strings: ['D', 'A', 'D', 'G', 'A', 'D'] },
  { id: 'standard-7', label: '7-string standard', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] },
];
export const DEFAULT_TUNING = { id: 'standard-6', strings: ['E', 'A', 'D', 'G', 'B', 'e'] };
export const DEFAULT_SELECTED_STRING_INDEXES = [0, 1, 2, 3, 4, 5];

export const TUNING_PRESET_BY_ID = new Map(TUNING_PRESETS.map((preset) => [preset.id, preset]));
export const PITCH_CLASS_INDEX = new Map(PITCHES.map((pitch, index) => [pitch, index]));
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
export const NOTE_LABEL_TO_INDEX = new Map(NOTE_PROMPTS.map((prompt) => [prompt.label, SOUND_GROUP_INDEX.get(prompt.soundGroup)]));
const TUNING_LABEL_PATTERN = /^[A-Ga-g](?:#|b)?$/;

export function normalizePitchLabel(label) {
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
