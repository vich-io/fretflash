import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('[data-popover-target="fret-range"]').tap();
});

async function finger(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const client = await page.context().newCDPSession(page);
  const box = await locator.boundingBox();
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  const send = (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return {
    down: () => send('touchStart', [{ x, y, id: 0 }]),
    move: (dx, dy) => send('touchMove', [{ x: x + dx, y: y + dy, id: 0 }]),
    up: () => send('touchEnd', []), cancel: () => send('touchCancel', []),
  };
}
const track = page => page.locator('.fret-span-track');
const savedRange = page => page.evaluate(() => JSON.parse(localStorage.getItem('fretflash.settings.v1')).fretRange);

test('preset and typed drafts visibly update the rail and selected range; invalid edits retain last committed span', async ({ page }) => {
  await page.locator('[data-fret-preset="high"]').tap();
  await expect(track(page)).toHaveAttribute('style', '--fret-from: 48%; --fret-width: 24%;');
  await expect(page.locator('[data-fret-preset="high"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#fret-from').fill('13');
  await expect(track(page)).toHaveAttribute('style', '--fret-from: 52%; --fret-width: 20%;');
  await page.locator('#fret-to').tap();
  await page.locator('#fret-to').fill('2');
  await expect(page.locator('.field-error')).toBeVisible();
  await expect(track(page)).toHaveAttribute('style', '--fret-from: 52%; --fret-width: 20%;');
  await page.locator('[data-fret-preset="all"]').tap();
  await expect(track(page)).toHaveAttribute('style', '--fret-from: 0%; --fret-width: 100%;');
  expect(await savedRange(page)).toEqual({ from: 0, to: 24 });
});

test('each bound swipes without focus or scroll, clamps without crossing, reverses and persists', async ({ page }) => {
  await page.locator('[data-fret-preset="high"]').tap();
  const from = page.locator('#fret-from'), to = page.locator('#fret-to');
  let touch = await finger(page, from);
  const scroll = await page.evaluate(() => window.scrollY);
  await touch.down(); await touch.move(0, -46); await expect(from).toHaveValue('17');
  await touch.move(0, -42); await expect(from).toHaveValue('16'); await touch.up();
  await expect(from).not.toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  touch = await finger(page, to);
  await touch.down(); await touch.move(0, 46); await expect(to).toHaveValue('16');
  await touch.move(0, 42); await expect(to).toHaveValue('17'); await touch.up();
  expect(await savedRange(page)).toEqual({ from: 16, to: 17 });
  await page.keyboard.press('Escape'); await page.reload();
  await expect(page.locator('[data-popover-target="fret-range"] strong')).toHaveText('16–17');
});

test('hold repeats, accelerates, stops on cancellation/editor close and does not add a release click', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-01T00:00:01Z'));
  const to = page.locator('#fret-to');
  const plus = page.locator('[data-fret-bound="to"][data-fret-step="1"]');
  let touch = await finger(page, plus);
  await touch.down(); await page.clock.runFor(449); await expect(to).toHaveValue('12');
  await page.clock.runFor(121); await expect(to).toHaveValue('14');
  await touch.up(); await page.clock.runFor(1000); await expect(to).toHaveValue('14');
  await plus.tap(); await expect(to).toHaveValue('15');
  touch = await finger(page, plus);
  await touch.down(); await page.clock.runFor(570); await expect(to).toHaveValue('17');
  await touch.cancel(); await page.clock.runFor(1000); await expect(to).toHaveValue('17');
  touch = await finger(page, plus);
  await touch.down(); await page.clock.runFor(570);
  await page.keyboard.press('Escape'); await page.clock.runFor(1000); await touch.up();
  await expect(page.locator('[data-popover-target="fret-range"] strong')).toHaveText('0–19');
  await page.locator('[data-popover-target="bpm"]').tap();
  await expect(page.locator('#bpm')).toBeVisible();
});

test('tap and focused input stay native; invalid drafts recover with a step; keyboard steps once', async ({ page }) => {
  const from = page.locator('#fret-from');
  await from.tap(); await expect(from).toBeFocused();
  const touch = await finger(page, from);
  await touch.down(); await touch.move(0, -46); await touch.up(); await expect(from).toHaveValue('0');
  await from.fill('5'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-popover-target="fret-range"] strong')).toHaveText('5–12');
  await page.locator('[data-popover-target="fret-range"]').tap();
  await from.fill('20'); await page.locator('[data-fret-bound="from"][data-fret-step="1"]').tap();
  await expect(from).toHaveValue('6'); await expect(page.locator('.field-error')).toHaveCount(0);
  const minus = page.locator('[data-fret-bound="from"][data-fret-step="-1"]');
  await minus.focus(); await page.keyboard.press('Enter'); await expect(from).toHaveValue('5');
  await page.keyboard.press('Space'); await expect(from).toHaveValue('4');
  await page.locator('[data-popover-target="bpm"]').tap();
  expect(await page.locator('[data-bpm]').allTextContents()).toEqual(['30', '40', '60', '80', '120', '160']);
});
