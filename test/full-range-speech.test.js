import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as speech from '../src/speech.js';
import { BPM_MIN, BPM_MAX, createSetup } from '../src/settings.js';
import { KNOWN_NOTE_LABELS } from '../src/music.js';

const hash = path => createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');

test('all spellings fit successive one-target calls throughout the complete supported BPM range', () => {
  for (let bpm=BPM_MIN;bpm<=BPM_MAX;bpm++) for (const label of KNOWN_NOTE_LABELS) {
    const call=speech.getSpokenPlayback(label,bpm,1);
    assert.ok(call,`${label} at ${bpm}`);
    assert.ok(call.duration+speech.SPOKEN_GAP_SECONDS<=60/bpm+1e-9);
  }
  const setup=createSetup({ spokenCues:true,bpm:BPM_MAX,selectedLabels:KNOWN_NOTE_LABELS,selectedStringIndexes:[0] });
  assert.equal(speech.getSpokenBpmMax(setup),BPM_MAX);
});

test('one selector prefers natural, then the accepted moderate fallback, then tight speech only as needed', () => {
  assert.equal(speech.getSpokenPlayback('C#',40,1).variant,'natural');
  assert.equal(speech.getSpokenPlayback('C#',200,2).variant,'fast');
  assert.equal(speech.getSpokenPlayback('C#',200,1).variant,'tight');
  assert.equal(speech.getSpokenPlayback('C',200,1).variant,'tight','plain names also need compression');
  assert.equal(speech.getSpokenPlayback('C#',200,1,false).variant,'natural');
  assert.equal(speech.getSpokenPlayback('Done',200,1),null);
});

test('tight source bank covers every complete spelling within the one-target maximum-rate budget with nonzero bounded PCM', () => {
  const bank=speech.SPOKEN_BANKS?.tight;
  assert.ok(bank,'tight bank metadata');
  assert.deepEqual(Object.keys(bank.clips).sort(),[...KNOWN_NOTE_LABELS].sort());
  const wav=readFileSync(new URL('../assets/voice/george-tight.wav',import.meta.url));
  assert.equal(wav.toString('ascii',0,4),'RIFF'); assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt16LE(20),1); assert.equal(wav.readUInt16LE(22),1); assert.equal(wav.readUInt32LE(24),bank.sampleRate);
  assert.equal(wav.toString('ascii',36,40),'data'); assert.equal(wav.length,44+bank.frames*2);
  let cursor=0;
  for(const [label,[start,end]] of Object.entries(bank.clips)) {
    assert.equal(start,cursor); assert.ok(end>start); assert.ok(end<=bank.frames); cursor=end;
    const clip=speech.getSpokenClip(label,'tight');
    assert.ok(clip.duration+speech.SPOKEN_GAP_SECONDS<=60/BPM_MAX+1e-9);
    let peak=0; for(let frame=start;frame<end;frame++) peak=Math.max(peak,Math.abs(wav.readInt16LE(44+frame*2)));
    assert.ok(peak>1000 && peak<32767,`${label} signal/headroom`);
  }
  assert.equal(cursor,bank.frames);
  assert.equal(hash('assets/voice/george.wav'),'bc2a1a4be75fb3d0fc9ab18e1c253c4206ed2051bd4bfb8d61a021a8719335e3');
  assert.equal(hash('assets/voice/george-fast.wav'),'fa4fbf9f21a0bebf23c579a84d7c8aba7333f384e8a5dead0b2ab3e90b1d2d07');
});
