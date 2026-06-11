import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'playwright/.auth/user.json';

// Drives the real EEN Identity Provider login with the test account.
// The IdP is a two-step form: email + "Next", then password + submit.
// Three submit buttons exist on step 1 (Next / Microsoft / Google), so the
// Next button is targeted by accessible name. If EEN changes their login
// page, fix the selectors here.
setup('authenticate against EEN', async ({ page }) => {
  setup.setTimeout(180_000);
  const user = process.env.TEST_USER;
  const password = process.env.TEST_PASSWORD;
  if (!user || !password) throw new Error('TEST_USER / TEST_PASSWORD not set');

  await page.goto('/');
  await page.getByTestId('login-button').click();

  const email = page.locator('input[name="email"], input[type="email"]').first();
  await email.waitFor({ timeout: 30_000 });
  await email.fill(user);
  await page.getByRole('button', { name: /next/i }).click();

  const pwd = page.locator('input[type="password"]').first();
  await pwd.waitFor({ timeout: 30_000 });
  await pwd.fill(password);
  await page.getByRole('button', { name: /sign in|log ?in|submit|next/i }).first().click();

  // Back at the app: callback completes and the gallery mounts.
  await page.waitForURL(/127\.0\.0\.1:3333/, { timeout: 60_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
