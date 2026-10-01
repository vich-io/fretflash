import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

// Development-only export; the browser app still has no build step.
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/sbin/chromium') ? '/usr/sbin/chromium' : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(new URL('share-card.html', import.meta.url).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
  await page.screenshot({ path: new URL('../assets/share-card.png', import.meta.url).pathname });
  await page.setViewportSize({ width: 192, height: 192 });
  await page.setContent('<body style="margin:0;background:#191919"><img style="width:192px;height:192px" alt=""></body>');
  await page.locator('img').evaluate((image, source) => { image.src = source; }, new URL('../assets/icons/fretflash-six-line-f.svg', import.meta.url).href);
  await page.locator('img').evaluate(image => image.decode());
  await page.screenshot({ path: new URL('../assets/icons/fretflash-192.png', import.meta.url).pathname });
  console.log('Exported share-card.png (1200×630) and fretflash-192.png (192×192).');
  for (const [name, size, art] of [['fretflash-512.png', 512, 512], ['fretflash-maskable-512.png', 512, 400], ['fretflash-apple-180.png', 180, 180]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:#191919;height:100vh;display:grid;place-items:center"><img style="width:${art}px;height:${art}px" alt=""></body>`);
    await page.locator('img').evaluate((image, source) => { image.src = source; }, new URL('../assets/icons/fretflash-six-line-f.svg', import.meta.url).href);
    await page.locator('img').evaluate(image => image.decode());
    await page.screenshot({ path: new URL(`../assets/icons/${name}`, import.meta.url).pathname });
    console.log(`Exported ${name} (${size}×${size}).`);
  }
} finally { await browser.close(); }
