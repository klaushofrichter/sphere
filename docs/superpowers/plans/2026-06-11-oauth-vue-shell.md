# OAuth + Vue 3 Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the sphere gallery behind EEN OAuth (een-oauth-proxy + een-api-toolkit) by converting the app shell to Vue 3, leaving the three.js gallery code untouched.

**Architecture:** Two-state Vue app (LoginView / GalleryView) with a build-time auth switch: auth is enabled iff `VITE_PROXY_URL` and `VITE_EEN_CLIENT_ID` exist at build time. The GitHub Pages build gets no env vars → open mode, unchanged public demo. The current `main.js` becomes `startGallery()/destroyGallery()` lifecycle functions called by a Vue component. Dev server moves to `http://127.0.0.1:3333` (EEN IdP exact redirect-URI match, callback on root path).

**Tech Stack:** vue@3, pinia@3, een-api-toolkit (^0.3.105), @vitejs/plugin-vue. New shell files are TypeScript; gallery files stay JS.

**Spec:** `docs/superpowers/specs/2026-06-11-oauth-vue-shell-design.md`

**Toolkit facts (from docs/ai-reference, v0.3.105):**
- `initEenToolkit({ proxyUrl, clientId, redirectUri, storageStrategy })` — call once in main.ts, AFTER `app.use(createPinia())`. `storageStrategy: 'localStorage'` persists the session; `useAuthStore().initialize()` must be called on app mount to restore it.
- `getAuthUrl()` → redirect target; `handleAuthCallback(code, state)` → `{data, error}`; `revokeToken()` logs out; `getCurrentUser()` → `{data: {email...}, error}`. Functions never throw.
- `useAuthStore()` exposes reactive `isAuthenticated`.

---

### Task 1: Dependencies, Vue plugin, port move to 127.0.0.1:3333

**Files:**
- Modify: `package.json` (+deps), `vite.config.js`, `playwright.config.js`, `e2e/gallery.spec.js` (no content change needed — baseURL comes from config)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/klaushofrichter/Development/sphere
npm install vue pinia een-api-toolkit
npm install -D @vitejs/plugin-vue
```

- [ ] **Step 2: Replace `vite.config.js`**

```js
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
```

- [ ] **Step 3: Update `playwright.config.js` (dev config) for the new origin**

Change the `use.baseURL` and `webServer` entries to:

```js
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
```

- [ ] **Step 4: Verify everything is still green (auth not wired yet)**

```bash
npm test                                              # 10 unit tests pass
VITE_PROXY_URL= VITE_EEN_CLIENT_ID= npm run test:e2e  # 7 gallery specs pass on the new port
npm run test:e2e:build                                # build smoke passes
```

(The env blanking is a no-op today but matches later tasks' open-mode runs.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js playwright.config.js
git commit -m "feat: add vue/pinia/een-api-toolkit deps, move dev server to 127.0.0.1:3333"
```

---

### Task 2: auth module (TDD for the pure parts)

**Files:**
- Create: `src/auth.ts`
- Modify: `vitest.config.js` (include .ts tests)
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Update `vitest.config.js` include pattern**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the unit tests in tests/ — e2e specs belong to Playwright,
    // which vitest's default include pattern would otherwise pick up.
    include: ['tests/**/*.test.{js,ts}'],
  },
});
```

- [ ] **Step 2: Write the failing test `tests/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isAuthEnabled, parseCallbackParams } from '../src/auth';

describe('isAuthEnabled', () => {
  it('requires both proxy url and client id', () => {
    expect(isAuthEnabled({ VITE_PROXY_URL: 'https://p', VITE_EEN_CLIENT_ID: 'c' })).toBe(true);
    expect(isAuthEnabled({ VITE_PROXY_URL: 'https://p' })).toBe(false);
    expect(isAuthEnabled({ VITE_EEN_CLIENT_ID: 'c' })).toBe(false);
    expect(isAuthEnabled({})).toBe(false);
    expect(isAuthEnabled({ VITE_PROXY_URL: '', VITE_EEN_CLIENT_ID: '' })).toBe(false);
  });
});

