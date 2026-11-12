// @vitest-environment happy-dom
// The server now owns the itinerary clock: it inserts the drive between stops
// and returns each leg in minutes. The view must show that leg for every stop
// (previously only saved places got a drive chip, so AI-added stops showed no
// travel time at all).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../store.js', () => ({ savePlan: vi.fn(async () => ({ local: true })) }));
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../sessionCache.js', () => ({ sessionSet: () => {} }));
vi.mock('../staticMap.js', () => ({ placeImage: () => null, mapboxToken: () => '' }));

import ItineraryView from './ItineraryView.jsx';

describe('ItineraryView drive legs', () => {
  it('shows the server-computed drive for every stop after the first', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const plan = {
      title: 'Bolinao day',
      schedule: [
        { placeId: 'a', name: 'Patar Beach', arrive: '09:40', depart: '10:40', legMinutes: 40, activities: [] },
        { placeId: 'b', name: 'Bolinao Lighthouse', arrive: '11:00', depart: '11:40', legMinutes: 20, activities: [] },
      ],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(<ItineraryView plan={plan} coords={{ lng: 119.79, lat: 16.12 }} pop={() => {}} showToast={() => {}}/>);
    });
    expect(container.textContent).toContain('40 min drive');
    expect(container.textContent).toContain('20 min drive');
    await React.act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
});
