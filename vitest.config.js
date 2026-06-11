import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the unit tests in tests/ — e2e/*.spec.js belongs to Playwright,
    // which vitest's default include pattern would otherwise pick up.
    include: ['tests/**/*.test.js'],
  },
});
