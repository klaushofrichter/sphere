import { test, expect } from '@playwright/test';

// Post-deployment verification against the live GitHub Pages site.
// The production build has no window.__sphere test hook, so settling is a
// generous fixed wait (intro is 1.8s + lerp tail) instead of state polling.

const CENTER = { x: 640, y: 360 };
const SETTLE_MS = 5_000;

async function canvasShot(page) {
  return page.locator('canvas').screenshot();
}

async function openLiveGallery(page) {
  const failedAssets = [];
  page.on('requestfailed', (req) => {
    if (req.url().includes('/assets/')) failedAssets.push(req.url());
  });
  const response = await page.goto('./', { waitUntil: 'networkidle' });
  expect(response.ok()).toBe(true);
  await page.waitForTimeout(SETTLE_MS);
  return failedAssets;
}

test('live site loads and renders the gallery', async ({ page }) => {
  const failedAssets = await openLiveGallery(page);

  await expect(page.locator('canvas')).toBeVisible();
  expect(failedAssets).toEqual([]);

  // Not a flat fill: center (cards) must differ from corner (vignette).
  const center = await page.screenshot({ clip: { x: 540, y: 260, width: 200, height: 200 } });
  const corner = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 200 } });
  expect(center.equals(corner)).toBe(false);
});

test('live site responds to drag', async ({ page }) => {
  await openLiveGallery(page);
  const before = await canvasShot(page);

  await page.mouse.move(CENTER.x, CENTER.y);
  await page.mouse.down();
  await page.mouse.move(CENTER.x - 400, CENTER.y - 150, { steps: 15 });
  await page.mouse.up();

  const after = await canvasShot(page);
  expect(after.equals(before)).toBe(false);
});

test('live site opens and closes the detail overlay', async ({ page }) => {
  await openLiveGallery(page);

  await page.mouse.move(CENTER.x, CENTER.y);
  await expect(
    page.locator('body'),
    'no card under the viewport center on the live site',
  ).toHaveClass(/hover-card/);

  await page.mouse.down();
  await page.mouse.up();

  const overlay = page.locator('#overlay');
  await expect(overlay).toBeVisible();
  await expect(page.locator('#overlay-title')).not.toBeEmpty();

  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
});
