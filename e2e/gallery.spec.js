import { test, expect } from '@playwright/test';

const CENTER = { x: 640, y: 360 };

/** Grab the rendered canvas pixels as a screenshot buffer. */
async function canvasShot(page) {
  return page.locator('canvas').screenshot();
}

/**
 * Wait until gallery motion has stopped: the scroll offset's lerp has
 * converged on its target and no drag is active. Reads the dev-only
 * window.__sphere test hook — deterministic and CI-speed-independent,
 * unlike diffing canvas pixels (the lerp tail keeps frames sub-pixel
 * different for a long time on slow software WebGL).
 *
 * Coupling note: this assumes the gallery is idle once current~=target.
 * If an always-on idle animation (e.g. auto-rotation) is ever added,
 * "settled" needs a new definition and these tests will time out here.
 */
async function settleGallery(page) {
  await page.waitForFunction(
    () => {
      const c = window.__sphere?.controls;
      if (!c || c.dragging) return false;
      return (
        Math.abs(c.target.x - c.current.x) < 1e-4 &&
        Math.abs(c.target.y - c.current.y) < 1e-4
      );
    },
    { timeout: 20_000 },
  );
}

/** Navigate, wait for all images, and let the intro animation settle. */
async function openGallery(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await settleGallery(page);
}

/**
 * Move the pointer to the viewport center and assert a card is actually
 * raycast-hit there (body gets the hover-card class) before interacting.
 * Fails loudly if a layout change ever leaves a gap at center.
 */
async function hoverCenterCard(page) {
  await page.mouse.move(CENTER.x, CENTER.y);
  await expect(
    page.locator('body'),
    'no card under the viewport center — did the sphere layout change?',
  ).toHaveClass(/hover-card/);
}

test.describe('sphere gallery', () => {
  test('loads without errors and renders the canvas', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failedAssets = [];
    page.on('console', (msg) => {
      // favicon 404s and similar noise are not app failures
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('requestfailed', (req) => {
      if (req.url().includes('/assets/')) failedAssets.push(req.url());
    });

    await openGallery(page);

    await expect(page.locator('canvas')).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedAssets).toEqual([]);

    // Not a flat fill: the center (cards) must differ from the corner (vignette).
    const center = await page.screenshot({ clip: { x: 540, y: 260, width: 200, height: 200 } });
    const corner = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 200 } });
    expect(center.equals(corner)).toBe(false);
  });

  test('dragging scrolls the gallery and easing continues after release', async ({ page }) => {
    await openGallery(page);
    const before = await canvasShot(page);

    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.down();
    await page.mouse.move(CENTER.x - 400, CENTER.y - 150, { steps: 15 });
    await page.mouse.up();

    const justReleased = await canvasShot(page);
    expect(justReleased.equals(before)).toBe(false);

    // Rendering keeps changing after the pointer is released. Note: this
    // covers the eased lerp tail and/or the fling tween — it does not
    // isolate fling momentum specifically (the lerp alone would pass it).
    await expect
      .poll(async () => (await canvasShot(page)).equals(justReleased), {
        timeout: 3_000,
        message: 'canvas froze immediately on release — no easing?',
      })
      .toBe(false);
  });

  test('hovering a card sets the pointer-cursor class on body', async ({ page }) => {
    await openGallery(page);
    await hoverCenterCard(page);
  });

  test('a click opens the overlay with populated content', async ({ page }) => {
    await openGallery(page);

    await hoverCenterCard(page);
    await page.mouse.down();
    await page.mouse.up();

    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#overlay-title')).not.toBeEmpty();
    await expect(page.locator('#overlay-client')).not.toBeEmpty();
    await expect(page.locator('#overlay-meta')).not.toBeEmpty();
    await expect(page.locator('#overlay-img')).toHaveAttribute('src', /\/assets\/img-\d+\.jpg/);
  });

  test('a drag does NOT open the overlay', async ({ page }) => {
    await openGallery(page);

    await hoverCenterCard(page);
    await page.mouse.down();
    await page.mouse.move(CENTER.x - 300, CENTER.y, { steps: 10 });
    await page.mouse.up();
    await settleGallery(page);

    await expect(page.locator('#overlay')).toBeHidden();
  });

  test('Escape closes the overlay and the gallery is interactive again', async ({ page }) => {
    await openGallery(page);

    // open
    await hoverCenterCard(page);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('#overlay')).toBeVisible();

    // close
    await page.keyboard.press('Escape');
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#overlay')).toHaveAttribute('aria-hidden', 'true');

    // gallery responds to drag again
    const before = await canvasShot(page);
    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.down();
    await page.mouse.move(CENTER.x + 350, CENTER.y + 120, { steps: 12 });
    await page.mouse.up();
    const after = await canvasShot(page);
    expect(after.equals(before)).toBe(false);
  });

  test('close button closes the overlay', async ({ page }) => {
    await openGallery(page);

    await hoverCenterCard(page);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('#overlay')).toBeVisible();

    await page.locator('#overlay-close').click();
    await expect(page.locator('#overlay')).toBeHidden();
  });
});
