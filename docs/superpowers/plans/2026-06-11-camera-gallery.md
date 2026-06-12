# Camera Gallery + Live Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After login the sphere shows live preview images of the account's EEN cameras (any count, distributed across the 100-cell grid); clicking a card opens a live MJPEG feed; open mode and the static image gallery are removed.

**Architecture:** A new `src/cameras.ts` (the only toolkit importer besides `auth.ts`) fetches cameras, distributes them via a staggered round-robin, and streams preview images into per-card texture re-bakes. The existing GSAP overlay hosts a self-contained `videoPane` module (MJPEG `multipartUrl` in an `<img>`; SDK-upgradeable interface). Auth becomes mandatory: missing config is a hard error.

**Tech Stack:** een-api-toolkit (getCameras, getLiveImage, listFeeds, initMediaSession), existing three.js/GSAP gallery, vitest (vi.mock for toolkit), Playwright.

**Spec:** `docs/superpowers/specs/2026-06-11-camera-gallery-design.md`

**Toolkit facts:** `Camera { id, name, status }` where `status` is a string OR an object with `connectionStatus`; `getCameras(params?)` → `Result<PaginatedResult<Camera>>` with `nextPageToken`; `getLiveImage({deviceId})` → `Result<{imageData /* base64 data URL */}>`; `initMediaSession()` once before multipart streaming; `listFeeds({deviceId, type:'preview', include:['multipartUrl']})` → `Result<{results: Feed[]}>`; never modify a `multipartUrl`. All functions return `{data,error}`, never throw.

---

### Task 1: Camera distribution (TDD, pure)

**Files:**
- Create: `src/cameras.ts` (distribution part only)
- Test: `tests/cameras.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { distributeCameras, COLS, ROWS } from '../src/cameras';

const CELLS = COLS * ROWS;

function neighborsDiffer(assign: number[], cols: number, rows: number) {
  const issues: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const me = assign[r * cols + c];
      const right = assign[r * cols + ((c + 1) % cols)];
      const down = assign[((r + 1) % rows) * cols + c];
      if (me === right) issues.push(`H ${c},${r}`);
      if (me === down) issues.push(`V ${c},${r}`);
    }
  }
  return issues;
}

describe('distributeCameras', () => {
  it('fills all cells and is deterministic', () => {
    for (const n of [1, 2, 3, 7, 50, 100, 250]) {
      const a = distributeCameras(n, COLS, ROWS);
      expect(a).toHaveLength(CELLS);
      expect(a).toEqual(distributeCameras(n, COLS, ROWS));
      for (const idx of a) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(Math.min(n, CELLS) === n ? n : CELLS);
      }
    }
  });

  it('uses every camera at least once when n <= cells', () => {
    for (const n of [1, 2, 3, 7, 50, 100]) {
      const used = new Set(distributeCameras(n, COLS, ROWS));
      expect(used.size).toBe(n);
    }
  });

  it('assigns one distinct camera per cell when n >= cells', () => {
    const a = distributeCameras(250, COLS, ROWS);
    expect(new Set(a).size).toBe(CELLS);
    expect(Math.max(...a)).toBeLessThan(CELLS); // first 100 cameras only
  });

  it('horizontal neighbors always differ for n > 1', () => {
    for (const n of [2, 3, 7, 50]) {
      const issues = neighborsDiffer(distributeCameras(n, COLS, ROWS), COLS, ROWS)
        .filter((s) => s.startsWith('H'));
      expect(issues).toEqual([]);
    }
  });

  it('vertical neighbors differ for n > 2', () => {
    for (const n of [3, 7, 50]) {
      const issues = neighborsDiffer(distributeCameras(n, COLS, ROWS), COLS, ROWS)
        .filter((s) => s.startsWith('V'));
      expect(issues).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/cameras.test.ts`
Expected: FAIL — cannot resolve `../src/cameras`.

- [ ] **Step 3: Implement the distribution in `src/cameras.ts`**

