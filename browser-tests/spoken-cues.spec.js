import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { getSpokenClip } from '../src/speech.js';
import { KNOWN_NOTE_LABELS } from '../src/music.js';
const target = process.env.SPOKEN_PREVIEW_PATH ? pathToFileURL(process.env.SPOKEN_PREVIEW_PATH).href : '/';

async function probe(page) {
  await page.addInitScript(() => {
    const Native = window.AudioContext || window.webkitAudioContext;
    window.__speechProof = { words: [], clicks: [], peaks: [], contexts: [] };
    window.__speechFingerprint = data => {
      const bits=new Uint32Array(data.buffer,data.byteOffset,data.length); let hash=2166136261;
      for(const value of bits) hash=Math.imul(hash^value,16777619);
      return hash>>>0;
    };
    class Context extends Native {
      constructor(...args) {
        super(...args);
        const tap = super.createGain(), analyser = super.createAnalyser();
        tap.connect(analyser); analyser.connect(super.destination); analyser.fftSize = 512;
        this._tap = tap; window.__speechProof.contexts.push(this);
        const samples = new Float32Array(512);
        setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          window.__speechProof.peaks.push({ time: this.currentTime, peak: Math.max(...samples.map(Math.abs)) });
        }, 5);
      }
      get destination() { return this._tap; }
      createOscillator() {
        const node = super.createOscillator(), start = node.start.bind(node);
        node.start = when => { window.__speechProof.clicks.push(when); return start(when); }; return node;
      }
      createBufferSource() {
        const node = super.createBufferSource(), start = node.start.bind(node), stop = node.stop.bind(node);
        const entry = { stops: [] };
        node.start = when => {
          const data = node.buffer.getChannelData(0); let first = -1, peak = 0;
          for (let i = 0; i < data.length; i++) { peak = Math.max(peak, Math.abs(data[i])); if (first === -1 && Math.abs(data[i]) > 0.001) first = i; }
          Object.assign(entry, { when, duration: node.buffer.duration, first: first / node.buffer.sampleRate, peak, rate: node.playbackRate.value, sampleRate: node.buffer.sampleRate, now: this.currentTime, fingerprint: window.__speechFingerprint(data) });
          window.__speechProof.words.push(entry); return start(when);
        };
        node.stop = when => { entry.stops.push(when); return stop(when); }; return node;
      }
    }
    window.AudioContext = Context; window.webkitAudioContext = Context;
  });
}
async function shortDrill(page, bpm, labels = ['C#', 'Db'], strings = 1) {
  await page.locator('[data-popover-target="bpm"]').click();
  await page.locator('#bpm').fill(String(bpm)); await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
  await page.locator('[data-popover-target="strings"]').click();
  for (let index = strings; index < 6; index++) await page.locator(`[data-string-index="${index}"]`).click();
  await page.keyboard.press('Escape'); await page.locator('[data-preset="clear"]').click();
  for (const label of labels) await page.locator(`[data-note-label="${label}"]`).click();
}
async function quiet(page) {
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__speechProof.peaks.slice(-8).every(x => x.peak < 0.005))).toBeTruthy();
}

test('native spoken toggle persists with George only, no chooser, and reachable short-phone Start', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', r => { if (r.url().includes('/voice/')) requests.push(r.url()); }); page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 320, height: 480 }); await page.goto(target);
  await expect(page.locator('#spoken-cues-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-spoken-voice]')).toHaveCount(0);
  await page.locator('#spoken-cues-button').click(); await expect(page.locator('[data-spoken-voice]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#spoken-cues-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-spoken-voice]')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(JSON.parse(localStorage.getItem('fretflash.settings.v1')), 'spokenVoice'))).toBe(false);
  expect(requests).toEqual([]);
  await page.locator('#spoken-cues-button').scrollIntoViewIfNeeded();
  const box = await page.locator('#start-button').boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(480);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: '.local/browser-evidence/natural-setup-320.png' });
  for (const [width, height] of [[320, 480], [390, 844], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('[data-spoken-voice]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `.local/browser-evidence/george-only/setup-${width}.png` });
  }
  await page.setViewportSize({ width: 320, height: 480 });
  await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click(); await expect(page.locator('.practice-countin')).toBeVisible();
  expect(requests).toEqual([]); await page.locator('#stop-button').click(); expect(errors).toEqual([]);
});

