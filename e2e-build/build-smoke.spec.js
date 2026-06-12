import { test, expect } from '@playwright/test';

// Production-build smoke under the GitHub Pages base path: the auth-gated
// login view must render and the hashed bundle must load. Built with dummy
// auth env (deterministic, secret-free); login itself is never attempted.
test.use({ baseURL: 'http://localhost:4173' });

test('production build serves the login view under /sphere/', async ({ page }) => {
  const failed = [];
  page.on('requestfailed', (req) => failed.push(req.url()));

  const response = await page.goto('/sphere/');
  expect(response.ok()).toBe(true);

  await expect(page.getByTestId('login-view')).toBeVisible();
  await expect(page.getByTestId('login-button')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(failed).toEqual([]);
});
