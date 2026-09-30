import { test, expect } from '@playwright/test';

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