describe('parseCallbackParams', () => {
  it('returns null when no oauth params are present', () => {
    expect(parseCallbackParams('')).toBeNull();
    expect(parseCallbackParams('?foo=bar')).toBeNull();
  });

  it('extracts code and state', () => {
    expect(parseCallbackParams('?code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('reports an IdP-provided error', () => {
    expect(parseCallbackParams('?error=access_denied')).toEqual({
      error: 'OAuth error: access_denied',
    });
  });

  it('reports incomplete params as an error', () => {
    expect(parseCallbackParams('?code=abc')).toEqual({
      error: 'Missing authorization code or state parameter',
    });
    expect(parseCallbackParams('?state=xyz')).toEqual({
      error: 'Missing authorization code or state parameter',
    });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL — cannot resolve `../src/auth`.

- [ ] **Step 4: Write `src/auth.ts`**

```ts
// The ONLY module that imports een-api-toolkit. Components use these
// wrappers so the toolkit surface stays in one place.
import {
  initEenToolkit,
  getAuthUrl,
  handleAuthCallback,
  revokeToken,
  getCurrentUser,
  useAuthStore,
} from 'een-api-toolkit';

/** Pure check: auth is enabled iff both env values are non-empty. */
export function isAuthEnabled(env: Record<string, unknown>): boolean {
  return Boolean(env.VITE_PROXY_URL) && Boolean(env.VITE_EEN_CLIENT_ID);
}

export const authEnabled = isAuthEnabled(import.meta.env);

/** Call once from main.ts, after app.use(createPinia()). */
export function initAuth(): void {
  initEenToolkit({
    proxyUrl: import.meta.env.VITE_PROXY_URL,
    clientId: import.meta.env.VITE_EEN_CLIENT_ID,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    // localStorage so sessions survive reloads and Playwright can restore
    // them via storageState (the proxy keeps refresh tokens server-side).
    storageStrategy: 'localStorage',
  });
}

export type CallbackParams = { code: string; state: string } | { error: string } | null;

/** Pure parser for the OAuth callback query string. */
export function parseCallbackParams(search: string): CallbackParams {
  const p = new URLSearchParams(search);
  const err = p.get('error');
  if (err) return { error: `OAuth error: ${err}` };
  const code = p.get('code');
  const state = p.get('state');
  if (code && state) return { code, state };
  if (code || state) return { error: 'Missing authorization code or state parameter' };
  return null;
}

/** Redirect to the EEN Identity Provider. */
export function login(): void {
  window.location.href = getAuthUrl();
}

/**
 * Complete an OAuth callback if the URL carries one.
 * Returns an error message, or null when there was no callback / it succeeded.
 * Always cleans the query string from the URL.
 */
export async function completeCallback(): Promise<string | null> {
  const parsed = parseCallbackParams(window.location.search);
  if (!parsed) return null;
  history.replaceState(null, '', window.location.pathname);
  if ('error' in parsed) return parsed.error;
  const { error } = await handleAuthCallback(parsed.code, parsed.state);
  return error ? error.message : null;
}

/** Revoke the token (proxy clears the session) and reset auth state. */
export async function logout(): Promise<void> {
  await revokeToken();
}

/** One toolkit API call to prove end-to-end access; null on any error. */
export async function fetchUserEmail(): Promise<string | null> {
  const { data, error } = await getCurrentUser();
  return error ? null : ((data as { email?: string }).email ?? null);
}

export { useAuthStore };
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS — previous 10 plus the new auth tests (15 total).

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts tests/auth.test.ts vitest.config.js
git commit -m "feat: auth module wrapping een-api-toolkit with pure parsing helpers"
```

---

### Task 3: Gallery lifecycle refactor (startGallery / destroyGallery)

**Files:**
- Create: `src/galleryApp.js` (from the current `src/main.js` body)
- Modify: `src/main.js` (becomes a thin shim — deleted in Task 4), `src/controls.js`, `src/overlay.js`

The app must keep working unchanged after this task (the shim preserves today's
behavior); Vue arrives in Task 4.

- [ ] **Step 1: Add `dispose()` to `src/controls.js`**

In the constructor, store the handlers so they can be removed, and keep a
reference to the element:

```js
  constructor(el, onClick) {
    this.el = el;
    this.onClick = onClick;
    this.enabled = true;
    this.target = { x: 0, y: 0 };
    this.current = { x: 0, y: 0 };
    this.dragging = false;
    this.start = null;
    this.last = null;
    this.velocity = { x: 0, y: 0 };

    this._onDown = (e) => this.onDown(e);
    this._onMove = (e) => this.onMove(e);
    this._onUp = (e) => this.onUp(e);
    this._onCancel = () => this.cancel();

    el.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onCancel);
  }
```

And add after `cancel()`:

```js
  dispose() {
    this.el.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onCancel);
    gsap.killTweensOf(this.target);
    document.body.classList.remove('dragging');
  }
```

- [ ] **Step 2: Add `dispose()` to `src/overlay.js`**

Store the keydown handler in the constructor:

```js
    this._onKeydown = (e) => {
      if (e.key === 'Escape') this.close();
    };
    window.addEventListener('keydown', this._onKeydown);
```

(replacing the inline `window.addEventListener('keydown', ...)`), and add:

```js
  dispose() {
    window.removeEventListener('keydown', this._onKeydown);
    gsap.killTweensOf(this.el);
  }
```

- [ ] **Step 3: Create `src/galleryApp.js`**

Move the ENTIRE body of the current `src/main.js` into an async
`startGallery(container)` function with a module-level context for teardown.
The code is identical to today's main.js except: (a) wrapped in functions,
(b) the renderer canvas is appended to the passed `container` instead of
`#app`, (c) every listener/ticker registration is kept in `ctx` for removal:

```js
import * as THREE from 'three';
import { gsap } from 'gsap';
import { makeCards } from './data.js';
import { Gallery } from './gallery.js';
import { Controls } from './controls.js';
import { Overlay } from './overlay.js';

let ctx = null;

function loadImages(cards) {
  return Promise.all(cards.map((c) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = c.image;
  })));
}

export async function startGallery(container) {
  if (ctx) return; // already running

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(
    65, window.innerWidth / window.innerHeight, 0.1, 50,
  );

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  const cards = makeCards();
  const images = await loadImages(cards);

  const gallery = new Gallery(scene, cards, images);
  const overlay = new Overlay();

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerOnScreen = false;
  const onPointerMove = (e) => {
    pointerOnScreen = true;
    pointerNdc.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    );
  };
  window.addEventListener('pointermove', onPointerMove);

  function pick() {
    if (!pointerOnScreen) return null;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(gallery.meshes.filter((m) => m.visible));
    return hits.length ? hits[0].object : null;
  }

  const controls = new Controls(renderer.domElement, () => {
    const mesh = pick();
    if (mesh) {
      controls.enabled = false;
      gallery.setHover(null);
      overlay.open(mesh.userData.card);
    }
  });
  overlay.onCloseStart = () => { controls.enabled = true; };

  const tick = () => {
    controls.tick();
    gallery.update(controls.current.x, controls.current.y);
    const hoverMesh = (controls.dragging || overlay.isOpen) ? null : pick();
    gallery.setHover(hoverMesh);
    document.body.classList.toggle('hover-card', !!hoverMesh && !controls.dragging);
    renderer.render(scene, camera);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  camera.fov = 95;
  camera.updateProjectionMatrix();
  gsap.to(camera, {
    fov: 65,
    duration: 1.8,
    ease: 'power3.inOut',
    onUpdate: () => camera.updateProjectionMatrix(),
  });
  gsap.from(controls.target, { x: 0.6, y: -0.3, duration: 1.8, ease: 'power3.out' });

  // Test hook (dev server only): lets e2e tests wait for motion to settle by
  // reading controls state instead of diffing canvas pixels.
  if (import.meta.env.DEV) {
    window.__sphere = { controls };
  }

  ctx = { renderer, gallery, overlay, controls, tick, onResize, onPointerMove, camera };
}

export function destroyGallery() {
  if (!ctx) return;
  gsap.ticker.remove(ctx.tick);
  gsap.killTweensOf(ctx.camera);
  window.removeEventListener('resize', ctx.onResize);
  window.removeEventListener('pointermove', ctx.onPointerMove);
  ctx.controls.dispose();
  ctx.overlay.dispose();
  ctx.renderer.dispose();
  ctx.renderer.domElement.remove();
  document.body.classList.remove('hover-card', 'dragging');
  if (import.meta.env.DEV) delete window.__sphere;
  ctx = null;
}
```

- [ ] **Step 4: Replace `src/main.js` with a shim (temporary, removed in Task 4)**

```js
import { startGallery } from './galleryApp.js';

startGallery(document.getElementById('app'));
```

- [ ] **Step 5: Verify**

```bash
npm test                                              # 15 unit tests pass
VITE_PROXY_URL= VITE_EEN_CLIENT_ID= npm run test:e2e  # 7 gallery specs pass
```

- [ ] **Step 6: Commit**

```bash
git add src/galleryApp.js src/main.js src/controls.js src/overlay.js
git commit -m "refactor: gallery start/destroy lifecycle with full listener disposal"
```

---

### Task 4: Vue shell (App, LoginView, GalleryView)

**Files:**
- Create: `src/main.ts`, `src/App.vue`, `src/views/LoginView.vue`, `src/views/GalleryView.vue`
- Modify: `index.html`, `src/styles.css`, `playwright.build.config.js`
- Delete: `src/main.js`

- [ ] **Step 1: Replace `index.html` body and script**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sphere Gallery PoC</title>
  <link rel="stylesheet" href="/src/styles.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/main.ts`**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { authEnabled, initAuth } from './auth';

const app = createApp(App);
app.use(createPinia()); // must precede initEenToolkit (toolkit requirement)
if (authEnabled) initAuth();
app.mount('#app');
```

- [ ] **Step 3: Create `src/views/GalleryView.vue`**

The vignette/hud/overlay markup moves here verbatim from the old index.html:

```vue
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { startGallery, destroyGallery } from '../galleryApp.js';

const root = ref(null);

onMounted(() => { startGallery(root.value); });
onUnmounted(() => { destroyGallery(); });
</script>

<template>
  <div>
    <div ref="root" class="gallery-canvas"></div>
    <div class="vignette"></div>
    <header class="hud">SPHERE GALLERY — POC</header>
    <div id="overlay" class="overlay" aria-hidden="true">
      <button class="overlay-close" id="overlay-close">Close</button>
      <div class="overlay-inner">
        <p class="overlay-client" id="overlay-client"></p>
        <h1 class="overlay-title" id="overlay-title"></h1>
        <p class="overlay-meta" id="overlay-meta"></p>
        <img class="overlay-img" id="overlay-img" alt="" />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Create `src/views/LoginView.vue`**

```vue
<script setup lang="ts">
import { login } from '../auth';

defineProps<{ error?: string | null }>();
</script>

<template>
  <div class="login" data-testid="login-view">
    <h1 class="login-title">SPHERE GALLERY</h1>
    <p class="login-sub">Sign in to view the gallery.</p>
    <p v-if="error" class="login-error" data-testid="login-error">{{ error }}</p>
    <button class="login-button" data-testid="login-button" @click="login()">
      Sign in with Eagle Eye Networks
    </button>
  </div>
</template>
```

- [ ] **Step 5: Create `src/App.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import GalleryView from './views/GalleryView.vue';
import LoginView from './views/LoginView.vue';
import { authEnabled, completeCallback, fetchUserEmail, logout, useAuthStore } from './auth';

// ready gates rendering until session restore + callback handling are done,
// so the login view doesn't flash before an existing session kicks in.
const ready = ref(!authEnabled);
const authError = ref<string | null>(null);
const userEmail = ref<string | null>(null);

const store = authEnabled ? useAuthStore() : null;
const isAuthed = computed(() => !authEnabled || Boolean(store?.isAuthenticated));

onMounted(async () => {
  if (!authEnabled) return;
  store!.initialize(); // restore session from localStorage if present
  const err = await completeCallback();
  if (err) authError.value = err;
  ready.value = true;
});

watch(isAuthed, async (authed) => {
  if (authEnabled && authed) {
    userEmail.value = await fetchUserEmail();
  } else {
    userEmail.value = null;
  }
}, { immediate: true });

async function onSignOut() {
  await logout();
}
</script>

<template>
  <GalleryView v-if="ready && isAuthed" />
  <LoginView v-else-if="ready" :error="authError" />
  <div v-if="ready && authEnabled && isAuthed" class="user-chip">
    <span v-if="userEmail" data-testid="user-email">{{ userEmail }}</span>
    <button class="user-chip-button" data-testid="signout-button" @click="onSignOut">
      Sign out
    </button>
  </div>
</template>
```

- [ ] **Step 6: Delete the shim**

```bash
git rm src/main.js
```

- [ ] **Step 7: Append shell styles to `src/styles.css`**

```css
.gallery-canvas { position: fixed; inset: 0; }
.gallery-canvas canvas { position: fixed; inset: 0; display: block; }
.login {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px;
  background: #000; cursor: default; text-align: center;
}
.login-title { font-family: Helvetica, Arial, sans-serif; font-size: 48px; letter-spacing: 0.04em; }
.login-sub { font-size: 13px; color: #888; letter-spacing: 0.15em; }
.login-error { font-size: 13px; color: #d65b5b; max-width: 480px; }
.login-button {
  background: #fff; color: #000; border: 0; border-radius: 999px;
  padding: 14px 28px; font: inherit; font-size: 14px; cursor: pointer;
}
.user-chip {
  position: fixed; top: 24px; left: 24px; z-index: 5;
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; letter-spacing: 0.1em; color: #888;
}
.user-chip-button {
  background: transparent; color: #888; border: 1px solid #333;
  border-radius: 999px; padding: 6px 14px; font: inherit; font-size: 11px;
  cursor: pointer;
}
.user-chip-button:hover { color: #fff; border-color: #666; }
```

Also update the old `#app canvas` rule to keep matching (the canvas now nests
deeper): it already matches descendants — no change needed. Verify the rule is
`#app canvas { position: fixed; inset: 0; display: block; }` and leave it.

- [ ] **Step 8: Mirror open mode in the build-smoke config**

In `playwright.build.config.js`, change the webServer command so the local
`.env` cannot leak auth into the production-parity build:

```js
  webServer: {
    command:
      'VITE_PROXY_URL= VITE_EEN_CLIENT_ID= SPHERE_BASE=/sphere/ npx vite build && SPHERE_BASE=/sphere/ npx vite preview --port 4173',
    url: 'http://localhost:4173/sphere/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
```

- [ ] **Step 9: Verify open mode end to end**

```bash
npm test                                              # 15 unit tests
VITE_PROXY_URL= VITE_EEN_CLIENT_ID= npm run test:e2e  # 7 gallery specs in open mode
npm run test:e2e:build                                # build smoke (auth blanked)
```

Then verify the auth path manually: `npm run dev` (loads `.env`), open
`http://127.0.0.1:3333` in Chrome → login view appears; sign in with the test
account → gallery loads, user chip shows the email; Sign out → login view.

- [ ] **Step 10: Commit**

```bash
git add index.html src/main.ts src/App.vue src/views/ src/styles.css playwright.build.config.js
git rm --cached src/main.js 2>/dev/null || true
git commit -m "feat: Vue 3 shell with OAuth login gate and open-mode build switch"
```

---

### Task 5: Playwright auth projects (real login, guard spec, sign-out spec)

**Files:**
- Create: `e2e/auth.setup.ts`, `e2e/auth.spec.ts`, `e2e/signout.spec.ts`
- Modify: `playwright.config.js`, `.gitignore`

- [ ] **Step 1: Add Playwright projects to `playwright.config.js`**

Add to the exported config (alongside existing keys):

```js
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
```

- [ ] **Step 2: Add to `.gitignore`**

```
playwright/.auth/
```

- [ ] **Step 3: Write `e2e/auth.setup.ts`**

```ts
import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'playwright/.auth/user.json';

// Drives the real EEN Identity Provider login with the test account.
// Selector strategy: the IdP page markup is external; we target generic
// email/password/submit fields and tolerate a two-step (email -> password)
// flow. If EEN changes their login page, fix the selectors here.
setup('authenticate against EEN', async ({ page }) => {
  setup.setTimeout(180_000);
  const user = process.env.TEST_USER;
  const password = process.env.TEST_PASSWORD;
  if (!user || !password) throw new Error('TEST_USER / TEST_PASSWORD not set');

  await page.goto('/');
  await page.getByTestId('login-button').click();

  const email = page.locator('input[type="email"], input[name="email"], #email').first();
  await email.waitFor({ timeout: 30_000 });
  await email.fill(user);

  const pwd = page.locator('input[type="password"]').first();
  if (!(await pwd.isVisible().catch(() => false))) {
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
    await pwd.waitFor({ timeout: 30_000 });
  }
  await pwd.fill(password);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();

  // Back at the app: callback completes and the gallery mounts.
  await page.waitForURL(/127\.0\.0\.1:3333/, { timeout: 60_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
```

- [ ] **Step 4: Run the setup headed once and adapt selectors**

```bash
npx playwright test --project=setup --headed
```

This is an empirical step: watch the EEN IdP login page; if the generic
selectors miss (e.g. custom web components, differently-named fields), inspect
the page and adjust the three locators in `auth.setup.ts` until the run passes.
Expected end state: the run is green and `playwright/.auth/user.json` exists.

- [ ] **Step 5: Write `e2e/auth.spec.ts` (guard, no stored state)**

```ts
import { test, expect } from '@playwright/test';

test('unauthenticated visitors get the login view and no gallery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-view')).toBeVisible();
  await expect(page.getByTestId('login-button')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('a bogus oauth callback shows an error on the login view', async ({ page }) => {
  await page.goto('/?error=access_denied');
  await expect(page.getByTestId('login-error')).toContainText('access_denied');
  await expect(page.locator('canvas')).toHaveCount(0);
});
```

- [ ] **Step 6: Write `e2e/signout.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('signing out returns to the login view', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('user-email')).not.toBeEmpty({ timeout: 30_000 });

  await page.getByTestId('signout-button').click();
  await expect(page.getByTestId('login-view')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('canvas')).toHaveCount(0);
});
```

- [ ] **Step 7: Full authenticated run locally**

```bash
npm run test:e2e
```

Expected: setup logs in once → 7 gallery specs (authenticated), 2 auth-guard
specs, 1 sign-out spec — all green.

- [ ] **Step 8: Commit**

```bash
git add e2e/auth.setup.ts e2e/auth.spec.ts e2e/signout.spec.ts playwright.config.js .gitignore
git commit -m "test: real EEN login setup, auth guard and sign-out e2e specs"
```

---

### Task 6: CI wiring, docs, final verification

**Files:**
- Modify: `.github/workflows/tests.yml`, `README.md`, `.env.example`

- [ ] **Step 1: Pass auth env to the e2e CI job**

In `.github/workflows/tests.yml`, the e2e job's `npm run test:e2e` step becomes:

```yaml
      - run: npm run test:e2e
        env:
          VITE_PROXY_URL: ${{ secrets.VITE_PROXY_URL }}
          VITE_EEN_CLIENT_ID: ${{ secrets.VITE_EEN_CLIENT_ID }}
          TEST_USER: ${{ secrets.TEST_USER }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

(`npm run test:e2e:build` stays env-less — it must build open mode.)

- [ ] **Step 2: Update `.env.example`**

```
# Environment variables for the sphere gallery project.
#
# Copy this file to .env (gitignored) and fill in real values:
#   cp .env.example .env
# Then upload everything to GitHub repository secrets with:
#   ./scripts/upload-secrets.sh
#
# GitHub secrets are write-only (replace/delete, never read back).

# Anthropic API key for the Claude code-review workflow
# (.github/workflows/pr-review.yml). Required for PR review comments.
ANTHROPIC_API_KEY=sk-ant-your-key-here

# EEN OAuth (een-oauth-proxy deployment + EEN application client id).
# When BOTH are present at dev/build time, the app requires login;
# when absent (e.g. the GitHub Pages build), the gallery is open.
VITE_PROXY_URL=https://your-proxy.workers.dev
VITE_EEN_CLIENT_ID=your-een-client-id

# EEN test account driven by the Playwright auth setup (local + CI e2e).
TEST_USER=user@example.com
TEST_PASSWORD=secret
```

- [ ] **Step 3: Update `README.md`**

- Quick start: dev URL becomes `http://127.0.0.1:3333` (note: the EEN IdP
  requires this exact origin; `localhost` will not work for login).
- New "Authentication" section after Quick start:

```markdown
## Authentication

With `VITE_PROXY_URL` and `VITE_EEN_CLIENT_ID` set (see `.env.example`), the
app requires an Eagle Eye Networks sign-in before showing the gallery: OAuth
runs against the EEN Identity Provider through
[een-oauth-proxy](https://github.com/klaushofrichter/een-oauth-proxy), using
[een-api-toolkit](https://github.com/klaushofrichter/een-api-toolkit) (Vue 3 +
Pinia). The proxy keeps `CLIENT_SECRET` and refresh tokens server-side.

Without those two variables the app builds in **open mode** — no login, the
gallery is public. The GitHub Pages deployment builds without them, so the
live demo stays open.

Auth e2e: the Playwright `setup` project performs a real EEN login with
`TEST_USER`/`TEST_PASSWORD` (locally from `.env`, in CI from repo secrets) and
the gallery suite runs authenticated; `auth.spec.ts` verifies the guard.
```

- Update the Configuration section's variable table: `VITE_PROXY_URL` /
  `VITE_EEN_CLIENT_ID` now active (auth switch), `TEST_USER`/`TEST_PASSWORD`
  used by e2e; remove the "reserved/not used" wording.
- Mention the tech additions (Vue 3 shell + Pinia) in the "How it works"
  tooling bullet.

- [ ] **Step 4: Full verification**

```bash
npm test               # 15 unit tests
npm run test:e2e       # authenticated run: setup + 7 gallery + 2 auth + 1 signout
npm run test:e2e:build # open-mode production build smoke
```

Manual: Chrome at `http://127.0.0.1:3333` — login, gallery, drag, overlay,
sign out. Open-mode check: `VITE_PROXY_URL= VITE_EEN_CLIENT_ID= npm run dev`
→ gallery loads with no login.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/tests.yml README.md .env.example
git commit -m "ci/docs: auth env for e2e, authentication README section, .env.example update"
```

---

## Risks / notes for the implementer

- **Proxy choice is configuration only.** `VITE_PROXY_URL` may point at the
  deployed Cloudflare Worker (current `.env` value) or a locally running
  proxy at `http://localhost:8787` (`een-oauth-proxy/proxy` via `npm run dev`).
  No code differs between the two; CI uses the deployed proxy via the
  `VITE_PROXY_URL` repo secret.

- **EEN IdP page markup is external** — Task 5 Step 4 is deliberately
  empirical. Use `--headed` and Playwright traces; keep selectors as generic
  as the page allows.
- **Sign-out revokes the shared session server-side** — that's why the
  `signout` project depends on `gallery` and runs last. Never move it earlier.
- **CI flakiness budget** — login happens once per run; Playwright `retries: 1`
  in CI covers transient IdP hiccups. If EEN is down, the required E2E check
  fails: accepted trade-off per the spec.
- **Do not call `initEenToolkit` anywhere except `initAuth()`** (toolkit
  anti-pattern: re-init on component mount).
- The deploy workflow needs NO changes: it builds without env vars → open mode.
