# EEN Login on GitHub Pages — Design

**Date:** 2026-06-11
**Goal:** The deployed GitHub Pages site requires the same EEN OAuth sign-in as
local development. The public/open gallery is no longer offered on Pages.

## Decisions (from brainstorming)

- **Prerequisites (user-owned):** the redirect URI is registered with the EEN
  client as exactly `https://klaushofrichter.github.io/sphere` (no trailing
  slash). The proxy's CORS allowlist must include
  `https://klaushofrichter.github.io`; if it does not, the first live
  verification fails at the token exchange — a clear, immediate signal.
- **Approach A — pure configuration:** zero app-code changes. The deploy
  workflow injects the auth env vars into the Pages build; the existing
  `VITE_REDIRECT_URI` override carries the registered URI.
- **The open-mode switch stays in the code** (quick demos, build-smoke); only
  the Pages deployment configuration changes.
- **Live verification performs a real EEN login** against the deployed site.

## Changes

### deploy.yml — build job

The `npx vite build --base=/sphere/` step gains env:

- `VITE_PROXY_URL: ${{ secrets.VITE_PROXY_URL }}`
- `VITE_EEN_CLIENT_ID: ${{ secrets.VITE_EEN_CLIENT_ID }}`
- `VITE_REDIRECT_URI: https://klaushofrichter.github.io/sphere` (literal — the
  exact registered form, no trailing slash)

These are public-by-design values (OAuth public client id, public proxy
endpoint); baking them into the public bundle is correct OAuth practice.
CLIENT_SECRET and refresh tokens remain proxy-side.

### OAuth round-trip on Pages (no code needed, documented for clarity)

IdP redirects to `https://klaushofrichter.github.io/sphere?code=…&state=…` →
GitHub Pages 301s to `/sphere/?code=…&state=…` preserving the query → the app
completes the callback exactly as in dev. The `sessionStorage` CSRF state
survives (same origin throughout).

### deploy.yml — verify job + live spec rewrite

`e2e-live/live.spec.js` becomes a serial authenticated journey against the
deployed site:

1. Login view renders (this also catches an accidentally-open deployment —
   a build missing the env vars would show the gallery and FAIL here).
2. Real EEN two-step IdP login with `TEST_USER`/`TEST_PASSWORD` (same selector
   strategy as the proven `e2e/auth.setup.ts`).
3. Redirect back to the live site; gallery canvas renders; drag changes the
   rendered view (fixed settle waits — production build has no test hook).
4. Sign out → login view returns (also cleans up the proxy session).

The verify job in deploy.yml gains env `TEST_USER`/`TEST_PASSWORD` from
secrets. `playwright.live.config.js` sets `trace: 'off'` in CI (a trace of
this spec would contain the typed credentials); the failure-artifact upload
stays useful via the HTML report without traces.

### Unchanged

- App code, components, auth.ts, gallery code: untouched.
- PR test workflows (`tests.yml`): already run the real login in dev mode.
- Build-smoke: stays open mode — its purpose is `/sphere/` base-path
  regression coverage of the rendered gallery, which requires bypassing
  login locally (the IdP will not redirect to localhost:4173). This is also
  the test coverage for the retained open-mode switch.

### Docs

README: the live-demo line notes the EEN sign-in requirement; the
Authentication section's "the GitHub Pages deployment builds without them, so
the live demo stays open" wording is replaced with the new reality (Pages
builds WITH auth; open mode remains available for local/demo builds).

## Error handling / failure modes

- Proxy CORS missing the github.io origin → live verification fails at token
  exchange (network/CORS error in the trace-free report).
- Secrets missing from the build → open-mode bundle → live spec step 1 fails
  (expects login view, sees gallery).
- IdP markup changes → live login fails with selector timeout, same as the PR
  suite; selectors live in two places (auth.setup.ts, live.spec.js) — kept
  intentionally similar.

## Testing

- PR checks: unchanged (15 unit; 11 auth-mode e2e; 1 open-mode build smoke).
- Post-merge: deploy → live verification (real login) → release. The first
  deployment after this change is the real test of the registered redirect
  URI and proxy CORS.

## Out of scope

- Removing the open-mode switch from code (deliberately retained).
- EEN camera images in the gallery (later phase).
- Custom domain / non-Pages hosting.
