// @vitest-environment happy-dom
// Browse defaults its town filter to the town nearest the traveler. Before a GPS
// fix arrives the app holds a Lingayen-area fallback centre, and that point must
// not be treated as where the traveler is (nor may it produce distance badges).
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const SPOTS = [
  { id: 'b1', name: 'Bolinao Beach', town: 'Bolinao', categories: ['Beach'], lng: 119.886, lat: 16.334 },
  { id: 'b2', name: 'Dagupan Shore', town: 'Dagupan', categories: ['Beach'], lng: 120.3431, lat: 16.0433 },
];

vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../spots.js', () => ({ fetchSpots: vi.fn(async () => SPOTS) }));
vi.mock('../store.js', () => ({ saveFavorite: vi.fn(async () => ({})) }));
vi.mock('../staticMap.js', () => ({ placeImage: () => null, mapboxToken: () => '' }));
vi.mock('../ui.jsx', () => ({ PhotoPlaceholder: () => null }));

import Browse from './Browse.jsx';

const FALLBACK = { lng: 120.23, lat: 16.03 };

async function mount(props){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<Browse kind="beaches" push={() => {}} pop={() => {}} showToast={() => {}} {...props} />);
  });
  await React.act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return { container, root };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('Browse location', () => {
  it('does not treat the province fallback as the traveler when there is no fix', async () => {
    const { container, root } = await mount({ coords: FALLBACK, hasFix: false });
    const town = container.querySelector('[data-testid="browse-town"]').textContent;
    // Alphabetical first town, not the one nearest the fake centre.
    expect(town).toContain('Bolinao');
    expect(town).not.toContain('Dagupan');
    const list = container.querySelector('[data-testid="browse-list"]').textContent;
    expect(list).not.toMatch(/\d+(\.\d+)? km/);
    await React.act(async () => root.unmount());
  });

  it('uses a real fix for the nearest town and the distance badge', async () => {
    const { container, root } = await mount({ coords: FALLBACK, hasFix: true });
    const town = container.querySelector('[data-testid="browse-town"]').textContent;
    expect(town).toContain('Dagupan');
    const list = container.querySelector('[data-testid="browse-list"]').textContent;
    expect(list).toMatch(/\d+(\.\d+)? km/);
    await React.act(async () => root.unmount());
  });
});