for (const bpm of [40, 200]) {
  test(`natural whole names in George at ${bpm} BPM start with the click, cross beats, and cancel on Pause/Stop`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message)); await probe(page); await page.goto(target);
    await shortDrill(page, bpm, ['C#', 'Db'], bpm === 200 ? 4 : 1);
    await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click();
    await expect.poll(() => page.evaluate(() => window.__speechProof.words.length), { timeout: 7000 }).toBe(1);
    const data = await page.evaluate(() => ({ words: window.__speechProof.words, clicks: window.__speechProof.clicks }));
    const word = data.words[0], expected = ['C#', 'Db'].map(label => getSpokenClip(label).duration);
    expect(expected.some(d => Math.abs(d - word.duration) <= 1 / word.sampleRate)).toBeTruthy();
    expect(data.clicks.some(when => Math.abs(when - word.when) < 1e-8)).toBeTruthy();
    expect(word.when).toBeGreaterThan(word.now); expect(word.rate).toBe(1); expect(word.stops).toEqual([]); expect(word.peak).toBeGreaterThan(0.1);
    if (bpm === 200) expect(word.duration).toBeGreaterThan(60 / bpm);
    await expect.poll(() => page.evaluate(() => { const p = window.__speechProof, w = p.words[0]; return p.peaks.some(x => x.time > w.when + 0.06 && x.time < w.when + w.duration && x.peak > 0.01); })).toBeTruthy();
    await page.locator('#pause-button').click(); await expect(page.locator('.practice-paused')).toBeVisible();
    expect(await page.evaluate(() => { const p = window.__speechProof, now = p.contexts[0].currentTime; return p.words.every(w => w.stops.some(t => t <= now) || w.when + w.duration <= now); })).toBeTruthy();
    await quiet(page); await page.locator('#resume-button').click(); await expect(page.locator('.practice-countin, .practice-running')).toBeVisible();
    await page.locator('#stop-button').click(); await quiet(page); expect(errors).toEqual([]);
  });
}

for (const action of ['Setup', 'hidden', 'pagehide']) {
  test(`final natural name survives Done until ${action} cancels its tail`, async ({ page }) => {
    await probe(page); await page.goto(target); await shortDrill(page, 200, ['C#']); await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click();
    await expect(page.locator('.practice-done')).toBeVisible();
    const words = await page.evaluate(() => window.__speechProof.words); expect(words).toHaveLength(1); expect(words[0].stops).toEqual([]);
    await expect.poll(() => page.evaluate(() => { const p = window.__speechProof, w = p.words[0]; return p.peaks.some(x => x.time > w.when + 0.3 && x.time < w.when + w.duration && x.peak > 0.01); })).toBeTruthy();
    if (action === 'Setup') await page.locator('#setup-button').click();
    else await page.evaluate(action => { if (action === 'pagehide') window.dispatchEvent(new Event('pagehide')); else { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); } }, action);
    expect(await page.evaluate(() => window.__speechProof.words[0].stops.length)).toBe(1); await quiet(page);
  });
}

test('one-target 200 BPM works through Start, remaining Resume, Restart and exact Repeat', async ({ page }) => {
  await probe(page); await page.goto(target); await shortDrill(page,40);
  await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click(); await page.locator('#pause-button').click();
  await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill('200'); await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
  await page.locator('#resume-button').click(); await expect(page.locator('.practice-countin, .practice-running')).toBeVisible();
  await page.locator('#pause-button').click(); await page.locator('#restart-button').click();
  await expect(page.locator('.practice-done')).toBeVisible(); await expect(page.locator('[role="alert"]')).toHaveCount(0);
  const before=await page.evaluate(()=>window.__speechProof.words.length);
  await page.locator('#same-order-button').click(); await expect(page.locator('.practice-done')).toBeVisible();
  expect(await page.evaluate(()=>window.__speechProof.words.length)).toBe(before+2);
  await page.locator('#setup-button').click(); await page.locator('#start-button').click(); await expect(page.locator('.practice-countin')).toBeVisible();
  await page.locator('#stop-button').click(); await quiet(page);
});

test('failed voice download is visible and disabling speech restores normal Start', async ({ page }) => {
  await page.route('**/assets/voice/george.wav*', route => route.abort()); await page.goto(target); await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click();
  await expect(page.locator('[role="alert"]')).toContainText('Audio could not start'); await expect(page.locator('.prompt-deck')).toBeVisible();
  await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click(); await expect(page.locator('.practice-countin')).toBeVisible();
});

test('Cancel during voice loading revokes the pending Start after the response arrives', async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; }); await page.route('**/assets/voice/george.wav*', async route => { await gate; await route.continue(); });
  await probe(page); await page.goto(target); await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click(); await expect(page.locator('#cancel-start-button')).toBeVisible();
  await page.locator('#cancel-start-button').click(); release(); await page.waitForTimeout(500); await expect(page.locator('.prompt-deck')).toBeVisible();
  expect(await page.evaluate(() => window.__speechProof.words.length)).toBe(0); expect(await page.evaluate(() => window.__speechProof.clicks.length)).toBe(0);
});

