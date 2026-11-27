// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { warmUp, photoUrls } from './warmup.js';

beforeEach(() => localStorage.clear());

describe('photoUrls', () => {
  it('collects only http(s) photo urls', () => {
    const urls = photoUrls([
      { photo: 'https://x/a.jpg' },
      { photo: '' },
      {},
      { photo: 'data:image/png;base64,xx' },
      { photo: 'https://x/b.jpg' },
    ]);
    expect(urls).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
  });
});

describe('warmUp', () => {
  it('pings health, refreshes both catalogues and pre-loads their photos', async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url) => { calls.push(String(url)); return { ok: true }; });
    const spots = vi.fn(async () => [{ photo: 'https://x/a.jpg' }]);
    const catalogue = vi.fn(async () => [{ photo: 'https://x/b.jpg' }]);
    const loaded = [];
    const list = await warmUp({ fetchImpl, spots, catalogue, loadImage: u => loaded.push(u) });
    expect(calls.some(u => u.includes('/api/health'))).toBe(true);
    expect(list.length).toBe(2);
    expect(loaded).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
  });

  it('never throws when the API is unreachable', async () => {
    const fetchImpl = async () => { throw new Error('offline'); };
    const spots = async () => [];
    const catalogue = async () => [];
    await expect(warmUp({ fetchImpl, spots, catalogue, bust: () => {}, bustCatalogue: () => {}, loadImage: () => {} }))
      .resolves.toEqual([]);
  });

  it('keeps the offline cache when the refresh fails', async () => {
    // A cold start with no signal must not wipe the lists the app needs to work
    // offline. Both fetchers are network-first and overwrite on success, so the
    // pre-fetch cache bust is never necessary.
    localStorage.setItem('lakbai.spots', JSON.stringify([{ id: 'cached-spot' }]));
    localStorage.setItem('lakbai.catalogue', JSON.stringify([{ id: 'cached-place', lng: 120, lat: 16 }]));
    const offline = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', offline);
    try {
      await warmUp({ loadImage: () => {} });
      expect(JSON.parse(localStorage.getItem('lakbai.spots'))).toEqual([{ id: 'cached-spot' }]);
      expect(JSON.parse(localStorage.getItem('lakbai.catalogue'))).toEqual([{ id: 'cached-place', lng: 120, lat: 16 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});