```ts
// Camera data for the sphere gallery. The ONLY module besides auth.ts that
// imports een-api-toolkit (fetch layer added in a later task).

export const COLS = 10;
export const ROWS = 10;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Staggered round-robin (Latin-square style): cell (col,row) gets camera
 * (col + row*stride) % n with stride >= 3 coprime to n. Horizontal
 * neighbors always differ (n > 1); vertical neighbors differ (n > 2,
 * because stride % n != 0). With n >= cells, each of the first `cells`
 * cameras gets exactly one cell (identity with a row stagger would repeat,
 * so the n >= cells case is a plain sequential fill).
 */
export function distributeCameras(n: number, cols: number, rows: number): number[] {
  const cells = cols * rows;
  if (n <= 0) return [];
  if (n >= cells) {
    return Array.from({ length: cells }, (_, i) => i);
  }
  let stride = 1;
  if (n > 2) {
    stride = 3;
    while (gcd(stride, n) !== 1 || stride % n === 0) stride++;
  }
  const out = new Array<number>(cells);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[r * cols + c] = (c + r * stride) % n;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/cameras.test.ts` — expect PASS (5 tests).

NOTE on the wrap edge: the test checks wrap-around neighbors too (`(c+1)%cols`, `(r+1)%rows`). If the chosen stride fails a wrap case for some n (e.g. n divides 10), adjust the stride search until the tests pass — the loop may also need to skip strides where `cols % n === 0` patterns collide. The tests are the contract; tweak the implementation, not the tests. If a wrap case is mathematically impossible for some n (e.g. n = 2 vertical), the test list above already excludes it.

- [ ] **Step 5: Commit**

```bash
git add src/cameras.ts tests/cameras.test.ts
git commit -m "feat: staggered round-robin camera distribution (TDD)"
```

---

### Task 2: Camera fetch layer (TDD with mocked toolkit)

**Files:**
- Modify: `src/cameras.ts` (append fetch layer)
- Test: append to `tests/cameras.test.ts`

- [ ] **Step 1: Append failing tests (vi.mock the toolkit)**

```ts
import { vi, beforeEach } from 'vitest';

vi.mock('een-api-toolkit', () => ({
  getCameras: vi.fn(),
  getLiveImage: vi.fn(),
  listFeeds: vi.fn(),
  initMediaSession: vi.fn(),
}));

import { getCameras, getLiveImage, listFeeds } from 'een-api-toolkit';
import { fetchAllCameras, loadCameraCards, getPreviewFeedUrl, cameraStatusText } from '../src/cameras';

const cam = (id: string, name: string, status: unknown = 'online') =>
  ({ id, name, status }) as never;

beforeEach(() => {
  vi.mocked(getCameras).mockReset();
  vi.mocked(getLiveImage).mockReset();
  vi.mocked(listFeeds).mockReset();
});

describe('cameraStatusText', () => {
  it('handles string and object status', () => {
    expect(cameraStatusText(cam('1', 'a', 'online'))).toBe('ONLINE');
    expect(cameraStatusText(cam('1', 'a', { connectionStatus: 'offline' }))).toBe('OFFLINE');
    expect(cameraStatusText(cam('1', 'a', undefined))).toBe('UNKNOWN');
  });
});

describe('fetchAllCameras', () => {
  it('pages through all results', async () => {
    vi.mocked(getCameras)
      .mockResolvedValueOnce({ data: { results: [cam('a', 'A')], nextPageToken: 't' }, error: null } as never)
      .mockResolvedValueOnce({ data: { results: [cam('b', 'B')] }, error: null } as never);
    const { cameras, error } = await fetchAllCameras();
    expect(error).toBeNull();
    expect(cameras!.map((c) => c.id)).toEqual(['a', 'b']);
    expect(vi.mocked(getCameras).mock.calls[1][0]).toMatchObject({ pageToken: 't' });
  });

  it('propagates errors', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({ data: null, error: { code: 'API_ERROR', message: 'boom' } } as never);
    const { cameras, error } = await fetchAllCameras();
    expect(cameras).toBeNull();
    expect(error).toContain('boom');
  });
});

describe('loadCameraCards', () => {
  it('errors on zero cameras', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({ data: { results: [] }, error: null } as never);
    const { cards, error } = await loadCameraCards(() => {});
    expect(cards).toBeNull();
    expect(error).toBe('No cameras available for this account');
  });

  it('builds 100 cards from the distribution and streams previews per distinct camera', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({
      data: { results: [cam('a', 'Front'), cam('b', 'Back'), cam('c', 'Yard')] }, error: null,
    } as never);
    vi.mocked(getLiveImage).mockResolvedValue({ data: { imageData: 'data:image/jpeg;base64,x' }, error: null } as never);

    const seen: Array<[string, string | null]> = [];
    const { cards, error } = await loadCameraCards((deviceId, dataUrl) => seen.push([deviceId, dataUrl]));
    expect(error).toBeNull();
    expect(cards).toHaveLength(100);
    expect(new Set(cards!.map((c) => c.deviceId))).toEqual(new Set(['a', 'b', 'c']));
    expect(cards![0]).toMatchObject({ id: 0, title: 'Front', pending: true });

    await vi.waitFor(() => expect(seen).toHaveLength(3)); // one preview per DISTINCT camera
    expect(vi.mocked(getLiveImage)).toHaveBeenCalledTimes(3);
    expect(seen.every(([, url]) => url === 'data:image/jpeg;base64,x')).toBe(true);
  });

  it('reports failed previews as null', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({ data: { results: [cam('a', 'Solo')] }, error: null } as never);
    vi.mocked(getLiveImage).mockResolvedValue({ data: null, error: { code: 'API_ERROR', message: 'no img' } } as never);
    const seen: Array<[string, string | null]> = [];
    await loadCameraCards((d, u) => seen.push([d, u]));
    await vi.waitFor(() => expect(seen).toEqual([['a', null]]));
  });
});

describe('getPreviewFeedUrl', () => {
  it('returns the first multipartUrl', async () => {
    vi.mocked(listFeeds).mockResolvedValueOnce({
      data: { results: [{ multipartUrl: null }, { multipartUrl: 'https://feed' }] }, error: null,
    } as never);
    expect(await getPreviewFeedUrl('a')).toEqual({ url: 'https://feed', error: null });
  });

  it('reports missing feeds', async () => {
    vi.mocked(listFeeds).mockResolvedValueOnce({ data: { results: [] }, error: null } as never);
    const r = await getPreviewFeedUrl('a');
    expect(r.url).toBeNull();
    expect(r.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/cameras.test.ts`
