import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Device spread first so the explicit settings below always win.
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npx vite --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Production-base smoke target: build with base /sphere/ and serve the
      // dist via vite preview (base comes from vite.config.js + SPHERE_BASE).
      command: 'SPHERE_BASE=/sphere/ npx vite build && SPHERE_BASE=/sphere/ npx vite preview --port 4173',
      url: 'http://localhost:4173/sphere/',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
