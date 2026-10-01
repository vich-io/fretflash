import { test, expect } from '@playwright/test';

test.use({ viewport:{ width:390,height:844 }, hasTouch:true, isMobile:true });
async function open(page) { await page.goto('/'); await expect(page.locator('#start-button')).toBeEnabled(); }
async function editor(page,name) { await page.locator(`[data-popover-target="${name}"]`).click(); }
async function close(page) { await page.locator('[data-close-editor]:visible').click(); }
async function lowEOpen(page) {
  await page.locator('[data-preset="all"]').click();
  await editor(page,'strings');
  for (let i=1;i<6;i++) await page.locator(`[data-string-index="${i}"]`).click();
  await close(page); await editor(page,'fret-range');
  await page.locator('#fret-to').fill('0'); await page.keyboard.press('Enter');
}

test('partial coverage disclosure lists omitted labels, retains intent and recovers with a wider range', async ({ page },info) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await open(page); await lowEOpen(page);
  await expect(page.locator('.note-pool-summary')).toContainText('2 of 21 notes available');
  await expect(page.locator('.note-pill[aria-pressed="true"]')).toHaveCount(21);
  const details=page.locator('.note-availability');
  await expect(details).not.toHaveAttribute('open',''); await expect(details.locator('p')).toBeHidden();
  await details.locator('summary').click(); await expect(details.locator('p')).toBeVisible();
  const omitted=(await details.locator('p').innerText()).split(' ');
  expect(omitted).toHaveLength(19); expect(omitted).toContain('B#'); expect(omitted).not.toContain('E'); expect(omitted).not.toContain('Fb');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.screenshot({ path:info.outputPath('partial-expanded.png'),fullPage:true });
  await editor(page,'bpm'); await page.locator('[data-bpm-step="1"]').click(); await close(page);
  await expect(details).toHaveAttribute('open','');
  await editor(page,'fret-range'); await page.locator('[data-fret-preset="default"]').click(); await close(page);
  await expect(page.locator('.note-pool-summary')).toContainText('21 notes · 21 clicks');
  await expect(details).toHaveCount(0); await expect(page.locator('.note-pill[aria-pressed="true"]')).toHaveCount(21);
  await page.reload(); await expect(page.locator('.note-pill[aria-pressed="true"]')).toHaveCount(21);
  await expect(page.locator('.note-pool-summary')).toContainText('21 notes · 21 clicks');
  expect(errors).toEqual([]);
});

test('zero coverage explains and disables before activation, while keyboard refusal and correction remain usable', async ({ page },info) => {
  await open(page); await lowEOpen(page);
  await page.locator('[data-preset="clear"]').click(); await page.locator('[data-note-label="C"]').click();
  await expect(page.locator('.note-pool-summary')).toContainText('0 of 1 notes available');
  await expect(page.locator('#start-button')).toBeDisabled();
  await expect(page.locator('[role="alert"]')).toHaveText('No selected notes are available in this fret range.');
  await page.screenshot({ path:info.outputPath('zero.png'),fullPage:true });
  await page.locator('.note-pool-summary').click(); await page.keyboard.press('Space');
  await expect(page.locator('.app-shell-setup')).toBeVisible(); await expect(page.locator('[role="alert"]')).toHaveCount(1);
  await expect(page.locator('[role="alert"]')).toHaveText('No selected notes are available in this fret range.');
  await expect(page.locator('[data-note-label="C"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-note-label="E"]').click(); await expect(page.locator('#start-button')).toBeEnabled();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});

for (const [width,height,scale] of [[320,568,1],[320,568,2],[768,1024,1],[1440,900,1]]) {
  test(`omitted detail remains reachable at ${width}px and ${scale}x text`,async ({ page },info) => {
    await page.setViewportSize({ width,height }); await open(page); await lowEOpen(page);
    await page.evaluate(scale=>document.documentElement.style.fontSize=`${scale*100}%`,scale);
    const details=page.locator('.note-availability'); await details.locator('summary').click();
    await expect(details.locator('p')).toBeVisible(); await expect(page.locator('#start-button')).toBeEnabled();
    await page.locator('#start-button').scrollIntoViewIfNeeded(); await expect(page.locator('#start-button')).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({ path:info.outputPath('coverage.png'),fullPage:true });
    await details.locator('summary').click(); await expect(details.locator('p')).toBeHidden();
  });
}

test('visible and initial help describes George and bounded faster calls without the retired chooser',async ({ page }) => {
  await open(page);
  const help=page.locator('#quick-reference'); await help.locator(':scope > summary').click();
  await help.locator('details > summary').click();
  const text=await help.locator('details p').first().innerText();
  expect(text).toContain('George'); expect(text).toContain('natural'); expect(text).toContain('faster versions');
  expect(text).toContain('stronger compression'); expect(text).toContain('10–200 BPM'); expect(text).not.toContain('lower BPM');
  expect(text).not.toContain('Lucy'); expect(text).not.toContain('Choose');
  const html=await (await page.request.get('/')).text(); expect(html).not.toContain('Choose Lucy or George');
});
