import { test, expect } from '@playwright/test';
import { release, retiredRelease, serveRelease } from './helpers/pwa-server.js';

test.use({ serviceWorkers: 'allow' });
const ready = page => expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
async function update(page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker update did not reach installed/redundant')), 12000);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker.addEventListener('statechange', () => {
          if (['installed', 'redundant'].includes(worker.state)) { clearTimeout(timer); resolve(worker.state); }
        });
      }, { once: true });
      reg.update().catch(reject);
    });
  });
}
async function contents(page, name) {
  return page.evaluate(async name => {
    const cache = await caches.open(name);
    return Promise.all((await cache.keys()).map(async request => ({ url: request.url, digest: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await (await cache.match(request)).arrayBuffer()))) })));
  }, name);
}
const setTempo = async (page, bpm) => {
  await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill(String(bpm)); await page.keyboard.press('Enter');
};

test('update protects an active/paused drill and another open round; only the stopped requester reloads', async ({ page, context }, info) => {
  const original = release('qa-a'), server = await serveRelease(original);
  try {
    await page.goto(server.url); await ready(page); await setTempo(page, 138);
    await page.locator('#start-button').click();
    const other = await context.newPage(); await other.goto(server.url); await ready(other);
    await other.locator('#start-button').click(); await other.evaluate(() => { window.oldRound = true; });
    server.set(release('qa-b')); expect(await update(page)).toBe('installed');
    const button = page.locator('.pwa-notice button');
    await expect(button).toBeHidden(); await button.dispatchEvent('click');
    await expect(page).toHaveTitle('FretFlash qa-a');
    await expect(page.locator('.pwa-notice')).toContainText('when stopped');
    if (await page.locator('#pause-button').isVisible()) await page.locator('#pause-button').click();
    await expect(page.locator('.practice-paused')).toBeVisible(); await expect(button).toBeHidden();
    await page.locator('#stop-button').click(); await expect(button).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    const before = await page.locator('#start-button').boundingBox();
    await page.locator('.pwa-notice').screenshot({ path: info.outputPath('update-ready.png') });
    expect(await page.locator('#start-button').boundingBox()).toEqual(before);
    await context.setOffline(true); await button.click();
    await expect(page).toHaveTitle('FretFlash qa-b');
    await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('138');
    await expect(other).toHaveTitle('FretFlash qa-a'); expect(await other.evaluate(() => window.oldRound)).toBe(true);
    await expect(other.locator('#stop-button')).toBeVisible();
    expect(await other.evaluate(async () => await (await fetch('/app.js?v=qa-a')).text())).toBe(original.get('app.js').toString());
    expect(await other.evaluate(async () => (await (await fetch('/assets/voice/george-tight.wav?v=qa-a')).arrayBuffer()).byteLength)).toBe(original.get('assets/voice/george-tight.wav').length);
  } finally { await server.close(); }
});

test('missing/corrupt candidates reject the whole cache and preserve the current offline release', async ({ page, context }) => {
  const server = await serveRelease(release('qa-a'));
  try {
    await page.goto(server.url); await ready(page); await page.evaluate(() => caches.open('unrelated-cache'));
    const before = await page.evaluate(() => caches.keys());
    for (const kind of ['corrupt', 'missing']) {
      const broken = release(`qa-${kind}`);
      if (kind === 'corrupt') broken.set('style.css', Buffer.from('wrong bytes'));
      else broken.delete('assets/voice/george-tight.wav');
      server.set(broken); expect(await update(page)).toBe('redundant');
      expect(await page.evaluate(() => caches.keys())).toEqual(before);
      await expect(page.getByRole('button', { name: 'Update app' })).toBeHidden();
    }
    await context.setOffline(true); await page.reload(); await expect(page).toHaveTitle('FretFlash qa-a');
    await page.locator('#start-button').click(); await expect(page.locator('#stop-button')).toBeVisible();
  } finally { await server.close(); }
});

test('exact corrupted A rollback after A→B→C preserves every retained A byte and current C offline', async ({ page, context }) => {
  const original = release('qa-a'), server = await serveRelease(original);
  try {
    await page.goto(server.url); await ready(page);
    const other = await context.newPage(); await other.goto(server.url); await ready(other); await other.evaluate(() => { window.oldRound = true; });
    const cacheA = await page.evaluate(async () => (await caches.keys()).find(name => name.startsWith('fretflash-offline-')));
    const saved = await contents(page, cacheA);
    for (const version of ['qa-b', 'qa-c']) {
      server.set(release(version)); expect(await update(page)).toBe('installed');
      await page.getByRole('button', { name: 'Update app' }).click(); await expect(page).toHaveTitle(`FretFlash ${version}`); await ready(page);
    }
    const before = await page.evaluate(() => caches.keys()), broken = new Map(original);
    broken.set('style.css', Buffer.from('interrupted exact rollback'));
    server.set(broken); expect(await update(page)).toBe('redundant');
    expect(await page.evaluate(() => caches.keys())).toEqual(before); expect(await contents(page, cacheA)).toEqual(saved);
    expect(await other.evaluate(() => window.oldRound)).toBe(true);
    await context.setOffline(true);
    expect(await other.evaluate(async () => await (await fetch('/app.js?v=qa-a')).text())).toBe(original.get('app.js').toString());
    expect(await other.evaluate(async () => (await (await fetch('/assets/voice/george.wav?v=qa-a')).arrayBuffer()).byteLength)).toBe(original.get('assets/voice/george.wav').length);
    await page.reload(); await expect(page).toHaveTitle('FretFlash qa-c'); await expect(page.locator('#start-button')).toBeEnabled();
  } finally { await server.close(); }
});

