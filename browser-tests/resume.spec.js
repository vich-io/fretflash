import { test, expect } from '@playwright/test';

test('Resume prepares a genuinely suspended AudioContext and recovers from rejection', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args) { super(...args); window.testAudio = this; }
      resume() { return window.rejectResume ? Promise.reject(new Error('injected Resume failure')) : super.resume(); }
    };
  });
  await page.goto('/');
  await page.locator('[data-popover-target="bpm"]').click();
  await page.locator('#bpm').fill('240');
  await page.keyboard.press('Enter');
  await page.locator('#start-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.locator('#pause-button').click();
  await page.evaluate(() => window.testAudio.suspend());
  expect(await page.evaluate(() => window.testAudio.state)).toBe('suspended');
  const label = await page.locator('.hero-label').innerText();
  await page.locator('#resume-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  expect(await page.evaluate(() => window.testAudio.state)).toBe('running');
  await expect.poll(() => page.locator('.hero-label').innerText()).not.toBe(label);
  await page.locator('#pause-button').click();
  await page.evaluate(async () => { await window.testAudio.suspend(); window.rejectResume = true; });
  await page.locator('#resume-button').click();
  await expect(page.locator('.practice-paused')).toBeVisible();
  await expect(page.locator('[role="alert"]')).toContainText('Try pressing Resume again');
  await expect(page.locator('#resume-button')).toBeEnabled();
  await page.evaluate(() => { window.rejectResume = false; });
  await page.locator('#resume-button').click();
  await expect(page.locator('.practice-paused')).toHaveCount(0);
  expect(await page.evaluate(() => window.testAudio.state)).toBe('running');
});
