import { devices } from '@playwright/test';

// Settings shared by all three Playwright configs (dev, build-smoke, live).

export const reporter = process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list';

export const baseUse = {
  // Device spread first so explicit settings always win.
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 720 },
};
