import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const original = readFileSync('assets/fonts/source/inter-latin-variable-full.woff2');
const trimmed = readFileSync('assets/fonts/inter-latin-variable.woff2');

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`trimmed Inter preserves setup/help geometry at ${viewport.width}×${viewport.height}`, async ({ page, context }, info) => {
    await page.setViewportSize(viewport);
    const routeFont = '**/assets/fonts/inter-latin-variable.woff2*';
    await page.route(routeFont, route => route.fulfill({ body: original, contentType: 'font/woff2' }));
    const capture = async (target, label) => {
      await target.goto('/');
      await expect(target.locator('#start-button')).toBeEnabled();
      await target.evaluate(() => document.fonts.ready);
      await target.getByText('Quick reference', { exact: true }).click();
      await target.evaluate(() => document.fonts.ready);
      await target.screenshot({ path: info.outputPath(`${label}.png`), fullPage: true });
      return target.evaluate(() => {
        const geometry = [...document.querySelectorAll('h1, .drill-cell, .note-pill, #start-button, .quick-help, .quick-help p')]
          .filter(element => element.getBoundingClientRect().height)
          .map(element => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { text: element.textContent, x, y, width, height };
          });
        return { geometry, width: innerWidth, documentWidth: document.documentElement.scrollWidth,
          fontLoaded: document.fonts.check('16px Inter') };
      });
    };
    const before = await capture(page, 'before');
    const afterPage = await context.newPage();
    await afterPage.setViewportSize(viewport);
    const after = await capture(afterPage, 'after');
    expect(after.fontLoaded).toBe(true);
    expect(after.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(after.geometry).toHaveLength(before.geometry.length);
    for (let i = 0; i < before.geometry.length; i++) {
      expect(after.geometry[i].text).toBe(before.geometry[i].text);
      for (const key of ['x', 'y', 'width', 'height']) {
        expect(Math.abs(after.geometry[i][key] - before.geometry[i][key])).toBeLessThan(0.05);
      }
    }
    await afterPage.close();
  });
}

test('original and trimmed Inter decode natively with subpixel-stable used-weight advances', async ({ page }, info) => {
  await page.goto('/');
  const proof = await page.evaluate(async ({ original, trimmed }) => {
    for (const [name, data] of [['BeforeInter', original], ['AfterInter', trimmed]]) {
      const font = new FontFace(name, Uint8Array.from(atob(data), c => c.charCodeAt(0)), { weight: '400 700' });
      await font.load(); document.fonts.add(font);
    }
    const rows = [], text = 'FretFlash ABCDEFG C# Db ♯♭ 0123456789 Start practice Quick reference';
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const draw = (name, weight) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = `${weight} 24px ${name}`;
      const width = ctx.measureText(text).width; ctx.fillText(text, 0, 36);
      return { width, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    for (const weight of [400, 500, 600, 700]) {
      const before = draw('BeforeInter', weight), after = draw('AfterInter', weight);
      let changedPixels = 0;
      for (let i = 0; i < before.pixels.length; i += 4) {
        if (before.pixels.slice(i, i + 4).some((value, channel) => value !== after.pixels[i + channel])) changedPixels++;
      }
      rows.push({ weight, beforeWidth: before.width, afterWidth: after.width, changedPixels });
    }
    return rows;
  }, { original: original.toString('base64'), trimmed: trimmed.toString('base64') });
  await info.attach('native-font-proof', { body: JSON.stringify(proof, null, 2), contentType: 'application/json' });
  console.log(JSON.stringify(proof));
  // Partial instancing rounds variation coordinates; a tiny native metric delta
  // is acceptable, but line wrapping and visible geometry must remain stable.
  for (const row of proof) expect(Math.abs(row.afterWidth - row.beforeWidth)).toBeLessThan(0.25);
});
