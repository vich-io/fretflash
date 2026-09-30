import { test, expect } from '@playwright/test';
import { createSetup, saveSettings } from '../src/settings.js';

const geometrySelectors = ['.brand-heading', '.drill-header', '.prompt-deck', '#quick-reference', '.app-footer'];
const geometry = page => page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
  const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
  return [selector, { x, y, width, height }];
})), geometrySelectors);

async function holdEntry(page) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/app.js', async route => { await gate; await route.continue(); });
  return release;
}

async function expectInitialSetup(page) {
  await expect(page.locator('.drill-cell')).toHaveCount(5);
  await expect(page.locator('.note-pill')).toHaveCount(21);
  await expect(page.locator('#start-button')).toBeVisible();
  await expect(page.locator('#start-button')).toBeDisabled();
  expect(await page.locator('#app button, #app input').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.disabled))).toBe(true);
  await expect(page.locator('.practice-stage')).toHaveCount(0);
  await expect(page.locator('.home-link')).toHaveAttribute('href', 'https://vich.io/');
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('complete default setup stays inactive while native help and links work', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expectInitialSetup(page);
    await expect(page.locator('noscript p')).toContainText('JavaScript is required');
    await expect(page.locator('noscript p')).toBeVisible();
    await page.locator('#quick-reference > summary').click();
    await expect(page.locator('#quick-reference > p').first()).toBeVisible();
    await page.locator('#quick-reference details > summary').click();
    await expect(page.locator('#quick-reference details p').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('no-javascript.png'), fullPage: true });
    await page.route('https://vich.io/', route => route.fulfill({ contentType: 'text/html', body: '<h1>Home destination</h1>' }));
    await page.locator('.home-link').click();
    await expect(page).toHaveURL('https://vich.io/');
  });
});

for (const [width, height] of [[320,568], [390,844], [768,1024], [1440,900]]) {
  test(`delayed entry preserves full setup geometry, help and nodes ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const release = await holdEntry(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/', { waitUntil: 'commit' });
      await expectInitialSetup(page);
      await expect(page.locator('.drill-header')).toHaveCSS('display', 'grid');
      await page.evaluate(() => document.fonts.ready);
      const before = await geometry(page);
      await page.screenshot({ path: info.outputPath('before-entry.png'), fullPage: true });
      await page.evaluate(() => {
        window.initialNodes = ['main', '#start-button', '#quick-reference'].map(selector => document.querySelector(selector));
      });
      const help = page.locator('#quick-reference');
      await help.locator(':scope > summary').click();
      await help.locator('details > summary').click();
      await help.locator(':scope > summary').focus();
      release();
      await expect(page.locator('#start-button')).toBeEnabled();
      expect(await page.evaluate(() => window.initialNodes.every((node, i) => node === document.querySelector(['main', '#start-button', '#quick-reference'][i])))).toBe(true);
      await expect(help).toHaveAttribute('open', '');
      await expect(help.locator('details')).toHaveAttribute('open', '');
      await expect(help.locator(':scope > summary')).toBeFocused();
      // Closing a disclosure after startup must not be undone by later paints.
      await help.locator('details > summary').click();
      await help.locator(':scope > summary').click();
      await page.locator('[data-popover-target="bpm"]').click();
      await page.keyboard.press('Escape');
      await expect(help).not.toHaveAttribute('open', '');
      await expect(help.locator('details')).not.toHaveAttribute('open', '');
      const after = await geometry(page);
      for (const selector of geometrySelectors) {
        for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(after[selector][key] - before[selector][key]), `${selector} ${key}`).toBeLessThanOrEqual(1);
      }
      await page.evaluate(() => document.activeElement.blur());
      await page.mouse.move(0, 0);
      await page.screenshot({ path: info.outputPath('ready.png'), fullPage: true });
      await page.locator('#start-button').click();
      await expect(page.locator('.practice-countin')).toBeVisible();
      await page.locator('#stop-button').click();
      await expect(help).not.toHaveAttribute('open', '');
      await expect(help.locator('details')).not.toHaveAttribute('open', '');
      expect(errors).toEqual([]);
    } finally { release(); }
  });
}

test('saved settings are restored before controls accept input', async ({ page }) => {
  let saved;
  saveSettings({ setItem: (key, value) => { saved = { key, value }; } }, createSetup({
    bpm: 73, selectedLabels: ['C#', 'Db'], fretRange: { from: 3, to: 15 },
    locationMode: 'all-in-range', tuning: { id: 'custom', strings: ['B', 'E', 'A', 'D', 'G', 'B', 'e'] }, selectedStringIndexes: [0, 2, 6],
  }));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), saved);
  const release = await holdEntry(page);
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expectInitialSetup(page);
    await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('40');
    const start = await page.locator('#start-button').boundingBox();
    await page.mouse.click(start.x + start.width / 2, start.y + start.height / 2);
    await page.keyboard.press('Space');
    await expect(page.locator('.practice-stage')).toHaveCount(0);
    await page.evaluate(() => {
      const button = document.querySelector('#start-button');
      window.firstEnabledSetup = null;
      new MutationObserver(() => {
        if (!button.disabled && !window.firstEnabledSetup) window.firstEnabledSetup = {
          bpm: document.querySelector('[data-popover-target="bpm"] strong').textContent,
          selected: [...document.querySelectorAll('.note-pill[aria-pressed="true"]')].map(node => node.dataset.noteLabel),
        };
      }).observe(button, { attributes: true, attributeFilter: ['disabled'] });
    });
    release();
    await expect(page.locator('#start-button')).toBeEnabled();
    expect(await page.evaluate(() => window.firstEnabledSetup)).toEqual({ bpm: '73', selected: ['C#', 'Db'] });
    await expect(page.locator('[data-popover-target="tuning"] strong')).toHaveText('Custom');
    await expect(page.locator('[data-popover-target="targets"] strong')).toHaveText('All in range');
    await expect(page.locator('[data-string-index][aria-pressed="true"]')).toHaveCount(3);
    await expect(page.locator('#fret-from')).toHaveValue('3');
    await expect(page.locator('#fret-to')).toHaveValue('15');
    await expect(page.locator('.practice-stage')).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), saved.key)).toBe(saved.value);
    await page.locator('#start-button').click();
    await expect(page.locator('.practice-countin')).toBeVisible();
    await page.locator('#stop-button').click();
  } finally { release(); }
});

test('failed entry request leaves the complete inactive setup and working help', async ({ page }) => {
  await page.route('**/app.js', route => route.abort('failed'));
  await page.goto('/');
  await expectInitialSetup(page);
  await page.locator('#quick-reference > summary').click();
  await expect(page.locator('#quick-reference > p').first()).toBeVisible();
  await expect(page.locator('#start-button')).toBeDisabled();
});
