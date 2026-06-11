import { defineConfig, devices } from '@playwright/test';

// E2E verification against the LIVE deployed site (GitHub Pages).
// No webServer — the target must already be deployed. Override the target
// with LIVE_BASE_URL (the deploy workflow passes the actual page_url).
const base = process.env.LIVE_BASE_URL || 'https://klaushofrichter.github.io/sphere/';

export default defineConfig({
  testDir: 'e2e-live',
  timeout: 60_000,
  retries: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: base.endsWith('/') ? base : `${base}/`,
    viewport: { width: 1280, height: 720 },
    // The live journey types real credentials; a trace would record them.
    // Local runs may keep traces (never uploaded).
    trace: process.env.CI ? 'off' : 'on-first-retry',
  },
});
