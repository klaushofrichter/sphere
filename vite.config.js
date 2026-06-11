import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Base path is '/' for local dev. Deployment and the e2e build-smoke test set
// SPHERE_BASE=/sphere/ (the GitHub Pages subpath). The deploy workflow's
// `vite build --base=/sphere/` CLI flag overrides this and stays valid.
export default defineConfig({
  base: process.env.SPHERE_BASE || '/',
  plugins: [vue()],
  server: {
    // EEN OAuth requires the exact redirect URI http://127.0.0.1:3333 —
    // the IdP rejects localhost and other ports.
    host: '127.0.0.1',
    port: 3333,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
  },
});
