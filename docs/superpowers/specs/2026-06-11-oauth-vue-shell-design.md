# OAuth Authentication + Vue 3 Shell — Design

**Date:** 2026-06-11
**Goal:** Gate the sphere gallery behind Eagle Eye Networks OAuth using
[een-oauth-proxy](https://github.com/klaushofrichter/een-oauth-proxy) and
[een-api-toolkit](https://github.com/klaushofrichter/een-api-toolkit), by
converting the app shell to Vue 3 while leaving the three.js gallery code
untouched.

## Decisions (from brainstorming)

- **Auth scope:** local development only for now. The deployed GitHub Pages
  site stays an open, unauthenticated gallery.
- **Vue depth:** Vue owns the shell (login view, auth state, lifecycle);
  the gallery mounts inside one Vue component, largely unchanged.
- **E2E:** real EEN login runs locally AND in CI (using TEST_USER /
  TEST_PASSWORD repo secrets). Accepted trade-off: the required E2E check
  depends on EEN/proxy availability; mitigated by one-login-per-run and
  Playwright retries.

## Architecture

Two-state Vue 3 app:

- **LoginView** — shown when auth is enabled and no user is signed in.
- **GalleryView** — shown when authenticated, or always when auth is disabled.

Auth is a **build-time switch**: enabled iff `VITE_PROXY_URL` and
`VITE_EEN_CLIENT_ID` are present at dev/build time. The GitHub Pages deploy
build receives no env vars → open mode → public demo unchanged. Local `.env`
provides them → guard active.

Dev server moves to **`http://127.0.0.1:3333`** (EEN IdP requires an exact
redirect-URI match; the toolkit's registered URI is the root path there).
The OAuth callback (`?code&state`) is handled on the root path.

The toolkit is marked "work in progress — not for production"; acceptable
because auth runs only in development and CI, never on the deployed site.

## Components

| Unit | Responsibility |
|---|---|
| `index.html` | Reduced to `<div id="app">` + module script `/src/main.ts`. |
| `src/main.ts` | createApp + Pinia; `initEenToolkit({proxyUrl, clientId})` only when auth enabled. New shell files are TypeScript; gallery files stay JS. |
| `src/auth.ts` | The ONLY module importing een-api-toolkit. Exports: `authEnabled` (env check), `login()` (redirect to `getAuthUrl()`), `completeCallback()` (parse `?code&state`, call `handleAuthCallback`, clean URL via `history.replaceState`), `logout()` (revoke + reset), reactive auth state re-exported from the toolkit's Pinia store, `fetchUserEmail()` (one `getCurrentUser()` call). |
| `src/App.vue` | On mount: auth disabled → GalleryView. Else: complete callback if params present, then reactively render GalleryView (authenticated) or LoginView. Renders a "Sign out · user@email" chip in the HUD corner when authenticated. |
| `src/views/LoginView.vue` | Black page matching gallery aesthetic: title, "Sign in with Eagle Eye Networks" button, error line for failed callbacks / unreachable proxy. |
| `src/views/GalleryView.vue` | Hosts the canvas container plus the vignette/hud/overlay markup moved verbatim from index.html. `onMounted: startGallery()`, `onUnmounted: destroyGallery()`. |
| `src/galleryApp.js` | Current `main.js` body wrapped in `startGallery()`; new `destroyGallery()` removes the gsap ticker callback, disposes the renderer, and calls new `dispose()` methods on Controls and Overlay so login/logout cycles don't stack listeners. Keeps the dev-only `window.__sphere` hook. |
| `src/controls.js`, `src/overlay.js` | Unchanged behavior + small `dispose()` (remove window/DOM listeners). |
| `src/gallery.js`, `src/sphericalMap.js`, `src/cardTexture.js`, `src/data.js` | Untouched. |
| `vite.config.js` | Adds `@vitejs/plugin-vue`; `server: { host: '127.0.0.1', port: 3333, strictPort: true }`. Existing `SPHERE_BASE` handling unchanged. |

New dependencies: `vue`, `pinia`, `een-api-toolkit`; dev: `@vitejs/plugin-vue`.

## Data flow

1. App loads. Auth disabled → gallery immediately (today's behavior).
2. Auth enabled, not signed in → LoginView. Button → EEN IdP → redirect back
   to `127.0.0.1:3333/?code&state`.
3. `completeCallback()` exchanges the code via the proxy (toolkit), token
   lands in the Pinia store, URL is cleaned, GalleryView mounts.
4. Session persistence across reloads: use the toolkit's session-restore
   mechanism if it exposes one (proxy keeps sessions server-side); otherwise
   a reload requires signing in again — acceptable for dev-only auth.
   Resolve at implementation time.
5. Token refresh/expiry is the toolkit's job. If refresh ultimately fails,
   the store flips to unauthenticated; a watcher destroys the gallery and
   App.vue swaps back to LoginView.
6. Sign out → `logout()` (proxy revoke) → LoginView.

## Error handling

- Callback errors (bad code, state mismatch) → LoginView with the toolkit's
  error message; URL cleaned.
- Proxy unreachable on login → error line on LoginView; no crash.
- Open mode executes no auth code path at all.

## Testing

- **Unit (vitest):** existing 10 tests unchanged. New tests for the pure
  parts of `src/auth.ts`: enabled-flag logic and callback-param parsing.
- **E2E (Playwright projects, dev config):**
  - `setup` project: real EEN IdP login with TEST_USER/TEST_PASSWORD, once
    per run; saves storage state (proxy session cookie / stored session id).
  - `gallery` project: the existing 7 specs, unchanged except the base URL,
    run with the saved auth state (depends on `setup`).
  - `auth.spec.js`: runs WITHOUT stored state — asserts the login view
    renders, no canvas mounts, and (with state) sign-out returns to login.
  - Fallback if storage state cannot restore the session: one UI login per
    worker. Decide at implementation time.
- **Build-smoke:** its build command explicitly blanks `VITE_PROXY_URL` and
  `VITE_EEN_CLIENT_ID` so the local `.env` cannot leak auth into what should
  mirror the open-mode Pages build.
- **Live spec:** unchanged; the deployed site remains open mode.
- **CI (`tests.yml`):** e2e job receives `VITE_PROXY_URL`,
  `VITE_EEN_CLIENT_ID`, `TEST_USER`, `TEST_PASSWORD` from repo secrets.
  The proxy's CORS allowlist must include `http://127.0.0.1:3333` (it is the
  toolkit's documented dev origin for this proxy deployment).

## Docs

- README: authentication section (setup, two build modes, new dev URL
  `http://127.0.0.1:3333`), updated scripts/ports.
- `.env.example`: `VITE_PROXY_URL` / `VITE_EEN_CLIENT_ID` become active
  (app + CI), `TEST_USER` / `TEST_PASSWORD` documented as e2e credentials.

## Out of scope

- Authentication on the deployed GitHub Pages site (later phase: requires
  registering that redirect URI with the EEN client and proxy CORS).
- EEN camera images in the gallery (later phase; this work lays the auth
  foundation for it).
- Toolkit API usage beyond auth + `getCurrentUser()`.
- Mobile/touch, accessibility (unchanged PoC scope).

## Security notes

- `VITE_EEN_CLIENT_ID` is public by OAuth design; `CLIENT_SECRET` and
  refresh tokens never leave the proxy.
- TEST_USER/TEST_PASSWORD exist only in `.env` (gitignored) and CI secrets;
  they never reach the client bundle.
