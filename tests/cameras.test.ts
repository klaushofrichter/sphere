import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('een-api-toolkit', () => ({
  getCameras: vi.fn(),
  getLiveImage: vi.fn(),
  listFeeds: vi.fn(),
  initMediaSession: vi.fn(),
}));

import { getCameras, getLiveImage, listFeeds } from 'een-api-toolkit';
import {
  fetchAllCameras, loadCameraCards, getPreviewFeedUrl, cameraStatusText, refreshPreview,
} from '../src/cameras';
import { distributeCameras, COLS, ROWS } from '../src/cameras';

const cam = (id: string, name: string, status: unknown = 'online') =>
  ({ id, name, status }) as never;

beforeEach(() => {
  vi.mocked(getCameras).mockReset();
  vi.mocked(getLiveImage).mockReset();
  vi.mocked(listFeeds).mockReset();
});

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
    for (const n of [1, 2, 3, 7, 9, 50, 100, 250]) {
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
    for (const n of [1, 2, 3, 7, 9, 50, 100]) {
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
    for (const n of [2, 3, 7, 9, 50]) {
      const issues = neighborsDiffer(distributeCameras(n, COLS, ROWS), COLS, ROWS)
        .filter((s) => s.startsWith('H'));
      expect(issues).toEqual([]);
    }
  });

  it('vertical neighbors differ for n > 2', () => {
    for (const n of [3, 7, 9, 50]) {
      const issues = neighborsDiffer(distributeCameras(n, COLS, ROWS), COLS, ROWS)
        .filter((s) => s.startsWith('V'));
      expect(issues).toEqual([]);
    }
  });

  // Sweep every camera count to lock down the fragile Path B fallback
  // (n ∈ {3, 9}, where n divides cols-1) alongside the Path A majority.
  it('covers all cameras with no equal neighbors for every n in 2..100', () => {
    for (let n = 2; n <= CELLS; n++) {
      const a = distributeCameras(n, COLS, ROWS);
      expect(new Set(a).size, `coverage for n=${n}`).toBe(n);
      expect(neighborsDiffer(a, COLS, ROWS), `neighbors for n=${n}`).toEqual([]);
    }
  });
});

describe('cameraStatusText', () => {
  it('handles string and object status', () => {
    expect(cameraStatusText(cam('1', 'a', 'online'))).toBe('ONLINE');
    expect(cameraStatusText(cam('1', 'a', { connectionStatus: 'offline' }))).toBe('OFFLINE');
    expect(cameraStatusText({ id: '1', name: 'a' } as never)).toBe('UNKNOWN');
  });
});

describe('fetchAllCameras', () => {
  it('pages through all results', async () => {
    vi.mocked(getCameras)
      .mockResolvedValueOnce({ data: { results: [cam('a', 'A')], nextPageToken: 't' }, error: null } as never)
      .mockResolvedValueOnce({ data: { results: [cam('b', 'B')] }, error: null } as never);
    const { cameras, error } = await fetchAllCameras();
    expect(error).toBeNull();
    expect(cameras!.map((c) => c.id)).toEqual(['a', 'b']);
    expect(vi.mocked(getCameras).mock.calls[1][0]).toMatchObject({ pageToken: 't' });
  });

  it('propagates errors', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({ data: null, error: { code: 'API_ERROR', message: 'boom' } } as never);
    const { cameras, error } = await fetchAllCameras();
    expect(cameras).toBeNull();
    expect(error).toContain('boom');
  });
});

