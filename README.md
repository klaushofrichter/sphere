# Sphere Gallery

A WebGL proof of concept: an image gallery wrapped around the inside of a sphere.
You stand at the center, drag to look around, and the grid of cards scrolls
infinitely in every direction with smooth, eased inertia. Clicking a card animates
a detail page in; closing it returns you exactly where you were.

Inspired by the work gallery at [phantom.land](https://www.phantom.land/).

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
  grid→sphere math and card data are unit tested).

## Quick start

Requires Node 18+ and desktop Chrome (the PoC targets Chrome only).

```bash
npm install
npm run fetch-images   # one-time: downloads 100 sample 640x480 images into public/assets
npm run dev            # open http://localhost:5173
```

Other scripts: `npm test` (unit tests), `npm run build` (production build).

## Controls

| Action | Result |
|---|---|
| Left-click drag | Look around the sphere (infinite in all directions) |
| Release while moving | Momentum fling with smooth decay |
| Hover a card | Card brightens |
| Click a card | Detail page animates in |
| Escape / Close | Back to the gallery, position preserved |

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
