import { test, expect } from '@playwright/test';

const CENTER = { x: 640, y: 360 };
const INTRO_MS = 2600; // intro zoom/drift is 1.8s; allow settle

/** Navigate, wait for all images + intro animation to finish. */
async function openGallery(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(INTRO_MS);
}

/** Grab the rendered canvas pixels as a screenshot buffer. */
async function canvasShot(page) {
  return page.locator('canvas').screenshot();
}

test.describe('sphere gallery', () => {
  test('loads without errors and renders the canvas', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failedAssets = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
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

    // The canvas must not be a blank black frame: at least some variation.
    const shot = await canvasShot(page);
    expect(shot.length).toBeGreaterThan(10_000); // PNG of real content, not a flat fill
  });

  test('dragging scrolls the gallery and momentum continues after release', async ({ page }) => {
    await openGallery(page);
    const before = await canvasShot(page);

    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.down();
    await page.mouse.move(CENTER.x - 400, CENTER.y - 150, { steps: 15 });
    await page.mouse.up();

    const justReleased = await canvasShot(page);
    expect(justReleased.equals(before)).toBe(false);

    // Momentum: rendering keeps changing after the pointer is released.
    await page.waitForTimeout(400);
    const later = await canvasShot(page);
    expect(later.equals(justReleased)).toBe(false);
  });

  test('hovering a card sets the pointer-cursor class on body', async ({ page }) => {
    await openGallery(page);
    await page.mouse.move(CENTER.x, CENTER.y);
    await expect(page.locator('body')).toHaveClass(/hover-card/);
  });

  test('a click opens the overlay with populated content', async ({ page }) => {
    await openGallery(page);

    await page.mouse.move(CENTER.x, CENTER.y);
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

    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.down();
    await page.mouse.move(CENTER.x - 300, CENTER.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await expect(page.locator('#overlay')).toBeHidden();
  });

  test('Escape closes the overlay and the gallery is interactive again', async ({ page }) => {
    await openGallery(page);

    // open
    await page.mouse.move(CENTER.x, CENTER.y);
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

    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('#overlay')).toBeVisible();

    await page.locator('#overlay-close').click();
    await expect(page.locator('#overlay')).toBeHidden();
  });
});
