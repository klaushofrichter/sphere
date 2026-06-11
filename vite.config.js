import { defineConfig } from 'vite';

// Base path is '/' for local dev. Deployment and the e2e build-smoke test set
// SPHERE_BASE=/sphere/ (the GitHub Pages subpath). The deploy workflow's
// `vite build --base=/sphere/` CLI flag overrides this and stays valid.
export default defineConfig({
  base: process.env.SPHERE_BASE || '/',
});
