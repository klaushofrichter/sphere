# Spherical Gallery PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the phantom.land "inside a sphere" gallery: 100 image cards on an infinite 2D grid mapped onto a sphere interior, with drag inertia, hover, and a GSAP detail overlay.

**Architecture:** A stationary perspective camera sits at the sphere center. The gallery is a flat 10×10 logical grid with a 2D scroll offset; every frame each card's wrapped grid position converts to spherical angles and the card mesh is placed on the inner sphere surface facing the camera. Cards outside the visible angular window are hidden (they wrap around modulo the grid extent), giving infinite scroll in both axes with no poles.

**Tech Stack:** Vite, vanilla JS (ES modules), three, gsap, vitest (unit tests for pure logic). Desktop Chrome only.

**Spec:** `docs/superpowers/specs/2026-06-10-spherical-gallery-design.md`

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json` (via npm), `index.html`, `src/styles.css`, `src/main.js`, `.gitignore`

- [ ] **Step 1: Initialize npm project and install dependencies**

```bash
cd /Users/klaushofrichter/Development/sphere
npm init -y
npm install three gsap
npm install -D vite vitest
```

- [ ] **Step 2: Set package.json scripts and module type**

Edit `package.json` so it contains:

```json
{
  "name": "sphere-gallery-poc",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "fetch-images": "node scripts/fetch-images.mjs"
  }
}
```

(keep the `dependencies`/`devDependencies` blocks npm created).

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sphere Gallery PoC</title>
  <link rel="stylesheet" href="/src/styles.css" />
</head>
<body>
  <div id="app"></div>
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
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `src/styles.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; background: #000; overflow: hidden; }
body {
  font-family: 'SF Mono', Menlo, 'Courier New', monospace;
  color: #fff;
  cursor: grab;
}
body.dragging { cursor: grabbing; }
body.hover-card { cursor: pointer; }
#app canvas { position: fixed; inset: 0; display: block; }
.vignette {
  position: fixed; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 80% 65% at 50% 50%,
    transparent 55%, rgba(0, 0, 0, 0.85) 100%);
}
.hud {
  position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
  font-size: 11px; letter-spacing: 0.2em; color: #888; pointer-events: none;
}
.overlay { position: fixed; inset: 0; display: none; z-index: 10; overflow-y: auto; }
.overlay-inner { max-width: 1100px; margin: 0 auto; padding: 96px 48px; }
.overlay-close {
  position: absolute; top: 28px; right: 36px; background: #fff; color: #000;
  border: 0; border-radius: 999px; padding: 12px 24px;
  font: inherit; font-size: 13px; cursor: pointer;
}
.overlay-client { font-size: 13px; letter-spacing: 0.15em; opacity: 0.8; }
.overlay-title {
  font-family: Helvetica, Arial, sans-serif;
  font-size: clamp(48px, 9vw, 130px); line-height: 0.95;
  text-transform: uppercase; margin: 12px 0 24px;
}
.overlay-meta { font-size: 13px; letter-spacing: 0.1em; margin-bottom: 40px; opacity: 0.9; }
.overlay-img { width: 100%; border-radius: 6px; }
```

- [ ] **Step 6: Create placeholder `src/main.js`**

```js
console.log('sphere gallery poc');
```

- [ ] **Step 7: Verify the dev server starts**

Run: `npm run dev -- --port 5173` (leave running in background)
Open `http://localhost:5173` — expect a black page with the "SPHERE GALLERY — POC" header text and no console errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore index.html src/
git commit -m "chore: scaffold vite project with three and gsap"
```

---

### Task 2: Image fetch script + assets

**Files:**
- Create: `scripts/fetch-images.mjs`
- Create (generated): `assets/img-0.jpg` … `assets/img-99.jpg`

- [ ] **Step 1: Write `scripts/fetch-images.mjs`**

```js
import { mkdir, writeFile, access } from 'node:fs/promises';