Expected: FAIL — missing exports.

- [ ] **Step 3: Append the fetch layer to `src/cameras.ts`**

```ts
import {
  getCameras,
  getLiveImage,
  listFeeds,
  initMediaSession,
  type Camera,
} from 'een-api-toolkit';

export interface CameraCard {
  id: number;          // cell index 0..99
  deviceId: string;
  title: string;       // camera name
  tags: string[];      // [status]
  pending: boolean;    // preview not yet resolved
}

const PREVIEW_CONCURRENCY = 6;

export function cameraStatusText(camera: Camera): string {
  const s = camera.status as unknown;
  if (typeof s === 'string') return s.toUpperCase();
  if (s && typeof s === 'object' && 'connectionStatus' in s) {
    return String((s as { connectionStatus: unknown }).connectionStatus).toUpperCase();
  }
  return 'UNKNOWN';
}

export async function fetchAllCameras(): Promise<{ cameras: Camera[] | null; error: string | null }> {
  const all: Camera[] = [];
  let pageToken: string | undefined;
  do {
    const { data, error } = await getCameras(pageToken ? { pageToken } : undefined);
    if (error) return { cameras: null, error: error.message };
    all.push(...data.results);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { cameras: all, error: null };
}

/**
 * Build 100 cards via the distribution and stream preview images for each
 * DISTINCT camera (concurrency-limited). onPreview(deviceId, dataUrl|null)
 * fires as each preview resolves; the caller re-bakes that camera's cells.
 * Resolves once the camera list is known; previews keep arriving after.
 */
export async function loadCameraCards(
  onPreview: (deviceId: string, dataUrl: string | null) => void,
): Promise<{ cards: CameraCard[] | null; error: string | null }> {
  const { cameras, error } = await fetchAllCameras();
  if (error) return { cards: null, error };
  if (!cameras || cameras.length === 0) {
    return { cards: null, error: 'No cameras available for this account' };
  }

  const assign = distributeCameras(cameras.length, COLS, ROWS);
  const used = [...new Set(assign)];
  const cards: CameraCard[] = assign.map((cameraIdx, cell) => ({
    id: cell,
    deviceId: cameras[cameraIdx].id,
    title: cameras[cameraIdx].name,
    tags: [cameraStatusText(cameras[cameraIdx])],
    pending: true,
  }));

  // Fire-and-forget preview pool over the distinct cameras actually used.
  const queue = used.map((i) => cameras[i].id);
  const worker = async () => {
    for (let d = queue.shift(); d !== undefined; d = queue.shift()) {
      const { data } = await getLiveImage({ deviceId: d });
      onPreview(d, data ? data.imageData : null);
    }
  };
  void Promise.all(Array.from({ length: Math.min(PREVIEW_CONCURRENCY, queue.length) }, worker));

  return { cards, error: null };
}

/** Initialize the media session once after login (needed for multipartUrl). */
export async function initMedia(): Promise<void> {
  await initMediaSession();
}

export async function getPreviewFeedUrl(
  deviceId: string,
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await listFeeds({ deviceId, type: 'preview', include: ['multipartUrl'] });
  if (error) return { url: null, error: error.message };
  const feed = data.results.find((f: { multipartUrl?: string | null }) => f.multipartUrl);
  return feed?.multipartUrl
    ? { url: feed.multipartUrl, error: null }
    : { url: null, error: 'No preview feed available for this camera' };
}
```

