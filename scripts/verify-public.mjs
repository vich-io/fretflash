import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { checkRuntimeGraph } from './runtime-manifest.mjs';

const supplied = process.env.PREVIEW_URL || process.env.BASE_URL || process.argv[2];
if (!supplied) throw new Error('Set PREVIEW_URL or BASE_URL (or pass a root URL argument)');
const origin = new URL(supplied);
if (!['https:', 'http:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('Public verifier requires an HTTP(S) origin root URL (no subpath, query, hash or credentials)');
}
const files = await checkRuntimeGraph();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let failed = 0;
const targets = [...files.map(file => [file, file]), ['/', 'index.html']];
for (const [path, file] of targets) {
  const url = new URL(path, origin);
  const expected = digest(await readFile(new URL(`../${file}`, import.meta.url)));
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const actual = digest(Buffer.from(await response.arrayBuffer()));
    if (actual !== expected) throw new Error(`SHA-256 mismatch local=${expected} remote=${actual}`);
    console.log(`OK ${path} ${actual}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
console.log(`${targets.length - failed}/${targets.length} public paths match local bytes (${files.length} runtime files plus ordinary root)`);
