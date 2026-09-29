export function getViewModel(state) {
  const base = { phase: state.phase, prompt: '', preview: '', countdown: null,
    beatNumber: 0, beatCount: 0, stringCue: '', primaryButton: '',
    showPause: false, showResume: false, showRestart: false, showStop: false,
    showSameOrder: false, progressLabels: [], progressIndex: 0 };
  if (state.phase === 'idle') return { ...base, prompt: 'Ready', primaryButton: 'Start' };
  if (state.phase === 'done') {
    const order = state.completedOrder ?? [];
    return { ...base, prompt: 'Done.', primaryButton: 'Shuffle',
      progressLabels: order.map(group => group.label), progressIndex: order.length,
      showSameOrder: order.length > 0 };
  }
  const paused = state.phase === 'paused';
  const activePhase = paused ? state.pausedFromPhase : state.phase;
  const countIn = activePhase === 'countin';
  const group = state.order[state.noteIndex];
  const beatNumber = countIn ? 1 : state.beatInNote;
  const target = group.targets[beatNumber - 1];
  return { ...base,
    prompt: countIn ? 'Get ready' : group.label,
    preview: countIn ? group.label : state.order[state.noteIndex + 1]?.label ?? 'Done',
    countdown: countIn ? Math.max(1, 5 - state.countInBeat) : null,
    beatNumber, beatCount: group.targets.length,
    stringCue: `String ${target.number} · ${target.label}`,
    progressLabels: state.order.map(item => item.label), progressIndex: state.noteIndex,
    showPause: !paused, showResume: paused, showRestart: paused, showStop: true,
  };
}
