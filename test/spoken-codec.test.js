import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { SPOKEN_BANKS } from '../src/speech.js';

const file = path => new URL(`../${path}`, import.meta.url);

test('only the three compact Opus/WebM banks ship and the WAV sources stay development-only', () => {
  const runtime = JSON.parse(readFileSync(file('runtime-files.json'), 'utf8')).files;
  const expected = ['assets/voice/george.webm', 'assets/voice/george-fast.webm', 'assets/voice/george-tight.webm'];
  assert.deepEqual(Object.values(SPOKEN_BANKS).map(bank => bank.path), expected);
  assert.deepEqual(runtime.filter(path => path.startsWith('assets/voice/')).sort(), [...expected].sort());
  let bytes = 0;
  for (const path of expected) {
    const encoded = readFileSync(file(path));
    assert.equal(encoded.subarray(0, 4).toString('hex'), '1a45dfa3', 'WebM header');
    assert.ok(encoded.includes(Buffer.from('A_OPUS')), 'Opus codec, not another format');
    bytes += encoded.length;
    assert.ok(statSync(file(path.replace('.webm', '.wav'))).size > encoded.length, 'source preserved outside runtime');
  }
  assert.ok(bytes < 260000, `compressed banks: ${bytes} bytes`);
});
