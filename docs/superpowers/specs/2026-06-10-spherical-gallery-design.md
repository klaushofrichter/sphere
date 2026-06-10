# Spherical Gallery PoC — Design

**Date:** 2026-06-10
**Goal:** Recreate the phantom.land "inside a sphere" work gallery as a proof of concept, using Three.js and GSAP, for desktop Chrome only.

## Reference behavior (observed on phantom.land)

- Entire gallery renders into a single full-screen WebGL canvas; black background.
- ~100 project cards arranged in a grid bent onto the inside of a sphere. Strong curvature:
  rows and the thin separator lines arc visibly; off-center cards tilt in 3D to face the
  viewer; corner cards tilt hardest. Roughly 4–5 columns × 3 rows visible at once.
- Left-click drag scrolls the grid infinitely in both axes (no poles, no clamps), with
  smooth eased inertia. Releasing during a fast drag keeps momentum that decays.
- Each grid cell shows a photo with small white mono-font labels in the dark gutters
  around it: client (top-left), title (top-right), tag chips (bottom-left), year
  (bottom-right). Hover brightens the cell. Vignette fades the screen edges to black.
- Clicking a card animates a project detail page in (solid color background, large title,
  tag chips, hero image).

## Architecture: infinite 2D grid mapped onto a sphere

The gallery is logically a **flat 2D grid** (10 columns × 10 rows = 100 cards) with a
scroll offset vector driven by dragging. Every frame, each card's wrapped grid position is
converted to spherical angles (longitude/latitude relative to view center) and its mesh is
placed on the inside of a fixed-radius sphere around a **stationary camera** at the
center, oriented to face the camera. Cards scrolled beyond the visible angular window wrap
around modulo the grid extent.

Why not a rotating camera in a fixed sphere: vertical rotation would hit poles, and the
grid could not repeat infinitely up/down — the observed site scrolls endlessly in both
axes.

This also serves the stated future need (automatic smooth navigation through a
predetermined set of images): navigation is just tweening the 2D scroll offset.

## Components

- **`index.html` + `src/main.js`** — entry; sets up renderer, scene, camera, resize.
- **`src/data.js`** — deterministic fake metadata for 100 cards (client, title, tags, year)
  and asset paths.
- **`src/cardTexture.js`** — offscreen 2D-canvas baker: one texture per card combining the
  640×480 photo and its label text in black margins (crisp text, no extra label meshes).
- **`src/gallery.js`** — grid→sphere mapping, per-frame placement, wrap logic, raycaster
  hover (GSAP brightness tween), click detection (pointer travel < threshold).
- **`src/controls.js`** — pointer drag → target offset vector; GSAP ticker lerps actual
  offset toward target (ease-out); release velocity gives decaying momentum.
- **`src/overlay.js`** — DOM detail overlay animated with a GSAP timeline: colored panel
  wipes in over the gallery with big title, the clicked image, tag chips, and a close
  button; close reverses the timeline; gallery keeps its scroll position underneath.
- **`scripts/fetch-images.mjs`** — one-time Node script downloading 100 seeded 640×480
  images from Lorem Picsum into `./assets/`.
- **Vignette** — full-screen radial-gradient DOM element (pointer-events: none).
- **Intro** — brief GSAP zoom/settle animation on load.

## Stack

Vite + npm, vanilla JS (no framework), `three`, `gsap`. Desktop Chrome only; no
responsive/mobile work. Git repo initialized in this folder.

## Visual parameters (tuned against the reference)

- Sphere radius small relative to card spacing → pronounced curvature; ~4.5 columns
  visible across the viewport; perspective camera FOV tuned to match (~60–70°).
- Card cell: 640×480 image with dark gutter margins carrying the four label zones.
- Background #000; labels white/grey mono font; thin cell separators visible as gaps.

## Error handling

- Missing/failed image → cell renders with placeholder color + labels (PoC level).
- WebGL context loss: not handled beyond browser default (PoC).

## Testing / verification

- `npm run dev` (Vite); drive the page in Chrome via devtools as pr.md requires.
- Verify: 60 fps during drag (Performance panel), infinite wrap both axes, eased inertia,
  hover brighten, click vs drag discrimination, overlay in/out animation, side-by-side
  visual comparison with phantom.land.

## Out of scope

- Mobile/touch, accessibility, SEO anchors, sound, filtering UI, real project content,
  dynamic image service (later phase), automatic navigation (later phase — enabled by the
  offset-tween design but not implemented).

## Future-phase constraints the design must not preclude

- **Dynamic image exchange:** in a later phase, individual card images will be swapped at
  runtime from a service. The per-card texture baking supports this: re-bake one card's
  texture from a new image and assign it to that mesh's `material.map`
  (`needsUpdate = true`). No global atlas or shared texture is used, so swaps stay cheap
  and card-local.
- **Automatic navigation:** scrolling is a single 2D offset vector, so automated tours are
  GSAP tweens of that vector.
