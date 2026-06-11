import { test, expect } from '@playwright/test';

test('unauthenticated visitors get the login view and no gallery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-view')).toBeVisible();
  await expect(page.getByTestId('login-button')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('a bogus oauth callback shows an error on the login view', async ({ page }) => {
  await page.goto('/?error=access_denied');
  await expect(page.getByTestId('login-error')).toContainText('access_denied');
  await expect(page.locator('canvas')).toHaveCount(0);
});
