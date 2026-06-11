import { test, expect } from '@playwright/test';

test('signing out returns to the login view', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('signout-button')).toBeVisible({ timeout: 30_000 });
  // Email comes from getCurrentUser(); soft so an EEN API hiccup doesn't
  // fail the sign-out test itself.
  await expect.soft(page.getByTestId('user-email')).not.toBeEmpty({ timeout: 30_000 });

  await page.getByTestId('signout-button').click();
  await expect(page.getByTestId('login-view')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('canvas')).toHaveCount(0);
});
