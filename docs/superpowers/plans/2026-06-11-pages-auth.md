# EEN Login on GitHub Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The deployed GitHub Pages site requires EEN OAuth sign-in; live verification performs a real login against the deployed site.

**Architecture:** Pure configuration (approach A): the deploy workflow injects `VITE_PROXY_URL`/`VITE_EEN_CLIENT_ID` (secrets) and `VITE_REDIRECT_URI=https://klaushofrichter.github.io/sphere` (literal, the exact registered form) into the Pages build — zero app-code changes; the existing build-time auth switch does the rest. The live e2e spec becomes a single authenticated journey (login view → real IdP login → gallery drag → sign out).

**Tech Stack:** GitHub Actions env wiring, Playwright (live config), README updates.

**Spec:** `docs/superpowers/specs/2026-06-11-pages-auth-design.md`

**Known limitation:** the rewritten live spec cannot be executed before the next production deploy (the currently-deployed site is open mode, and the IdP won't redirect to any local preview). Verification before merge is syntax-level (`--list`); the first deploy is the real test. This is accepted in the spec.

---

### Task 1: Deploy workflow env wiring

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Inject auth env into the Pages build**

In the `build` job, change the build step from:

```yaml
      - run: npx vite build --base=/sphere/
```

to:

```yaml
      # Public-by-design values (OAuth public client id, public proxy URL,
      # registered redirect URI) baked into the public bundle: the Pages
      # site requires EEN sign-in. CLIENT_SECRET stays proxy-side.
      - run: npx vite build --base=/sphere/
        env:
          VITE_PROXY_URL: ${{ secrets.VITE_PROXY_URL }}
          VITE_EEN_CLIENT_ID: ${{ secrets.VITE_EEN_CLIENT_ID }}
          VITE_REDIRECT_URI: https://klaushofrichter.github.io/sphere
```

(`VITE_REDIRECT_URI` is the literal registered form — no trailing slash.)

- [ ] **Step 2: Give the verify job the login credentials**

In the `verify` job, change:

```yaml
      - run: npm run test:e2e:live
        env:
          LIVE_BASE_URL: ${{ needs.deploy.outputs.page_url }}
```

to:

```yaml
      - run: npm run test:e2e:live
        env:
          LIVE_BASE_URL: ${{ needs.deploy.outputs.page_url }}
          TEST_USER: ${{ secrets.TEST_USER }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

- [ ] **Step 3: Validate YAML**

Run: `npx --yes js-yaml .github/workflows/deploy.yml > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build Pages with EEN auth and give live verification login credentials"
```

---

### Task 2: Live spec rewrite (authenticated journey) + trace hygiene

**Files:**
- Modify: `playwright.live.config.js`, `e2e-live/live.spec.js`

- [ ] **Step 1: Disable traces in CI in `playwright.live.config.js`**

Change the `trace` line in `use` to:

```js
    // The live journey types real credentials; a trace would record them.
    // Local runs may keep traces (never uploaded).
    trace: process.env.CI ? 'off' : 'on-first-retry',
```

- [ ] **Step 2: Replace `e2e-live/live.spec.js` entirely with**

```js
import { test, expect } from '@playwright/test';

// Post-deployment verification: a single authenticated journey against the
// live GitHub Pages site. The production build has no test hook, so settling
// uses fixed waits. IdP selectors mirror e2e/auth.setup.ts (kept in sync
// deliberately — if EEN changes their login page, fix both).

const CENTER = { x: 640, y: 360 };
const SETTLE_MS = 5_000;

async function canvasShot(page) {
  return page.locator('canvas').screenshot();
}

test('live site requires EEN sign-in and serves the gallery after login', async ({ page }) => {
  test.setTimeout(240_000);
  const user = process.env.TEST_USER;
  const password = process.env.TEST_PASSWORD;
  if (!user || !password) throw new Error('TEST_USER / TEST_PASSWORD not set');

  await test.step('login view renders (an accidentally-open deployment fails here)', async () => {
    const response = await page.goto('./');
    expect(response.ok()).toBe(true);
    await expect(page.getByTestId('login-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  await test.step('real EEN login', async () => {
    await page.getByTestId('login-button').click();

    const email = page.locator('input[name="email"], input[type="email"]').first();
    await email.waitFor({ timeout: 30_000 });
    await email.fill(user);
    await page.getByRole('button', { name: /next/i }).click();

    const pwd = page.locator('input[type="password"]').first();
    await pwd.waitFor({ timeout: 30_000 });
    await pwd.fill(password);
    await page.getByRole('button', { name: /sign in|log ?in|submit|next/i }).first().click();

    await page.waitForURL(/klaushofrichter\.github\.io\/sphere/, { timeout: 60_000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  });

  await test.step('gallery responds to drag', async () => {
    await page.waitForTimeout(SETTLE_MS); // intro + lerp tail
    const before = await canvasShot(page);
    await page.mouse.move(CENTER.x, CENTER.y);
    await page.mouse.down();
    await page.mouse.move(CENTER.x - 400, CENTER.y - 150, { steps: 15 });
    await page.mouse.up();
    const after = await canvasShot(page);
    expect(after.equals(before)).toBe(false);
  });

  await test.step('sign out returns to the login view and clears the session', async () => {
    await page.waitForTimeout(1_500); // let momentum settle before clicking the chip
    await page.getByTestId('signout-button').click();
    await expect(page.getByTestId('login-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Syntax-verify (cannot run against the live site yet)**

Run: `npx playwright test --config playwright.live.config.js --list`
Expected: lists `live site requires EEN sign-in and serves the gallery after login`, exit 0.

- [ ] **Step 4: Confirm regular suites are unaffected**

```bash
pkill -f vite 2>/dev/null; sleep 1
npm test                                              # 15 unit tests
VITE_PROXY_URL= VITE_EEN_CLIENT_ID= npm run test:e2e  # 7 open-mode gallery specs
npm run test:e2e:build                                # 1 build smoke
```

- [ ] **Step 5: Commit**

```bash
git add playwright.live.config.js e2e-live/live.spec.js
git commit -m "test: live verification performs a real EEN login against the deployed site"
```

---

### Task 3: README wording

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the live-demo line**

Change:

```markdown
**Live demo:** https://klaushofrichter.github.io/sphere/ ·
**Latest release:** https://github.com/klaushofrichter/sphere/releases/latest
```

to:

```markdown
**Live demo:** https://klaushofrichter.github.io/sphere/ (requires an
Eagle Eye Networks sign-in) ·
**Latest release:** https://github.com/klaushofrichter/sphere/releases/latest
```

- [ ] **Step 2: Update the Authentication section's deployment paragraph**

Change:

```markdown
Without those two variables the app builds in **open mode** — no login, the
gallery is public. The GitHub Pages deployment builds without them, so the
live demo stays open.
```

to:

```markdown
Without those two variables the app builds in **open mode** — no login, the
gallery is public (used by the local build-smoke test and available for
demos). The GitHub Pages deployment builds **with** them, so the live site
requires sign-in; after each deploy, the live verification performs a real
EEN login against the deployed site before a release is cut.
```

- [ ] **Step 3: Update the Configuration table row**

Change the `VITE_PROXY_URL`, `VITE_EEN_CLIENT_ID` row description from:

```markdown
| `VITE_PROXY_URL`, `VITE_EEN_CLIENT_ID` | The auth build switch: present → the app requires EEN sign-in (dev + CI e2e); absent → open mode (GitHub Pages). |
```

to:

```markdown
| `VITE_PROXY_URL`, `VITE_EEN_CLIENT_ID` | The auth build switch: present → the app requires EEN sign-in (dev, CI e2e, and the GitHub Pages deployment); absent → open mode (build-smoke test, local demos). |
```

- [ ] **Step 4: Update the deployment pipeline bullet**

In "Branches, CI, and deployment", change:

```markdown
- Merging to `production` triggers the deploy workflow: build → publish to
  GitHub Pages → **live e2e verification against the deployed site** → on
```

to:

```markdown
- Merging to `production` triggers the deploy workflow: build (with EEN auth
  baked in) → publish to GitHub Pages → **live e2e verification including a
  real EEN sign-in against the deployed site** → on
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: live demo requires EEN sign-in"
```

---

## Post-merge verification (controller, not a task)

After the PR merges and the pipeline runs: the live verification's step 1
proves the deployed site gates on login; steps 2–4 prove the registered
redirect URI, proxy CORS, token exchange, gallery, and sign-out on the live
site. If CORS is missing, expect step 2 to fail at the token exchange.
