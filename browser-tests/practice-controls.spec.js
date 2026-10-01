import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });
async function open(page) {
  await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {timeout:15000}).toBe(true);
}

for (const [width,height,scale=1] of [[320,568],[390,844],[768,1024],[1440,900],[320,568,2]]) {
test(`editor headings are balanced and close returns focus ${width}x${height} at ${scale}x text`, async ({ page }, info) => {
  await page.setViewportSize({width,height}); await open(page); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(scale => document.documentElement.style.fontSize=`${scale*100}%`,scale);
  const errors = [];
  for (const [id, label] of [['bpm','BPM'],['fret-range','Fret range'],['strings','Strings'],['tuning','Tuning'],['targets','Targets']]) {
    const trigger = page.locator(`[data-popover-target="${id}"]`);
    await trigger.focus(); await page.keyboard.press('Enter');
    const close = page.getByRole('button', { name: `Close ${label}`, exact: true });
    await expect(close).toBeVisible(); await expect(close.locator('svg')).toHaveCount(1);
    expect((await close.innerText()).trim()).toBe('');
    const box = await close.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    const editor = page.locator(`[data-popover="${id}"]`);
    await editor.screenshot({path:info.outputPath(`${id}.png`)});
    const alignment = await editor.evaluate(el => {
      const panel = el.getBoundingClientRect(), title = el.querySelector('h2').getBoundingClientRect();
      const close = el.querySelector('[data-close-editor]').getBoundingClientRect();
      return { title: Math.abs(title.x+title.width/2-panel.x-panel.width/2),
        vertical: Math.abs(title.y+title.height/2-close.y-close.height/2),
        overlap: title.right > close.left, alignment: getComputedStyle(el.querySelector('h2')).textAlign };
    });
    if (alignment.title > 1 || alignment.vertical > 1 || alignment.overlap || alignment.alignment !== 'center') errors.push({id,...alignment});
    if (id === 'bpm') await page.locator('#bpm').fill('73');
    await close.click(); await expect(trigger).toBeFocused();
    await expect(page.locator('.header-popover[data-open="true"]')).toHaveCount(0);
  }
  await expect(page.locator('[data-popover-target="bpm"] strong')).toHaveText('73');
  expect(errors).toEqual([]);
});
}

test('spoken cues is a peer setup setting with native keyboard order', async ({ page }, info) => {
  await page.setViewportSize({width:390,height:844}); await open(page);
  await page.screenshot({path:info.outputPath('setup-phone.png')});
  await expect(page.locator('.drill-header > .drill-cell')).toHaveCount(6);
  const toggle = page.locator('.drill-header > #spoken-cues-button');
  await expect(toggle).toBeVisible(); await expect(page.locator('#spoken-cues-button')).toHaveCount(1);
  await page.locator('[data-popover-target="targets"]').focus(); await page.keyboard.press('Tab');
  await expect(toggle).toBeFocused(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed','true'); await expect(toggle).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-preset="all"]')).toBeFocused();
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:info.outputPath('setup-desktop.png')});
});

test('quick reference is concise playing advice without voice implementation detail', async ({ page }, info) => {
  await open(page); const help = page.locator('#quick-reference'); await help.locator(':scope > summary').click();
  const text = await help.innerText();
  expect(text).toMatch(/four.*count-in|four.*clicks/i); expect(text).toMatch(/Spoken cues/);
  expect(text).toMatch(/one click before/); expect(text.split(/\s+/).length).toBeLessThan(180);
  await help.screenshot({path:info.outputPath('quick-reference.png')});
  await help.locator('details > summary').click();
  const all = await help.innerText(); expect(all.split(/\s+/).length).toBeLessThan(300);
  expect(all).not.toMatch(/George|compress|variants|banks|pre.?generated|implementation|playbackRate|service worker/i);
  expect(all).toMatch(/C#.*Db/); expect(all).toMatch(/offline/i); expect(all).toMatch(/Escape/);
});

for (const [width, height] of [[320,480],[390,844],[768,1024],[1440,900],[568,320]]) {
  test(`practice speech toggle is reachable and transport-stable ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({width,height}); await open(page); await page.locator('#start-button').click();
    await expect(page.locator('.practice-countin')).toBeVisible();
    const toggle = page.locator('#spoken-cues-button'); await expect(toggle).toBeVisible();
    await expect(page.locator('.practice-context #spoken-cues-button')).toHaveCount(1);
    await expect(page.locator('.practice-options')).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed','false');
    expect(await toggle.evaluate(node => Boolean(node.closest('[aria-live]')))).toBe(false);
    const stop = await page.locator('#stop-button').boundingBox();
    expect(stop.y+stop.height).toBeLessThanOrEqual(height);
    await toggle.scrollIntoViewIfNeeded(); await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed','true'); await expect(toggle).toHaveAttribute('aria-busy','false');
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-pressed','false');
    await page.locator('#pause-button').click();
    await expect(page.locator('.practice-paused')).toBeVisible();
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-pressed','true');
    await page.evaluate(() => scrollTo(0,0));
    expect(await page.locator('#stop-button').boundingBox()).toEqual(stop);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('practice-toggle.png')});
    await page.locator('#stop-button').click(); await expect(toggle).toHaveAttribute('aria-pressed','true');
    await page.reload(); await expect(toggle).toHaveAttribute('aria-pressed','true');
  });
}
