// @vitest-environment happy-dom
// The map's spot popup must open the in-app route sheet, not Google Maps.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(async () => ({ data: [] })),
}));
vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../staticMap.js', () => ({
  staticMapThumb: () => null,
  placeImage: () => null,
  mapboxToken: () => 'pk.test',
}));

import SpotPopup from './SpotPopup.jsx';

const SPOT = { id: 's1', name: 'Bolinao Falls', lng: 120.09, lat: 16.11, categories: ['Nature'], town: 'Bolinao' };

beforeEach(() => {
  vi.stubGlobal('open', vi.fn(() => ({})));
});

describe('SpotPopup directions', () => {
  it('opens the in-app route sheet and never a maps tab', async () => {
    const openDirections = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await React.act(async () => {
      root.render(
        <SpotPopup spot={SPOT} coords={{ lng: 120.23, lat: 16.03 }} pop={() => {}} push={() => {}} setTab={() => {}} showToast={() => {}} user={{ id: 'u1' }} openDirections={openDirections}/>
      );
    });
    await React.act(async () => { await Promise.resolve(); });

    const btn = container.querySelector('[data-testid="spot-directions"]');
    expect(btn).toBeTruthy();
    await React.act(async () => {
      btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    expect(openDirections).toHaveBeenCalledTimes(1);
    expect(openDirections.mock.calls[0][0]).toMatchObject({ id: 's1', lng: 120.09, lat: 16.11 });
    expect(window.open).not.toHaveBeenCalled();

    await React.act(async () => root.unmount());
    container.remove();
  });
});
