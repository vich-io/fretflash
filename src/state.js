import { createTuningStrings } from './music.js?v=043bbc19dc51c1fe';

import {
  BPM_MAX,
  BPM_MIN,
  cloneFretRange,
  cloneTuning,
  createSetup,
  isValidBpm,
} from './settings.js?v=043bbc19dc51c1fe';

import {
  createRangeFilteredRound,
  shuffleSelectedLabels,
} from './round.js?v=043bbc19dc51c1fe';

export function createIdleState(
  setupInput = {},
) {
  if (setupInput === null || typeof setupInput !== 'object' || Array.isArray(setupInput)) {
    throw new TypeError('createIdleState expects a setup object');
  }
  const setup = createSetup(setupInput);

  return {
    phase: 'idle',
    startPending: false,
    bpm: setup.bpm,
    spokenCues: setup.spokenCues,
    order: [],
    selectedLabels: setup.selectedLabels,
    fretRange: setup.fretRange,
    locationMode: setup.locationMode,
    tuning: setup.tuning,
    selectedStringIndexes: setup.selectedStringIndexes,
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  };
}

export function cloneGeneratedOrder(order) {
  return order.map((group) => ({
    ...group,
    targets: group.targets.map((target) => ({ ...target })),
  }));
}

export function startRound(setupInput, createOrder = shuffleSelectedLabels) {
  if (setupInput === null || typeof setupInput !== 'object' || Array.isArray(setupInput)) {
    throw new TypeError('startRound expects a setup object');
  }
  const setup = createSetup(setupInput);

  if (!isValidBpm(setup.bpm)) {
    throw new Error(`BPM must be an integer from ${BPM_MIN} to ${BPM_MAX}`);
  }

  const order = createRangeFilteredRound(
    setup.selectedLabels,
    setup.fretRange,
    createOrder,
    setup.locationMode,
    createTuningStrings(setup.tuning.strings),
    setup.selectedStringIndexes,
  );

  return startPreparedRound(setup, order);
}

// The controller already generated and validated this order before preparing audio.
export function startPreparedRound(setupInput, preparedOrder) {
  const setup = createSetup(setupInput);
  if (!isValidBpm(setup.bpm) || !Array.isArray(preparedOrder) || preparedOrder.length === 0) {
    throw new Error('A valid BPM and nonempty prepared order are required');
  }
  return {
    phase: 'countin',
    startPending: false,
    bpm: setup.bpm,
    spokenCues: setup.spokenCues,
    order: cloneGeneratedOrder(preparedOrder),
    selectedLabels: [...setup.selectedLabels],
    fretRange: cloneFretRange(setup.fretRange),
    locationMode: setup.locationMode,
    tuning: cloneTuning(setup.tuning),
    selectedStringIndexes: [...setup.selectedStringIndexes],
    noteIndex: 0,
    beatInNote: 1,
    countInBeat: 1,
  };
}

function getCurrentNoteGroup(state) {
  return state.order[state.noteIndex];
}

function getCurrentGroupBeatCount(state) {
  return getCurrentNoteGroup(state)?.targets.length ?? 0;
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
      completedOrder: cloneGeneratedOrder(state.order),
      completedFretRange: cloneFretRange(state.fretRange),
      completedLocationMode: state.locationMode,
      completedTuning: cloneTuning(state.tuning),
      completedSelectedStringIndexes: [...state.selectedStringIndexes],
    };
  }

  return state;
}
