import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceAfterClick,
  startRound,
} from '../src/state.js';

import {
  createRangeFilteredRound,
  formatRoundDuration,
  getAvailableTargetsForLabelInRange,
  getClickIntervalMs,
  getRoundClickCount,
  shuffleSelectedLabels,
} from '../src/round.js';

import { getViewModel } from '../src/view-model.js';



test('round module owns pure round generation and timing helpers', () => {
  const groups = createRangeFilteredRound(['C', 'Db'], { from: 0, to: 12 }, (items) => items);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.label), ['C', 'Db']);
  assert.equal(getRoundClickCount(groups), 12);
  assert.equal(getClickIntervalMs(120), 500);
  assert.equal(formatRoundDuration(12, 60), '12s');
  assert.equal(getAvailableTargetsForLabelInRange('C', { from: 0, to: 0 }).length, 0);
  assert.deepEqual(shuffleSelectedLabels(['C'], () => 0.5), ['C']);
});

test('state and view-model modules own drill transitions and display derivation', () => {
  const state = startRound({ bpm: 60, selectedLabels: ['C'], fretRange: { from: 0, to: 12 } }, (items) => items);

  assert.equal(state.phase, 'countin');
  assert.equal(getViewModel(state).status, 'Count-in: 4 / 4');

  let advanced = state;
  for (let tick = 0; tick < 4; tick += 1) {
    advanced = advanceAfterClick(advanced);
  }

  assert.equal(advanced.phase, 'running');
  assert.equal(getViewModel(advanced).prompt, 'C');
});
