import { defineConfig } from '@playwright/test';
import { reporter, baseUse } from './playwright.shared.js';

// Smoke test against the PRODUCTION build under the GitHub Pages base path.
// Separate config so regular dev e2e runs (playwright.config.js) don't pay
// for a vite build; CI runs both via npm run test:e2e && test:e2e:build.
export default defineConfig({
  testDir: 'e2e-build',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter,
  use: {
    ...baseUse,
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'VITE_PROXY_URL=https://smoke.invalid VITE_EEN_CLIENT_ID=smoke ' +
      'SPHERE_BASE=/sphere/ npx vite build && SPHERE_BASE=/sphere/ npx vite preview --port 4173',
    url: 'http://localhost:4173/sphere/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
