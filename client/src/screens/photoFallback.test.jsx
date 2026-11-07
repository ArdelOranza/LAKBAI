// @vitest-environment happy-dom
// U14-A: every place photo slot falls back to a Mapbox Static map of the place
// when no real photo exists, so a located place is never a blank slot.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';

const MAPBOX_LINE = /api\.mapbox\.com\/styles\/v1\/mapbox\/streets-v12\/static\//;

vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test');

const photoless = (over = {}) => ({ id: 'p1', name: 'Photoless Cove', lng: 119.9, lat: 16.2, photo: null, ...over });

vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../api.js', () => ({
  recommend: vi.fn(async () => ({ places: [photoless()] })),
}));
vi.mock('../store.js', () => ({
  listFavorites: vi.fn(async () => ({ data: [photoless({ id: 'fav-1', place_id: 'fav-1' })] })),
  removeFavorite: vi.fn(async () => ({})),
  saveFavorite: vi.fn(async () => ({})),
  listPlaceReviews: vi.fn(async () => []),
}));
vi.mock('../App.jsx', () => ({ FALLBACK_CENTER: { lng: 120.23, lat: 16.03 } }));
vi.mock('../spots.js', () => ({
  fetchSpots: vi.fn(async () => ([photoless({ id: 'sp1', town: 'Alaminos', categories: ['Beach'] })])),
}));
vi.mock('../prefs.js', () => ({ readLocalPrefs: () => [] }));
vi.mock('../sessionCache.js', () => ({ sessionGet: () => null, sessionSet: () => {} }));
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}), headers: { get: () => null } })));

import PlaceDetail from './PlaceDetail.jsx';
import Home from './Home.jsx';
import SearchResults from './SearchResults.jsx';
import Browse from './Browse.jsx';
import SavedTab from './SavedTab.jsx';
import SpotPopup from './SpotPopup.jsx';

async function mount(ui){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => { root.render(ui); });
  // let effect-driven fetches (recommend, favorites, spots) settle before we look
  await React.act(async () => { await new Promise(r => setTimeout(r, 10)); });
  return {
    container,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}
const render = el => renderToString(el);

beforeEach(() => { document.body.innerHTML = ''; });

describe('PlaceDetail hero', () => {
  it('a located place with no photo shows a static map of it, not "Photo coming soon"', () => {
    const html = render(
      <PlaceDetail place={photoless()} coords={{ lng: 120, lat: 16 }} push={() => {}} pop={() => {}} showToast={() => {}} setTab={() => {}} user={{ id: 'u1' }}/>
    );
    expect(html).not.toContain('Photo coming soon');
    const hero = html.match(/<img[^>]*data-testid="hero-photo"[^>]*>/);
    expect(hero, 'hero img present').not.toBeNull();
    expect(hero[0]).toMatch(MAPBOX_LINE);
  });

  it('a real photo still wins over the static map', () => {
    const html = render(
      <PlaceDetail place={photoless({ photo: 'https://real/cove.jpg' })} coords={{ lng: 120, lat: 16 }} push={() => {}} pop={() => {}} showToast={() => {}} setTab={() => {}} user={{ id: 'u1' }}/>
    );
    expect(html).toContain('https://real/cove.jpg');
    expect(html).not.toMatch(MAPBOX_LINE);
  });
});

describe('list card thumbs', () => {
  it('Home recommendations never render a blank tile for a located place', async () => {
    const h = await mount(<Home coords={{ lng: 120.1, lat: 16.1 }} push={() => {}} showToast={() => {}} setTab={() => {}} user={{ id: 'u1' }}/>);
    const recs = h.container.querySelector('[data-testid="recs"]');
    expect(recs.querySelector('img'), recs.innerHTML.slice(0, 300)).not.toBeNull();
    expect(recs.querySelector('img').src).toMatch(MAPBOX_LINE);
    await h.unmount();
  });

  it('SearchResults rows get the static map thumb', async () => {
    const h = await mount(<SearchResults query="cove" coords={{ lng: 120.1, lat: 16.1 }} push={() => {}} pop={() => {}} showToast={() => {}} user={{ id: 'u1' }}/>);
    const row = h.container.querySelector('[data-testid="result-row"]');
    expect(row).not.toBeNull();
    expect(row.querySelector('img')?.src || '').toMatch(MAPBOX_LINE);
    await h.unmount();
  });

  it('Browse rows get the static map thumb', async () => {
    const h = await mount(<Browse kind="beaches" coords={{ lng: 120.1, lat: 16.1 }} push={() => {}} pop={() => {}} showToast={() => {}}/>);
    const row = h.container.querySelector('article');
    expect(row, h.container.innerHTML.slice(0, 300)).not.toBeNull();
    expect(row.querySelector('img')?.src || '').toMatch(MAPBOX_LINE);
    await h.unmount();
  });

  it('Saved rows get the static map thumb', async () => {
    const h = await mount(<SavedTab coords={{ lng: 120.3, lat: 16.1 }} push={() => {}} showToast={() => {}}/>);
    const row = h.container.querySelector('[data-testid="saved-row"]');
    expect(row).not.toBeNull();
    expect(row.querySelector('img')?.src || '').toMatch(MAPBOX_LINE);
    await h.unmount();
  });
});

describe('SpotPopup gallery', () => {
  it('a photoless spot shows its static map slide instead of three icon placeholders', async () => {
    const h = await mount(<SpotPopup spot={photoless({ id: 'sp1', photos: [], categories: ['Beach'], blurb: '' })} coords={{ lng: 120.1, lat: 16.1 }} pop={() => {}} push={() => {}} showToast={() => {}} setTab={() => {}}/>);
    expect(h.container.innerHTML).toMatch(MAPBOX_LINE);
    // no real photos exist — the "N Photos" badge must not fabricate a count
    expect(h.container.innerHTML).not.toContain('Photos</span>');
    await h.unmount();
  });

  it('real photos still render as slides with the count badge', async () => {
    const h = await mount(<SpotPopup spot={photoless({ id: 'sp2', photos: ['https://real/a.jpg', 'https://real/b.jpg'], categories: ['Beach'], blurb: '' })} coords={{ lng: 120.1, lat: 16.1 }} pop={() => {}} push={() => {}} showToast={() => {}} setTab={() => {}}/>);
    expect(h.container.innerHTML).toContain('https://real/a.jpg');
    expect(h.container.innerHTML).toContain('2 Photos');
    await h.unmount();
  });
});
