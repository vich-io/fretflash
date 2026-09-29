import { test, expect } from '@playwright/test';

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('fretflash.settings.v1')));
async function editor(page, name) { await page.locator(`[data-popover-target="${name}"]`).click(); }
async function tinyRound(page) {
  await page.goto('/');
  await editor(page, 'bpm');
  await page.locator('#bpm').fill('240');
  await page.keyboard.press('Enter');
  await page.locator('[data-preset="clear"]').click();
  await page.locator('[data-note-label="C#"]').click();
  await page.locator('[data-note-label="Db"]').click();
  await editor(page, 'strings');
  for (let i = 1; i < 6; i++) await page.locator(`[data-string-index="${i}"]`).click();
  await page.keyboard.press('Escape');
}

test('setup journey: native blur, presets, wheel, tuning, subsets and reload', async ({ page }) => {
  await page.goto('/');
  await editor(page, 'bpm');
  await page.locator('#bpm').fill('73');
  await page.locator('[data-bpm-step="1"]').click();
  await expect(page.locator('#bpm')).toHaveValue('74');
  await page.locator('#bpm').hover();
  await page.mouse.wheel(0, -100);
  await expect(page.locator('#bpm')).toHaveValue('75');
  await editor(page, 'fret-range');
  await page.locator('#fret-from').fill('3');
  await page.keyboard.press('Tab');
  await expect(page.locator('#fret-to')).toBeFocused();
  await page.locator('#fret-to').fill('15');
  await page.keyboard.press('Enter');
  await editor(page, 'targets');
  await page.locator('[data-location-mode="all-in-range"]').click();
  await editor(page, 'tuning');
  await page.locator('#custom-tuning').fill('B E A D G B e');
  await page.keyboard.press('Tab');
  await editor(page, 'strings');
  await page.locator('[data-string-index="0"]').click();
  await page.locator('[data-preset="naturals"]').click();
  const before = await saved(page);
  expect(before.bpm).toBe(75);
  expect(before.fretRange).toEqual({ from: 3, to: 15 });
  expect(before.tuning.strings).toHaveLength(7);
  expect(before.selectedStringIndexes).toEqual([1, 2, 3, 4, 5, 6]);
  expect(before.locationMode).toBe('all-in-range');
  await page.reload();
  expect(await saved(page)).toEqual(before);
  await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('75');
});

test('Clear is usable but cannot start or overwrite the last valid saved pool', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-preset="naturals"]').click();
  const before = await saved(page);
  await page.locator('[data-preset="clear"]').click();
  await expect(page.locator('.note-pill[aria-pressed="true"]')).toHaveCount(0);
  await page.locator('#start-button').click();
  await expect(page.locator('[role="alert"]')).toContainText('Select at least one note');
  expect(await saved(page)).toEqual(before);
  await page.locator('[data-note-label="C"]').click();
});

test('invalid tuning survives unrelated actions and correction clears its error', async ({ page }) => {
  await page.goto('/');
  await editor(page, 'tuning');
  await page.locator('#custom-tuning').fill('not a tuning');
  await page.locator('[data-note-label="C"]').click();
  await editor(page, 'fret-range');
  await page.locator('#fret-from').fill('2');
  await page.keyboard.press('Tab');
  await editor(page, 'tuning');
  await expect(page.locator('#custom-tuning')).toHaveValue('not a tuning');
  await page.locator('#custom-tuning').fill('D A D G B e');
  await page.keyboard.press('Tab');
  await expect(page.locator('[role="alert"]:visible')).toHaveCount(0);
  expect((await saved(page)).fretRange.from).toBe(2);
});

test('round journey: distinct spellings, Pause/Restart, Done/Repeat, Shuffle and Setup', async ({ page }) => {
  await tinyRound(page);
  await page.locator('#start-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  const order = await page.locator('.progress-cell').allTextContents();
  expect([...order].sort()).toEqual(['C#', 'Db']);
  await page.locator('#pause-button').click();
  await page.locator('#restart-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  expect(await page.locator('.progress-cell').allTextContents()).toEqual(order);
  await expect(page.locator('.practice-done')).toBeVisible();
  await expect(page.locator('input')).toHaveCount(0);
  await page.locator('#same-order-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  expect(await page.locator('.progress-cell').allTextContents()).toEqual(order);
  await expect(page.locator('.practice-done')).toBeVisible();
  await page.locator('#start-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.locator('#brand-home-button').click();
  await expect(page.locator('.prompt-deck')).toBeVisible();
  const payload = await saved(page);
  expect(payload.phase).toBeUndefined();
  expect(payload.order).toBeUndefined();
  expect(payload.completedOrder).toBeUndefined();
});

test('pending audio can be cancelled; a late resolution cannot start playback', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      get state() { return 'suspended'; }
      resume() { return new Promise(resolve => { window.finishAudio = resolve; }); }
    };
  });
  await page.goto('/');
  await page.locator('#start-button').click();
  await expect(page.locator('[role="status"]')).toContainText('Starting audio');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.finishAudio());
  await expect(page.locator('.prompt-deck')).toBeVisible();
  await expect(page.locator('#cancel-start-button')).toHaveCount(0);
});

test('failed paused Restart and Done Repeat show phase-appropriate recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      get state() { return window.failAudio ? 'suspended' : super.state; }
      resume() { return window.failAudio ? Promise.reject(new Error('injected rejection')) : super.resume(); }
    };
  });
  await tinyRound(page);
  await page.locator('#start-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.locator('#pause-button').click();
  await page.evaluate(() => { window.failAudio = true; });
  await page.locator('#restart-button').click();
  await expect(page.locator('[role="alert"]')).toContainText('Restart');
  await page.evaluate(() => { window.failAudio = false; });
  await page.locator('#restart-button').click();
  await expect(page.locator('.practice-done')).toBeVisible();
  await page.evaluate(() => { window.failAudio = true; });
  await page.locator('#same-order-button').click();
  await expect(page.locator('[role="alert"]')).toContainText('Repeat');
});

test('modified shortcuts do nothing; native transport repeat and editor Escape retain focus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+Space');
  await expect(page.locator('.prompt-deck')).toBeVisible();
  await editor(page, 'fret-range');
  await page.locator('#fret-from').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-popover-target="fret-range"]')).toBeFocused();
  await page.locator('#start-button').focus();
  await page.keyboard.down('Enter');
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.prompt-deck')).toBeVisible();
});
