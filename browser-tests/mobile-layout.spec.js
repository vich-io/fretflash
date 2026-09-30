import { test, expect } from '@playwright/test';

async function open(page, width=320, height=568) {
  await page.setViewportSize({width,height}); await page.goto('/');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.evaluate(()=>document.fonts.ready);
}
async function inScreen(page, selector, clearance=8) {
  const b=await page.locator(selector).boundingBox();
  expect(b.y,selector).toBeGreaterThanOrEqual(0);
  expect(b.y+b.height,selector).toBeLessThanOrEqual((await page.evaluate(()=>innerHeight))-clearance);
}
async function documentBox(page,selector) {
  return page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};});
}

test('default phone setup exposes Start without scrolling and keeps every setting',async({page},info)=>{
  for(const [w,h] of [[320,480],[320,568],[351,640],[352,640],[353,640],[360,640],[375,667],[387,667],[388,667],[389,667],[390,844],[430,932]]){
    await open(page,w,h);await page.screenshot({path:info.outputPath(`${w}x${h}-setup.png`)});
    expect(await page.evaluate(()=>scrollY)).toBe(0);await inScreen(page,'#start-button');
    await expect(page.locator('.drill-cell')).toHaveCount(5);await expect(page.locator('.note-pill')).toHaveCount(21);
    expect(await page.evaluate(()=>Boolean(document.querySelector('.note-pill').compareDocumentPosition(document.querySelector('#start-button'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const toolRows=await page.locator('.deck-tools button').evaluateAll(es=>new Set(es.map(e=>e.getBoundingClientRect().y)).size);
    expect(toolRows).toBe(1);
  }
});

test('short portrait and landscape transport survives expanded setup details',async({page},info)=>{
  for(const [w,h] of [[320,480],[320,568],[375,650],[375,651],[375,667],[375,700],[375,701],[568,320]]){
    await open(page,w,h);await page.locator('#start-button').click();
    await page.locator('#pause-button').waitFor();await inScreen(page,'#pause-button');await inScreen(page,'#stop-button');
    const before=await documentBox(page,'#pause-button');await page.locator('.context-details > summary').click();
    // Tall layout retains its original context-above-cue composition.
    if(h>700){await page.locator('#stop-button').click();continue;}
    expect(await documentBox(page,'#pause-button')).toEqual(before);
    await page.evaluate(()=>scrollTo(0,0));await inScreen(page,'#pause-button');await inScreen(page,'#stop-button');
    await page.screenshot({path:info.outputPath(`${w}x${h}-details.png`)});
    await page.locator('#pause-button').click();const paused=await documentBox(page,'#resume-button');
    expect(paused).toEqual(before);await page.locator('[data-popover-target="bpm"]').click();
    expect(await documentBox(page,'#resume-button')).toEqual(paused);
    await page.locator('[data-bpm="60"]').click();await page.locator('[data-close-editor]:visible').click();
    await inScreen(page,'#resume-button');await page.locator('#resume-button').click();await page.locator('#stop-button').click();
  }
});

test('pointer editors arrive in view and close restores their owner',async({page},info)=>{
  for(const id of ['bpm','fret-range','tuning','targets']){
    await open(page);await page.locator(`[data-popover-target="${id}"]`).click();
    const panel=await page.locator('.header-popover[data-open="true"]').boundingBox();
    if(id==='fret-range'||id==='tuning')expect(panel.y).toBeLessThanOrEqual((await page.locator('.setup-scroll').boundingBox()).y+24);
    await inScreen(page,'[data-close-editor]:visible');
    await page.screenshot({path:info.outputPath(`${id}-editor.png`)});
    const input=page.locator('.header-popover[data-open="true"] input').last();
    if(await input.count()){await input.click();await page.keyboard.press('Tab');await inScreen(page,'[data-close-editor]:visible');}
    await page.locator('[data-close-editor]:visible').click();
    await expect(page.locator(`[data-popover-target="${id}"]`)).toBeFocused();
    await inScreen(page,`[data-popover-target="${id}"]`,0);
  }
});

test('six strings stay together and seven strings have numbered deliberate rows',async({page},info)=>{
  await open(page);await page.locator('[data-popover-target="strings"]').click();
  const six=await page.locator('.string-chip').evaluateAll(es=>es.map(e=>({y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  expect(new Set(six.map(b=>b.y)).size).toBe(1);expect(six.every(b=>b.w>=44&&b.h>=44)).toBe(true);
  await page.screenshot({path:info.outputPath('six-strings.png')});
  await page.locator('[data-close-editor]:visible').click();await page.locator('[data-popover-target="tuning"]').click();
  await page.locator('[data-tuning-id="standard-7"]').click();await page.locator('[data-close-editor]:visible').click();
  await page.locator('[data-popover-target="strings"]').click();await expect(page.locator('.string-chip')).toHaveCount(7);
  await expect(page.locator('.string-number')).toHaveText(['7','6','5','4','3','2','1']);
  const ys=await page.locator('.string-chip').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));
  expect(ys.slice(0,4).every(y=>y===ys[0])).toBe(true);expect(ys.slice(4).every(y=>y===ys[4]&&y>ys[0])).toBe(true);
  await page.locator('[data-string-index="0"]').click();await expect(page.locator('[data-string-index="0"]')).toHaveAttribute('aria-pressed','false');
  await page.screenshot({path:info.outputPath('seven-strings.png')});
});

test('touch transport keeps its fixed coordinate across Pause and Resume',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:320,height:480},hasTouch:true,isMobile:true});
  const page=await context.newPage();await open(page,320,480);await page.locator('#start-button').tap();
  const box=await page.locator('#pause-button').boundingBox();const stop=await page.locator('#stop-button').boundingBox();
  const point={x:box.x+box.width/2,y:box.y+box.height/2};
  for(let i=0;i<4;i++){
    await page.touchscreen.tap(point.x,point.y);
    const selector=i%2===0?'#resume-button':'#pause-button';expect(await page.locator(selector).boundingBox()).toEqual(box);
    expect(await page.locator('#stop-button').boundingBox()).toEqual(stop);
  }
  await page.locator('#stop-button').tap();await context.close();
});

test('enlarged string targets fit and Done stays visible during editor scrolling',async({page},info)=>{
  await open(page);await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await page.locator('[data-popover-target="strings"]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const sizes=await page.locator('.string-chip').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  expect(sizes.every(b=>b.w>=44&&b.h>=44)).toBe(true);
  await page.locator('[data-close-editor]:visible').click();await page.locator('[data-popover-target="tuning"]').click();
  const scroll=await page.locator('.setup-scroll').boundingBox();
  const visibleTop=Math.max(0,scroll.y),visibleBottom=Math.min(568,scroll.y+scroll.height);
  expect(visibleBottom-visibleTop).toBeGreaterThan(44);
  const before=await page.locator('.setup-scroll').evaluate(e=>e.scrollTop);await page.mouse.move(160,(visibleTop+visibleBottom)/2);await page.mouse.wheel(0,300);
  await expect.poll(()=>page.locator('.setup-scroll').evaluate(e=>e.scrollTop)).toBeGreaterThan(before);
  await inScreen(page,'[data-close-editor]:visible');
  await page.screenshot({path:info.outputPath('sticky-done-large.png')});
  await page.locator('[data-close-editor]:visible').click();await expect(page.locator('[data-popover-target="tuning"]')).toBeFocused();
});

test('enlarged short layouts keep notes editors and transport reachable',async({page},info)=>{
  for(const [w,h] of [[320,480],[568,320]]){
    await open(page,w,h);await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const note of ['C','F#','B#'])await page.locator(`[data-note-label="${note}"]`).click();
    await page.locator('[data-popover-target="fret-range"]').click();await page.locator('#fret-to').fill('15');await page.keyboard.press('Enter');
    await page.locator('#start-button').click();await page.locator('#pause-button').click();
    await page.locator('[data-popover-target="bpm"]').click();await page.locator('[data-bpm="60"]').click();await page.locator('[data-close-editor]:visible').click();
    await page.locator('#resume-button').click();await page.locator('#stop-button').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`${w}x${h}-large.png`),fullPage:true});
  }
});
