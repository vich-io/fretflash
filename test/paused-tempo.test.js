import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../src/controller.js';

test('paused tempo persists into subsequent cues without resetting the order or position', () => {
  let tick, interval;
  const controller=createAppController({render(){},playClick(){},setIntervalFn(fn,ms){tick=fn;interval=ms;return 1;},clearIntervalFn(){}});
  controller.start('240');
  while(controller.getState().phase==='countin') tick();
  controller.pause();
  const before=controller.getState();
  controller.setBpm(180); controller.resume();
  assert.equal(interval,60000/180);
  tick();
  assert.equal(controller.getState().bpm,180);
  assert.deepEqual(controller.getState().order,before.order);
  assert.equal(controller.getState().beatInNote,before.beatInNote+1);
});
