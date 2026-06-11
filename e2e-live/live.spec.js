import { test, expect } from '@playwright/test';

// Post-deployment verification: a single authenticated journey against the
// live GitHub Pages site. The production build has no test hook, so settling
// uses fixed waits. IdP selectors mirror e2e/auth.setup.ts (kept in sync
// deliberately — if EEN changes their login page, fix both).

const CENTER = { x: 640, y: 360 };
const SETTLE_MS = 5_000;

async function canvasShot(page) {
  return page.locator('canvas').screenshot();
}

test('live site requires EEN sign-in and serves the gallery after login', async ({ page }) => {
  test.setTimeout(240_000);
  const user = process.env.TEST_USER;
  const password = process.env.TEST_PASSWORD;
  if (!user || !password) throw new Error('TEST_USER / TEST_PASSWORD not set');

  await test.step('login view renders (an accidentally-open deployment fails here)', async () => {
    const response = await page.goto('./');
    expect(response.ok()).toBe(true);
    await expect(page.getByTestId('login-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  await test.step('real EEN login', async () => {
    await page.getByTestId('login-button').click();

    const email = page.locator('input[name="email"], input[type="email"]').first();
    await email.waitFor({ timeout: 30_000 });
    await email.fill(user);
    await page.getByRole('button', { name: /next/i }).click();

    const pwd = page.locator('input[type="password"]').first();
    await pwd.waitFor({ timeout: 30_000 });
    await pwd.fill(password);
    await page.getByRole('button', { name: /sign in|log ?in|submit|next/i }).first().click();

    await page.waitForURL(/klaushofrichter\.github\.io\/sphere/, { timeout: 60_000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  });

  await test.step('gallery responds to drag', async () => {
    await page.waitForTimeout(SETTLE_MS); // intro + lerp tail
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
