import { test as setup, expect } from '@playwright/test';
import { loginToEen } from './helpers/eenLogin';

const AUTH_FILE = 'playwright/.auth/user.json';

// Drives the real EEN Identity Provider login with the test account.
// IdP form interaction lives in helpers/eenLogin.ts (shared with the
// post-deploy live verification).
setup('authenticate against EEN', async ({ page }) => {
  setup.setTimeout(180_000);
  const user = process.env.TEST_USER;
  const password = process.env.TEST_PASSWORD;
  if (!user || !password) throw new Error('TEST_USER / TEST_PASSWORD not set');

  await page.goto('/');
  await page.getByTestId('login-button').click();
  await loginToEen(page, user, password);

  // Back at the app: callback completes and the gallery mounts.
  await page.waitForURL(/127\.0\.0\.1:3333/, { timeout: 60_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
