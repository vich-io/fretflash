import {
  NOTE_LABEL_TO_INDEX,
  PITCH_CLASS_INDEX,
  STRING_ORDER,
  normalizePitchLabel,
} from './music.js';

import {
  DEFAULT_LOCATION_MODE,
  FRET_MAX,
  cloneFretRange,
  isValidFretRange,
  isValidLocationMode,
  normalizeFretRange,
  normalizeSelectedStringIndexes,
} from './settings.js';

export function getFretRangeLabel(fretRange) {
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

export function shuffleSelectedLabels(labels, random = Math.random) {
  const shuffled = [...labels];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function createRangeFilteredRound(labels, fretRange, shuffleGroups = shuffleSelectedLabels, locationMode = DEFAULT_LOCATION_MODE, tuningStrings = STRING_ORDER, selectedStringIndexes) {
  const activeRange = normalizeFretRange(fretRange);
  const activeLocationMode = isValidLocationMode(locationMode) ? locationMode : DEFAULT_LOCATION_MODE;
  const groups = labels
    .map((label) => ({
      label,
      fretRange: cloneFretRange(activeRange),
      locationMode: activeLocationMode,
      targets: getAvailableTargetsForLabelInRange(label, activeRange, activeLocationMode, tuningStrings, selectedStringIndexes),
    }))
    .filter((group) => group.targets.length > 0);

  return shuffleGroups(groups);
}

export function getRoundClickCount(order) {
  return order.reduce((total, group) => total + group.targets.length, 0);
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
