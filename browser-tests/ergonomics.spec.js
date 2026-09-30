import { test, expect } from '@playwright/test';

async function tempo(page, value) {
  await page.locator('[data-popover-target="bpm"]').click();
  await page.locator('#bpm').fill(String(value));
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
}
async function open(page) { await page.goto('/'); await page.evaluate(() => document.fonts.ready); }

test('touch Pause and Resume retain their exact target; Stop does not move', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width:390,height:844 }, hasTouch:true, isMobile:true });
  const page = await context.newPage(); await open(page);
  await page.locator('#start-button').tap();
  const pause = await page.locator('#pause-button').boundingBox();
  const stop = await page.locator('#stop-button').boundingBox();
  const point = { x:pause.x+pause.width*.8, y:pause.y+pause.height/2 };
  await page.touchscreen.tap(point.x,point.y);
  expect(await page.locator('#resume-button').boundingBox()).toEqual(pause);
  expect(await page.locator('#stop-button').boundingBox()).toEqual(stop);
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y).id,point)).toBe('resume-button');
  await page.touchscreen.tap(point.x,point.y);
  await expect(page.locator('.practice-countin')).toBeVisible();
  await context.close();
});

test('narrow portrait and landscape keep cue and transport in the viewport', async ({ page }) => {
  for (const viewport of [{width:320,height:568},{width:568,height:320}]) {
    await page.setViewportSize(viewport); await open(page); await page.locator('#start-button').click();
    for (const selector of ['.practice-string','#pause-button','#stop-button']) {
      const b=await page.locator(selector).boundingBox(); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y+b.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.locator('#pause-button').click();
    await expect(page.locator('#resume-button')).toBeInViewport();
  }
});

test('hidden invalid fret drafts have a visible recovery action', async ({ page }) => {
  await open(page); await page.locator('[data-popover-target="fret-range"]').click();
  await page.locator('#fret-from').fill('25'); await page.keyboard.press('Tab');
  await page.locator('[data-popover-target="targets"]').click();
  await expect(page.locator('#start-button')).toBeDisabled();
  await expect(page.locator('[data-popover-target="fret-range"]')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('.draft-recovery')).toContainText('Choose frets');
  await page.locator('.draft-recovery button').click(); await expect(page.locator('#fret-from')).toBeFocused();
  await page.locator('#fret-from').fill('3'); await page.keyboard.press('Tab');
  await expect(page.locator('#start-button')).toBeEnabled();
  await expect(page.locator('.draft-recovery')).toHaveCount(0);
});

test('keyboard opens editor directly and Done returns focus', async ({ page }) => {
  await open(page); const trigger=page.locator('[data-popover-target="bpm"]');
  await trigger.focus(); await page.keyboard.press('Enter'); await expect(page.locator('#bpm')).toBeFocused();
  await page.locator('[data-close-editor]:visible').click(); await expect(trigger).toBeFocused();
});

test('paused and completed tempo edits preserve sequence and reject invalid drafts', async ({ page }) => {
  await open(page); await page.locator('[data-preset="clear"]').click();
  for(const label of ['C','D']) await page.locator(`[data-note-label="${label}"]`).click();
  await tempo(page,240); await page.locator('#start-button').click();
  await page.locator('.practice-running').waitFor(); await page.locator('#pause-button').click();
  const order=await page.locator('.progress-label').allTextContents();
  const cue=await page.locator('.practice-cue-row').innerText();
  await tempo(page,180); await expect(page.locator('.practice-paused')).toBeVisible();
  expect(await page.locator('.progress-label').allTextContents()).toEqual(order);
  expect(await page.locator('.practice-cue-row').innerText()).toBe(cue);
  await page.locator('#resume-button').click();
  await page.waitForTimeout(800); await expect(page.locator('.practice-context')).toContainText('180');
  await page.locator('.practice-done').waitFor();
  await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill('19');
  await page.locator('#same-order-button').click(); await expect(page.locator('.practice-done')).toBeVisible();
  await expect(page.locator('[role="alert"]:visible').first()).toContainText('Choose a BPM');
  await page.locator('[data-popover-target="bpm"]').click(); await page.locator('#bpm').fill('200'); await page.keyboard.press('Enter');
  await expect(page.locator('.practice-done')).toBeVisible(); await page.locator('#same-order-button').click();
  expect(await page.locator('.progress-label').allTextContents()).toEqual(order);
  await expect(page.locator('.practice-context')).toContainText('200');
});

test('grouped note labels fit their touch targets with enlarged text', async ({ page }) => {
  await page.setViewportSize({width:320,height:568}); await open(page);
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await expect(page.locator('.note-group')).toHaveCount(7);
  expect(await page.locator('.note-pill').count()).toBe(21);
  const overflow=await page.locator('.note-pill').evaluateAll(es=>es.filter(e=>{
    const r=e.getBoundingClientRect(), range=document.createRange(); range.selectNodeContents(e); const t=range.getBoundingClientRect();
    return t.left<r.left || t.right>r.right || t.top<r.top || t.bottom>r.bottom;
  }).map(e=>e.textContent));
  expect(overflow).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('tempo edits cancel pending Resume and Repeat without losing the round', async ({ page }) => {
  await page.addInitScript(() => {
    const Native=window.AudioContext;
    window.AudioContext=class extends Native {
      get state(){ return window.holdResume ? 'suspended' : super.state; }
      resume(){ return window.holdResume ? new Promise(resolve=>{window.finishResume=resolve;}) : super.resume(); }
    };
  });
  await open(page); await page.locator('[data-preset="clear"]').click(); await page.locator('[data-note-label="C"]').click(); await tempo(page,240);
  await page.locator('#start-button').click(); await page.locator('#pause-button').click();
  const order=await page.locator('.progress-label').allTextContents();
  await page.evaluate(()=>{window.holdResume=true;}); await page.locator('#resume-button').click();
  await expect(page.locator('#resume-button')).toBeDisabled();
  await tempo(page,200);
  await page.evaluate(()=>{window.holdResume=false;window.finishResume();});
  await expect(page.locator('.practice-paused')).toBeVisible(); await expect(page.locator('#resume-button')).toBeEnabled();
  expect(await page.locator('.progress-label').allTextContents()).toEqual(order);
  await page.locator('#resume-button').click(); await expect(page.locator('.practice-countin')).toBeVisible();
  await expect(page.locator('.practice-context')).toContainText('200');
  await page.locator('.practice-done').waitFor();
  await page.evaluate(()=>{window.holdResume=true;}); await page.locator('#same-order-button').click();
  await expect(page.locator('#same-order-button')).toBeDisabled(); await tempo(page,180);
  await page.evaluate(()=>{window.holdResume=false;window.finishResume();});
  await expect(page.locator('.practice-done')).toBeVisible(); await expect(page.locator('#same-order-button')).toBeEnabled();
  await page.locator('#same-order-button').click(); expect(await page.locator('.progress-label').allTextContents()).toEqual(order);
  await expect(page.locator('.practice-context')).toContainText('180');
});

test('enlarged tempo and transport labels remain inside controls; help stays native', async ({ page }) => {
  await page.setViewportSize({width:320,height:568}); await open(page);
  await page.locator('.quick-help > summary').focus(); await page.keyboard.press('Space');
  await expect(page.locator('.quick-help')).toHaveAttribute('open',''); await expect(page.locator('.prompt-deck')).toBeVisible();
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  async function contained(){
    expect(await page.locator('button:visible').evaluateAll(es=>es.filter(e=>!e.childElementCount).filter(e=>{
      const box=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const text=range.getBoundingClientRect();
      return text.left<box.left-.5||text.right>box.right+.5;
    }).map(e=>e.textContent))).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.locator('[data-popover-target="bpm"]').click(); await contained();
  expect(await page.locator('#bpm').evaluate(e=>e.clientWidth>=e.scrollWidth)).toBe(true);
  await page.locator('[data-close-editor]:visible').click(); await page.locator('#start-button').click(); await page.locator('#pause-button').click(); await contained();
});
