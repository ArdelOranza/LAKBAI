// @vitest-environment happy-dom
// Once signed in, opening Home must not ask the AI again on every launch.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const recommend = vi.hoisted(() => vi.fn(async () => ({ places: [{ id: 'fresh', name: 'Fresh New Gem', lng: 120.1, lat: 16.1, categories: ['Beach'] }] })));

vi.mock('../api.js', () => ({ recommend }));
vi.mock('../geocode.js', () => ({ reverseGeocode: vi.fn(async () => 'Alaminos City, Pangasinan') }));

import Home from './Home.jsx';
import { FALLBACK_CENTER } from '../App.jsx';

const USER = { id: 'u1', email: 'a@b.com' };
const FIX = { lng: 120.031, lat: 16.161 };
const DAGUPAN = { lng: 120.3402, lat: 16.0433 };
const CACHED = [
  { id: 'c1', name: 'Patar White Sand Beach', lng: 119.89, lat: 16.32, categories: ['Beach'] },
  { id: 'c2', name: 'Bolinao Falls', lng: 120.09, lat: 16.11, categories: ['Nature'] },
];

function seedCache(savedAgoMs, at = FIX){
  localStorage.setItem('lakbai.home.v1:u1', JSON.stringify({
    places: CACHED,
    at,
    prefs: '',
    savedAt: Date.now() - savedAgoMs,
  }));
}

async function mount(coords = FIX){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<Home coords={coords} push={() => {}} showToast={() => {}} setTab={() => {}} user={USER}/>);
  });
  return { container, root };
}

beforeEach(() => {
  localStorage.clear();
  recommend.mockClear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ features: [] }) })));
});

describe('Home with a saved feed', () => {
  it('paints the last hidden gems immediately and does not call the AI again', async () => {
    seedCache(5 * 60 * 1000);
    const { container, root } = await mount();

    expect(container.textContent).toContain('Patar White Sand Beach');
    expect(container.textContent).not.toContain('Finding hidden gems for you…');

    await React.act(async () => { await Promise.resolve(); });
    expect(recommend).not.toHaveBeenCalled();

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('keeps the old picks on screen while a stale feed refreshes', async () => {
    let finish;
    recommend.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    seedCache(60 * 60 * 1000);
    const { container, root } = await mount();

    // The stale list is already visible — no empty state, no shimmer.
    expect(container.textContent).toContain('Patar White Sand Beach');
    expect(container.textContent).not.toContain('Finding hidden gems for you…');

    await React.act(async () => { await Promise.resolve(); });
    expect(recommend).toHaveBeenCalledTimes(1);
    // Still the cached picks while the refresh is in flight.
    expect(container.textContent).toContain('Patar White Sand Beach');

    await React.act(async () => {
      finish({ places: [{ id: 'fresh', name: 'Fresh New Gem', lng: 120.1, lat: 16.1, categories: ['Beach'] }] });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Fresh New Gem');

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('paints the saved feed before the first GPS fix, not the province centre', async () => {
    // A cold launch starts with the fallback centre until the fix lands. That is
    // not a move, so the Dagupan feed must paint immediately — no shimmer.
    seedCache(60 * 1000, DAGUPAN);
    const { container, root } = await mount(FALLBACK_CENTER);

    expect(container.textContent).toContain('Patar White Sand Beach');
    expect(container.textContent).not.toContain('Finding hidden gems for you…');

    await React.act(async () => { await Promise.resolve(); });
    expect(recommend).not.toHaveBeenCalled();

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('keeps the previous picks visible while refreshing after moving to a new town', async () => {
    let finish;
    recommend.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    // Feed built in Bolinao; the traveler is now in Dagupan (~50 km away).
    seedCache(60 * 1000, { lng: 119.89, lat: 16.32 });
    const { container, root } = await mount(DAGUPAN);

    expect(container.textContent).toContain('Patar White Sand Beach');
    expect(container.textContent).not.toContain('Finding hidden gems for you…');

    await React.act(async () => { await Promise.resolve(); });
    expect(recommend).toHaveBeenCalledTimes(1);
    // Local cards stay up instead of blanking to a shimmer mid-request.
    expect(container.textContent).toContain('Patar White Sand Beach');

    await React.act(async () => {
      finish({ places: [{ id: 'dag1', name: 'Dagupan Bangus Market', lng: 120.34, lat: 16.04, categories: ['Food & Dining'] }] });
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Dagupan Bangus Market');

    await React.act(async () => root.unmount());
    container.remove();
  });
});
