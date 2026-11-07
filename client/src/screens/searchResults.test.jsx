// @vitest-environment happy-dom
// U14-B: searching anything (falls, markets, headlands) must surface Mapbox
// discoveries when the dataset answer is thin — and never break when AI fails.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const discoverRows = [
  { id: 'd009j', name: 'Balingasay Headland', lng: 119.869, lat: 16.302, address: 'Balingasay, Bolinao, Pangasinan', categories: ['natural', 'landmark'] },
  { id: 'd009k', name: 'Bolinao Falls', lng: 119.84, lat: 16.223, address: 'Bolinao, Pangasinan', categories: ['waterfall'] },
];
const datasetRows = [
  { id: 'ds1', name: 'Dataset Beach', lng: 119.9, lat: 16.09, photo: 'https://real/x.jpg', categories: ['Beach'] },
];

// recommend mock is mutable so each test can set its own result.
const recommend = vi.hoisted(() => vi.fn(async () => ({ places: [] })));
vi.mock('../api.js', () => ({
  recommend,
  chat: vi.fn(),
  itineraryFromSaved: vi.fn(),
}));
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../prefs.js', () => ({ readLocalPrefs: () => [] }));
vi.mock('../sessionCache.js', () => ({ sessionGet: () => null, sessionSet: () => {} }));

// The fetch stub answers /api/places with a Mapbox-y payload from the proxy.
const fetchMock = vi.fn(async url => {
  if (String(url).includes('/api/places')) {
    return { ok: true, json: async () => ({ places: discoverRows }) };
  }
  return { ok: false };
});
vi.stubGlobal('fetch', fetchMock);

import SearchResults from './SearchResults.jsx';

async function mount(query){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = {
    query, coords: { lng: 119.9, lat: 16.1 },
    push: vi.fn(), pop: () => {}, showToast: vi.fn(),
    user: { id: 'u1' }, setTab: () => {},
  };
  await React.act(async () => { root.render(<SearchResults {...props}/>); });
  await React.act(async () => { await new Promise(r => setTimeout(r, 10)); });
  return { container, props,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  recommend.mockReset().mockImplementation(async () => ({ places: [] }));
  fetchMock.mockClear();
});

describe('SearchResults Mapbox discovery merge', () => {
  it('a thin dataset answer gains Mapbox-discovered rows', async () => {
    recommend.mockImplementation(async () => ({ places: datasetRows }));
    const h = await mount('Bolinao Falls');
    const discoverRowsDom = h.container.querySelectorAll('[data-testid="discover-row"]');
    expect(discoverRowsDom.length).toBe(2);
    expect(h.container.textContent).toContain('Balingasay Headland');
    expect(h.container.textContent).toContain('Dataset Beach');
  });

  it('a rich dataset answer still merges live Mapbox finds (dynamic, not static)', async () => {
    recommend.mockImplementation(async () => ({ places: Array.from({ length: 6 }, (_, i) => ({ id: 'r' + i, name: 'Rich ' + i, lng: 120, lat: 16, photo: null })) }));
    const h = await mount('beaches');
    expect(fetchMock.mock.calls.map(c => String(c[0])).some(u => u.includes('/api/places'))).toBe(true);
    expect(h.container.textContent).toContain('Rich 0');
    expect(h.container.textContent).toContain('Balingasay Headland');
    await h.unmount();
  });

  it('AI failure no longer blanks the search — discovery still fills the list', async () => {
    recommend.mockImplementation(async () => { throw new Error('AI down'); });
    const h = await mount('falls');
    const rows = h.container.querySelectorAll('[data-testid="discover-row"]');
    expect(rows.length).toBe(2);
    await h.unmount();
  });

  it('a discovered row is a real place card: tap opens PlaceDetail with its true coords', async () => {
    recommend.mockImplementation(async () => ({ places: datasetRows }));
    const h = await mount('headland');
    const row = h.container.querySelectorAll('[data-testid="discover-row"]')[0];
    await React.act(async () => {
      row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(h.props.push).toHaveBeenCalledTimes(1);
    const pushed = h.props.push.mock.calls[0][0];
    expect(pushed.name).toBe('detail');
    expect(pushed.place.name).toBe('Balingasay Headland');
    expect(pushed.place.lng).toBeCloseTo(119.869, 3);
    expect(pushed.place.lat).toBeCloseTo(16.302, 3);
    await h.unmount();
  });
});
