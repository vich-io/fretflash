import { createTuningStrings } from './music.js';

import {
  BPM_MAX,
  BPM_MIN,
  cloneFretRange,
  cloneTuning,
  createSetup,
  isValidBpm,
  isValidFretRange,
  isValidLocationMode,
  isValidNoteSelection,
  normalizeSelectedStringIndexes,
  parseBpmInput,
} from './settings.js';

import {
  advanceAfterClick,
  cloneGeneratedOrder,
  createIdleState,
  startRound,
} from './state.js';

import {
  createRangeFilteredRound,
  getClickIntervalMs,
  shuffleSelectedLabels,
} from './round.js';

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

  function beginRound(setup, sequence, order) {
    if (sequence !== startSequence) {
      return false;
    }

    state = startRound(setup, () => order);
    clickCurrentAndPrepareNext();
    scheduleTimer(sequence);
    return true;
  }

  function prepareAndBegin(sequence, beginPreparedRound) {
    try {
      const prepared = prepareAudio();
      if (prepared && typeof prepared.then === 'function') {
        return prepared
          .then(beginPreparedRound)
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

    return beginPreparedRound();
  }

  function createCurrentSetup(overrides = {}) {
    return createSetup({ ...state, ...overrides });
  }

  function createSetupStateFromCurrent(overrides = {}) {
    return createIdleState(createCurrentSetup(overrides));
  }

  function updateSetup(overrides = {}) {
    if (state.phase === 'done') {
      startSequence += 1;
      clearTimer();
      state = createSetupStateFromCurrent(overrides);
      return;
    }

    if (state.phase === 'idle' || state.phase === 'paused') {
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


    setFretRange(fretRange, { render = true } = {}) {
      if (isValidFretRange(fretRange)) {
        updateSetup({ fretRange: cloneFretRange(fretRange) });
        if (render) renderCurrent();
      }
    },

    setLocationMode(locationMode) {
      if (isValidLocationMode(locationMode)) {
        updateSetup({ locationMode });
        renderCurrent();
      }
    },

    setTuning(tuning, { render = true } = {}) {
      const normalizedTuning = cloneTuning(tuning);
      updateSetup({
        tuning: normalizedTuning,
        selectedStringIndexes: normalizeSelectedStringIndexes(undefined, normalizedTuning.strings.length),
      });
      if (render) renderCurrent();
    },

    setSelectedStringIndexes(indexes) {
      const tuning = cloneTuning(state.tuning);
      updateSetup({ selectedStringIndexes: normalizeSelectedStringIndexes(indexes, tuning.strings.length) });
      renderCurrent();
    },

    setBpm(bpm, { render = true } = {}) {
      if (isValidBpm(bpm)) {
        if (state.phase === 'idle' || state.phase === 'done' || state.phase === 'paused') {
          startSequence += 1;
          clearTimer();
        }
        state = { ...state, bpm };
        if (render) renderCurrent();
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

      const setup = createCurrentSetup();
      const order = createRangeFilteredRound(
        setup.selectedLabels,
        setup.fretRange,
        createOrder,
        setup.locationMode,
        createTuningStrings(setup.tuning.strings),
        setup.selectedStringIndexes,
      );
      if (order.length === 0) {
        renderCurrent('No selected notes are available in this fret range.');
        return false;
      }

      const sequence = startSequence + 1;
      startSequence = sequence;
      clearTimer();

      return prepareAndBegin(sequence, () => beginRound(setup, sequence, order));
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
      const order = cloneGeneratedOrder(state.completedOrder);
      const setup = createCurrentSetup({
        bpm,
        fretRange: state.completedFretRange ?? state.fretRange,
        locationMode: state.completedLocationMode ?? state.locationMode,
        tuning: state.completedTuning ?? state.tuning,
        selectedStringIndexes: state.completedSelectedStringIndexes ?? state.selectedStringIndexes,
      });
      const sequence = startSequence + 1;
      startSequence = sequence;
      clearTimer();

      return prepareAndBegin(sequence, () => beginRound(setup, sequence, order));
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

    restartCurrent() {
      if (state.phase !== 'paused' || !Array.isArray(state.order) || state.order.length === 0) {
        return false;
      }

      const order = cloneGeneratedOrder(state.order);
      const setup = createCurrentSetup({ bpm: state.bpm });
      const sequence = startSequence + 1;
      startSequence = sequence;
      clearTimer();

      return prepareAndBegin(sequence, () => beginRound(setup, sequence, order));
    },

    stop() {
      startSequence += 1;
      clearTimer();
      state = createSetupStateFromCurrent();
      renderCurrent();
    },
  };
}
