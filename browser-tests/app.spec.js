import { test, expect } from '@playwright/test';

async function setup(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#start-button')).toBeVisible();
  return errors;
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('fretflash.settings.v1')));
const alert = page => page.locator('[role="alert"]:visible');

// Exercise native blur, document bubbling, focus and key repeat once; not at every width.
test('invalid fret Tab then valid Tab clears error and enables Start', async ({ page }) => {
  await setup(page);
  await page.locator('[data-popover-target="fret-range"]').click();
  await page.locator('#fret-from').fill('25');
  await page.keyboard.press('Tab');
  await expect(alert(page)).toContainText('Choose frets');
  await expect(page.locator('#start-button')).toBeDisabled();
  await page.locator('#fret-from').fill('3');
  await page.keyboard.press('Tab');
  await expect(alert(page)).toHaveCount(0);
  await expect(page.locator('#start-button')).toBeEnabled();
  expect((await saved(page)).fretRange).toEqual({ from: 3, to: 12 });
});

test('invalid range draft survives switching editors without mutating committed range', async ({ page }) => {
  await setup(page);
  await page.locator('[data-popover-target="fret-range"]').click();
  await page.locator('#fret-from').fill('25');
  await page.keyboard.press('Tab');
  await page.locator('[data-popover-target="targets"]').click();
  await expect(page.locator('#start-button')).toBeDisabled();
  await page.locator('[data-popover-target="fret-range"]').click();
  await expect(page.locator('#fret-from')).toHaveValue('25');
  await expect(alert(page)).toContainText('Choose frets');
  expect((await saved(page)).fretRange).toEqual({ from: 0, to: 12 });
});

test('invalid BPM Start displays actionable error despite outside-click bubbling', async ({ page }) => {
  await setup(page);
  await page.locator('[data-popover-target="bpm"]').click();
  await page.locator('#bpm').fill('9');
  await page.locator('#start-button').click();
  await expect(page.locator('.prompt-deck')).toBeVisible();
  await expect(alert(page)).toContainText('Choose a BPM between 10 and 200.');
});

test('unchanged tuning visit preserves the selected-string subset', async ({ page }) => {
  await setup(page);
  await page.locator('[data-popover-target="strings"]').click();
  await page.locator('[data-string-index="0"]').click();
  await page.keyboard.press('Escape');
  const before = (await saved(page)).selectedStringIndexes;
  expect(before).toEqual([1, 2, 3, 4, 5]);
  await page.locator('[data-popover-target="tuning"]').click();
  await page.locator('#custom-tuning').click();
  await page.keyboard.press('Tab');
  expect((await saved(page)).selectedStringIndexes).toEqual(before);
  await page.locator('[data-popover-target="strings"]').click();
  await expect(page.locator('[data-string-index="0"]')).toHaveAttribute('aria-pressed', 'false');
});

test('Enter on note preserves keyboard focus and Space does not launch playback', async ({ page }) => {
  await setup(page);
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.activeElement?.dataset.noteLabel === 'C')) break;
    await page.keyboard.press('Tab');
  }
  expect(await page.evaluate(() => document.activeElement?.dataset.noteLabel)).toBe('C');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.dataset.noteLabel)).toBe('C');
  await page.keyboard.press('Space');
  await expect(page.locator('.prompt-deck')).toBeVisible();
});

test('held Space repeats cannot toggle transport again', async ({ page }) => {
  await setup(page);
  await page.keyboard.down('Space');
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.keyboard.up('Space');
});