for (const pending of [false, true]) test(`Start racing delayed activation (${pending ? 'pending readiness' : 'count-in'}) is preserved; Stop does not authorize reload`, async ({ page }) => {
  const server = await serveRelease(release('qa-a'));
  try {
    if (pending) await page.addInitScript(() => {
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        get state() { return 'suspended'; }
        resume() { return new Promise(resolve => { window.resumeAudio = () => super.resume().then(resolve); }); }
      };
    });
    await page.goto(server.url); await ready(page);
    server.set(release('qa-b', { delay: 800 })); expect(await update(page)).toBe('installed');
    await page.getByRole('button', { name: 'Update app' }).click();
    await expect(page.locator('.pwa-notice')).toContainText('Updating');
    await page.waitForTimeout(400); await page.locator('#start-button').click();
    await expect(page.locator('.pwa-notice')).toHaveAttribute('data-state', 'waiting');
    await expect(page).toHaveTitle('FretFlash qa-a');
    await expect(page.locator(pending ? '[data-cancel-start]' : '.practice-countin')).toBeVisible();
    await page.locator(pending ? '[data-cancel-start]' : '#stop-button').click(); await expect(page).toHaveTitle('FretFlash qa-a');
    await page.getByRole('button', { name: 'Update app' }).click(); await expect(page).toHaveTitle('FretFlash qa-b');
  } finally { await server.close(); }
});

test('stalled update action recovers without granting a late reload', async ({ page, context }) => {
  const server = await serveRelease(release('qa-a'));
  try {
    await page.goto(server.url); await ready(page);
    server.set(release('qa-b', { ignoreActivation: true }));
    const installing = context.waitForEvent('serviceworker'); expect(await update(page)).toBe('installed');
    const worker = await installing;
    await page.clock.install();
    await page.getByRole('button', { name: 'Update app' }).click();
    await page.clock.runFor(10001);
    await expect(page.locator('.pwa-notice')).toContainText('Try again');
    await expect(page.getByRole('button', { name: 'Update app' })).toBeEnabled(); await expect(page).toHaveTitle('FretFlash qa-a');
    await worker.evaluate(() => self.skipWaiting());
    await expect(page.locator('.pwa-notice')).toHaveAttribute('data-state', 'ready');
    await expect(page).toHaveTitle('FretFlash qa-a');
  } finally { await server.close(); }
});

test('zero-client activation cleans only obsolete FretFlash caches', async ({ page, context }) => {
  const server = await serveRelease(release('qa-a'));
  try {
    await page.goto(server.url); await ready(page); await page.evaluate(() => caches.open('unrelated-cache'));
    const next = release('qa-b'), cacheB = next.get('sw.js').toString().match(/const CACHE_NAME = '([^']+)'/)[1];
    server.set(next); const installing = context.waitForEvent('serviceworker'); expect(await update(page)).toBe('installed');
    const worker = await installing; await page.close();
    await expect.poll(() => worker.evaluate(() => caches.keys())).toEqual(['unrelated-cache', cacheB]);
    await context.setOffline(true); const reopened = await context.newPage(); await reopened.goto(server.url);
    await expect(reopened).toHaveTitle('FretFlash qa-b'); await expect(reopened.locator('#start-button')).toBeEnabled();
  } finally { await server.close(); }
});

test('failed first installation leaves online playback usable and a later complete visit installs', async ({ page }) => {
  const original = release('qa-first'), broken = new Map(original); broken.delete('assets/voice/george-tight.wav');
  const server = await serveRelease(broken);
  try {
    await page.goto(server.url); await expect(page.locator('.pwa-notice')).toContainText('Offline unavailable');
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(false);
    await page.locator('#start-button').click(); await expect(page.locator('#stop-button')).toBeVisible(); await page.locator('#stop-button').click();
    server.set(original); await page.reload(); await ready(page); await expect(page.locator('.pwa-notice')).toBeHidden();
  } finally { await server.close(); }
});

test('retirement worker restores pre-PWA app without erasing settings or unrelated caches', async ({ page }) => {
  const server = await serveRelease(release('qa-a'));
  try {
    await page.goto(server.url); await ready(page); await setTempo(page, 138); await page.evaluate(() => caches.open('unrelated-cache'));
    server.set(retiredRelease('qa-retired'));
    await update(page); await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
    await page.reload(); await expect(page).toHaveTitle('FretFlash qa-retired');
    await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('138');
    await expect(page.locator('.pwa-notice')).toHaveCount(0); expect(await page.evaluate(() => caches.keys())).toEqual(['unrelated-cache']);
    await page.locator('#start-button').click(); await expect(page.locator('#stop-button')).toBeVisible();
  } finally { await server.close(); }
});
