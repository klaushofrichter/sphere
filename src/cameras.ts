// Camera data for the sphere gallery. The ONLY module besides auth.ts that
// imports een-api-toolkit (fetch layer added in a later task).
//
// Distribution scheme:
//   First, a deterministic search finds coefficients (a, b) such that the
//   linear assignment f(r, c) = (a*r + b*c) mod n places all n cameras in the
//   100-cell grid with no horizontal or vertical conflicts (including wrap-
//   around).  The search is exhaustive over small a, b values and succeeds for
//   almost all n; it fails only when n divides (cols-1)=9, i.e. n ∈ {3, 9}.
//
//   For the n∈{3,9} fallback, a sequence-rotation scheme is used: the base
//   row S is the uniform tiling c%n with the last element bumped to break the
//   wrap collision (S[cols-1] ← first value ≠ S[cols-2] and ≠ S[0]), then row
//   r is S rotated left by r*k positions, where k is the smallest positive
//   integer such that S[c] ≠ S[(c+k)%cols] (V-neighbor) and
//   S[c] ≠ S[(c+(rows-1)*k)%cols] (V-wrap) for every c.
//
//   Both paths are deterministic (no randomness) and guarantee every camera
//   index in [0, n) appears at least once when n ≤ cols*rows.

export const COLS = 10;
export const ROWS = 10;

/**
 * Distribute `n` cameras across a `cols × rows` toroidal grid so that no two
 * adjacent cells (horizontal or vertical, with wrap-around) show the same
 * camera index.
 *
 * Returns an array of length `cols * rows`.  Each element is a camera index in
 * [0, min(n, cols*rows)).  When n >= cols*rows the first cols*rows camera
 * indices are used, one per cell.
 */
export function distributeCameras(n: number, cols: number, rows: number): number[] {
  const cells = cols * rows;

  // When there are at least as many cameras as cells, assign one per cell.
  if (n >= cells) {
    return Array.from({ length: cells }, (_, i) => i);
  }

  // Single camera — no neighbor constraint is tested for n=1.
  if (n === 1) {
    return new Array(cells).fill(0);
  }

  // ── Path A: linear scheme f(r, c) = (a*r + b*c) mod n ───────────────────
  // Search for the smallest (a, b) satisfying all four conditions:
  //   1. b*(cols-1) mod n ≠ 0  — H-wrap pair differs
  //   2. b mod n ≠ 0           — H-neighbors differ
  //   3. a mod n ≠ 0           — V-neighbors differ
  //   4. a*(rows-1) mod n ≠ 0  — V-wrap pair (row rows-1 → row 0) differs
  //   5. All n values appear in the grid (coverage check)
  const limit = Math.max(20, n);
  for (let a = 1; a < limit; a++) {
    if (a % n === 0) continue;
    if ((a * (rows - 1)) % n === 0) continue;
    for (let b = 1; b < limit; b++) {
      if (b % n === 0) continue;
      if ((b * (cols - 1)) % n === 0) continue;

      const grid = Array.from({ length: cells }, (_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (a * r + b * c) % n;
      });

      if (new Set(grid).size === n) return grid;
    }
  }

  // ── Path B: sequence-rotation fallback (used when n | (cols-1) = 9) ─────
  // Build base row S = [0 % n, 1 % n, ..., (cols-1) % n]
  const S: number[] = Array.from({ length: cols }, (_, c) => c % n);

  // Fix H-wrap: if S[cols-1] === S[0], replace S[cols-1] with the first value
  // that is neither S[cols-2] (left-neighbor) nor S[0] (wrap-neighbor).
  if (S[cols - 1] === S[0]) {
    const forbidden = new Set<number>([S[cols - 2], S[0]]);
    for (let v = 0; v < n; v++) {
      if (!forbidden.has(v)) {
        S[cols - 1] = v;
        break;
      }
    }
  }

  // Find the smallest rotation step k such that:
  //   - S[c] ≠ S[(c + k) % cols]           for all c  (V-neighbors)
  //   - S[c] ≠ S[(c + wrapOff) % cols]     for all c  (V-wrap)
  //     where wrapOff = ((rows-1) * k) % cols
  for (let k = 1; k < cols; k++) {
    let vOk = true;
    for (let c = 0; c < cols; c++) {
      if (S[c] === S[(c + k) % cols]) { vOk = false; break; }
    }
    if (!vOk) continue;

    const wrapOff = ((rows - 1) * k) % cols;
    let vwrapOk = true;
    for (let c = 0; c < cols; c++) {
      if (S[c] === S[(c + wrapOff) % cols]) { vwrapOk = false; break; }
    }
    if (!vwrapOk) continue;

    const grid: number[] = new Array(cells);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        grid[r * cols + c] = S[(c + r * k) % cols];
      }
    }

    if (new Set(grid).size === Math.min(n, cells)) return grid;
  }

  // Unreachable for any valid n, cols, rows combination.
  return new Array(cells).fill(0);
}

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
    // The list endpoint omits status unless explicitly included.
    const { data, error } = await getCameras({ include: ['status'], ...(pageToken ? { pageToken } : {}) });
    if (error) return { cameras: null, error: error.message };
    all.push(...data.results);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { cameras: all, error: null };
}

