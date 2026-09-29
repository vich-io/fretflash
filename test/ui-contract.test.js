import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import {
  createSetup,
} from '../src/settings.js';
import {
  createIdleState,
} from '../src/state.js';
import { getViewModel } from '../src/view-model.js';
import {
  renderHtml,
} from '../src/render.js';

const requiredFiles = [
  'index.html',
  'style.css',
  'app.js',
  'src/audio.js',
  'src/browser/setup-drafts.js',
  'src/controller.js',
  'src/music.js',
  'src/round.js',
  'src/settings.js',
  'src/state.js',
  'src/render.js',
  'src/view-model.js',
  'assets/fonts/inter-latin-variable.woff2',
  'assets/fonts/OFL.txt',
  'assets/icons/fretflash-six-line-f.svg',
];

function cssRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 's').exec(css)?.groups?.body ?? '';
}

test('static app entry files exist', async () => {
  await Promise.all(requiredFiles.map((path) => access(path)));
});

test('index.html keeps the static no-build app entry minimal', async () => {
  const html = await readFile('index.html', 'utf8');

  assert.match(html, /<meta name="description" content="FretFlash is a tiny guitar fretboard note-recall drill: choose note prompts, play them across the strings to a click, and build faster recall\."\>/);
  assert.match(html, /<div class="app-brand" aria-label="FretFlash">[\s\S]*<span class="brand-wordmark">fretflash\.<\/span>/);
  assert.match(html, /<link rel="preload" href="assets\/fonts\/inter-latin-variable\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.match(html, /<link rel="license" href="assets\/fonts\/OFL\.txt"/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="assets\/icons\/fretflash-six-line-f\.svg">/);
  assert.match(html, /<img class="brand-mark" src="assets\/icons\/fretflash-six-line-f\.svg" alt="" aria-hidden="true" width="28" height="28">/);
  assert.match(html, /<link rel="stylesheet" href="style\.css">/);
  assert.match(html, /<div id="app"><\/div>/);
  assert.doesNotMatch(html, /<main id="app"|Loading…|Loading\.\.\.|<p>Loading/);
  assert.match(html, /<noscript>[\s\S]*fretflash\.[\s\S]*JavaScript is required to run the drill\.[\s\S]*<\/noscript>/);
  assert.match(html, /<script type="module" src="app\.js"><\/script>/);
});

test('six-line F retains the exact selected monochrome artwork', async () => {
  const svg = await readFile('assets/icons/fretflash-six-line-f.svg', 'utf8');
  assert.equal(createHash('sha256').update(svg).digest('hex'), 'ae05e48647309118bec85bd7e54092cc6c427ba087ff40e4b9223eee12b204b5');
  assert.equal((svg.match(/data-line=/g) ?? []).length, 6);
  assert.match(svg, /stroke="#efefed"/);
});

test('app self-hosts Inter to match just click', async () => {
  const css = await readFile('style.css', 'utf8');

  assert.match(css, /@font-face\s*\{[^}]*font-family: 'Inter';[^}]*font-weight: 100 900;[^}]*src: url\('assets\/fonts\/inter-latin-variable\.woff2'\) format\('woff2'\);/s);
  assert.match(css, /:root\s*\{[^}]*font-family: 'Inter', ui-sans-serif, system-ui/s);
  assert.doesNotMatch(css, /ibm-plex|IBM Plex/);
});

test('home link uses the vich.io homepage font stack', async () => {
  const css = await readFile('style.css', 'utf8');
  assert.match(cssRule(css, '.home-link'), /font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;/);
});


test('setup render keeps fret-range controls and defaults structurally intact', () => {
  const setup = {
    ...createSetup(createIdleState({ bpm: 60, selectedLabels: ['C'], fretRange: { from: 0, to: 12 } })),
    openPopover: 'fret-range',
  };
  const html = renderHtml(getViewModel(createIdleState()), setup);

  assert.match(html, /<div class="fret-range-picker" aria-label="Fret range picker">/);
  assert.deepEqual([...html.matchAll(/data-fret-preset="([^"]+)"/g)].map((match) => match[1]), ['open', 'low', 'default', 'high', 'dusty', 'all']);
  assert.match(html, /data-fret-preset="default" data-fret-from="0" data-fret-to="12" aria-pressed="true"/);
  assert.match(html, /data-fret-preset="all" data-fret-from="0" data-fret-to="24"/);
  assert.doesNotMatch(html, /data-fret-preset="middle"/);
  assert.match(html, /<label for="fret-from">From<\/label><input id="fret-from"/);
  assert.match(html, /<label for="fret-to">To<\/label><input id="fret-to"/);
});

test('CSS keeps only broad structural contracts in static tests', async () => {
  const css = await readFile('style.css', 'utf8');

  for (const selector of [
    '.app-shell',
    '.setup-launcher',
    '.drill-cell',
    '.header-popover',
    '.prompt-deck',
    '.note-grid',
    '.practice-stage',
    '.practice-display',
    '.note-progress-rail',
    '.progress-cell',
    '.done-actions',
  ]) {
    assert.notEqual(cssRule(css, selector), '', `${selector} rule should exist`);
  }

  assert.match(cssRule(css, '.note-progress-rail'), /overflow-x:\s*auto/);
  assert.match(cssRule(css, '.progress-cell'), /inline-size:/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.touch-first \.shortcut-hint\s*\{[^}]*display: none;/s);
  assert.doesNotMatch(css, /\.count-card\s*\{|\.count-in-number\s*\{|\.progress-check\s*\{|\.app-shell-done\s*\{|\.done-panel\s*\{|\.done-sigil\s*\{/);
});
