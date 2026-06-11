import { defineConfig, devices } from '@playwright/test';

// Dev-server e2e suite (e2e/). The production-build smoke test lives in
// e2e-build/ with its own config (playwright.build.config.js) so these runs
// don't pay for a vite build. The live-site suite is playwright.live.config.js.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Device spread first so the explicit settings below always win.
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3333',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx vite',
    url: 'http://127.0.0.1:3333',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
