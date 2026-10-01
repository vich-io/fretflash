import { test, expect } from '@playwright/test';
import { release, serveRelease } from './helpers/pwa-server.js';

test.use({ serviceWorkers: 'allow' });

test.describe('reload fallback', () => {
  test.use({ serviceWorkers: 'block' });
  test('failed entry releases reload rendering and leaves native help usable', async ({ page }, info) => {
    await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled();
    await page.route('**/app.js*', route => route.abort());
    await page.reload(); await expect(page.locator('#start-button')).toBeDisabled();
    await expect(page.locator('script[type="module"]')).toHaveAttribute('blocking', 'render');
    await page.locator('#quick-reference > summary').click();
    await expect(page.locator('#quick-reference > p').first()).toBeVisible();
    await page.screenshot({ path: info.outputPath('failed-reload-fallback.png') });
  });
});

for (const width of [320, 390, 768, 1440]) {
  test(`reference target is confined to its label at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled();
    const help = page.locator('#quick-reference'), summary = help.locator(':scope > summary');
    const area = await help.boundingBox(), target = await summary.boundingBox();
    expect(target.width).toBeLessThan(area.width - 20);
    await page.mouse.click(area.x + area.width - 5, target.y + target.height / 2);
    await expect(help).not.toHaveAttribute('open', '');
    await summary.click(); await expect(help).toHaveAttribute('open', '');
    await summary.focus(); await page.keyboard.press('Enter'); await expect(help).not.toHaveAttribute('open', '');
  });
}

test('slow audio preparation stays in the initiating button and cancellation rejects late readiness', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      get state() { return 'suspended'; }
      resume() { return new Promise(resolve => { window.releaseAudio = () => super.resume().then(resolve); }); }
    };
  });
  await page.goto('/'); const start = page.locator('#start-button'); await expect(start).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const before = await start.boundingBox(), help = await page.locator('#quick-reference').boundingBox();
  await start.click();
  await expect(start).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#cancel-start-button')).toHaveCount(0);
  await expect(page.locator('#app-feedback')).toBeEmpty();
  await expect(start).toHaveText('Cancel');
  expect(await start.boundingBox()).toEqual(before);
  expect(await page.locator('#quick-reference').boundingBox()).toEqual(help);
  await page.screenshot({ path: info.outputPath('pending-start.png') });
  await start.click(); await page.evaluate(() => window.releaseAudio());
  await expect(start).toHaveText('Start'); await expect(start).toBeEnabled();
  await expect(start).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.practice-countin')).toHaveCount(0);
  await page.waitForTimeout(400); await expect(start).toHaveText('Start');
});

test('fast readiness never flashes Cancel or adds a startup block', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      get state() { return 'suspended'; }
      resume() { return new Promise(resolve => setTimeout(() => super.resume().then(resolve), 20)); }
    };
  });
  await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled();
  await page.evaluate(() => {
    window.startLabels = [];
    new MutationObserver(() => window.startLabels.push(document.querySelector('#start-button')?.textContent ?? '')).observe(document.querySelector('#app'), { subtree: true, childList: true, characterData: true });
  });
  await page.locator('#start-button').click(); await expect(page.locator('.practice-countin')).toBeVisible();
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.startLabels.includes('Cancel'))).toBe(false);
  await expect(page.locator('#app-feedback')).toBeEmpty();
  await page.locator('#stop-button').click(); await expect(page.locator('#start-button')).toHaveText('Start');
});

for (const action of ['resume-button', 'restart-button', 'same-order-button', 'start-button']) {
  test(`pending ${action} reuses only its own control and can cancel`, async ({ page }) => {
    await page.addInitScript(() => {
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        get state() { return window.holdAudio ? 'suspended' : super.state; }
        resume() { return window.holdAudio ? new Promise(resolve => { window.releaseAudio = () => super.resume().then(resolve); }) : super.resume(); }
      };
    });
    await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled();
    await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill('200'); await page.keyboard.press('Enter');
    await page.locator('[data-preset="clear"]').click(); await page.locator('[data-note-label="C"]').click();
    await page.locator('#start-button').click(); await expect(page.locator('.practice-countin')).toBeVisible();
    if (['resume-button', 'restart-button'].includes(action)) await page.locator('#pause-button').click();
    else await expect(page.locator('.practice-done')).toBeVisible();
    await page.evaluate(() => { window.holdAudio = true; });
    const button = page.locator(`#${action}`), before = await button.boundingBox();
    await button.click(); await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('[data-cancel-start]')).toHaveCount(1);
    await expect(button).toHaveText('Cancel'); expect(await button.boundingBox()).toEqual(before);
    await expect(page.locator('#app-feedback')).toBeEmpty();
    await button.click(); await page.evaluate(() => window.releaseAudio());
    await expect(page.locator('#start-button')).toBeEnabled(); await expect(page.locator('.prompt-deck')).toBeVisible();
    await expect(page.locator('[data-cancel-start]')).toHaveCount(0);
  });
}

