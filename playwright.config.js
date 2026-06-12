import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Playwright's node process doesn't read .env (only Vite does). Load the
// test credentials from it for local runs; real env vars (CI) win.
const fileEnv = loadEnv('', process.cwd(), '');
process.env.TEST_USER ??= fileEnv.TEST_USER;
process.env.TEST_PASSWORD ??= fileEnv.TEST_PASSWORD;
process.env.VITE_PROXY_URL ??= fileEnv.VITE_PROXY_URL;
process.env.VITE_EEN_CLIENT_ID ??= fileEnv.VITE_EEN_CLIENT_ID;

if (!process.env.VITE_PROXY_URL || !process.env.VITE_EEN_CLIENT_ID
    || !process.env.TEST_USER || !process.env.TEST_PASSWORD) {
  throw new Error(
    'e2e requires VITE_PROXY_URL, VITE_EEN_CLIENT_ID, TEST_USER and TEST_PASSWORD '
    + '(from .env locally, from secrets in CI). Open mode no longer exists.',
  );
}

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
  // Trace policy: setup and authenticated projects must not expose credentials
  // or session tokens in CI artifacts. setup fills the password (trace: off
  // always). gallery (auth) and signout carry session tokens (trace: off in CI,
  // on-first-retry locally). Unauthenticated projects inherit the top-level
  // trace setting (on-first-retry), which is safe.
  projects: [
    // Real EEN login once per run; saves session for the gallery project.
    // trace: off — this project fills the password; never record it.
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { trace: 'off' } },
    {
      name: 'gallery',
      testMatch: /gallery\.spec\.js/,
      dependencies: ['setup'],
      // Session token in storageState; allow traces locally, not in CI.
      use: { storageState: 'playwright/.auth/user.json', trace: process.env.CI ? 'off' : 'on-first-retry' },
    },
    // Guard spec runs WITHOUT stored auth state.
    { name: 'auth', testMatch: /auth\.spec\.ts/ },
    // Sign-out revokes the shared session, so it must run after gallery.
    {
      name: 'signout',
      testMatch: /signout\.spec\.ts/,
      dependencies: ['setup', 'gallery'],
      // retries: 0 — a retried signout starts with a revoked session and
      // fails misleadingly; disable retries for this project.
      retries: 0,
      // Session token in storageState; allow traces locally, not in CI.
      use: { storageState: 'playwright/.auth/user.json', trace: process.env.CI ? 'off' : 'on-first-retry' },
    },
  ],
});
