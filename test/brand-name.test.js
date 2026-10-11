import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderHtml } from '../src/render.js';
import { createIdleState } from '../src/state.js';
import { getViewModel } from '../src/view-model.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('current branding is lowercase in search, sharing, help, accessibility and installation', () => {
  const title = 'fretflash — free guitar fretboard trainer';
  for (const path of ['scripts/page-template.html', 'index.html']) {
    const html = read(path);
    assert.ok(html.includes(`<title>${title}</title>`));
    assert.ok(html.includes('content="fretflash"'));
    assert.ok(html.includes('"name":"fretflash"'));
    assert.doesNotMatch(html, /FretFlash|Fretflash|FRETFLASH/);
  }
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.name, 'fretflash');
  assert.equal(manifest.short_name, 'fretflash');
  assert.match(renderHtml(getViewModel(createIdleState())), /aria-label="fretflash — return to setup"/);
  assert.doesNotMatch(read('scripts/share-card.html'), /FretFlash|Fretflash/);
});
