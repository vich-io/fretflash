import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { renderDocument } from '../scripts/prerender.mjs';

const templatePath = 'scripts/page-template.html';

test('checked-in initial HTML is generated from the current renderer and document template', async () => {
  const source = await readFile(templatePath, 'utf8');
  assert.equal(await readFile('index.html', 'utf8'), renderDocument(source));
});

test('prerender refuses ambiguous template boundaries', () => {
  for (const source of ['', '<!-- setup:end --><!-- setup:start -->', '<!-- setup:start --><!-- setup:end --><!-- setup:end -->', '<!-- setup:start --><!-- setup:start --><!-- setup:end -->']) {
    assert.throws(() => renderDocument(source), /exactly one ordered/);
  }
});

test('normal runtime gate rejects stale HTML without rewriting it; prerender repairs it', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'fretflash-prerender-'));
  try {
    const runtime = JSON.parse(await readFile('runtime-files.json', 'utf8')).files;
    const files = [...runtime, 'runtime-files.json', 'package.json', templatePath, 'scripts/prerender.mjs', 'scripts/check-runtime.mjs', 'scripts/runtime-manifest.mjs'];
    for (const file of files) {
      await mkdir(dirname(join(fixture, file)), { recursive: true });
      await copyFile(file, join(fixture, file));
    }
    const run = (command, args) => spawnSync(command, args, { cwd: fixture, timeout: 15000, encoding: 'utf8' });
    const stale = await readFile(join(fixture, 'index.html'), 'utf8');
    // A renderer edit, not just a corrupt HTML file, must invalidate the checked-in document.
    const renderer = await readFile(join(fixture, 'src/render.js'), 'utf8');
    await writeFile(join(fixture, 'src/render.js'), renderer.replace('Notes to practice', 'Changed renderer heading'));
    const blocked = run('npm', ['run', 'check:runtime']);
    assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
    assert.match(blocked.stderr, /index.html is stale/);
    assert.equal(await readFile(join(fixture, 'index.html'), 'utf8'), stale);
    const generated = run(process.execPath, ['scripts/prerender.mjs']);
    assert.equal(generated.status, 0, generated.stderr);
    assert.match(await readFile(join(fixture, 'index.html'), 'utf8'), /Changed renderer heading/);
    const current = run('npm', ['run', 'check:runtime']);
    assert.equal(current.status, 0, current.stdout + current.stderr);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
