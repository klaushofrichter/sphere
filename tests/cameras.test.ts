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
        expect(idx).toBeLessThan(Math.min(n, CELLS));
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
