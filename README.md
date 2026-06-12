# Sphere Gallery

A WebGL proof of concept: your Eagle Eye Networks cameras on the inside of a
sphere. After signing in, live preview images of the account's cameras wrap
around you in an endlessly scrolling grid; clicking a camera opens its live
video feed. Drag to look around — the grid scrolls infinitely in every
direction with smooth, eased inertia.

Inspired by the work gallery at [phantom.land](https://www.phantom.land/).

**Live demo:** https://klaushofrichter.github.io/sphere/ (requires an
Eagle Eye Networks sign-in) ·
**Latest release:** https://github.com/klaushofrichter/sphere/releases/latest

## How it works

The gallery is logically a flat 10×10 grid with a 2D scroll offset. Every frame,
each card's wrapped grid position is converted to spherical angles and the card
mesh is placed on the inside of a fixed-radius sphere around a stationary camera.
Cards that scroll beyond the visible angular window wrap around modulo the grid
extent — which is why the scroll is endless in both axes with no poles.

- **Rendering:** [three.js](https://threejs.org/) — one plane per card, with the
  photo and its labels baked into a single canvas texture per card.
- **Motion:** [GSAP](https://gsap.com/) — drag inertia, fling momentum, hover
  brightening, the detail-overlay timeline, and the intro zoom.
- **Cameras:** after login, the account's online cameras (offline ones are
  excluded) are fetched and distributed across the 100-cell grid (staggered
  round-robin, so neighboring cells show different cameras at any count).
  Preview images stream into the card textures as they arrive and then keep
  refreshing continuously — one visible camera per 100ms, at most 10 image
  loads per second, paused while the tab is hidden or the video overlay is
  open. Each card opens a live MJPEG feed of its camera.
- **Tooling:** [Vite](https://vite.dev/) + [Vitest](https://vitest.dev/) (the
  grid→sphere math, camera distribution and fetch layer, and auth helpers are
  unit tested), with a [Vue 3](https://vuejs.org/) +
  [Pinia](https://pinia.vuejs.org/) shell for authentication.

## Quick start

Requires Node 22+ (or 20.19+; Vite 8's minimum) and desktop Chrome (the PoC
targets Chrome only).

```bash
npm install
npm run dev            # open http://127.0.0.1:3333
```

> The dev server binds `http://127.0.0.1:3333` exactly — the EEN Identity
> Provider only accepts that redirect URI, so `localhost` will not work for
> login.

A `.env` with EEN credentials is required (see Authentication) — there is no unauthenticated mode.

Other scripts: `npm test` (unit tests), `npm run test:e2e` (Playwright end-to-end
tests in Chromium — first run `npx playwright install chromium`; on Linux use
`npx playwright install --with-deps chromium` to pull system libraries),
`npm run test:e2e:build` (smoke test of the production build under the
GitHub Pages base path), `npm run test:e2e:live` (verifies the deployed site),
and `npm run build` (production build).

## Authentication

With `VITE_PROXY_URL` and `VITE_EEN_CLIENT_ID` set (see `.env.example`), the
app requires an Eagle Eye Networks sign-in before showing the gallery: OAuth
runs against the EEN Identity Provider through
[een-oauth-proxy](https://github.com/klaushofrichter/een-oauth-proxy), using
[een-api-toolkit](https://github.com/klaushofrichter/een-api-toolkit) (Vue 3 +
Pinia). The proxy keeps `CLIENT_SECRET` and refresh tokens server-side.

Authentication is mandatory: without those two variables the build renders a
configuration error instead of the app (the production-build smoke test uses
dummy values to verify the login gate). The GitHub Pages deployment builds
with them, and the post-deploy live verification performs a real EEN login
before a release is cut.

Auth e2e: the Playwright `setup` project performs a real EEN login with
`TEST_USER`/`TEST_PASSWORD` (locally from `.env`, in CI from repo secrets) and
the gallery suite runs authenticated; `auth.spec.ts` verifies the guard and
`signout.spec.ts` the logout flow.

## Controls

| Action | Result |
|---|---|
| Left-click drag | Look around the sphere (infinite in all directions) |
| Release while moving | Momentum fling with smooth decay |
| Hover a card | Card brightens |
| Click a card | Live video view animates in (camera name below the stream) |
| Escape / Close | Back to the gallery, position preserved |

## Configuration (.env)

`.env` configures local development (the auth switch reads the `VITE_` values)
and feeds **GitHub repository secrets** used by CI:

Copy `.env.example` to `.env` (gitignored), fill in the values, and upload
them with:

```bash
./scripts/upload-secrets.sh   # uploads every NAME=VALUE line in .env as a repo secret
```

| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | The Claude code-review workflow (`.github/workflows/pr-review.yml`), which posts an automated review comment on every PR. |
| `VITE_PROXY_URL`, `VITE_EEN_CLIENT_ID` | The EEN OAuth configuration (mandatory): the app requires sign-in everywhere; missing values produce a configuration-error screen. |
| `TEST_USER`, `TEST_PASSWORD` | The EEN test account used by the Playwright auth setup for real-login e2e (local + CI). |

Secrets are write-only on GitHub: they can be replaced or deleted but never
read back, and re-running the script overwrites existing values.

## Branches, CI, and deployment

- `develop` is the integration branch; `production` is deploy-only and accepts
  changes exclusively through pull requests.
- Every PR runs: unit tests, the Playwright e2e suite, a production-build smoke
  test, CodeQL security analysis, and an advisory Claude code review. Four
  checks are required to merge into `production`: `Unit Tests`, `E2E Tests`,
  `Analyze (javascript-typescript)`, and the `CodeQL` alert verdict.
- Merging to `production` triggers the deploy workflow: build (with EEN auth
  baked in) → publish to GitHub Pages → **live e2e verification including a
  real EEN sign-in against the deployed site** → on
  success, a GitHub release tagged `v<version>-r<run>` with the exact deployed
  build attached as a zip (see the
  [releases page](https://github.com/klaushofrichter/sphere/releases)).

## Notes

- Gallery content comes from the signed-in account's cameras: statuses
  `online` and `streaming` are shown, everything else (offline and
  transitional states) is excluded. Cameras without a retrievable preview
  show a placeholder tile and remain clickable; the live feed is the
  camera's MJPEG preview stream (a full-quality WebCodecs player is a
  planned upgrade behind the same video-pane interface).
- This is a proof of concept: desktop Chrome only, no mobile/touch or
  accessibility work. A later phase will add automatic, smooth navigation through the gallery (the scroll offset is a single tweenable vector by design).

## Credits

Created by Claude Fable 5 (Anthropic's Claude Code), directed and reviewed by
Klaus Hofrichter. Inspired by [phantom.land](https://www.phantom.land/).

## License

[MIT](./LICENSE)
