import test from 'node:test';
import assert from 'node:assert/strict';

import { createWebAudioClickPlayer } from '../src/audio.js';

test('future click can be cancelled before it sounds', () => {
  const starts = [];
  const stops = [];
  const player = createWebAudioClickPlayer(class {
    constructor() { this.currentTime = 3; this.state = 'running'; this.destination = {}; }
    createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start: (at) => starts.push(at), stop: (at) => stops.push(at), disconnect() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }; }
  });
  player.prepare();
  assert.equal(player.now(), 3);
  const handle = player.play({ accent: true, when: 4 });
  assert.deepEqual(starts, [4]);
  player.cancel(handle);
  assert.ok(stops.some((at) => at <= 3));
});

// Web Audio click player
test('createWebAudioClickPlayer prepare fails when AudioContext is unavailable', () => {
  const player = createWebAudioClickPlayer(undefined);

  assert.throws(() => player.prepare(), /Web Audio is not available/);
});

test('createWebAudioClickPlayer prepares context and plays a short click', () => {
  const events = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 10;
      this.destination = 'destination';
    }

    resume() {
      events.push('resume');
      this.state = 'running';
    }

    createOscillator() {
      return {
        type: '',
        frequency: {
          setValueAtTime: (value, time) => events.push(['frequency', value, time]),
        },
        connect: () => events.push('oscillator-connect'),
        start: (time) => events.push(['start', time]),
        stop: (time) => events.push(['stop', time]),
      };
    }

    createGain() {
      return {
        gain: {
          setValueAtTime: (value, time) => events.push(['gain-set', value, time]),
          exponentialRampToValueAtTime: (value, time) => events.push(['gain-ramp', value, time]),
        },
        connect: (destination) => events.push(['gain-connect', destination]),
      };
    }
  }

  const player = createWebAudioClickPlayer(FakeAudioContext);

  player.prepare();
  player.play();

  assert.equal(events[0], 'resume');
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'frequency'), ['frequency', 1200, 10]);
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'start'), ['start', 10]);
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'stop'), ['stop', 10.05]);
});

test('createWebAudioClickPlayer plays accented clicks with a higher pitch and gain', () => {
  const events = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 20;
      this.destination = 'destination';
    }

    createOscillator() {
      return {
        type: '',
        frequency: {
          setValueAtTime: (value, time) => events.push(['frequency', value, time]),
        },
        connect: () => {},
        start: (time) => events.push(['start', time]),
        stop: (time) => events.push(['stop', time]),
      };
    }

    createGain() {
      return {
        gain: {
          setValueAtTime: (value, time) => events.push(['gain-set', value, time]),
          exponentialRampToValueAtTime: (value, time) => events.push(['gain-ramp', value, time]),
        },
        connect: () => {},
      };
    }
  }

  const player = createWebAudioClickPlayer(FakeAudioContext);

  player.prepare();
  player.play({ accent: true });

  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'frequency'), ['frequency', 1800, 20]);
  assert.ok(events.some((event) => Array.isArray(event) && event[0] === 'gain-ramp' && event[1] === 0.28));
  assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'stop'), ['stop', 20.05]);
});
