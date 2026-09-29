import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = process.cwd();
const run = (script, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script], { cwd: root, timeout: 15000, ...options });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  child.on('error', reject);
  child.on('close', code => resolve({ code, output }));
});

test('public verifier rejects changed modules and a wrong ordinary root independently', async () => {
  let mutation = '';
  const server = createServer(async (request, response) => {
    if (request.url === mutation) { response.end('wrong bytes'); return; }
    const file = request.url === '/' ? 'index.html' : request.url.slice(1);
    try { response.end(await readFile(join(root, file))); } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}/`;
    for (const [path, expected] of [['', 0], ['/app.js', 1], ['/', 1]]) {
      mutation = path;
      const result = await run('scripts/verify-public.mjs', { env: { ...process.env, PREVIEW_URL: origin } });
      assert.equal(result.code, expected, `${path || 'matching bytes'}: ${result.output}`);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('runtime graph rejects an unlisted new import', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'fretflash-graph-'));
  try {
    const files = JSON.parse(await readFile('runtime-files.json', 'utf8')).files;
    for (const file of [...files, 'runtime-files.json', 'package.json', 'scripts/check-runtime.mjs', 'scripts/runtime-manifest.mjs']) {
      await mkdir(dirname(join(fixture, file)), { recursive: true });
      await copyFile(join(root, file), join(fixture, file));
    }
    const app = await readFile(join(fixture, 'app.js'), 'utf8');
    await writeFile(join(fixture, 'app.js'), `${app}\nimport './src/unlisted.js';\n`);
    const result = await run('scripts/check-runtime.mjs', { cwd: fixture });
    assert.equal(result.code, 1);
    assert.match(result.output, /Unlisted runtime graph asset: src\/unlisted.js/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