test('Pause retains the cue and Resume advances once on a shared controlled clock', async ({ page }) => {
  // This is a deterministic UI/lifecycle test. Native audio output is tested below.
  // Advancing JS timers alone leaves AudioContext time running independently.
  await page.route('**/app.js', async route => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toContain('audioClock: player.now');
    await route.fulfill({ response, body: body.replace('audioClock: player.now', 'audioClock: () => performance.now() / 1000') });
  });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await setup(page);
  await page.locator('[data-popover-target="bpm"]').click();
  await page.locator('#bpm').fill('200');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await page.locator('#start-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  await page.clock.runFor(5 * 60000 / 200);
  await expect(page.locator('.practice-running')).toBeVisible();
  const cue = await page.locator('.practice-cue-row').innerText();
  const note = await page.locator('.current-note').innerText();
  await page.locator('#pause-button').click();
  await expect(page.locator('.practice-paused')).toBeVisible();
  await page.clock.runFor(1000);
  expect(await page.locator('.practice-cue-row').innerText()).toBe(cue);
  expect(await page.locator('.current-note').innerText()).toBe(note);
  await page.locator('#resume-button').click();
  await expect(page.locator('.practice-running')).toBeVisible();
  await page.clock.runFor(60000 / 200 - 1);
  expect(await page.locator('.practice-cue-row').innerText()).toBe(cue);
  await page.clock.runFor(1);
  await expect(page.locator('.beat-meter')).toHaveText('3 / 6');
});

test('real Web Audio reaches destination side-tap, accents target, then Stop silences it', async ({ page }) => {
  if (process.env.FRETFLASH_AUDIO_NEGATIVE_CONTROL === '1') {
    await page.route('**/app.js', async route => {
      const response = await route.fetch();
      const body = await response.text();
      if (!body.includes('playClick: player.play')) throw new Error('Negative-control seam changed; do not claim mutation proof');
      await route.fulfill({ response, body: body.replace('playClick: player.play', 'playClick: () => {}') });
    });
  }
  await page.addInitScript(() => {
    const Native = window.AudioContext || window.webkitAudioContext;
    window.__audioProof = { events: [], peaks: [], contexts: [] };
    class ProbedContext extends Native {
      constructor(...args) {
        super(...args);
        const tap = super.createGain();
        const analyser = super.createAnalyser();
        analyser.fftSize = 256;
        tap.connect(analyser);
        analyser.connect(super.destination);
        this._tap = tap;
        this._analyser = analyser;
        window.__audioProof.contexts.push(this);
        const samples = new Float32Array(analyser.fftSize);
        window.setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          window.__audioProof.peaks.push(Math.max(...samples.map(Math.abs)));
        }, 5);
      }
      get destination() { return this._tap; }
      createOscillator() {
        const oscillator = super.createOscillator();
        const setFrequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        let requestedFrequency;
        oscillator.frequency.setValueAtTime = (value, when) => {
          requestedFrequency = value;
          return setFrequency(value, when);
        };
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when) => {
          window.__audioProof.events.push({ frequency: requestedFrequency, when });
          return start(when);
        };
        return oscillator;
      }
    }
    window.AudioContext = ProbedContext;
    window.webkitAudioContext = ProbedContext;
  });
  await setup(page);
  await page.locator('[data-popover-target="bpm"]').click();
  await page.locator('#bpm').fill('200');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await page.locator('#start-button').click();
  await expect.poll(() => page.evaluate(() => window.__audioProof.events.length), { timeout: 6000 }).toBeGreaterThanOrEqual(5);
  const proof = await page.evaluate(() => ({ events: window.__audioProof.events.slice(0, 5), peak: Math.max(...window.__audioProof.peaks) }));
  expect(proof.events.map(event => event.frequency)).toEqual([1200, 1200, 1200, 1200, 1800]);
  expect(proof.peak).toBeGreaterThan(0.005);
  await page.locator('#stop-button').click();
  const count = await page.evaluate(() => window.__audioProof.events.length);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.__audioProof.events.length)).toBe(count);
  const quiet = await page.evaluate(() => { const p = window.__audioProof.peaks; return Math.max(...p.slice(-20)); });
  expect(quiet).toBeLessThan(0.005);
});

