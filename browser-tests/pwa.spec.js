import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { release, serveRelease } from './helpers/pwa-server.js';

test.use({ serviceWorkers: 'allow' });
const ready = page => expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)), { timeout: 15000 }).toBe(true);

test('PWA has stable identity, correct manifest MIME and decoded launcher icons', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-button')).toBeEnabled();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const response = await page.request.get(await page.locator('link[rel="manifest"]').evaluate(link => link.href));
  expect(response.headers()['content-type']).toMatch(/^application\/(?:manifest\+)?json\b/);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', prefer_related_applications: false });
  for (const icon of manifest.icons) {
    expect(await page.evaluate(async src => {
      const image = new Image(); image.src = src; await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src)).toBe(icon.sizes);
  }
  const maskable = manifest.icons.find(icon => icon.purpose === 'maskable');
  expect(await page.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = image.width;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let foreground = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] !== 255) return false;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) <= 40) continue;
      foreground++;
      const x = (i / 4) % canvas.width + .5 - canvas.width / 2, y = Math.floor(i / 4 / canvas.width) + .5 - canvas.height / 2;
      if (Math.hypot(x, y) > canvas.width * .4) return false;
    }
    return foreground > 0;
  }, maskable.src)).toBe(true);
  await ready(page);
  const cdp = await page.context().newCDPSession(page);
  expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);
});

test('fresh install omits the social preview but still serves its metadata URL online', async ({ page, context }) => {
  const requests = [];
  context.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled(); await ready(page);
  expect(requests).not.toContain('/assets/share-card.png');
  const cachedPaths = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('fretflash-offline-'));
    const cache = await caches.open(names[0]);
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  expect(cachedPaths).not.toContain('/assets/share-card.png');
  expect(cachedPaths).toContain('/assets/fonts/inter-latin-variable.woff2');
  const previewURL = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(new URL(previewURL).pathname).toBe('/assets/share-card.png');
  const response = await page.request.get('/assets/share-card.png');
  expect(response.status()).toBe(200); expect(response.headers()['content-type']).toMatch(/^image\/png/);
  expect(await response.body()).toEqual(readFileSync('assets/share-card.png'));
});

test('a missing metadata-only preview does not block offline installation', async ({ page }) => {
  const files = release('qa-no-preview');
  files.delete('assets/share-card.png');
  const server = await serveRelease(files);
  try {
    await page.goto(server.url); await expect(page.locator('#start-button')).toBeEnabled(); await ready(page);
    expect((await page.request.get(`${server.url}assets/share-card.png`)).status()).toBe(404);
  } finally { await server.close(); }
});

test('normal-profile installation survives browser restart with fonts, saved setup and all speech banks offline', async ({ baseURL }) => {
  test.setTimeout(60000);
  const directory = await mkdtemp(join(tmpdir(), 'fretflash-offline-'));
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/sbin/chromium') ? '/usr/sbin/chromium' : undefined);
  const options = { headless: true, executablePath, baseURL, serviceWorkers: 'allow' };
  let context;
  try {
    context = await chromium.launchPersistentContext(directory, options);
    let page = await context.newPage();
    await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled(); await ready(page);
    const cdp = await context.newCDPSession(page);
    await expect.poll(async () => (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
    const bankPaths = await page.evaluate(async () => {
      const names = (await caches.keys()).filter(name => name.startsWith('fretflash-offline-'));
      const requests = await (await caches.open(names[0])).keys();
      return requests.map(request => new URL(request.url).pathname).filter(path => path.endsWith('.webm')).sort();
    });
    expect(bankPaths).toEqual(['/assets/voice/george-fast.webm', '/assets/voice/george-tight.webm', '/assets/voice/george.webm']);
    await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill('137'); await page.keyboard.press('Enter');
    await context.close();
    context = await chromium.launchPersistentContext(directory, { ...options, offline: true });
    page = await context.newPage();
    await page.addInitScript(() => {
      window.offlineProof = { speech: [], clicks: [], peaks: [] };
      const Native = window.AudioContext;
      class Context extends Native {
        constructor(...args) {
          super(...args);
          this.tap = super.createGain(); this.analyser = super.createAnalyser(); this.tap.connect(this.analyser); this.analyser.connect(super.destination);
          const samples = new Float32Array(this.analyser.fftSize);
          setInterval(() => { this.analyser.getFloatTimeDomainData(samples); window.offlineProof.peaks.push(Math.max(...samples.map(Math.abs))); }, 10);
        }
        get destination() { return this.tap; }
        createOscillator() { const node = super.createOscillator(), start = node.start.bind(node); node.start = when => { window.offlineProof.clicks.push(when); start(when); }; return node; }
        createBufferSource() { const node = super.createBufferSource(), start = node.start.bind(node); node.start = when => { window.offlineProof.speech.push({ when, duration: node.buffer.duration }); start(when); }; return node; }
      }
      window.AudioContext = Context;
    });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled();
    await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('137');
    expect(await page.locator('.brand-mark').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(async () => { const fonts = await document.fonts.load('16px Inter'); return fonts.length > 0 && fonts.every(font => font.status === 'loaded'); })).toBe(true);
    await page.locator('[data-preset="clear"]').click();
    for (const label of ['C#', 'Db']) await page.locator(`[data-note-label="${label}"]`).click();
    await page.locator('#spoken-cues-button').click();
    for (const [bpm, strings] of [[40, 1], [200, 2], [200, 1]]) {
      await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill(String(bpm)); await page.keyboard.press('Enter');
      await page.locator('[data-popover-target="strings"]').click();
      for (let index = 0; index < 6; index++) {
        const button = page.locator(`[data-string-index="${index}"]`);
        if ((await button.getAttribute('aria-pressed') === 'true') !== (index < strings)) await button.click();
      }
      await page.keyboard.press('Escape');
      const before = await page.evaluate(() => window.offlineProof.speech.length);
      await page.locator('#start-button').click();
      await expect(page.locator('.practice-done')).toBeVisible({ timeout: 15000 });
      expect(await page.evaluate(() => window.offlineProof.speech.length)).toBe(before + 2);
      await page.locator('#setup-button').click();
    }
    const proof = await page.evaluate(() => ({ words: window.offlineProof.speech.length, clicks: window.offlineProof.clicks.length, peak: Math.max(...window.offlineProof.peaks) }));
    expect(proof.words).toBe(6); expect(proof.clicks).toBeGreaterThan(12); expect(proof.peak).toBeGreaterThan(.01);
    await page.reload(); await expect(page.locator('#spoken-cues-button')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  } finally { await context?.close(); await rm(directory, { recursive: true, force: true }); }
});
