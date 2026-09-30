import { test, expect } from '@playwright/test';

async function open(page, width=320, height=480) {
  await page.setViewportSize({width,height}); await page.goto('/');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.evaluate(()=>document.fonts.ready);
}
async function textFits(page) {
  const failures=await page.locator('.drill-cell').evaluateAll(cells=>{
    const failed=[];
    const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    for(const cell of cells) {
      const box=cell.getBoundingClientRect();
      const groups=[...cell.children].map(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].filter(r=>r.width>0&&r.height>0);});
      for(let i=0;i<groups.length;i++)for(const rect of groups[i]) {
        if(rect.left<box.left-1||rect.right>box.right+1)failed.push(`${cell.textContent}: escaped cell`);
        for(let j=i+1;j<groups.length;j++)if(groups[j].some(other=>overlaps(rect,other)))failed.push(`${cell.textContent}: collision`);
      }
    }
    return failed;
  });
  expect(failures).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test('reserved Start survives native scrolling, late-note selection and edits',async({browser,baseURL},info)=>{
  for(const [width,height] of [[320,480],[320,568],[360,640],[375,667],[390,844],[430,932]]) {
    const context=await browser.newContext({baseURL,viewport:{width,height},hasTouch:true,isMobile:true});
    const page=await context.newPage();await open(page,width,height);
    await expect(page.locator('.setup-scroll')).toHaveCount(1);
    const before=await page.locator('#start-button').boundingBox();
    await page.screenshot({path:info.outputPath(`${width}x${height}-opening.png`)});
    const scroll=await page.locator('.setup-scroll').boundingBox();
    await page.mouse.move(scroll.x+scroll.width/2,scroll.y+scroll.height/2);await page.mouse.wheel(0,1200);
    if(width<=375)await expect.poll(()=>page.locator('.setup-scroll').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
    const late=page.locator('[data-note-label="B#"]'),pressed=await late.getAttribute('aria-pressed');
    await late.tap();await expect(late).toHaveAttribute('aria-pressed',pressed==='true'?'false':'true');
    expect(await page.locator('#start-button').boundingBox()).toEqual(before);
    expect(before.y+before.height).toBeLessThanOrEqual(height-8);
    await page.screenshot({path:info.outputPath(`${width}x${height}-scrolled.png`)});
    await page.locator('[data-popover-target="fret-range"]').tap();await page.locator('#fret-to').fill('15');
    await page.locator('[data-close-editor]:visible').tap();expect(await page.locator('#start-button').boundingBox()).toEqual(before);
    await page.locator('[data-preset="clear"]').tap();await page.locator('[data-note-label="C"]').tap();
    await page.touchscreen.tap(before.x+before.width/2,before.y+before.height/2);
    await page.locator('#pause-button').tap();await page.locator('#resume-button').tap();await page.locator('#stop-button').tap();
    await context.close();
  }
});

test('compact fields fit painted text at breakpoints and enlarged seven-string labels',async({page})=>{
  for(const [w,h] of [[320,480],[387,667],[388,667],[389,667],[719,800],[720,800],[721,800]]) {await open(page,w,h);await textFits(page);}
  for(const [w,h] of [[320,480],[320,568],[568,320],[390,844]]) {
    await open(page,w,h);await page.evaluate(()=>document.documentElement.style.fontSize='200%');await textFits(page);
    expect(await page.locator('.setup-scroll').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(384);
    await page.locator('[data-popover-target="tuning"]').click();await page.locator('[data-tuning-id="standard-7"]').click();
    await page.locator('[data-close-editor]:visible').click();await textFits(page);
    for(const note of ['C','F#','B#'])await page.locator(`[data-note-label="${note}"]`).click();
    await page.locator('#start-button').click();await page.locator('#stop-button').click();await textFits(page);
  }
});

test('native touch and keyboard scrolling reveal notes without moving Start',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:320,height:480},hasTouch:true,isMobile:true});
  const page=await context.newPage();await open(page);const before=await page.locator('#start-button').boundingBox();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y:300}]});
  for(let y=280;y>=80;y-=20){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:160,y}]});await page.waitForTimeout(30);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>page.locator('.setup-scroll').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('#start-button').boundingBox()).toEqual(before);
  await page.reload();await expect(page.locator('#start-button')).toBeEnabled();let reached=false;
  for(let i=0;i<45;i++){await page.keyboard.press('Tab');if(await page.locator('[data-note-label="B#"]').evaluate(e=>e===document.activeElement)){reached=true;break;}}
  expect(reached).toBe(true);expect(await page.locator('#start-button').boundingBox()).toEqual(before);
  await page.keyboard.press('Tab');await expect(page.locator('#start-button')).toBeFocused();await context.close();
});

test('short enlarged setup keeps invalid-draft recovery and help reachable',async({page},info)=>{
  await open(page);await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await page.locator('[data-popover-target="fret-range"]').click();await page.locator('#fret-to').fill('-1');
  await page.locator('[data-close-editor]:visible').click();await expect(page.locator('#start-button')).toBeDisabled();
  await page.locator('[data-recover-editor="fret-range"]').click();await page.locator('#fret-to').fill('12');
  await page.locator('[data-close-editor]:visible').click();await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('#quick-reference > summary').click();await page.locator('#quick-reference details > summary').click();
  await expect(page.locator('#quick-reference details p').last()).toBeVisible();
  await page.screenshot({path:info.outputPath('enlarged-help.png'),fullPage:true});
  await page.locator('#quick-reference > summary').click();await page.locator('#start-button').click();await page.locator('#stop-button').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