describe('loadCameraCards', () => {
  it('errors on zero cameras', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({ data: { results: [] }, error: null } as never);
    const { cards, error } = await loadCameraCards(() => {});
    expect(cards).toBeNull();
    expect(error).toBe('No online cameras available for this account');
  });

  it('excludes offline and transitional cameras, keeps online and streaming', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({
      data: {
        results: [
          cam('a', 'Front', 'online'),
          cam('b', 'Back', 'offline'),
          cam('c', 'Yard', { connectionStatus: 'online' }),
          cam('d', 'Gate', { connectionStatus: 'deviceOffline' }),
          cam('e', 'Lobby', 'streaming'),
          cam('f', 'Dock', 'initializing'),
        ],
      },
      error: null,
    } as never);
    vi.mocked(getLiveImage).mockResolvedValue({ data: { imageData: 'data:image/jpeg;base64,x' }, error: null } as never);

    const { cards, error } = await loadCameraCards(() => {});
    expect(error).toBeNull();
    expect(new Set(cards!.map((c) => c.deviceId))).toEqual(new Set(['a', 'c', 'e']));
  });

  it('errors when every camera is offline', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({
      data: { results: [cam('a', 'Front', 'offline'), cam('b', 'Back', 'error')] },
      error: null,
    } as never);
    const { cards, error } = await loadCameraCards(() => {});
    expect(cards).toBeNull();
    expect(error).toBe('No online cameras available for this account');
  });

  it('builds 100 cards from the distribution and streams previews per distinct camera', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({
      data: { results: [cam('a', 'Front'), cam('b', 'Back'), cam('c', 'Yard')] }, error: null,
    } as never);
    vi.mocked(getLiveImage).mockResolvedValue({ data: { imageData: 'data:image/jpeg;base64,x' }, error: null } as never);

    const seen: Array<[string, string | null]> = [];
    const { cards, error } = await loadCameraCards((deviceId, dataUrl) => seen.push([deviceId, dataUrl]));
    expect(error).toBeNull();
    expect(cards).toHaveLength(100);
    expect(new Set(cards!.map((c) => c.deviceId))).toEqual(new Set(['a', 'b', 'c']));
    expect(cards![0]).toMatchObject({ id: 0, pending: true });
    expect(['Front', 'Back', 'Yard']).toContain(cards![0].title);

    await vi.waitFor(() => expect(seen).toHaveLength(3)); // one preview per DISTINCT camera
    expect(vi.mocked(getLiveImage)).toHaveBeenCalledTimes(3);
    expect(seen.every(([, url]) => url === 'data:image/jpeg;base64,x')).toBe(true);
  });

  it('reports failed previews as null', async () => {
    vi.mocked(getCameras).mockResolvedValueOnce({ data: { results: [cam('a', 'Solo')] }, error: null } as never);
    vi.mocked(getLiveImage).mockResolvedValue({ data: null, error: { code: 'API_ERROR', message: 'no img' } } as never);
    const seen: Array<[string, string | null]> = [];
    await loadCameraCards((d, u) => seen.push([d, u]));
    await vi.waitFor(() => expect(seen).toEqual([['a', null]]));
  });
});

describe('refreshPreview', () => {
  it('returns the data url on success and null on failure', async () => {
    vi.mocked(getLiveImage)
      .mockResolvedValueOnce({ data: { imageData: 'data:image/jpeg;base64,y' }, error: null } as never)
      .mockResolvedValueOnce({ data: null, error: { code: 'API_ERROR', message: 'nope' } } as never);
    expect(await refreshPreview('a')).toBe('data:image/jpeg;base64,y');
    expect(await refreshPreview('a')).toBeNull();
  });
});

describe('getPreviewFeedUrl', () => {
  it('returns the first multipartUrl', async () => {
    vi.mocked(listFeeds).mockResolvedValueOnce({
      data: { results: [{ multipartUrl: null }, { multipartUrl: 'https://feed' }] }, error: null,
    } as never);
    expect(await getPreviewFeedUrl('a')).toEqual({ url: 'https://feed', error: null });
  });

  it('reports missing feeds', async () => {
    vi.mocked(listFeeds).mockResolvedValueOnce({ data: { results: [] }, error: null } as never);
    const r = await getPreviewFeedUrl('a');
    expect(r.url).toBeNull();
    expect(r.error).toBeTruthy();
  });
});