test('selected artwork, semantic fonts, ordered spellings, and no answer frets', async ({ page, request, baseURL }) => {
  const errors = await setup(page);
  const icon = new URL('assets/icons/fretflash-six-line-f.svg', baseURL);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', icon.pathname.slice(1));
  await expect(page.locator('.brand-mark')).toHaveAttribute('src', icon.pathname.slice(1));
  const selected = await request.get(icon.href);
  expect(selected.ok()).toBeTruthy();
  expect(await selected.body()).toEqual(await (await import('node:fs/promises')).readFile('assets/icons/fretflash-six-line-f.svg'));
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/^Inter,/);
  expect(await page.locator('.home-link').evaluate(el => getComputedStyle(el).fontFamily)).toContain('SFMono-Regular');
  expect(await page.locator('.note-pill').allTextContents()).toEqual('C Cb C# D Db D# E Eb E# F Fb F# G Gb G# A Ab A# B Bb B#'.split(' '));
  await page.locator('[data-popover-target="targets"]').click();
  await page.locator('[data-location-mode="all-in-range"]').click();
  await page.locator('[data-popover-target="fret-range"]').click();
  await page.locator('[data-fret-preset="all"]').click();
  await page.locator('[data-preset="clear"]').click();
  await page.locator('[data-note-label="C"]').click();
  await expect(page.locator('.note-pool-summary')).toContainText(/1 notes? · 12 clicks/);
  await page.locator('#start-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  await expect(page.locator('.practice-display')).not.toContainText(/(?:fret|position)\s+\d+/i);
  expect(errors).toEqual([]);
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900], [568, 320]]) {
  test(`geometry ${width}x${height}: no horizontal overflow or rail-induced document scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await setup(page);
    // A locator click scrolls the offscreen Start button into view first;
    // keyboard Start isolates scrolling caused by the app's progress rail.
    await page.keyboard.press('Space');
    await expect(page.locator('.practice-countin')).toBeVisible();
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      scrollY,
      railWidth: document.querySelector('.note-progress-rail').clientWidth,
      railContent: document.querySelector('.note-progress-rail').scrollWidth,
    }));
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.scrollY).toBe(0);
    expect(geometry.railWidth).toBeGreaterThan(0);
    expect(geometry.railContent).toBeGreaterThanOrEqual(geometry.railWidth);
    if (height === 320) {
      for (const selector of ['.practice-cue-row', '.current-note', '#stop-button']) {
        const box = await page.locator(selector).boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
    }
    await page.screenshot({ path: `.local/browser-evidence/countin-${width}x${height}.png` });
    await page.locator('#pause-button').click();
    await page.screenshot({ path: `.local/browser-evidence/paused-${width}x${height}.png` });
    expect(errors).toEqual([]);
  });
}

test('long progress moves its rail, not the document, on a short landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await setup(page);
  await page.locator('[data-popover-target="bpm"]').click();
  await page.locator('#bpm').fill('200');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await page.locator('[data-popover-target="strings"]').click();
  for (let index = 1; index < 6; index++) await page.locator(`[data-string-index="${index}"]`).click();
  await page.keyboard.press('Escape');
  await page.locator('[data-preset="all"]').click();
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.keyboard.press('Space');
  await expect(page.locator('.practice-countin')).toBeVisible();
  await expect.poll(() => page.locator('.note-progress-rail').evaluate(el => el.scrollLeft), { timeout: 9000 }).toBeGreaterThan(0);
  await expect(page.locator('.practice-running')).toBeVisible();
  const position = await page.evaluate(() => ({
    scrollY,
    railX: document.querySelector('.note-progress-rail').scrollLeft,
    railWidth: document.querySelector('.note-progress-rail').clientWidth,
    railContent: document.querySelector('.note-progress-rail').scrollWidth,
    progressIndex: [...document.querySelectorAll('.progress-cell')].findIndex(cell => cell.classList.contains('is-current')),
    visibleCue: document.querySelector('.current-note').getBoundingClientRect().top,
  }));
  expect(position.scrollY).toBe(0);
  expect(position.railX, JSON.stringify(position)).toBeGreaterThan(0);
  expect(position.visibleCue).toBeGreaterThanOrEqual(0);
});