test('complete spoken round and exact Repeat/Restart preserve George and uncommon spellings', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await probe(page); await page.goto(target); await shortDrill(page, 200, ['Cb', 'E#'], 4);
  await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click(); await expect(page.locator('.practice-done')).toBeVisible();
  const words = await page.evaluate(() => window.__speechProof.words); expect(words).toHaveLength(2);
  const durations = ['Cb', 'E#'].map(label => getSpokenClip(label).duration).sort();
  words.map(w => w.duration).sort().forEach((duration, i) => expect(Math.abs(duration - durations[i])).toBeLessThanOrEqual(1 / words[i].sampleRate));
  expect(words[1].when - words[0].when).toBeCloseTo(4 * 60 / 200, 8);
  await page.locator('#same-order-button').click(); await expect(page.locator('.practice-countin')).toBeVisible(); await page.locator('#pause-button').click(); await page.locator('#restart-button').click();
  await expect(page.locator('.practice-done')).toBeVisible(); await page.locator('#setup-button').click(); await expect(page.locator('#spoken-cues-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-spoken-voice]')).toHaveCount(0); expect(errors).toEqual([]);
});

test('200 BPM uses the bounded fallback only for the crowded call, with natural final speech and real output', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', r => { if (r.url().includes('/voice/')) requests.push(new URL(r.url()).pathname); });
  page.on('pageerror', e => errors.push(e.message));
  await probe(page); await page.goto(target); await shortDrill(page, 200, ['C#', 'Db'], 2);
  await page.locator('#spoken-cues-button').click();
  await page.locator('[data-popover-target="bpm"]').click();
  await expect(page.locator('#bpm')).toHaveAttribute('min', '10');
  await expect(page.locator('#bpm')).toHaveAttribute('max', '200');
  await page.keyboard.press('Escape'); await page.locator('#start-button').click();
  await expect(page.locator('.practice-done')).toBeVisible();
  const proof = await page.evaluate(() => window.__speechProof);
  expect(proof.words).toHaveLength(2);
  const [first, last] = proof.words;
  expect(first.duration).toBeLessThanOrEqual(.55 + 1 / first.sampleRate);
  expect(last.duration).toBeGreaterThan(.55);
  expect(['C#', 'Db'].some(label => Math.abs(last.duration - getSpokenClip(label).duration) <= 1 / last.sampleRate)).toBeTruthy();
  expect(last.when - first.when).toBeCloseTo(.6, 8);
  expect(last.when - first.when - first.duration).toBeGreaterThanOrEqual(.05 - 1 / first.sampleRate);
  for (const word of proof.words) {
    expect(word.rate).toBe(1); expect(word.stops).toEqual([]);
    expect(proof.clicks.some(when => Math.abs(when - word.when) < 1e-8)).toBeTruthy();
  }
  expect(proof.peaks.some(p => p.time > first.when + .06 && p.time < first.when + first.duration && p.peak > .01)).toBeTruthy();
  expect(requests.sort()).toEqual(['/assets/voice/george-fast.wav', '/assets/voice/george.wav']);
  await page.locator('#same-order-button').click();
  await expect.poll(() => page.evaluate(() => window.__speechProof.words.length), { intervals: [50] }).toBe(3);
  await page.locator('#pause-button').click();
  expect(await page.evaluate(() => window.__speechProof.words[2].stops.length)).toBe(1);
  await quiet(page); await page.locator('#stop-button').click(); expect(errors).toEqual([]);
});

for(const [variant,strings] of [['fast',2],['tight',1]]) {
  test(`a failed ${variant} bank supports speech-off recovery and a successful speech-on retry`,async ({ page }) => {
    const route=`**/assets/voice/george-${variant}.wav*`;
    await page.route(route,r=>r.abort()); await page.goto(target); await shortDrill(page,200,['C#','Db'],strings);
    await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click();
    await expect(page.locator('[role="alert"]')).toContainText('Audio could not start'); await expect(page.locator('.prompt-deck')).toBeVisible();
    await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click();
    await expect(page.locator('.practice-countin')).toBeVisible(); await page.locator('#stop-button').click();
    await page.unroute(route); await page.locator('#spoken-cues-button').click(); await page.locator('#start-button').click();
    await expect(page.locator('.practice-countin')).toBeVisible(); await page.locator('#stop-button').click();
  });
}

