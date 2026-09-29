import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../src/controller.js';

test('Stop cancels pending Resume and duplicate Resume cannot own another request', async () => {
  let finish;
  let waitForAudio = false;
  let clicks = 0;
  let timers = 0;
  const controller = createAppController({
    render() {},
    prepareAudio: () => waitForAudio ? new Promise(resolve => { finish = resolve; }) : undefined,
    playClick: () => { clicks++; },
    setIntervalFn: () => { timers++; return timers; },
    clearIntervalFn() {},
  });
  controller.start('240');
  controller.pause();
  waitForAudio = true;
  const resumed = controller.resume();
  assert.equal(controller.getState().phase, 'paused');
  assert.equal(controller.getState().startPending, true);
  assert.equal(controller.resume(), false);
  controller.stop();
  finish();
  assert.equal(await resumed, false);
  assert.equal(controller.getState().phase, 'idle');
  assert.equal(clicks, 1);
  assert.equal(timers, 1);
});