const COUNT = 100;
await mkdir('assets', { recursive: true });

for (let i = 0; i < COUNT; i++) {
  const dest = `assets/img-${i}.jpg`;
  try {
    await access(dest);
    console.log(`skip ${dest}`);
    continue;
  } catch {}
  const url = `https://picsum.photos/seed/sphere-${i}/640/480.jpg`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.error(`FAILED ${url}: ${res.status}`);
    continue;
  }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`saved ${dest}`);
}
```

- [ ] **Step 2: Run it**

Run: `npm run fetch-images`
Expected: 100 lines of `saved assets/img-N.jpg` (rerun if any `FAILED` lines appear; the script skips already-downloaded files).

- [ ] **Step 3: Verify count and sizes**

Run: `ls assets/*.jpg | wc -l` → `100`; `du -sh assets` → a few MB.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-images.mjs assets/
git commit -m "feat: add image fetch script and 100 sample 640x480 images"
```

---

### Task 3: Card data module (TDD)

**Files:**
- Create: `src/data.js`
- Test: `tests/data.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { makeCards, CARD_COUNT, COLS, ROWS } from '../src/data.js';

describe('makeCards', () => {
  it('produces COLS*ROWS = 100 cards', () => {
    expect(CARD_COUNT).toBe(100);
    expect(COLS * ROWS).toBe(CARD_COUNT);
    expect(makeCards()).toHaveLength(100);
  });

  it('is deterministic', () => {
    expect(makeCards()).toEqual(makeCards());
  });

  it('gives every card the required fields', () => {
    for (const [i, card] of makeCards().entries()) {
      expect(card.id).toBe(i);
      expect(card.client).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.tags.length).toBeGreaterThanOrEqual(1);
      expect(card.year).toBeGreaterThanOrEqual(2017);
      expect(card.year).toBeLessThanOrEqual(2026);
      expect(card.image).toBe(`/assets/img-${i}.jpg`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/data.test.js`
Expected: FAIL — cannot resolve `../src/data.js`.

- [ ] **Step 3: Write `src/data.js`**

```js
const CLIENTS = ['Google', 'Netflix', 'Zendesk', 'Diageo', 'HBO',
  'Bumble', 'YouTube', 'Monocle', 'CapitalG', 'Phantom'];
const QUALIFIERS = ['Pixel', 'Global', 'Festive', 'Annoying', 'Ultimate',
  'Spherical', 'Walking', 'Visitor', 'Brand', 'Travel'];
const SUBJECTS = ['Compass', 'Takeover', 'Experience', 'Generator', 'Tour',
  'Standards', 'Report', 'Guide', 'Resilience', 'Heroes'];
const TAGS = ['EXPERIENCE', 'WEBSITE', '3D', 'CAMPAIGN', 'AI',
  'MOTION', 'CONTENT', 'BRAND', 'EVENT', 'TOOL'];

export const COLS = 10;
export const ROWS = 10;
export const CARD_COUNT = COLS * ROWS;

export function makeCards() {
  return Array.from({ length: CARD_COUNT }, (_, i) => ({
    id: i,
    client: CLIENTS[i % CLIENTS.length],
    title: `${QUALIFIERS[Math.floor(i / 10) % 10]} ${SUBJECTS[(i * 7) % 10]}`,
    tags: [TAGS[i % 10], TAGS[(i + 3) % 10]],
    year: 2017 + (i % 10),
    image: `/assets/img-${i}.jpg`,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/data.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data.js tests/data.test.js
git commit -m "feat: deterministic card metadata for 100 cards"
```

---

### Task 4: Grid→sphere mapping (TDD)

**Files:**
- Create: `src/sphericalMap.js`
- Test: `tests/sphericalMap.test.js`

This is the core math. `wrapOffset` wraps a scroll-relative coordinate into
`[-extent/2, extent/2)` so the grid repeats infinitely. `gridToSphere` turns a card's
wrapped angular coordinates into a 3D position on the inner sphere.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import {
  wrapOffset, gridToSphere,
  SPHERE_RADIUS, THETA_STEP, PHI_STEP, VISIBLE_THETA, VISIBLE_PHI,
} from '../src/sphericalMap.js';

describe('wrapOffset', () => {
  it('keeps values inside the half-extent window', () => {
    expect(wrapOffset(0, 4)).toBe(0);
    expect(wrapOffset(1.9, 4)).toBeCloseTo(1.9);
    expect(wrapOffset(2.1, 4)).toBeCloseTo(-1.9);
    expect(wrapOffset(-2.1, 4)).toBeCloseTo(1.9);
    expect(wrapOffset(4, 4)).toBeCloseTo(0);
    expect(wrapOffset(-13.9, 4)).toBeCloseTo(-1.9);
  });
});

describe('gridToSphere', () => {
  it('places card (0,0) with zero offset at the view center on the sphere', () => {
    const { theta, phi, visible, position } = gridToSphere(0, 0, 0, 0, 10, 10);
    expect(theta).toBe(0);
    expect(phi).toBe(0);
    expect(visible).toBe(true);
    expect(position[0]).toBeCloseTo(0);
    expect(position[1]).toBeCloseTo(0);
    expect(position[2]).toBeCloseTo(-SPHERE_RADIUS);
  });

  it('places a neighbor one theta step to the right', () => {
    const { theta, position } = gridToSphere(1, 0, 0, 0, 10, 10);
    expect(theta).toBeCloseTo(THETA_STEP);
    expect(position[0]).toBeCloseTo(SPHERE_RADIUS * Math.sin(THETA_STEP));
    expect(position[1]).toBeCloseTo(0);
    expect(position[2]).toBeCloseTo(-SPHERE_RADIUS * Math.cos(THETA_STEP));
  });

  it('wraps the last column to just left of center', () => {
    const { theta } = gridToSphere(9, 0, 0, 0, 10, 10);
    expect(theta).toBeCloseTo(-THETA_STEP);
  });

  it('scrolling by exactly one full extent is a no-op', () => {
    const a = gridToSphere(3, 4, 0, 0, 10, 10);
    const b = gridToSphere(3, 4, 10 * THETA_STEP, 10 * PHI_STEP, 10, 10);
    expect(b.theta).toBeCloseTo(a.theta);
    expect(b.phi).toBeCloseTo(a.phi);
  });

  it('culls cards outside the visible window', () => {
    const { visible, position } = gridToSphere(4, 0, 0, 0, 10, 10);
    expect(Math.abs(wrapOffset(4 * THETA_STEP, 10 * THETA_STEP))).toBeGreaterThan(VISIBLE_THETA);
    expect(visible).toBe(false);
    expect(position).toBeNull();
  });

  it('keeps every visible card in front of the camera (z < 0 hemisphere-ish)', () => {
    for (let c = 0; c < 10; c++) {
      for (let r = 0; r < 10; r++) {
        const { visible, position } = gridToSphere(c, r, 1.23, -0.77, 10, 10);
        if (visible) {
          expect(Math.abs(Math.atan2(position[0], -position[2]))).toBeLessThanOrEqual(VISIBLE_THETA + 1e-9);
          expect(Math.abs(Math.asin(position[1] / SPHERE_RADIUS))).toBeLessThanOrEqual(VISIBLE_PHI + 1e-9);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sphericalMap.test.js`
Expected: FAIL — cannot resolve `../src/sphericalMap.js`.

- [ ] **Step 3: Write `src/sphericalMap.js`**

```js
export const SPHERE_RADIUS = 10;
export const THETA_STEP = 0.40;   // horizontal angular spacing between cards (rad)
export const PHI_STEP = 0.344;    // vertical angular spacing (rad), keeps card aspect
export const VISIBLE_THETA = 1.25; // half-window beyond which cards are hidden
export const VISIBLE_PHI = 1.0;

export function wrapOffset(value, extent) {
  const half = extent / 2;
  return ((((value + half) % extent) + extent) % extent) - half;
}

export function gridToSphere(col, row, offsetX, offsetY, cols, rows) {
  const theta = wrapOffset(col * THETA_STEP - offsetX, cols * THETA_STEP);
  const phi = wrapOffset(row * PHI_STEP - offsetY, rows * PHI_STEP);
  const visible = Math.abs(theta) < VISIBLE_THETA && Math.abs(phi) < VISIBLE_PHI;
  if (!visible) return { theta, phi, visible, position: null };
  const r = SPHERE_RADIUS;
  return {
    theta,
    phi,
    visible,
    position: [
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.sin(phi),
      -r * Math.cos(theta) * Math.cos(phi),
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sphericalMap.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS (data + sphericalMap).

- [ ] **Step 6: Commit**

```bash
git add src/sphericalMap.js tests/sphericalMap.test.js
git commit -m "feat: infinite-wrap grid to sphere mapping with culling"
```

---

### Task 5: Card texture baker

**Files:**
- Create: `src/cardTexture.js`

Browser-only module (uses 2D canvas + THREE.CanvasTexture); verified visually in Task 6.
Desktop Chrome only, so `ctx.roundRect` is safe.

- [ ] **Step 1: Write `src/cardTexture.js`**

```js
import * as THREE from 'three';

const W = 688;
const H = 592;
const MARGIN_X = 24;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;

export const CARD_ASPECT = W / H;

export function bakeCardTexture(card, image) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (image) {
    ctx.drawImage(image, MARGIN_X, MARGIN_TOP, 640, 480);
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(MARGIN_X, MARGIN_TOP, 640, 480);
  }

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = '600 17px "SF Mono", Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(card.client.toUpperCase(), MARGIN_X, MARGIN_TOP / 2);
  ctx.textAlign = 'right';
  ctx.fillText(card.title.toUpperCase(), W - MARGIN_X, MARGIN_TOP / 2);

  const chipY = H - MARGIN_BOTTOM / 2;
  let x = MARGIN_X;
  ctx.font = '500 14px "SF Mono", Menlo, monospace';
  for (const tag of card.tags) {
    const tw = ctx.measureText(tag).width;
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.roundRect(x, chipY - 13, tw + 20, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#cfcfcf';
    ctx.textAlign = 'left';
    ctx.fillText(tag, x + 10, chipY + 1);
    x += tw + 30;
  }

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.font = '600 15px "SF Mono", Menlo, monospace';
  ctx.fillText(String(card.year), W - MARGIN_X, chipY);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cardTexture.js
git commit -m "feat: bake card image plus labels into one canvas texture"
```

---

### Task 6: Gallery scene — static sphere render

**Files:**
- Create: `src/gallery.js`
- Modify: `src/main.js` (replace placeholder entirely)

- [ ] **Step 1: Write `src/gallery.js`**

```js
import * as THREE from 'three';
import { gsap } from 'gsap';
import { gridToSphere, SPHERE_RADIUS, THETA_STEP } from './sphericalMap.js';
import { COLS, ROWS } from './data.js';
import { bakeCardTexture, CARD_ASPECT } from './cardTexture.js';

const GAP = 0.06;          // fraction of cell width left as black gap
const BASE_TINT = 0.73;    // resting brightness (multiplied onto the texture)

export class Gallery {
  constructor(scene, cards, images) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const width = 2 * SPHERE_RADIUS * Math.tan(THETA_STEP / 2) * (1 - GAP);
    const height = width / CARD_ASPECT;
    const geo = new THREE.PlaneGeometry(width, height);

    this.meshes = cards.map((card, i) => {
      const tex = bakeCardTexture(card, images[i]);
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      mat.color.setScalar(BASE_TINT);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.card = card;
      mesh.userData.col = i % COLS;
      mesh.userData.row = Math.floor(i / COLS);
      this.group.add(mesh);
      return mesh;
    });

    this.hovered = null;
  }

  update(offsetX, offsetY) {
    for (const mesh of this.meshes) {
      const { visible, position } = gridToSphere(
        mesh.userData.col, mesh.userData.row, offsetX, offsetY, COLS, ROWS,
      );
      mesh.visible = visible;
      if (visible) {
        mesh.position.set(position[0], position[1], position[2]);
        mesh.lookAt(0, 0, 0);
      }
    }
  }

  setHover(mesh) {
    if (this.hovered === mesh) return;
    if (this.hovered) {
      gsap.to(this.hovered.material.color, {
        r: BASE_TINT, g: BASE_TINT, b: BASE_TINT, duration: 0.4, ease: 'power2.out',
      });
    }
    this.hovered = mesh;
    if (mesh) {
      gsap.to(mesh.material.color, { r: 1, g: 1, b: 1, duration: 0.25, ease: 'power2.out' });
    }
  }
}
```

- [ ] **Step 2: Replace `src/main.js` with the static-render version**

```js
import * as THREE from 'three';
import { gsap } from 'gsap';
import { makeCards } from './data.js';
import { Gallery } from './gallery.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(
  65, window.innerWidth / window.innerHeight, 0.1, 50,
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function loadImages(cards) {
  return Promise.all(cards.map((c) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = c.image;
  })));
}

const cards = makeCards();
const images = await loadImages(cards);
const gallery = new Gallery(scene, cards, images);

gsap.ticker.add(() => {
  gallery.update(0, 0);
  renderer.render(scene, camera);
});
```

- [ ] **Step 3: Verify in Chrome**

With `npm run dev` running, load `http://localhost:5173` in Chrome (via the
claude-in-chrome tools) and screenshot. Expected:
- A curved grid of photo cards filling the screen, center card face-on at screen center,
  off-center cards visibly tilted toward the viewer, black gaps between cards.
- White label text in the card gutters (client top-left, title top-right, tag chips +
  year at the bottom).
- Vignette darkening at the edges; no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/gallery.js src/main.js
git commit -m "feat: render 100 cards on inner sphere with baked textures"
```

---

### Task 7: Drag controls with eased inertia

**Files:**
- Create: `src/controls.js`
- Modify: `src/main.js` (wire controls into the ticker)

- [ ] **Step 1: Write `src/controls.js`**

```js
import { gsap } from 'gsap';

const DRAG_SPEED = 0.0022; // radians of scroll per pixel of pointer travel
const EASE = 0.085;        // per-frame lerp factor toward target
const CLICK_DIST = 6;      // px of travel below which pointerup counts as a click
const FLING = 0.45;        // seconds of velocity carried into momentum

export class Controls {
  constructor(el, onClick) {
    this.onClick = onClick;
    this.enabled = true;
    this.target = { x: 0, y: 0 };
    this.current = { x: 0, y: 0 };
    this.dragging = false;
    this.start = null;
    this.last = null;
    this.velocity = { x: 0, y: 0 };

    el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
  }

  onDown(e) {
    if (!this.enabled || e.button !== 0) return;
    this.dragging = true;
    this.start = { x: e.clientX, y: e.clientY };
    this.last = { x: e.clientX, y: e.clientY, t: performance.now() };
    this.velocity = { x: 0, y: 0 };
    gsap.killTweensOf(this.target);
    document.body.classList.add('dragging');
  }

  onMove(e) {
    if (!this.dragging) return;
    const now = performance.now();
    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    const dt = Math.max(now - this.last.t, 1);
    this.target.x -= dx * DRAG_SPEED;
    this.target.y += dy * DRAG_SPEED;
    this.velocity.x = (-dx * DRAG_SPEED / dt) * 1000;
    this.velocity.y = (dy * DRAG_SPEED / dt) * 1000;
    this.last = { x: e.clientX, y: e.clientY, t: now };
  }

  onUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    document.body.classList.remove('dragging');
    const travel = Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y);
    if (travel < CLICK_DIST) {
      this.onClick(e);
      return;
    }
    gsap.to(this.target, {
      x: this.target.x + this.velocity.x * FLING,
      y: this.target.y + this.velocity.y * FLING,
      duration: 1.4,
      ease: 'power3.out',
    });
  }

  tick() {
    this.current.x += (this.target.x - this.current.x) * EASE;
    this.current.y += (this.target.y - this.current.y) * EASE;
  }
}
```

- [ ] **Step 2: Wire into `src/main.js`**

Replace the final block of `src/main.js` (from `const gallery = ...` to the end) with:

```js
const gallery = new Gallery(scene, cards, images);
const controls = new Controls(renderer.domElement, () => {});

gsap.ticker.add(() => {
  controls.tick();
  gallery.update(controls.current.x, controls.current.y);
  renderer.render(scene, camera);
});
```

and add the import at the top:

```js
import { Controls } from './controls.js';
```

- [ ] **Step 3: Verify in Chrome**

Reload the page; using browser automation, drag left/right and up/down with
screenshots before/after each drag. Expected:
- Content scrolls opposite hand motion like grabbing the sphere (drag content with the
  cursor — if the felt direction is inverted vs phantom.land, flip the `-=`/`+=` signs
  in `onMove`).
- Motion continues with decaying momentum after release; comes to rest smoothly.
- A huge drag in any direction keeps producing wrapped content (no edge, no poles).
- Cursor is `grab`, `grabbing` while dragging.

- [ ] **Step 4: Commit**

```bash
git add src/controls.js src/main.js
git commit -m "feat: drag controls with eased inertia and infinite wrap"
```

---

### Task 8: Hover highlight + click detection

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add raycasting hover/click to `src/main.js`**

Insert after `const gallery = new Gallery(...)`:

```js
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerOnScreen = false;
window.addEventListener('pointermove', (e) => {
  pointerOnScreen = true;
  pointerNdc.set(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
});

function pick() {
  if (!pointerOnScreen) return null;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(gallery.meshes.filter((m) => m.visible));
  return hits.length ? hits[0].object : null;
}
```

Change the controls construction to log clicks for now:

```js
const controls = new Controls(renderer.domElement, () => {
  const mesh = pick();
  if (mesh) console.log('card click:', mesh.userData.card.title);
});
```

And replace the ticker with:

```js
gsap.ticker.add(() => {
  controls.tick();
  gallery.update(controls.current.x, controls.current.y);
  const hoverMesh = controls.dragging ? null : pick();
  gallery.setHover(hoverMesh);
  document.body.classList.toggle('hover-card', !!hoverMesh && !controls.dragging);
  renderer.render(scene, camera);
});
```

- [ ] **Step 2: Verify in Chrome**

- Hover over a card: it brightens smoothly; moving off dims it back; cursor becomes
  pointer.
- Click (no drag) on a card: console logs `card click: <title>`.
- Drag ending on a card does NOT log a click.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: hover brighten and click-vs-drag discrimination"
```

---

### Task 9: Detail overlay with GSAP timeline

**Files:**
- Create: `src/overlay.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write `src/overlay.js`**

```js
import { gsap } from 'gsap';

const PALETTE = ['#5b5bd6', '#d65b5b', '#3e8e5a', '#c98a2d', '#7a4fd0', '#2d8fc9'];

export class Overlay {
  constructor() {
    this.el = document.getElementById('overlay');
    this.clientEl = document.getElementById('overlay-client');
    this.titleEl = document.getElementById('overlay-title');
    this.metaEl = document.getElementById('overlay-meta');
    this.imgEl = document.getElementById('overlay-img');
    this.isOpen = false;
    this.onCloseStart = null;

    document.getElementById('overlay-close')
      .addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  open(card) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.el.style.background = PALETTE[card.id % PALETTE.length];
    this.clientEl.textContent = card.client.toUpperCase();
    this.titleEl.textContent = card.title;
    this.metaEl.textContent = `${card.tags.join('  ·  ')}   —   ${card.year}`;
    this.imgEl.src = card.image;
    this.el.setAttribute('aria-hidden', 'false');

    gsap.timeline()
      .set(this.el, { display: 'block' })
      .fromTo(this.el,
        { clipPath: 'inset(100% 0 0 0)' },
        { clipPath: 'inset(0% 0 0 0)', duration: 0.7, ease: 'power4.inOut' })
      .from([this.clientEl, this.titleEl, this.metaEl, this.imgEl], {
        y: 60, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out',
      }, '-=0.25');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.onCloseStart) this.onCloseStart();
    gsap.to(this.el, {
      clipPath: 'inset(0 0 100% 0)',
      duration: 0.55,
      ease: 'power4.inOut',
      onComplete: () => {
        gsap.set(this.el, { display: 'none' });
        this.el.setAttribute('aria-hidden', 'true');
      },
    });
  }
}
```

- [ ] **Step 2: Wire into `src/main.js`**

Add import:

```js
import { Overlay } from './overlay.js';
```

After the gallery construction add:

```js
const overlay = new Overlay();
```

Replace the controls click handler:

```js
const controls = new Controls(renderer.domElement, () => {
  const mesh = pick();
  if (mesh) {
    controls.enabled = false;
    gallery.setHover(null);
    overlay.open(mesh.userData.card);
  }
});
overlay.onCloseStart = () => { controls.enabled = true; };
```

Guard hover while open — in the ticker change the hover line to:

```js
const hoverMesh = (controls.dragging || overlay.isOpen) ? null : pick();
```

- [ ] **Step 3: Verify in Chrome**

- Click a card: colored panel wipes up over the gallery; client, big uppercase title,
  tags/year line and the image stagger in.
- Close button (and Escape) wipe it away downward; gallery is exactly where it was;
  drag works again afterwards.

- [ ] **Step 4: Commit**

```bash
git add src/overlay.js src/main.js
git commit -m "feat: GSAP detail overlay on card click"
```

---

### Task 10: Intro animation + final polish/verification

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add the intro animation at the end of `src/main.js`**

```js
camera.fov = 95;
camera.updateProjectionMatrix();
gsap.to(camera, {
  fov: 65,
  duration: 1.8,
  ease: 'power3.inOut',
  onUpdate: () => camera.updateProjectionMatrix(),
});
gsap.from(controls.target, { x: 0.6, y: -0.3, duration: 1.8, ease: 'power3.out' });
```

- [ ] **Step 2: Run the unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Full verification pass in Chrome (per pr.md: use devtools)**

- Reload: intro zoom/drift settles into the gallery.
- Drag all four directions incl. flings; verify smooth eased motion and infinite wrap.
- Hover brighten, pointer cursor; click → overlay; Escape → back.
- Performance: with the page under load (continuous drag), check the frame rate stays
  ~60fps — use `performance.now()` sampling via the JS console or the Performance
  panel; no long tasks > 50ms during steady drag.
- Side-by-side visual comparison against https://www.phantom.land/ (wait ~15s for its
  full sphere mode): similar curvature (~4–5 columns visible, strong tilt on edge
  cards), similar label layout, vignette, black gaps. Tune `THETA_STEP`, camera `fov`,
  `VISIBLE_*`, vignette gradient if needed.

- [ ] **Step 4: Tune constants if comparison shows mismatch**

Knobs (all in `src/sphericalMap.js` / `src/main.js`):
- More curvature → larger `THETA_STEP`/`PHI_STEP` (keep ratio ≈ 0.86 to preserve card
  aspect).
- More cards visible → larger camera `fov` or smaller steps.
- Re-run `npm test` after any constant change (tests reference the exported constants,
  not hard-coded values, except the wrap examples which are step-independent).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: intro animation and visual tuning to match reference"
```
