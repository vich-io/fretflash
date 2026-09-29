import { getFretRangeLabel } from './round.js';

function formatStringCue(string) {
  return `String ${string.number} · ${string.label}`;
}

function getCurrentNoteGroup(state) {
  return state.order[state.noteIndex];
}

function getCurrentGroupBeatCount(state) {
  return getCurrentNoteGroup(state)?.targets.length ?? 0;
}

function getCurrentStringCue(state) {
  return formatStringCue(getCurrentNoteGroup(state).targets[state.beatInNote - 1]);
}

function getDisplayedCountInBeat(state) {
  return Math.max(1, 5 - (state.countInBeat ?? 1));
}

function getCurrentPrompt(state) {
  const current = getCurrentNoteGroup(state);
  return current?.label;
}

function getPromptLabel(group) {
  return group?.label;
}

function getProgressLabels(state) {
  return Array.isArray(state.order) ? state.order.map(getPromptLabel).filter(Boolean) : [];
}

function getNextPrompt(state) {
  const next = state.order[state.noteIndex + 1];
  if (!next) {
    return 'Done';
  }

  return next.label;
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
    showRestart: false,
    showStop: false,
    showSameOrder: false,
    progressLabels: [],
    progressIndex: 0,
    shortcutHint: '',
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
    const displayedCountInBeat = getDisplayedCountInBeat(state);
    const beatCount = getCurrentGroupBeatCount(state);
    return {
      ...base,
      prompt: 'Get ready',
      status: `Count-in: ${displayedCountInBeat} / 4`,
      beat: `Beat 1 / ${beatCount}`,
      previewLabel: 'Starting note',
      preview: getCurrentPrompt(state),
      progressLabels: getProgressLabels(state),
      progressIndex: state.noteIndex,
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
      progressLabels: getProgressLabels(state),
      progressIndex: state.noteIndex,
      previewLabel: 'Next',
      preview: getNextPrompt(state),
      showPause: true,
      showStop: true,
    };
  }

  if (state.phase === 'paused') {
    const activePhase = state.pausedFromPhase ?? 'running';
    if (activePhase === 'countin') {
      const displayedCountInBeat = getDisplayedCountInBeat(state);
      const beatCount = getCurrentGroupBeatCount(state);
      return {
        ...base,
        prompt: 'Get ready',
        status: `Paused · Count-in: ${displayedCountInBeat} / 4`,
        beat: `Beat 1 / ${beatCount}`,
        previewLabel: 'Starting note',
        preview: getCurrentPrompt(state),
        progressLabels: getProgressLabels(state),
        progressIndex: state.noteIndex,
        stringCueLabel: 'Starts on',
        stringCue: getCurrentStringCue({ ...state, beatInNote: 1 }),
        fretRange: `Frets ${getFretRangeLabel(state.fretRange)}`,
        showResume: true,
        showRestart: true,
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
      progressLabels: getProgressLabels(state),
      progressIndex: state.noteIndex,
      previewLabel: 'Next',
      preview: getNextPrompt(state),
      showResume: true,
      showRestart: true,
      showStop: true,
    };
  }

  if (state.phase === 'done') {
    const completedOrder = Array.isArray(state.completedOrder) ? state.completedOrder : [];
    return {
      ...base,
      prompt: 'Done.',
      primaryButton: 'Shuffle',
      progressLabels: completedOrder.map(getPromptLabel).filter(Boolean),
      progressIndex: completedOrder.length,
      showSameOrder: completedOrder.length > 0,
      showBpm: true,
    };
  }

  return base;
}