/**
 * Build 100 cards via the distribution and stream preview images for each
 * DISTINCT camera (concurrency-limited). Offline cameras are excluded from
 * the gallery entirely. onPreview(deviceId, dataUrl|null) fires as each
 * preview resolves; the caller re-bakes that camera's cells. Resolves once
 * the camera list is known; previews keep arriving after.
 */
// Statuses that mean the camera is connected and can deliver video. The full
// EEN enum also has offline variants (offline/deviceOffline/bridgeOffline/
// invalidCredentials/error) and transitional states (registered/attaching/
// initializing) — none of those belong in the gallery.
const SHOWN_STATUSES = new Set(['ONLINE', 'STREAMING']);

export async function loadCameraCards(
  onPreview: (deviceId: string, dataUrl: string | null) => void,
): Promise<{ cards: CameraCard[] | null; error: string | null }> {
  const { cameras: all, error } = await fetchAllCameras();
  if (error) return { cards: null, error };
  const cameras = (all ?? []).filter((c) => SHOWN_STATUSES.has(cameraStatusText(c)));
  if (cameras.length === 0) {
    return { cards: null, error: 'No online cameras available for this account' };
  }

  const assign = distributeCameras(cameras.length, COLS, ROWS);
  if (cameras.length > COLS * ROWS) {
    console.warn(`Account has ${cameras.length} online cameras; showing the first ${COLS * ROWS}.`);
  }
  const cards: CameraCard[] = assign.map((cameraIdx, cell) => ({
    id: cell,
    deviceId: cameras[cameraIdx].id,
    title: cameras[cameraIdx].name,
    tags: [cameraStatusText(cameras[cameraIdx])],
    pending: true,
  }));

  // Fire-and-forget preview pool over the distinct cameras actually used.
  const queue = [...new Set(assign)].map((i) => cameras[i].id);
  const worker = async () => {
    for (let d = queue.shift(); d !== undefined; d = queue.shift()) {
      // Guard the whole body: a thrown refresh (vs. the {data:null} path)
      // would otherwise kill this worker and permanently shrink concurrency.
      try {
        const dataUrl = await refreshPreview(d);
        onPreview(d, dataUrl);
      } catch (e) {
        console.warn('preview load failed:', e);
      }
    }
  };
  void Promise.all(Array.from({ length: Math.min(PREVIEW_CONCURRENCY, queue.length) }, worker));

  return { cards, error: null };
}

/** Fetch a camera's current preview image; data URL or null on any error. */
export async function refreshPreview(deviceId: string): Promise<string | null> {
  const { data } = await getLiveImage({ deviceId });
  return data?.imageData ?? null;
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
