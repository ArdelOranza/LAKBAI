// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../store.js', () => ({
  listFavorites: vi.fn(async () => ({ data: [{ place_id: 'p-123', name: 'Saved Beach', lng: 120.3, lat: 16.1, photo: null, categories: ['beach'] }] })),
  removeFavorite: vi.fn(async () => ({})),
  saveFavorite: vi.fn(async () => ({})),
}));
vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../api.js', () => ({
  recommend: vi.fn(async () => ({ places: [] })),
  itineraryFromSaved: vi.fn(async () => ({})),
}));
vi.mock('../prefs.js', () => ({
  readLocalPrefs: () => [],
}));
vi.mock('../sessionCache.js', () => ({
  sessionGet: () => null,
  sessionSet: () => {},
}));
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ hospitals: [], police: [] }) })));

import SavedTab from './SavedTab.jsx';
import { itineraryFromSaved } from '../api.js';

describe('SavedTab detail navigation', () => {
  it('normalizes favorite rows so PlaceDetail receives id=place_id', async () => {
    const push = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(<SavedTab coords={{ lng: 120.3, lat: 16.1 }} push={push} showToast={() => {}} />);
    });
    const row = container.querySelector('[data-testid="saved-row"]');
    expect(row).not.toBeNull();
    await React.act(async () => {
      row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(push).toHaveBeenCalledTimes(1);
    const pushed = push.mock.calls[0][0];
    expect(pushed.name).toBe('detail');
    expect(pushed.place.id).toBe('p-123');
    await React.act(async () => root.unmount());
    container.remove();
  });
});

describe('SavedTab itinerary location', () => {
  async function renderSaved(coords, push, showToast){
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(<SavedTab coords={coords} push={push} showToast={showToast} />);
    });
    return { container, root };
  }

  it('builds the route from the real GPS fix, within 50 km of the traveler', async () => {
    itineraryFromSaved.mockClear();
    const push = vi.fn();
    const { container, root } = await renderSaved({ lng: 119.79, lat: 16.12, accuracy: 8 }, push, () => {});
    const btn = container.querySelector('[data-testid="generate-itinerary"] button');
    await React.act(async () => {
      btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(itineraryFromSaved).toHaveBeenCalledWith(['Saved Beach'], 8, 9, '119.79,16.12');
    expect(push.mock.calls[0][0].name).toBe('itinerary');
    await React.act(async () => root.unmount());
    container.remove();
  });

  it('does not guess a location when there is no GPS fix', async () => {
    itineraryFromSaved.mockClear();
    const push = vi.fn();
    const showToast = vi.fn();
    // FALLBACK_CENTER has no `accuracy` — it is not a real fix.
    const { container, root } = await renderSaved({ lng: 120.23, lat: 16.03 }, push, showToast);
    const btn = container.querySelector('[data-testid="generate-itinerary"] button');
    await React.act(async () => {
      btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(itineraryFromSaved).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(showToast.mock.calls.some(c => /location/i.test(String(c[0])))).toBe(true);
    await React.act(async () => root.unmount());
    container.remove();
  });
});
