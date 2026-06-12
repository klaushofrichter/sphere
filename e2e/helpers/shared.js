// Helpers shared between the dev gallery suite and the live verification.

/** Pixel center of the shared 1280x720 viewport (see playwright.shared.js). */
export const CENTER = { x: 640, y: 360 };

/** Grab the rendered canvas pixels as a screenshot buffer. */
export async function canvasShot(page) {
  return page.locator('canvas').screenshot();
}
