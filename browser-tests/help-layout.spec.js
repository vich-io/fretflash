import { test, expect } from '@playwright/test';

test('footer preserves centred shortcuts and the selected help/home optical corrections', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.body.classList.add('keyboard-seen'));
  await expect(page.locator('.footer-label')).toHaveCount(4);
  const centres = () => page.locator('.footer-label').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return rect.y + rect.height / 2;
  }));
  for (const [width, height, scale] of [[320, 568, 1], [390, 844, 1], [686, 800, 1], [768, 1024, 1], [1440, 900, 1], [390, 844, 2]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => document.documentElement.style.fontSize = `${scale * 100}%`, scale);
    const [help, key, shortcut, home] = await centres();
    expect(Math.abs(key - shortcut)).toBeLessThan(0.02);
    expect(Math.abs(shortcut + scale - home)).toBeLessThan(0.02);
    if (scale === 1) expect(Math.abs(help + scale - shortcut)).toBeLessThan(0.02);
    else expect(help).toBeLessThan(shortcut); // Existing narrow enlarged-text fallback uses two rows.
    const badge = await page.locator('.shortcut-hint kbd').boundingBox();
    expect(Math.abs(badge.y + badge.height / 2 - shortcut)).toBeLessThan(0.02);
    expect(badge.height).toBe(20 * scale);
    expect(await page.locator('.shortcut-hint kbd').evaluate(element => getComputedStyle(element).position)).toBe('static');
    expect(await page.locator('.home-link').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44 * scale);
    expect(await page.locator('#quick-reference > summary').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44 * scale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 686 || scale === 2) await page.locator('.setup-tail').screenshot({ path: info.outputPath(`footer-${width}-${scale}.png`) });
  }
  await page.locator('#quick-reference > summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quick-reference p').first()).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#quick-reference p').first()).toBeHidden();
  await page.evaluate(() => document.documentElement.style.fontSize = '100%');
  await page.setViewportSize({ width: 686, height: 800 });
  await page.locator('#start-button').click();
  await page.locator('#pause-button').click();
  const practice = await centres();
  expect(Math.max(...practice.slice(0, -1)) - Math.min(...practice.slice(0, -1))).toBeLessThan(0.02);
  expect(Math.abs(practice.at(-1) - practice[0] - 1)).toBeLessThan(0.02);
});

for (const [width, height] of [[320,568], [390,844], [768,1024], [1440,900]]) {
  test(`help layout and source fidelity ${width}x${height}`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    const response = await page.goto('/');
    const source = await response.text();
    const sourceText = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.querySelector('#quick-reference').textContent.replace(/\s+/g, ' ').trim();
    }, source);
    await expect(page.locator('#start-button')).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const help = page.locator('#quick-reference');
    await expect(help).not.toHaveAttribute('open', '');
    expect((await help.textContent()).replace(/\s+/g, ' ').trim()).toBe(sourceText);
    await page.screenshot({ path: info.outputPath('closed.png'), fullPage: true });
    await help.locator(':scope > summary').click();
    await expect(help.locator('p').first()).toBeVisible();
    await expect(help.locator('details p').first()).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await help.screenshot({ path: info.outputPath('help.png') });
    await help.locator('details summary').click();
    await expect(help.locator('details p').first()).toBeVisible();
    await help.screenshot({ path: info.outputPath('help-expanded.png') });
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await help.screenshot({ path: info.outputPath('help-large.png') });
    expect(errors).toEqual([]);
  });
}
