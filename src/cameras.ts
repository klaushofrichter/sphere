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
