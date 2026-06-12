# Camera Gallery + Live Video — Design

**Date:** 2026-06-11
**Goal:** After login, the sphere shows live preview images of the account's
EEN cameras instead of static photos; clicking a card opens a live MJPEG video
feed for that camera. Open mode is removed entirely.

## Decisions (from brainstorming)

- **Video tier:** MJPEG preview stream now (`initMediaSession` + `listFeeds`
  → `multipartUrl` in an `<img>`); the video pane is structured so the
  `@een/live-video-web-sdk` full-quality player can replace it later.
- **Camera count:** design for any N (1 … 100+), adapting distribution and
  fetch behavior.
- **Open mode is removed.** The static Picsum gallery, its assets, and the
  open-mode test paths are deleted.
- **Approach A:** a camera data module feeds the existing gallery pipeline;
  three.js code untouched; the existing GSAP overlay hosts the video pane.

## Open-mode removal — ripple effects

- The app requires auth, always. Missing `VITE_PROXY_URL` /
  `VITE_EEN_CLIENT_ID` at startup → hard error screen ("auth not
  configured"), never a silently open gallery. The `isAuthEnabled` helper and
  LoginView/GalleryView split remain; only the open branch is removed.
- DELETED: `public/assets/` (100 images), `scripts/fetch-images.mjs`, the
  `fetch-images` npm script, `src/data.js` and its tests, the open-mode
  Playwright project fallback, and the release job's 100-image guard
  (replaced by index.html + hashed JS bundle existence checks).
- **Build-smoke** (`e2e-build/`) becomes: production build under
  `/sphere/` serves the login view, zero canvas, and the hashed JS bundle
  loads without failed requests. (A local preview can never complete OAuth.)
- **E2E always requires credentials.** Fork PRs without secrets cannot run
  e2e — accepted. The gallery e2e suite requires the test account to have at
  least one online camera.

## Camera data module (`src/cameras.ts`)

The only module besides `auth.ts` that imports een-api-toolkit.

- `fetchAllCameras()` — pages through `getCameras({pageToken})` until
  `nextPageToken` is exhausted; returns `Camera[]`. `{data,error}` style, no
  throws.
- `distributeCameras(count, cols, rows): number[]` — pure. Staggered
  round-robin (Latin-square style): cell `(col,row)` (cell index
  `row*cols+col`) gets camera index `(col + row*stride) % N` where `stride`
  is the smallest integer ≥ 3 coprime to N (fallback 1 when N ≤ 2).
  Properties: horizontal neighbors always differ for N > 1; vertical
  neighbors differ for N > 2; N ≥ cells → first `cells` cameras get one cell
  each (log truncation to console). Unit-tested for N = 1, 2, 3, 7, 50, 100,
  250 including the neighbor properties and determinism.
- `loadCameraCards(onPreview): Promise<{cards, error}>` — builds 100 cards
  `{id, deviceId, title: camera name, tags: [status], image: null}` via the
  distribution, then fetches each DISTINCT camera's preview once with
  `getLiveImage({deviceId})` in a concurrency-limited pool (6 in flight),
  calling `onPreview(deviceId, dataUrl)` per arrival. Failed previews (e.g.
  offline cameras) keep `image: null` — the card renders a placeholder and
  stays clickable.

## Gallery integration

- `galleryApp.js`: replace `makeCards()` + image preloading with
  `loadCameraCards`. The gallery constructs immediately with placeholder
  textures; each `onPreview` re-bakes that camera's card textures
  (`bakeCardTexture` + assign `material.map`, dispose the old texture). One
  camera may occupy several cells → re-bake all its cells.
- `cardTexture.js`: accepts an optional image; placeholder branch renders
  the camera name + "LOADING…" or "NO PREVIEW" centered tile. Labels: camera
  name (top-right), "EEN" (top-left), status chip (bottom-left), no year.
- Zero cameras or `getCameras` error → black error state ("No cameras
  available for this account" / the error message) + Sign out button,
  replacing the gallery (a Vue-rendered state in GalleryView's place).

## Video overlay (`src/videoPane.js` + existing overlay)

- After login (App.vue), `initMediaSession()` is called once; failures are
  logged and surfaced lazily (the pane shows an error if streaming fails).
- Card click → overlay opens (existing GSAP wipe) showing camera name,
  status, and the video pane. The pane: `listFeeds({deviceId, type:
  'preview', include: ['multipartUrl']})` → set the `<img>` src to
  `multipartUrl` (never modified — pre-signed URL). A "LIVE" badge shows
  while streaming; feed lookup errors render an inline message.
- Close (button/Escape): `img.src = ''` to terminate the MJPEG connection,
  then the existing overlay close path. `videoPane.dispose()` is wired into
  `overlay.dispose()`.
- The pane exposes `open(deviceId)` / `close()` / `dispose()` — the SDK
  player can later replace its internals behind the same interface.

## Error handling summary

| Failure | Behavior |
|---|---|
| Auth env missing at startup | Hard error screen, no gallery |
| getCameras error / zero cameras | Error state + Sign out |
| Preview fetch fails per camera | Placeholder card, still clickable |
| listFeeds / stream fails in pane | Inline error in the overlay |
| Token expiry mid-session | Existing path: store flips → LoginView |

## Testing

- **Unit (TDD):** `distributeCameras` (all N cases + neighbor properties),
  card-shape mapping from camera fixtures. Existing data.js tests are
  deleted with the module.
- **E2E (auth mode, real account):** gallery specs stay content-agnostic
  (canvas, drag, hover, settle hook — unchanged). Overlay spec: click a
  card → overlay shows a stream `<img>` whose src is non-empty (multipart
  URL) → close clears the src. Signout spec unchanged.
- **Build-smoke:** login view renders under `/sphere/`, zero canvas, no
  failed bundle requests.
- **Live spec:** journey unchanged (login gate → sign-in → canvas → overlay
  step now exercises the real stream → drag → sign-out).
- **CI:** unchanged secrets wiring; e2e has no open-mode fallback anymore.

## Docs

README: gallery description (live camera previews, MJPEG detail feed),
removal of open mode and the fetch-images quick-start step, updated test
descriptions. `.env.example` unchanged.

## Out of scope

- `@een/live-video-web-sdk` full-quality player (the pane interface is the
  upgrade seam).
- Preview auto-refresh while the gallery is open.
- Automatic gallery navigation (still future; offset-tween design holds).
- Camera filtering/search; multi-account support.
