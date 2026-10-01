import { SPOKEN_BANK, SPOKEN_FAST_BANK, SPOKEN_TIGHT_BANK } from './voice-bank.js?v=043bbc19dc51c1fe';
import { BPM_MAX, createSetup } from './settings.js?v=043bbc19dc51c1fe';
import { createTuningStrings } from './music.js?v=043bbc19dc51c1fe';
import { createRangeFilteredRound } from './round.js?v=043bbc19dc51c1fe';
export { SPOKEN_BANK, SPOKEN_FAST_BANK };
export const SPOKEN_BANKS = { natural: SPOKEN_BANK, fast: SPOKEN_FAST_BANK, tight: SPOKEN_TIGHT_BANK };

export const SPOKEN_GAP_SECONDS = 0.05;

export function getSpokenClip(label, variant = 'natural') {
  if (!Object.hasOwn(SPOKEN_BANKS, variant)) return null;
  const bank = SPOKEN_BANKS[variant];
  if (!Object.hasOwn(bank.clips, label)) return null;
  const [startFrame, endFrame] = bank.clips[label];
  return { startFrame, endFrame, duration: (endFrame - startFrame) / bank.sampleRate };
}

export function getSpokenPlayback(label, bpm, targetCount, hasSuccessor = true) {
  const natural = getSpokenClip(label);
  if (!natural) return null;
  const budget = targetCount * 60 / bpm;
  if (!hasSuccessor) return { ...natural, variant: 'natural' };
  for (const variant of ['natural', 'fast', 'tight']) {
    const clip = variant === 'natural' ? natural : getSpokenClip(label, variant);
    if (clip && clip.duration + SPOKEN_GAP_SECONDS <= budget + 1e-9) return { ...clip, variant };
  }
  return null;
}

export function getSpokenBpmMax(setupInput, order, firstAnnouncement = 0) {
  const setup = createSetup(setupInput);
  if (!setup.spokenCues) return BPM_MAX;
  const shuffled = order === undefined;
  order ??= createRangeFilteredRound(setup.selectedLabels, setup.fretRange, groups => groups,
    setup.locationMode, createTuningStrings(setup.tuning.strings), setup.selectedStringIndexes);
  let maximum = BPM_MAX;
  // Any setup group can precede another after shuffling; exact orders exclude their final call.
  const last = shuffled && order.length > 1 ? order.length : order.length - 1;
  for (let i = firstAnnouncement; i < last; i++) {
    const clip = getSpokenClip(order[i].label, 'tight');
    if (!clip) return 0;
    maximum = Math.min(maximum, Math.floor(60 * order[i].targets.length / (clip.duration + SPOKEN_GAP_SECONDS) + 1e-9));
  }
  return maximum;
}

export function upcomingSpokenLabel(state) {
  if (!state.spokenCues) return null;
  if (state.phase === 'countin' && state.countInBeat === 4) return state.order[0]?.label ?? null;
  if (state.phase === 'running' && state.beatInNote === state.order[state.noteIndex]?.targets.length) {
    return state.order[state.noteIndex + 1]?.label ?? null;
  }
  return null;
}

export function spokenCueError(setup, order, firstAnnouncement = 0) {
  if (!setup.spokenCues) return '';
  for (let i = firstAnnouncement; i < order.length - 1; i++) {
    if (!getSpokenPlayback(order[i].label, setup.bpm, order[i].targets.length)) {
      return 'Spoken cues could not be prepared for this drill.';
    }
  }
  return '';
}
