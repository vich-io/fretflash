import { test, expect } from '@playwright/test';

const title = 'FretFlash — free guitar fretboard trainer';
const description = 'Practice guitar fretboard note recall with click-paced prompts. Choose notes, strings, tuning and fret range, then find each note in time.';

test.describe('initial HTML', () => {
  test.use({ javaScriptEnabled: false });
  test('search and sharing work without JavaScript', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(title);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('fretflash.');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://fretflash.vich.io/');
    for (const [name, value] of Object.entries({ description, 'twitter:title': title, 'twitter:description': description, 'twitter:card': 'summary_large_image' })) {
      await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute('content', value);
    }
    for (const [property, value] of Object.entries({ 'og:title': title, 'og:description': description, 'og:type': 'website', 'og:site_name': 'FretFlash', 'og:url': 'https://fretflash.vich.io/', 'og:image': 'https://fretflash.vich.io/assets/share-card.png' })) {
      await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute('content', value);
    }
    expect(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'FretFlash', url: 'https://fretflash.vich.io/' });
    for (const [selector, dimensions] of [['meta[property="og:image"]', [1200, 630]], ['link[rel="icon"][type="image/png"]', [192, 192]]]) {
      const source = await page.locator(selector).getAttribute(selector.startsWith('meta') ? 'content' : 'href');
      const path = new URL(source, 'https://fretflash.vich.io/').pathname;
      const response = await page.request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
      const bytes = await response.body();
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(dimensions);
    }
  });

  test('the concise reference is real HTML and opens without JavaScript', async ({ page }) => {
    await page.goto('/');
    const help = page.locator('#quick-reference');
    await expect(help).toHaveCount(1);
    await expect(help).not.toHaveAttribute('open', '');
    await expect(help.locator('p').first()).toBeHidden();
    await help.locator(':scope > summary').click();
    await expect(help.locator('p').first()).toBeVisible();
    await expect(help).toContainText('four count-in clicks');
    await expect(help).toContainText('Fret 0 is the open string');
    await expect(help).toContainText('C# and Db');
    await expect(help).toContainText('every matching fret, lowest first');
    await expect(page.locator('#start-button')).toBeDisabled();
  });
});

test('startup keeps one heading/reference, help state and real transport', async ({ page }) => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/app.js*', async route => { await ready; await route.continue(); });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#quick-reference')).toHaveCount(1);
  } finally { release(); }
  await expect(page.locator('#start-button')).toBeEnabled();
  await expect(page.locator('h1')).toHaveCount(1);
  const help = page.locator('#quick-reference');
  await expect(help).toHaveCount(1);
  await help.locator(':scope > summary').focus();
  await page.keyboard.press('Space');
  await expect(help).toHaveAttribute('open', '');
  await page.locator('[data-note-label="C"]').click();
  await expect(help).toHaveAttribute('open', '');
  await help.locator('details summary').click();
  await page.locator('[data-note-label="C"]').click();
  await expect(help.locator('details')).toHaveAttribute('open', '');
  await page.locator('#start-button').click();
  await expect(page.locator('#pause-button')).toBeVisible();
  await expect(help).toHaveCount(0);
  await page.locator('#stop-button').click();
  await expect(help).toHaveCount(1);
  await expect(help).not.toHaveAttribute('open', '');
  await expect(page.locator('h1')).toHaveCount(1);
});

test('filename alias redirects permanently to the canonical root', async ({ request }) => {
  const response = await request.get('/index.html', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe('/');
});
