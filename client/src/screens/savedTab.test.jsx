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
