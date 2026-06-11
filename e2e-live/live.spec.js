import { test, expect } from '@playwright/test';
import { loginToEen } from '../e2e/helpers/eenLogin';

// Post-deployment verification: a single authenticated journey against the
// live GitHub Pages site. The production build has no test hook, so settling
// uses fixed waits. IdP form interaction lives in e2e/helpers/eenLogin.ts
// (shared with the dev/CI auth setup).

const CENTER = { x: 640, y: 360 };
const SETTLE_MS = 5_000;
// Post-login URL expectation derives from the configured target so the spec
// follows LIVE_BASE_URL instead of hardcoding the production host.
const LIVE_BASE = (process.env.LIVE_BASE_URL || 'https://klaushofrichter.github.io/sphere/')
  .replace(/\/$/, '');

async function canvasShot(page) {
  return page.locator('canvas').screenshot();
}

test('live site requires EEN sign-in and serves the gallery after login', async ({ page }) => {
  test.setTimeout(240_000);
  const user = process.env.TEST_USER;
  const password = process.env.TEST_PASSWORD;
  if (!user || !password) throw new Error('TEST_USER / TEST_PASSWORD not set');

  // Asset failures (e.g. a broken --base path) are collected for the whole
  // journey and asserted once the gallery has rendered.
  const failedAssets = [];
  page.on('requestfailed', (req) => {
    if (req.url().includes('/assets/')) failedAssets.push(req.url());
  });

  await test.step('login view renders (an accidentally-open deployment fails here)', async () => {
    const response = await page.goto('./');
    expect(response.ok()).toBe(true);
    await expect(page.getByTestId('login-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  await test.step('real EEN login', async () => {
    await page.getByTestId('login-button').click();
    await loginToEen(page, user, password);

    await page.waitForURL((url) => url.href.startsWith(LIVE_BASE), { timeout: 60_000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  });

  await test.step('gallery responds to drag', async () => {
    await page.waitForTimeout(SETTLE_MS); // intro + lerp tail
    expect(failedAssets).toEqual([]);
    const before = await canvasShot(page);
    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.down();
    await page.mouse.move(CENTER.x - 400, CENTER.y - 150, { steps: 15 });
    await page.mouse.up();
    const after = await canvasShot(page);
    expect(after.equals(before)).toBe(false);
  });

  await test.step('sign out returns to the login view and clears the session', async () => {
    await page.waitForTimeout(1_500); // let momentum settle before clicking the chip
    await page.getByTestId('signout-button').click();
    await expect(page.getByTestId('login-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});
