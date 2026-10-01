import { test, expect } from '@playwright/test';

// Native Chromium touch exercises capture, focus and compatibility clicks.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const messages = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  await page.goto('/');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.evaluate(() => document.addEventListener('pointerdown', event => {
    if (event.isPrimary) window.touchPointerId = event.pointerId;
  }, true));
  await page.locator('[data-popover-target="bpm"]').tap();
  await expect(page.locator('#bpm')).toBeVisible();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function finger(page, locator) {
  const client = await page.context().newCDPSession(page);
  const box = await locator.boundingBox();
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  const send = (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return {
    down: () => send('touchStart', [{ x, y, id: 0 }]),
    move: (dx, dy) => send('touchMove', [{ x: x + dx, y: y + dy, id: 0 }]),
    up: () => send('touchEnd', []), cancel: () => send('touchCancel', []),
    second: () => send('touchStart', [{ x, y, id: 0 }, { x: x + 12, y, id: 1 }]),
  };
}
async function freeze(page) {
  await page.clock.install({ time: new Date('2026-10-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-01T00:00:01Z'));
}
async function setTempo(page, value) {
  await page.locator('#bpm').fill(String(value));
  await page.keyboard.press('Tab');
}
const savedBpm = page => page.evaluate(() => JSON.parse(localStorage.getItem('fretflash.settings.v1')).bpm);

test('holding accelerates in both directions, stops on release and adds no release click', async ({ page }) => {
  await setTempo(page, 100);
  await freeze(page);
  const bpm = page.locator('#bpm');
  for (const delta of [1, -1]) {
    await setTempo(page, 100);
    const touch = await finger(page, page.locator(`[data-bpm-step="${delta}"]`));
    await touch.down();
    await page.clock.runFor(449); await expect(bpm).toHaveValue('100');
    await page.clock.runFor(1); await expect(bpm).toHaveValue(String(100 + delta));
    await page.clock.runFor(120); await expect(bpm).toHaveValue(String(100 + 2 * delta));
    const before = Number(await bpm.inputValue());
    await page.clock.runFor(600);
    const slow = Math.abs(Number(await bpm.inputValue()) - before);
    await page.clock.runFor(2200);
    const accelerated = Number(await bpm.inputValue());
    await page.clock.runFor(400);
    const fast = Math.abs(Number(await bpm.inputValue()) - accelerated);
    expect(fast).toBeGreaterThan(slow * 2);
    const released = await bpm.inputValue();
    await touch.up(); await page.clock.runFor(1000);
    await expect(bpm).toHaveValue(released);
    expect(await savedBpm(page)).toBe(Number(released));
    await page.locator(`[data-bpm-step="${delta}"]`).tap();
    await expect(bpm).toHaveValue(String(Number(released) + delta));
  }
});

test('vertical swipe adjusts without focus or page scroll, reverses and persists', async ({ page }) => {
  const bpm = page.locator('#bpm');
  const scroll = await page.evaluate(() => window.scrollY);
  const touch = await finger(page, bpm);
  await touch.down(); await touch.move(0, -46); await expect(bpm).toHaveValue('50');
  await touch.move(0, -6); await expect(bpm).toHaveValue('40');
  await touch.move(0, 14); await touch.up(); await expect(bpm).toHaveValue('35');
  await expect(bpm).not.toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  expect(await savedBpm(page)).toBe(35);
  await page.reload(); await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('35');
});

test('tap still edits; horizontal movement and small jitter do not adjust; focused field stays native', async ({ page }) => {
  const bpm = page.locator('#bpm'), touch = await finger(page, bpm);
  await touch.down(); await touch.move(40, 0); await touch.up();
  await expect(bpm).toHaveValue('40'); await expect(bpm).not.toBeFocused();
  await touch.down(); await touch.move(1, -2); await touch.up(); await expect(bpm).toBeFocused();
  await touch.down(); await touch.move(0, -46); await touch.up(); await expect(bpm).toHaveValue('40');
  await bpm.fill('137'); await page.locator('[data-bpm-step="1"]').tap(); await expect(bpm).toHaveValue('138');
  await bpm.tap(); await expect(bpm).toBeFocused(); await page.keyboard.press('Enter');
  await expect(bpm).not.toBeFocused(); await expect(page.locator('#start-button')).toBeVisible();
});

test('swipe clamps at either boundary with immediate reversal', async ({ page }) => {
  const bpm = page.locator('#bpm');
  for (const [start, dy, limit, reversed] of [[199, -46, 200, 199], [11, 46, 10, 11]]) {
    await setTempo(page, start);
    const touch = await finger(page, bpm);
    await touch.down(); await touch.move(0, dy); await expect(bpm).toHaveValue(String(limit));
    await touch.move(0, dy - Math.sign(dy) * 4); await expect(bpm).toHaveValue(String(reversed));
    await touch.up();
  }
});

test('cancel, button exit, multitouch, blur, hidden and lost capture terminate hold', async ({ page }) => {
  await freeze(page);
  const bpm = page.locator('#bpm'), plus = page.locator('[data-bpm-step="1"]');
  for (const stop of ['cancel', 'leave', 'second', 'blur', 'hidden', 'capture', 'pagehide']) {
    const before = Number(await bpm.inputValue()), touch = await finger(page, plus);
    await touch.down(); await page.clock.runFor(570); await expect(bpm).toHaveValue(String(before + 2));
    const last = await bpm.inputValue();
    if (stop === 'cancel') await touch.cancel();
    if (stop === 'leave') await touch.move(80, 0);
    if (stop === 'second') await touch.second();
    // These lifecycle paths are injected; pointer/click paths above are actual touch.
    if (stop === 'blur' || stop === 'pagehide') await page.evaluate(name => window.dispatchEvent(new Event(name)), stop);
    if (stop === 'hidden') await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    if (stop === 'capture') {
      await touch.move(1, 0);
      await plus.evaluate(element => element.releasePointerCapture(window.touchPointerId));
      await touch.move(2, 0);
    }
    await page.clock.runFor(1000); await expect(bpm, stop).toHaveValue(last);
    if (stop !== 'cancel') await touch.up();
    await expect(bpm, `${stop}: release`).toHaveValue(last);
    if (stop === 'hidden') await page.evaluate(() => { delete document.hidden; });
  }
});

test('closing the editor mid-hold ends repeats; cancelled swipe leaves the next tap usable', async ({ page }) => {
  await freeze(page);
  const bpm = page.locator('#bpm'), touch = await finger(page, page.locator('[data-bpm-step="1"]'));
  await touch.down(); await page.clock.runFor(570);
  await page.keyboard.press('Escape'); await page.clock.runFor(1000); await touch.up();
  await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('42');
  await page.locator('[data-popover-target="bpm"]').tap();
  const swipe = await finger(page, bpm);
  await swipe.down(); await swipe.move(0, -26); await expect(bpm).toHaveValue('47');
  await swipe.cancel(); await expect(bpm).not.toBeFocused();
  await bpm.tap(); await expect(bpm).toBeFocused();
});

test('hold and swipe reach the global maximum with one-target spoken cues enabled', async ({ page }) => {
  await page.keyboard.press('Escape');
  await page.locator('[data-preset="all"]').tap();
  await page.locator('[data-popover-target="strings"]').tap();
  for (let i = 1; i < 6; i++) await page.locator(`[data-string-index="${i}"]`).tap();
  await page.keyboard.press('Escape'); await page.locator('#spoken-cues-button').tap();
  await page.locator('[data-popover-target="bpm"]').tap();
  const bpm = page.locator('#bpm'), max = Number(await bpm.getAttribute('max'));
  expect(max).toBe(200); await setTempo(page, max - 1); await freeze(page);
  const touch = await finger(page, page.locator('[data-bpm-step="1"]'));
  await touch.down(); await page.clock.runFor(1500); await touch.up(); await expect(bpm).toHaveValue(String(max));
  const swipe = await finger(page, bpm);
  await swipe.down(); await swipe.move(0, -46); await expect(bpm).toHaveValue(String(max));
  await swipe.move(0, -42); await swipe.up(); await expect(bpm).toHaveValue(String(max - 1));
});

test('mouse holding repeats; keyboard clicks stay one step', async ({ page }) => {
  await freeze(page);
  const plus = page.locator('[data-bpm-step="1"]'), bpm = page.locator('#bpm'), box = await plus.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.clock.runFor(570); await expect(bpm).toHaveValue('42'); await page.mouse.up();
  await expect(bpm).toHaveValue('42'); await plus.focus(); await page.keyboard.press('Enter');
  await expect(bpm).toHaveValue('43'); await page.keyboard.press('Space'); await expect(bpm).toHaveValue('44');
});

test('paused and completed gestures retain the generated order and cue', async ({ page }) => {
  await setTempo(page, 200); await page.keyboard.press('Escape');
  await page.locator('[data-preset="clear"]').tap();
  for (const note of ['C', 'D']) await page.locator(`[data-note-label="${note}"]`).tap();
  await page.locator('#start-button').tap(); await page.locator('#pause-button').tap();
  const order = await page.locator('.progress-label').allTextContents();
  const cue = await page.locator('.practice-cue-row').innerText();
  await page.locator('[data-popover-target="bpm"]').tap();
  const minus = await finger(page, page.locator('[data-bpm-step="-1"]'));
  await minus.down(); await page.waitForTimeout(570); await minus.up();
  const changed = Number(await page.locator('#bpm').inputValue());
  expect(changed).toBeLessThan(200); expect(changed).toBeGreaterThan(190);
  await expect(page.locator('.practice-paused')).toBeVisible();
  expect(await page.locator('.progress-label').allTextContents()).toEqual(order);
  expect(await page.locator('.practice-cue-row').innerText()).toBe(cue);
  await page.keyboard.press('Escape'); await page.locator('#resume-button').tap();
  await expect(page.locator('.practice-done')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-popover-target="bpm"]').tap();
  const drag = await finger(page, page.locator('#bpm'));
  await drag.down(); await drag.move(0, 26); await drag.up();
  await expect(page.locator('#bpm')).toHaveValue(String(changed - 5));
  await expect(page.locator('.practice-done')).toBeVisible();
  expect(await page.locator('.progress-label').allTextContents()).toEqual(order);
  await page.keyboard.press('Escape'); await page.locator('#same-order-button').tap();
  await expect(page.locator('.practice-countin')).toBeVisible();
  expect(await page.locator('.progress-label').allTextContents()).toEqual(order);
  await page.locator('#stop-button').tap();
});

test('last-note preview is empty during count-in, running and pause; Done appears only after completion', async ({ page }) => {
  await setTempo(page, 120); await page.keyboard.press('Escape');
  await page.locator('[data-preset="clear"]').tap(); await page.locator('[data-note-label="C"]').tap();
  await page.locator('#start-button').tap(); await expect(page.locator('.practice-countin')).toBeVisible();
  await expect(page.locator('.practice-countin .next-note')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.practice-countin .next-note')).toBeHidden();
  await expect(page.locator('.practice-running')).toBeVisible();
  await page.locator('#pause-button').tap();
  await expect(page.locator('.next-note')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.practice-display')).not.toContainText('Done');
  await page.locator('#resume-button').tap(); await expect(page.locator('.practice-done')).toBeVisible();
  await expect(page.locator('.current-note')).toHaveText('Done.');
});