(If toolkit type names differ — e.g. `getCameras` param type rejects `{pageToken}` — check `node_modules/een-api-toolkit/dist/index.d.ts` and adapt the call, not the behavior.)

- [ ] **Step 4: Run to verify pass**

Run: `npm test` — all unit tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/cameras.ts tests/cameras.test.ts
git commit -m "feat: camera fetch layer with preview streaming pool (TDD)"
```

---

### Task 3: Card texture placeholder + camera labels

**Files:**
- Modify: `src/cardTexture.js`

- [ ] **Step 1: Update `bakeCardTexture`**

Read the current file first. Changes (keep canvas dimensions and chip helpers):

1. The image branch stays. The placeholder branch (when `image` is null) becomes:

```js
  } else {
    ctx.fillStyle = '#101010';
    ctx.fillRect(MARGIN_X, MARGIN_TOP, 640, 480);
    ctx.fillStyle = '#444';
    ctx.font = '600 28px "SF Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(card.pending ? 'LOADING…' : 'NO PREVIEW', W / 2, H / 2);
  }
```

2. Top-left label becomes the constant `'EEN'`; top-right stays `card.title.toUpperCase()` (now the camera name):

```js
  ctx.fillText('EEN', MARGIN_X, MARGIN_TOP / 2);
```

3. The year rendering block (bottom-right `card.year`) is REMOVED — cameras have no year. Tag chips stay (they carry the status).

- [ ] **Step 2: Verify nothing else consumed `card.year` / old fields**

Run: `grep -rn "year\|client" src/ e2e/ e2e-live/ | grep -v node_modules`
Expected: only `overlay.js` references (`card.client`, `card.year`) — handled in Task 5. Note them; do not fix here.

- [ ] **Step 3: Commit**

```bash
git add src/cardTexture.js
git commit -m "feat: placeholder tiles and camera labels in card textures"
```

---

### Task 4: Gallery integration (cards from cameras, live re-bake, error state)

**Files:**
- Modify: `src/galleryApp.js`, `src/gallery.js`, `src/views/GalleryView.vue`, `src/App.vue`, `src/styles.css`

- [ ] **Step 1: `src/gallery.js` — import COLS/ROWS from cameras**

Change `import { COLS, ROWS } from './data.js';` to `import { COLS, ROWS } from './cameras';`

- [ ] **Step 2: `src/galleryApp.js` — camera-driven startup + re-bake**

Replace the data import block (`makeCards`, `loadImages`) with:

```js
import { loadCameraCards } from './cameras';
import { bakeCardTexture } from './cardTexture.js';
```

(remove the local `loadImages` helper). In `startGallery(container)`, replace

```js
  const cards = makeCards();
  const images = await loadImages(cards);
  const gallery = new Gallery(scene, cards, images);
```

with:

```js
  const onPreview = (deviceId, dataUrl) => {
    const apply = (img) => {
      if (gen !== startGen) return; // gallery torn down before this preview arrived
      for (const mesh of gallery.meshes) {
        const card = mesh.userData.card;
        if (card.deviceId !== deviceId) continue;
        card.pending = false;
        const tex = bakeCardTexture(card, img);
        mesh.material.map.dispose();
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
      }
    };
    if (!dataUrl) { apply(null); return; }
    const img = new Image();
    img.onload = () => apply(img);
    img.onerror = () => apply(null);
    img.src = dataUrl;
  };

  const { cards, error } = await loadCameraCards(onPreview);
  if (gen !== startGen) { /* cancelled during fetch */
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    return;
  }
  if (error) {
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    return { error };
  }
  const gallery = new Gallery(scene, cards, cards.map(() => null));
