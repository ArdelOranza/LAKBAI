// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchSpots } from './spots.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('fetchSpots', () => {
  it('loads the live catalogue from VITE_API_URL, not the static app origin', async () => {
    vi.stubEnv('VITE_API_URL', 'https://lakbai-api.onrender.com/');
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ spots: [{ id: 'a' }] }) });
    vi.stubGlobal('fetch', f);

    await expect(fetchSpots()).resolves.toEqual([{ id: 'a' }]);
    expect(f.mock.calls[0][0]).toBe('https://lakbai-api.onrender.com/api/spots');
  });

  it('falls back to the last good catalogue when the API is unreachable', async () => {
    vi.stubEnv('VITE_API_URL', 'https://lakbai-api.onrender.com');
    localStorage.setItem('lakbai.spots', JSON.stringify([{ id: 'cached' }]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));

    await expect(fetchSpots()).resolves.toEqual([{ id: 'cached' }]);
  });
});
