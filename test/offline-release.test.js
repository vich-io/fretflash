import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prepareOffline, versionRuntime } from '../scripts/offline-release.mjs';

const sha = bytes => 'sha256-' + createHash('sha256').update(bytes).digest('base64');
async function snapshot() {
  const names = JSON.parse(await readFile('runtime-files.json', 'utf8')).files;
  return new Map(await Promise.all(names.map(async name => [name, await readFile(name)])));
}

test('prepared worker pins every runtime byte except itself and preparing twice is identical', async () => {
  const original = await snapshot(), { files, version } = prepareOffline(original);
  const worker = files.get('sw.js').toString();
  const assets = JSON.parse(worker.match(/const PRECACHE = ([\s\S]*?);\n\/\/ precache:end/)[1]);
  assert.equal(assets.length, files.size - 1);
  for (const [name, bytes] of files) {
    if (name === 'sw.js') continue;
    const url = name === 'index.html' ? '/' : `/${name}?v=${version}`;
    assert.deepEqual(assets.find(asset => asset.url === url), { url, integrity: sha(bytes) });
  }
  const next = prepareOffline(files);
  assert.equal(next.version, version);
  for (const [name, bytes] of files) assert.ok(next.files.get(name).equals(bytes), name);
});

test('worker-only and WAV-only changes both receive new release URLs and cache identities', async () => {
  const original = await snapshot(), before = prepareOffline(original);
  for (const name of ['sw.js', 'assets/voice/george-tight.wav']) {
    const changed = new Map(original);
    changed.set(name, Buffer.concat([changed.get(name), Buffer.from('\nchanged\n')]));
    const after = prepareOffline(changed);
    assert.notEqual(after.version, before.version);
    assert.notEqual(after.files.get('sw.js').toString().match(/CACHE_NAME = '([^']+)'/)[1], before.files.get('sw.js').toString().match(/CACHE_NAME = '([^']+)'/)[1]);
  }
});

test('deep imports, renderer icons and manifest icons are versioned; bank recipe paths stay plain', async () => {
  const files = versionRuntime(await snapshot(), 'qa-assets');
  assert.match(files.get('app.js').toString(), /\.\/src\/audio\.js\?v=qa-assets/);
  assert.match(files.get('src/audio.js').toString(), /\.\/speech\.js\?v=qa-assets/);
  assert.match(files.get('src/render.js').toString(), /assets\/icons\/fretflash-six-line-f\.svg\?v=qa-assets/);
  assert.match(files.get('manifest.json').toString(), /fretflash-maskable-512\.png\?v=qa-assets/);
  assert.match(files.get('src/voice-bank.js').toString(), /"path": "assets\/voice\/george\.wav"/);
  assert.match(files.get('src/audio.js').toString(), /metadata\.path \+ new URL\(import\.meta\.url\)\.search/);
});
