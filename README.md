# Sphere Gallery

A WebGL proof of concept: an image gallery wrapped around the inside of a sphere.
You stand at the center, drag to look around, and the grid of cards scrolls
infinitely in every direction with smooth, eased inertia. Clicking a card animates
a detail page in; closing it returns you exactly where you were.

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
- **Tooling:** [Vite](https://vite.dev/) + [Vitest](https://vitest.dev/) (the
  grid→sphere math, card data, and auth helpers are unit tested), with a
  [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) shell for
  authentication.

## Quick start

Requires Node 22+ (or 20.19+; Vite 8's minimum) and desktop Chrome (the PoC
targets Chrome only).

```bash
npm install
npm run fetch-images   # one-time: downloads 100 sample 640x480 images into public/assets
npm run dev            # open http://127.0.0.1:3333
```

> The dev server binds `http://127.0.0.1:3333` exactly — the EEN Identity
> Provider only accepts that redirect URI, so `localhost` will not work for
> login.

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

Without those two variables the app builds in **open mode** — no login, the
gallery is public (used by the local build-smoke test and available for
demos). The GitHub Pages deployment builds **with** them, so the live site
requires sign-in; after each deploy, the live verification performs a real
EEN login against the deployed site before a release is cut.

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
| Click a card | Detail page animates in |
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
| `VITE_PROXY_URL`, `VITE_EEN_CLIENT_ID` | The auth build switch: present → the app requires EEN sign-in (dev, CI e2e, and the GitHub Pages deployment); absent → open mode (build-smoke test, local demos). |
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

- Sample images come from [Lorem Picsum](https://picsum.photos/) with fixed seeds,
  so the set is reproducible. Card metadata (clients, titles, tags, years) is
  generated fictional placeholder content.
- This is a proof of concept: desktop Chrome only, no mobile/touch or
  accessibility work. A later phase will swap images dynamically from a service
  and add automatic navigation (both are just texture re-bakes and offset tweens
  in the current architecture).

## Credits

Created by Claude Fable 5 (Anthropic's Claude Code), directed and reviewed by
Klaus Hofrichter. Inspired by [phantom.land](https://www.phantom.land/).

## License

[MIT](./LICENSE)
