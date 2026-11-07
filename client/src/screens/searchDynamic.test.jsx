// @vitest-environment happy-dom
// DYNAMIC SEARCH: results must be live, not served from a static session cache.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const discoverRows = [
  { id: 'd009j', name: 'Balingasay Headland', lng: 119.869, lat: 16.302, address: 'Balingasay, Bolinao, Pangasinan', categories: ['natural'] },
];
const freshRows = [{ id: 'fresh1', name: 'Fresh Result', lng: 119.9, lat: 16.1, photo: null, categories: [] }];
const staleRows = [{ id: 'stale1', name: 'Stale Cached', lng: 119.9, lat: 16.1, photo: null, categories: [] }];

// Mutable session store so we can probe cache behaviour.
const sess = vi.hoisted(() => ({ map: {} }));
const recommend = vi.hoisted(() => vi.fn(async () => ({ places: [...freshRows] })));
vi.mock('../api.js', () => ({ recommend, chat: vi.fn(), itineraryFromSaved: vi.fn() }));
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../prefs.js', () => ({ readLocalPrefs: () => [] }));
vi.mock('../sessionCache.js', () => ({
  sessionGet: k => sess.map[k] ?? null,
  sessionSet: (k, v) => { sess.map[k] = v; },
}));
const fetchMock = vi.fn(async url => {
  if (String(url).includes('/api/places')) return { ok: true, json: async () => ({ places: discoverRows }) };
  return { ok: false };
});
vi.stubGlobal('fetch', fetchMock);

import SearchResults from './SearchResults.jsx';

async function mount(query, coords = { lng: 119.9, lat: 16.1 }){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { query, coords, push: vi.fn(), pop: () => {}, showToast: vi.fn(), user: { id: 'u1' }, setTab: () => {} };
  await React.act(async () => { root.render(<SearchResults {...props}/>); });
  await React.act(async () => { await new Promise(r => setTimeout(r, 15)); });
  return { container, root, props,
    async rerender(newCoords){
      await React.act(async () => { root.render(<SearchResults {...props} coords={newCoords}/>); });
      await React.act(async () => { await new Promise(r => setTimeout(r, 15)); });
    },
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  sess.map = {};
  recommend.mockClear().mockImplementation(async () => ({ places: [...freshRows] }));
  fetchMock.mockClear();
});

describe('dynamic search (not static)', () => {
  it('a cached query revalidates live instead of serving stale rows forever', async () => {
    sess.map['lakbai.rec:falls'] = staleRows; // poison cache
    const h = await mount('falls');
    expect(recommend).toHaveBeenCalled(); // must hit the network despite cache
    expect(h.container.textContent).toContain('Fresh Result');
    expect(h.container.textContent).not.toContain('Stale Cached');
    await h.unmount();
  });

  it('Mapbox discovery runs even on a rich dataset answer (always-live merge)', async () => {
    recommend.mockImplementation(async () => ({ places: Array.from({ length: 6 }, (_, i) => ({ id: 'r'+i, name: 'Rich '+i, lng: 120, lat: 16 })) }));
    const h = await mount('beaches');
    const hitPlaces = fetchMock.mock.calls.some(c => String(c[0]).includes('/api/places'));
    expect(hitPlaces).toBe(true);
    expect(h.container.textContent).toContain('Balingasay Headland');
    await h.unmount();
  });

  it('moving to a new location re-runs the search', async () => {
    const h = await mount('falls', { lng: 119.9, lat: 16.1 });
    const before = recommend.mock.calls.length;
    await h.rerender({ lng: 120.3, lat: 16.05 });
    expect(recommend.mock.calls.length).toBeGreaterThan(before);
    await h.unmount();
  });

  it('shows a live indicator while searching', async () => {
    recommend.mockImplementation(() => new Promise(() => {})); // never resolves
    const h = await mount('falls');
    expect(h.container.textContent).toMatch(/searching/i);
    expect(h.container.querySelector('[data-testid="live-badge"]')).toBeNull();
    await h.unmount();
  });
});
