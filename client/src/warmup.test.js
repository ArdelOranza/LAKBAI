import { describe, it, expect, vi } from 'vitest';
import { warmUp, photoUrls } from './warmup.js';

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
    const bust = vi.fn();
    const bustCatalogue = vi.fn();
    const spots = vi.fn(async () => [{ photo: 'https://x/a.jpg' }]);
    const catalogue = vi.fn(async () => [{ photo: 'https://x/b.jpg' }]);
    const loaded = [];
    const list = await warmUp({ fetchImpl, spots, catalogue, bust, bustCatalogue, loadImage: u => loaded.push(u) });
    expect(calls.some(u => u.includes('/api/health'))).toBe(true);
    expect(bust).toHaveBeenCalledTimes(1);
    expect(bustCatalogue).toHaveBeenCalledTimes(1);
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
});