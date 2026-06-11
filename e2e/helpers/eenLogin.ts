import type { Page } from '@playwright/test';

/**
 * Drive the EEN Identity Provider's two-step login form:
 * email -> "Next" -> password -> submit.
 *
 * THE single place for IdP selectors — used by e2e/auth.setup.ts (dev/CI
 * suite) and e2e-live/live.spec.js (post-deploy verification). If EEN
 * changes their login page, fix it here.
 *
 * Selector notes (from live inspection): step 1 has THREE submit buttons
 * (Next / Microsoft / Google), so "Next" is targeted by accessible name;
 * step 2's submit matches /sign in/i.
 */
export async function loginToEen(page: Page, user: string, password: string): Promise<void> {
  const email = page.locator('input[name="email"], input[type="email"]').first();
  await email.waitFor({ timeout: 30_000 });
  await email.fill(user);
  await page.getByRole('button', { name: /next/i }).click();

  const pwd = page.locator('input[type="password"]').first();
  await pwd.waitFor({ timeout: 30_000 });
  await pwd.fill(password);
  await page.getByRole('button', { name: /sign in|log ?in|submit|next/i }).first().click();
}