test('10 BPM starts through ordinary controls and one-target spoken setup retains the full 200-BPM range', async ({ page }) => {
  await page.goto(target); await shortDrill(page, 10);
  await page.locator('#spoken-cues-button').click(); await page.locator('[data-popover-target="bpm"]').click();
  await expect(page.locator('#bpm')).toHaveAttribute('min', '10');
  await expect(page.locator('#bpm')).toHaveAttribute('max', '200');
  await expect(page.locator('[data-popover="bpm"] .microcopy')).toHaveCount(0);
  await expect(page.locator('[data-bpm="160"]')).toBeEnabled();
  await page.keyboard.press('Escape'); await page.locator('#start-button').click();
  await expect(page.locator('.practice-countin')).toBeVisible();
  await expect(page.locator('.practice-context')).toContainText('10'); await page.locator('#stop-button').click();
});

test('all 21 spellings play at one-target 200 BPM with real output, complete calls and 50ms gaps',async ({ page },info) => {
  const errors=[],requests=[]; page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/voice/'))requests.push(new URL(r.url()).pathname);});
  await probe(page); await page.goto(target); await shortDrill(page,200,KNOWN_NOTE_LABELS,1);
  await page.locator('#spoken-cues-button').click(); await page.locator('[data-popover-target="bpm"]').click();
  await expect(page.locator('#bpm')).toHaveAttribute('max','200'); await expect(page.locator('#bpm')).toHaveValue('200');
  await page.keyboard.press('Escape'); await page.screenshot({ path:info.outputPath('one-target-200.png') });
  await page.locator('#start-button').click(); await expect(page.locator('.practice-done')).toBeVisible({ timeout:12000 });
  const proof=await page.evaluate(()=>window.__speechProof); expect(proof.words).toHaveLength(21); expect(proof.clicks).toHaveLength(25);
  for(let i=0;i<proof.words.length;i++) {
    const word=proof.words[i]; expect(word.rate).toBe(1); expect(word.stops).toEqual([]);
    expect(proof.clicks.some(t=>Math.abs(t-word.when)<1e-8)).toBe(true);
    if(i<20) {
      expect(word.duration).toBeLessThanOrEqual(.25+1/word.sampleRate);
      const gap=proof.words[i+1].when-word.when; expect(gap).toBeCloseTo(.3,8);
      expect(gap-word.duration).toBeGreaterThanOrEqual(.05-1/word.sampleRate);
      expect(proof.peaks.some(p=>p.time>word.when+.06 && p.time<word.when+word.duration && p.peak>.01)).toBe(true);
    } else expect(KNOWN_NOTE_LABELS.some(label=>Math.abs(getSpokenClip(label).duration-word.duration)<=1/word.sampleRate)).toBe(true);
  }
  expect(requests.sort()).toEqual(['/assets/voice/george-tight.wav','/assets/voice/george.wav']);
  const identities=await page.evaluate(async labels=>{
    const { SPOKEN_BANKS,getSpokenClip }=await import('/src/speech.js');
    const context=window.__speechProof.contexts[0],maps={};
    for(const variant of ['tight','natural']) {
      const metadata=SPOKEN_BANKS[variant];
      const bank=await context.decodeAudioData(await (await fetch(metadata.path)).arrayBuffer());
      maps[variant]=Object.fromEntries(labels.map(label=>{
        const clip=getSpokenClip(label,variant);
        const data=bank.getChannelData(0).subarray(Math.round(clip.startFrame/metadata.sampleRate*bank.sampleRate),Math.round(clip.endFrame/metadata.sampleRate*bank.sampleRate));
        return [window.__speechFingerprint(data),label];
      }));
    }
    return window.__speechProof.words.map((word,i)=>maps[i<20?'tight':'natural'][word.fingerprint]);
  },KNOWN_NOTE_LABELS);
  expect([...identities].sort()).toEqual([...KNOWN_NOTE_LABELS].sort());
  await page.locator('#setup-button').click(); await quiet(page); expect(errors).toEqual([]);
});

test('Cancel while tight speech loads prevents late words and supports a fresh retry',async ({ page }) => {
  let release; const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/assets/voice/george-tight.wav*',async route=>{await gate;await route.continue();});
  await probe(page); await page.goto(target); await shortDrill(page,200); await page.locator('#spoken-cues-button').click();
  await page.locator('#start-button').click(); await expect(page.locator('#cancel-start-button')).toBeVisible();
  await page.locator('#cancel-start-button').click(); release(); await page.waitForTimeout(300);
  await expect(page.locator('.prompt-deck')).toBeVisible();
  expect(await page.evaluate(()=>window.__speechProof.words.length+window.__speechProof.clicks.length)).toBe(0);
  await page.locator('#start-button').click(); await expect(page.locator('.practice-done')).toBeVisible();
  expect(await page.evaluate(()=>window.__speechProof.words.length)).toBe(2);
});
