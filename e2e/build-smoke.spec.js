import { test, expect } from '@playwright/test';

// Smoke test against the PRODUCTION build served under the GitHub Pages base
// path (/sphere/). Catches base-path regressions the dev-server tests can't.
test.use({ baseURL: 'http://localhost:4173' });

test('production build serves the gallery under /sphere/', async ({ page }) => {
  const failedAssets = [];
  page.on('requestfailed', (req) => {
    if (req.url().includes('/assets/')) failedAssets.push(req.url());
  });

  const response = await page.goto('/sphere/');
  expect(response.ok()).toBe(true);

  await page.waitForLoadState('networkidle');
  await expect(page.locator('canvas')).toBeVisible();
  expect(failedAssets).toEqual([]);

  // A gallery image must resolve under the production base path.
  const img = await page.request.get('/sphere/assets/img-0.jpg');
  expect(img.ok()).toBe(true);
  expect(img.headers()['content-type']).toContain('image');
});