test.describe('real update header', () => {
  test('header states fit phone, tablet, desktop and enlarged text without shifting the drill', async ({ page }, info) => {
    const server = await serveRelease(release('layout-a'));
    const views = [[320, 1], [390, 1], [768, 1], [1440, 1], [320, 2]];
    const geometry = () => page.evaluate(() => ['.setup-app-bar', '.brand-heading', '#start-button'].map(selector => {
      const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height };
    }));
    const size = async (width, scale) => { await page.setViewportSize({ width, height: 844 }); await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale); };
    try {
      await page.goto(server.url); await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      const before = [];
      for (const [width, scale] of views) { await size(width, scale); before.push(await geometry()); }
      server.set(release('layout-b', { ignoreActivation: true }));
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      const update = page.getByRole('button', { name: 'Update app' }); await expect(update).toBeVisible({ timeout: 15000 });
      for (const [index, [width, scale]] of views.entries()) {
        await size(width, scale); expect(await geometry()).toEqual(before[index]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.locator('.setup-app-bar').screenshot({ path: info.outputPath(`header-${width}-${scale}.png`) });
      }
      await size(390, 1); await page.evaluate(() => { window.notice = document.querySelector('.pwa-notice'); });
      await page.locator('#start-button').click(); await expect(page.locator('.practice-countin')).toBeVisible();
      await page.locator('#pause-button').click(); await expect(page.locator('.pwa-notice')).toContainText('when stopped');
      await expect(update).toBeHidden(); await expect(page.locator('.setup-app-bar .pwa-notice')).toHaveCount(1);
      expect(await page.evaluate(() => window.notice === document.querySelector('.pwa-notice'))).toBe(true);
      await page.screenshot({ path: info.outputPath('update-waiting.png') });
      await page.locator('#stop-button').click(); expect(await geometry()).toEqual(before[1]);
      await page.clock.install(); await update.click(); await page.clock.runFor(10001);
      await expect(update).toHaveText('Try again'); expect(await geometry()).toEqual(before[1]);
      await page.screenshot({ path: info.outputPath('update-retry.png') });
    } finally { await server.close(); }
  });

  test('ready and pending update reserve header space and refresh once with saved setup', async ({ page }, info) => {
    const server = await serveRelease(release('ui-a'));
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(server.url);
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill('137'); await page.keyboard.press('Enter');
      await page.locator('#spoken-cues-button').click();
      await page.locator('#quick-reference > summary').focus();
      const before = await page.locator('#start-button').boundingBox();
      const brandBefore = await page.locator('.brand-heading').boundingBox();
      server.set(release('ui-b', { delay: 400 }));
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      const update = page.getByRole('button', { name: 'Update app' });
      await expect(update).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.setup-app-bar .pwa-notice')).toHaveCount(1);
      const header = await page.locator('.setup-app-bar').boundingBox(), action = await update.boundingBox();
      expect(Math.abs(action.x + action.width - header.x - header.width)).toBeLessThan(1);
      expect(Math.abs(action.y + action.height / 2 - brandBefore.y - brandBefore.height / 2)).toBeLessThan(1);
      expect(await page.locator('#start-button').boundingBox()).toEqual(before);
      expect(await page.locator('.brand-heading').boundingBox()).toEqual(brandBefore);
      await page.screenshot({ path: info.outputPath('update-ready.png') });
      await page.addInitScript(() => {
        window.refreshFrames = [];
        const sample = () => {
          window.refreshFrames.push({
            background: getComputedStyle(document.documentElement).backgroundColor,
            bpm: document.querySelector('[data-popover-target="bpm"] strong')?.textContent,
          });
          if (window.refreshFrames.length < 12) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      let navigations = 0; page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
      await update.click();
      await expect(page.locator('.pwa-notice')).toHaveAttribute('data-state', 'updating');
      expect(await page.locator('#start-button').boundingBox()).toEqual(before);
      await page.screenshot({ path: info.outputPath('update-pending.png') });
      await expect(page).toHaveTitle('FretFlash ui-b');
      await expect(page.locator('#start-button')).toBeEnabled();
      expect(navigations).toBe(1);
      await expect.poll(() => page.evaluate(() => window.refreshFrames.length)).toBe(12);
      const frames = await page.evaluate(() => window.refreshFrames);
      await info.attach('refresh-frames', { body: JSON.stringify(frames, null, 2), contentType: 'application/json' });
      expect(frames.every(frame => frame.background === 'rgb(25, 25, 25)')).toBe(true);
      expect(frames.filter(frame => frame.bpm).every(frame => frame.bpm === '137')).toBe(true);
      await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('137');
      await expect(page.locator('#spoken-cues-button')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.pwa-notice')).toBeHidden();
      expect(await page.locator('#start-button').boundingBox()).toEqual(before);
      await page.screenshot({ path: info.outputPath('update-complete.png') });
    } finally { await server.close(); }
  });
});