```

NOTE: `gallery` is referenced inside `onPreview` before construction — that is
safe because `onPreview` only fires from async preview completion, after
`loadCameraCards` resolved and `gallery` was constructed. Keep the existing
generation-cancellation block that already follows the old `loadImages` await
(merge with the above — there must be exactly one cancellation check after the
await, then the error check, then construction).

`startGallery` now returns `undefined` on success and `{ error }` on failure.

- [ ] **Step 3: `src/views/GalleryView.vue` — error state**

```vue
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { startGallery, destroyGallery } from '../galleryApp.js';
import { logout } from '../auth';

const root = ref(null);
const errorMsg = ref(null);

onMounted(async () => {
  const result = await startGallery(root.value);
  if (result?.error) errorMsg.value = result.error;
});
onUnmounted(() => { destroyGallery(); });

async function onSignOut() { await logout(); }
</script>
```

and in the template, before the gallery markup:

```html
    <div v-if="errorMsg" class="login" data-testid="gallery-error">
      <h1 class="login-title">SPHERE GALLERY</h1>
      <p class="login-error">{{ errorMsg }}</p>
      <button class="login-button" data-testid="error-signout" @click="onSignOut()">Sign out</button>
    </div>
```

(the canvas/vignette/hud/overlay markup stays; with an error the canvas was never created.)

- [ ] **Step 4: `src/App.vue` — initialize the media session after login**

Extend the `watch(isAuthed, ...)` success branch:

```ts
import { authEnabled, completeCallback, fetchUserEmail, logout, useAuthStore } from './auth';
import { initMedia } from './cameras';
...
  if (authEnabled && authed) {
    void initMedia(); // needed before multipartUrl streaming; failures surface in the video pane
    const email = await fetchUserEmail();
    if (req === emailRequest) userEmail.value = email;
  }
```

- [ ] **Step 5: Verify** — `npm test` passes; `npm run dev` then manual check in Chrome (controller does the visual check after commit).

- [ ] **Step 6: Commit**

```bash
git add src/galleryApp.js src/gallery.js src/views/GalleryView.vue src/App.vue
git commit -m "feat: gallery renders live camera previews with streaming re-bake"
```

---

### Task 5: Video pane in the overlay (MJPEG live feed)

**Files:**
- Create: `src/videoPane.js`
- Modify: `src/overlay.js`, `src/galleryApp.js`, `src/views/GalleryView.vue`, `src/styles.css`

- [ ] **Step 1: Create `src/videoPane.js`**

```js
import { getPreviewFeedUrl } from './cameras';

/**
 * Live MJPEG preview pane inside the detail overlay. Self-contained behind
 * open/close/dispose so a full-quality SDK player can replace the internals
 * later without touching the overlay.
 */
export class VideoPane {
  constructor() {
    this.img = document.getElementById('video-stream');
    this.live = document.getElementById('video-live');
    this.errorEl = document.getElementById('video-error');
    this._openId = 0;
  }

  async open(deviceId) {
    const id = ++this._openId;
    this.errorEl.hidden = true;
    this.live.hidden = true;
    this.img.removeAttribute('src');

    const { url, error } = await getPreviewFeedUrl(deviceId);
    if (id !== this._openId) return; // closed/reopened while fetching
    if (error || !url) {
      this.errorEl.textContent = error || 'No live feed available';
      this.errorEl.hidden = false;
      return;
    }
    // multipartUrl is pre-signed: use verbatim, never append parameters.
    this.img.src = url;
    this.live.hidden = false;
  }

  close() {
    this._openId++;
    // Clearing src terminates the MJPEG connection.
    this.img.removeAttribute('src');
    this.live.hidden = true;
    this.errorEl.hidden = true;
  }

  dispose() {
    this.close();
  }
}
```

- [ ] **Step 2: Update the overlay markup in `src/views/GalleryView.vue`**

Replace the `<img class="overlay-img" ...>` line inside `#overlay` with:

```html
        <div class="video-pane">
          <img class="video-stream" id="video-stream" alt="Live camera stream" />
          <span class="video-live" id="video-live" hidden>● LIVE</span>
          <p class="video-error" id="video-error" data-testid="video-error" hidden></p>
        </div>
```

- [ ] **Step 3: Update `src/overlay.js`**

