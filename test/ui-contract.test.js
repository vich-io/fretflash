import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRuntimeGraph } from '../scripts/runtime-manifest.mjs';

test('single runtime manifest exactly covers the reachable no-build app graph', async () => {
  const files = await checkRuntimeGraph();
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('assets/icons/fretflash-six-line-f.svg'));
});
