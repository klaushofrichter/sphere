import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Playwright's node process doesn't read .env (only Vite does). Load the
// test credentials from it for local runs; real env vars (CI) win.
const fileEnv = loadEnv('', process.cwd(), '');
process.env.TEST_USER ??= fileEnv.TEST_USER;
process.env.TEST_PASSWORD ??= fileEnv.TEST_PASSWORD;

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
  projects: [
    // Real EEN login once per run; saves session for the gallery project.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Existing gallery suite runs authenticated via the saved session.
    {
      name: 'gallery',
      testMatch: /gallery\.spec\.js/,
      dependencies: ['setup'],
      use: { storageState: 'playwright/.auth/user.json' },
    },
    // Guard spec runs WITHOUT stored auth state.
    { name: 'auth', testMatch: /auth\.spec\.ts/ },
    // Sign-out revokes the shared session, so it must run after gallery.
    {
      name: 'signout',
      testMatch: /signout\.spec\.ts/,
      dependencies: ['setup', 'gallery'],
      use: { storageState: 'playwright/.auth/user.json' },
    },
  ],
});