Read the file first. In `open(card)`:
- `this.clientEl.textContent = 'EEN';`
- title stays `card.title`;
- `this.metaEl.textContent = card.tags.join('  ·  ');` (no year);
- remove the `imgEl` src/alt lines and the `imgEl` from the stagger array — replace with the pane container: stagger `[this.clientEl, this.titleEl, this.metaEl, document.querySelector('.video-pane')]`.
- constructor: drop `this.imgEl = document.getElementById('overlay-img');` (element gone); update `dispose()`'s `killTweensOf` array accordingly (el, clientEl, titleEl, metaEl, and the `.video-pane` element).

- [ ] **Step 4: Wire the pane in `src/galleryApp.js`**

```js
import { VideoPane } from './videoPane.js';
```

After `const overlay = new Overlay();` add `const videoPane = new VideoPane();`
In the Controls click callback, after `overlay.open(mesh.userData.card);` add
`videoPane.open(mesh.userData.card.deviceId);`
Extend `overlay.onCloseStart`:

```js
  overlay.onCloseStart = () => {
    controls.enabled = true;
    videoPane.close();
  };
```

Add `videoPane` to `ctx` and call `ctx.videoPane.dispose();` in `destroyGallery()` next to `ctx.overlay.dispose();`.

- [ ] **Step 5: Styles — append to `src/styles.css`**

```css
.video-pane { position: relative; width: 100%; }
.video-stream { width: 100%; min-height: 200px; background: #000; border-radius: 6px; }
.video-live {
  position: absolute; top: 12px; left: 12px;
  background: #d32f2f; color: #fff; font-size: 11px; letter-spacing: 0.1em;
  padding: 4px 10px; border-radius: 999px;
}
.video-error { font-size: 13px; color: #d65b5b; padding: 24px 0; }
```

- [ ] **Step 6: Verify** — `npm test`; dev-mode click check happens in Task 7's full verification.

- [ ] **Step 7: Commit**

```bash
git add src/videoPane.js src/overlay.js src/galleryApp.js src/views/GalleryView.vue src/styles.css
git commit -m "feat: live MJPEG video pane in the detail overlay"
```

---

### Task 6: Open-mode removal (deletions, hard fail, test restructure)

**Files:**
- Delete: `public/assets/` (100 files), `scripts/fetch-images.mjs`, `src/data.js`, `tests/data.test.js`
- Modify: `package.json`, `src/main.ts`, `playwright.config.js`, `playwright.build.config.js`, `e2e-build/build-smoke.spec.js`, `e2e/gallery.spec.js`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Deletions**

```bash
git rm -r -q public/assets scripts/fetch-images.mjs src/data.js tests/data.test.js
npm pkg delete scripts.fetch-images
rmdir public scripts 2>/dev/null || true
```

- [ ] **Step 2: `src/main.ts` — hard fail without auth config**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { authEnabled, initAuth } from './auth';

if (!authEnabled) {
  document.getElementById('app')!.innerHTML =
    '<div class="login"><h1 class="login-title">CONFIGURATION ERROR</h1>' +
    '<p class="login-sub" data-testid="config-error">VITE_PROXY_URL and VITE_EEN_CLIENT_ID must be set at build time.</p></div>';
  throw new Error('Auth not configured: VITE_PROXY_URL / VITE_EEN_CLIENT_ID missing');
}

const app = createApp(App);
app.use(createPinia()); // must precede initEenToolkit (toolkit requirement)
initAuth();
app.mount('#app');
```

- [ ] **Step 3: `playwright.config.js` — remove the open-mode fallback**

Replace the `authMode` conditional projects with a fail-fast guard plus the four projects (unchanged content):

```js
if (!process.env.VITE_PROXY_URL || !process.env.VITE_EEN_CLIENT_ID
    || !process.env.TEST_USER || !process.env.TEST_PASSWORD) {
  throw new Error(
    'e2e requires VITE_PROXY_URL, VITE_EEN_CLIENT_ID, TEST_USER and TEST_PASSWORD '
    + '(from .env locally, from secrets in CI). Open mode no longer exists.',
  );
}
```

(keep the loadEnv bootstrap above it; delete the `authMode` const and the `: [...]` open-mode branch.)

- [ ] **Step 4: Build-smoke — login-view smoke with dummy auth env**

`playwright.build.config.js` webServer command becomes (dummy values make the
auth switch true deterministically — the smoke only renders the login view,
it never logs in; no secrets needed, works on forks):

```js
    command:
      'VITE_PROXY_URL=https://smoke.invalid VITE_EEN_CLIENT_ID=smoke ' +
      'SPHERE_BASE=/sphere/ npx vite build && SPHERE_BASE=/sphere/ npx vite preview --port 4173',
