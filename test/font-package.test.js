import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
test('Inter keeps its identity and used weight range in a smaller WOFF2', () => {
  const bytes = read('assets/fonts/inter-latin-variable.woff2');
  assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
  assert.ok(bytes.length < 38000, `${bytes.length} bytes`);
  assert.match(read('style.css').toString().match(/@font-face\s*\{[^}]+\}/)[0], /font-weight:\s*400 700;/);
});
