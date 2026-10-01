import { createTuningStrings } from './music.js';
import {
  BPM_MAX, BPM_MIN, cloneFretRange, cloneTuning, createSetup, isValidBpm,
  isValidFretRange, isValidLocationMode, isValidNoteSelection,
  normalizeSelectedStringIndexes, parseBpmInput,
} from './settings.js';
import { advanceAfterClick, cloneGeneratedOrder, createIdleState, startPreparedRound } from './state.js';
import { createRangeFilteredRound, getClickIntervalMs, shuffleSelectedLabels } from './round.js';
import { getSpokenPlayback, getSpokenBpmMax, spokenCueError, upcomingSpokenLabel } from './speech.js';

export function createAppController({
  render, playClick, prepareAudio = () => {},
  playSpeech = () => {}, stopSpeech = () => {},
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout,
  audioClock, cancelClick = () => {},
  createOrder = shuffleSelectedLabels, initialState = createIdleState(),
} = {}) {
  let state = initialState;
  let nextState = null;
  let timerId = null;
  let nextAt = null;
  let startSequence = 0;
  const queued = [];
  const renderCurrent = (error = '') => render(state, error);
  const intervalSeconds = () => getClickIntervalMs(state.bpm) / 1000;

  function cancelQueued(reconcile = false, stopActiveSpeech = true) {
    if (stopActiveSpeech) stopSpeech();
    const now = audioClock?.();
    let firstUnheard = null;
    for (const cue of queued.splice(0)) {
      clearTimeoutFn(cue.timer);
      if (reconcile && cue.when <= now) {
        // An already-started oscillator cannot be unheard. Keep its cue as the last audible one.
        state = cue.state;
        nextState = advanceAfterClick(state);
      } else {
        firstUnheard ??= cue.state;
        cancelClick(cue.handle);
      }
    }
    if (firstUnheard) nextState = firstUnheard;
  }

  function clearTimer(stopActiveSpeech = true) {
    if (timerId !== null) {
      clearIntervalFn(timerId);
      timerId = null;
    }
    cancelQueued(false, stopActiveSpeech);
  }

  function showAndClick() {
    if (nextState?.phase !== 'countin' && nextState?.phase !== 'running') return;
    state = nextState;
    renderCurrent();
    playClick({ accent: state.phase === 'running' && state.beatInNote === 1 });
    announce(state);
    nextState = advanceAfterClick(state);
    if (nextState.phase === 'done') {
      state = nextState;
      renderCurrent();
      clearTimer(false);
    }
  }

  function pauseForStall() {
    startSequence += 1;
    if (timerId !== null) { clearIntervalFn(timerId); timerId = null; }
    cancelQueued(true);
    if (nextState?.phase === 'done') {
      state = nextState;
      renderCurrent();
    } else {
      state = { ...state, phase: 'paused', pausedFromPhase: state.phase };
      renderCurrent();
    }
  }

  function scheduleAudioCue(sequence) {
    const cueState = nextState;
    const when = nextAt;
    const handle = playClick({ accent: cueState.phase === 'running' && cueState.beatInNote === 1, when });
    announce(cueState, when);
    nextState = advanceAfterClick(cueState);
    nextAt += intervalSeconds();
    const cue = { state: cueState, when, handle, timer: null };
    queued.push(cue);
    cue.timer = setTimeoutFn(() => {
      if (sequence !== startSequence || !queued.includes(cue)) return;
      if (audioClock() - when > intervalSeconds() / 2) {
        pauseForStall();
        return;
      }
      queued.splice(queued.indexOf(cue), 1);
      state = cueState;
      renderCurrent();
      if (nextState.phase === 'done' && queued.length === 0) {
        state = nextState;
        renderCurrent();
        clearTimer(false);
      }
    }, Math.max(0, (when - audioClock()) * 1000));
  }

  function scheduleTimer(sequence) {
    if (audioClock) {
      nextAt = audioClock() + intervalSeconds();
      const pump = () => {
        if (sequence !== startSequence || !['countin', 'running'].includes(state.phase)) return;
        const now = audioClock();
        if (now - nextAt > intervalSeconds() / 2 || now > nextAt && upcomingSpokenLabel(nextState)) {
          pauseForStall();
          return;
        }
        while (nextState?.phase !== 'done' && nextAt <= now + 0.12) scheduleAudioCue(sequence);
      };
      timerId = setIntervalFn(pump, 25);
      pump();
      return;
    }
    timerId = setIntervalFn(() => {
      if (sequence === startSequence) showAndClick();
    }, getClickIntervalMs(state.bpm));
  }

  function beginRound(setup, sequence, order) {
    if (sequence !== startSequence) return false;
    state = startPreparedRound(setup, order);
    nextState = state;
    showAndClick();
    scheduleTimer(sequence);
    return true;
  }

  function announce(cueState, when) {
    const label = upcomingSpokenLabel(cueState);
    if (label) {
      const index = cueState.phase === 'countin' ? 0 : cueState.noteIndex + 1;
      const playback = getSpokenPlayback(label, cueState.bpm, cueState.order[index].targets.length, index < cueState.order.length - 1);
      if (!playback) throw new Error('Unsafe spoken cue');
      playSpeech({ label, when, variant: playback.variant });
    }
  }

  function prepareAndBegin(sequence, begin, retry = state.phase === 'done' ? 'Shuffle' : 'Start', spokenOrder = state.order, firstAnnouncement = 0) {
    try {
      const prepared = prepareAudio({ ...currentSetup(), spokenOrder, firstAnnouncement });
      if (prepared && typeof prepared.then === 'function') {
        state = { ...state, startPending: true };
        renderCurrent();
        return prepared.then(begin).catch(() => {
          if (sequence !== startSequence) return false;
          state = { ...state, startPending: false };
          renderCurrent(`Audio could not start. Try pressing ${retry} again.`);
          return false;
        });
      }
    } catch {
      if (sequence === startSequence) {
        state = { ...state, startPending: false };
        renderCurrent(`Audio could not start. Try pressing ${retry} again.`);
      }
      return false;
    }
    return begin();
  }

  const currentSetup = (overrides = {}) => createSetup({ ...state, ...overrides });
  const idleFromCurrent = (overrides = {}) => createIdleState(currentSetup(overrides));
  const firstUnheardAnnouncement = () => nextState?.phase === 'countin' ? 0 : (nextState?.noteIndex ?? state.order.length) + 1;

  function updateSetup(overrides = {}) {
    if (state.phase === 'done') {
      startSequence += 1;
      clearTimer();
      state = idleFromCurrent(overrides);
      nextState = null;
      return;
    }
    if (state.phase === 'idle' || state.phase === 'paused') {
      startSequence += 1;
      clearTimer();
    }
    state = { ...state, ...overrides, startPending: false };
  }

  function rejectStart(message) {
    if (state.startPending) {
      startSequence += 1;
      state = { ...state, startPending: false };
    }
    renderCurrent(message);
    return false;
  }

  function start(bpmInput) {
    const bpm = parseBpmInput(bpmInput);
    if (bpm === null) return rejectStart(`Choose a BPM between ${BPM_MIN} and ${BPM_MAX}.`);
    // Invalid requests do not disturb an already running interval.
    if (!isValidNoteSelection(state.selectedLabels)) {
      if (state.phase === 'idle') state = { ...state, bpm };
      return rejectStart('Select at least one note.');
    }
    const setup = currentSetup({ bpm });
    const order = createRangeFilteredRound(
      setup.selectedLabels, setup.fretRange, createOrder, setup.locationMode,
      createTuningStrings(setup.tuning.strings), setup.selectedStringIndexes,
    );
    if (order.length === 0) return rejectStart('No selected notes are available in this fret range.');
    const speechError = spokenCueError(setup, order);
    if (speechError) return rejectStart(speechError);
    startSequence += 1;
    clearTimer();
    state = { ...state, bpm, startPending: false };
    const sequence = startSequence;
    return prepareAndBegin(sequence, () => beginRound(setup, sequence, order), undefined, order);
  }

  return {
    getState: () => state,
    getBpmMax: () => state.phase === 'paused'
      ? getSpokenBpmMax(currentSetup(), state.order, firstUnheardAnnouncement())
      : getSpokenBpmMax(currentSetup()),
    setSetup(setup) {
      if (setup === null || typeof setup !== 'object' || Array.isArray(setup)
        || !isValidBpm(setup.bpm)
        || !Array.isArray(setup.selectedLabels)
        || (setup.selectedLabels.length > 0 && !isValidNoteSelection(setup.selectedLabels))
        || !isValidFretRange(setup.fretRange) || !isValidLocationMode(setup.locationMode)
        || !setup.tuning || !Array.isArray(setup.tuning.strings)
        || !Array.isArray(setup.selectedStringIndexes) || setup.selectedStringIndexes.length === 0
        || new Set(setup.selectedStringIndexes).size !== setup.selectedStringIndexes.length
        || setup.selectedStringIndexes.some(index => !Number.isInteger(index) || index < 0 || index >= setup.tuning.strings.length)) return false;
      const tuning = cloneTuning(setup.tuning);
      if (tuning.id !== setup.tuning.id || tuning.strings.length !== setup.tuning.strings.length
        || tuning.strings.some((label, index) => label !== setup.tuning.strings[index])) return false;
      updateSetup(createSetup(setup));
      renderCurrent();
      return true;
    },
    setSelectedLabels(labels) { updateSetup({ selectedLabels: [...labels] }); renderCurrent(); },
    setFretRange(fretRange, { render: shouldRender = true } = {}) {
      if (isValidFretRange(fretRange)) { updateSetup({ fretRange: cloneFretRange(fretRange) }); if (shouldRender) renderCurrent(); }
    },
    setLocationMode(locationMode) {
      if (isValidLocationMode(locationMode)) { updateSetup({ locationMode }); renderCurrent(); }
    },
    setTuning(tuning, { render: shouldRender = true } = {}) {
      const normalized = cloneTuning(tuning);
      updateSetup({ tuning: normalized, selectedStringIndexes: normalizeSelectedStringIndexes(undefined, normalized.strings.length) });
      if (shouldRender) renderCurrent();
    },
    setSelectedStringIndexes(indexes) {
      updateSetup({ selectedStringIndexes: normalizeSelectedStringIndexes(indexes, state.tuning.strings.length) });
      renderCurrent();
    },
    setBpm(bpm, { render: shouldRender = true } = {}) {
      if (!isValidBpm(bpm)) return;
      if (state.phase === 'idle' || state.phase === 'done' || state.phase === 'paused') {
        startSequence += 1;
        clearTimer();
      }
      state = { ...state, bpm, startPending: false };
      if (state.phase === 'paused' && nextState) nextState = { ...nextState, bpm };
      if (shouldRender) renderCurrent();
    },
    start,
    repeatSameOrder(bpmInput) {
      if (state.phase !== 'done' || !state.completedOrder?.length) return false;
      const bpm = parseBpmInput(bpmInput);
      if (bpm === null) return rejectStart(`Choose a BPM between ${BPM_MIN} and ${BPM_MAX}.`);
      const order = cloneGeneratedOrder(state.completedOrder);
      const setup = currentSetup({ bpm,
        fretRange: state.completedFretRange ?? state.fretRange,
        locationMode: state.completedLocationMode ?? state.locationMode,
        tuning: state.completedTuning ?? state.tuning,
        selectedStringIndexes: state.completedSelectedStringIndexes ?? state.selectedStringIndexes,
      });
      const speechError = spokenCueError(setup, order);
      if (speechError) return rejectStart(speechError);
      startSequence += 1;
      clearTimer();
      state = { ...state, bpm, startPending: false };
      const sequence = startSequence;
      return prepareAndBegin(sequence, () => beginRound(setup, sequence, order), 'Repeat', order);
    },
    pause() {
      if (state.phase !== 'countin' && state.phase !== 'running') return false;
      startSequence += 1;
      if (timerId !== null) { clearIntervalFn(timerId); timerId = null; }
      cancelQueued(true);
      if (nextState?.phase === 'done') {
        state = nextState;
        renderCurrent();
        return true;
      }
      state = { ...state, phase: 'paused', pausedFromPhase: state.phase };
      renderCurrent();
      return true;
    },
    resume() {
      if (state.phase !== 'paused' || state.startPending) return false;
      const firstAnnouncement = firstUnheardAnnouncement();
      const speechError = spokenCueError(currentSetup(), state.order, firstAnnouncement);
      if (speechError) return rejectStart(speechError);
      clearTimer();
      const phase = state.pausedFromPhase === 'countin' ? 'countin' : 'running';
      const sequence = ++startSequence;
      return prepareAndBegin(sequence, () => {
        if (sequence !== startSequence) return false;
        state = { ...state, phase, pausedFromPhase: undefined, startPending: false };
        scheduleTimer(sequence);
        renderCurrent();
        return true;
      }, 'Resume', state.order, firstAnnouncement);
    },
    restartCurrent() {
      if (state.phase !== 'paused' || state.startPending || !state.order?.length) return false;
      const order = cloneGeneratedOrder(state.order);
      const setup = currentSetup({ bpm: state.bpm });
      const speechError = spokenCueError(setup, order);
      if (speechError) return rejectStart(speechError);
      startSequence += 1;
      clearTimer();
      const sequence = startSequence;
      return prepareAndBegin(sequence, () => beginRound(setup, sequence, order), 'Restart', order);
    },
    stop() {
      startSequence += 1;
      clearTimer();
      state = idleFromCurrent();
      nextState = null;
      renderCurrent();
    },
  };
}