```

Replace `e2e-build/build-smoke.spec.js` content with:

```js
import { test, expect } from '@playwright/test';

// Production-build smoke under the GitHub Pages base path: the auth-gated
// login view must render and the hashed bundle must load. Built with dummy
// auth env (deterministic, secret-free); login itself is never attempted.
test.use({ baseURL: 'http://localhost:4173' });

test('production build serves the login view under /sphere/', async ({ page }) => {
  const failed = [];
  page.on('requestfailed', (req) => failed.push(req.url()));

  const response = await page.goto('/sphere/');
  expect(response.ok()).toBe(true);

  await expect(page.getByTestId('login-view')).toBeVisible();
  await expect(page.getByTestId('login-button')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(failed).toEqual([]);
});
```

- [ ] **Step 5: `e2e/gallery.spec.js` — overlay spec now asserts the stream**

In `a click opens the overlay with populated content`, replace the
`overlay-img` assertion:

```js
  await expect(page.locator('#overlay-img')).toHaveAttribute('src', /\/assets\/img-\d+\.jpg/);
```

with:

```js
  // Stream or a clean error: the feed URL comes from the real account.
  const stream = page.locator('#video-stream[src]');
  const paneError = page.getByTestId('video-error');
  await expect(stream.or(paneError)).toBeVisible({ timeout: 20_000 });
```

In the `loads without errors` spec, the `failedAssets` listener stays (it now
guards the JS bundle path); REMOVE the assertion comment referencing the 100
images if present. Everything else in the file stays untouched.

- [ ] **Step 6: `deploy.yml` — release guard without images**

Replace the image-count guard in the `Package the deployed build` step:

```yaml
          test -f dist/index.html || { echo "::error::dist/index.html missing - artifact download failed?"; exit 1; }
          ls dist/assets/index-*.js >/dev/null 2>&1 || { echo "::error::hashed JS bundle missing from dist"; exit 1; }
```

(delete the `IMG_COUNT` lines.)

- [ ] **Step 7: Verify**

```bash
npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo OK
pkill -f vite 2>/dev/null; sleep 1
npm test                 # unit: sphericalMap + auth + cameras (data tests gone)
npm run test:e2e:build   # 1 login-view smoke
npm run test:e2e         # auth mode: real login + gallery on real cameras
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat!: remove open mode - static gallery, assets and fallbacks deleted"
```

---

### Task 7: README + full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README updates**

- Intro paragraph: the gallery now shows "live preview images of your Eagle
  Eye Networks cameras"; clicking a card opens "a live video feed".
- Quick start: REMOVE the `npm run fetch-images` line; note that `.env` with
  EEN credentials is required (no open mode).
- Authentication section: remove the open-mode paragraph; state that auth is
  mandatory and a missing configuration fails the build output loudly.
- "How it works": add one bullet — "**Cameras:** the account's cameras are
  fetched after login and distributed across the 100-cell grid (staggered
  round-robin so neighbors differ); previews stream in as textures, and each
  card opens a live MJPEG feed."
- Notes section: drop the Lorem Picsum sentence; mention placeholders for
  offline cameras.
- Configuration table: unchanged (vars all still accurate).

- [ ] **Step 2: Full verification**

```bash
pkill -f vite 2>/dev/null; sleep 1
npm test
npm run test:e2e          # real login, gallery from real cameras, stream overlay
npm run test:e2e:build
```

Manual (controller): dev server, login, confirm camera previews populate the
sphere, click a card → live stream, sign out.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: camera gallery and mandatory auth"
```

---

## Risks / notes for the implementer

- **The dev/CI e2e now depends on the test account's cameras.** At least one
  camera must exist; previews/feeds may legitimately fail per camera — specs
  assert "stream OR clean error", never raw success only.
- **Never modify a `multipartUrl`** (pre-signed). Clearing `img.src` is how
  the MJPEG connection is terminated.
- **initMediaSession** is called once post-login from App.vue; the pane still
  works for `getLiveImage` previews without it, but multipart streaming needs
  the session cookie.
- The toolkit mock in unit tests must be declared with `vi.mock` BEFORE
  importing `../src/cameras` (vitest hoists `vi.mock`, so file order as shown
  works).
- `src/gallery.js` and `galleryApp.js` changes interact with the generation
  counter — keep exactly one cancellation check after the camera-fetch await.
