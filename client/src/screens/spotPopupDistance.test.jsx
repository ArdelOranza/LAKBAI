// @vitest-environment happy-dom
// The popup may show a straight-line distance, but it must never invent a
// travel time (no "8 min") and never measure from the fallback centre.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../App.jsx', () => ({ FALLBACK_CENTER: { lng: 120.23, lat: 16.03 } }));
vi.mock('../store.js', () => ({ saveFavorite: vi.fn(), listFavorites: vi.fn(async () => ({ data: [] })) }));

import SpotPopup from './SpotPopup.jsx';

const SPOT = { id: 'p1', name: 'Patar Beach', lng: 119.86, lat: 16.3, categories: ['Beach'] };

async function mount(coords){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => {
    root.render(<SpotPopup spot={SPOT} coords={coords} pop={() => {}} push={() => {}} showToast={() => {}} user={{ id: 'u1' }} setTab={() => {}} openDirections={() => {}}/>);
  });
  await React.act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return { container, async unmount(){ await React.act(async () => root.unmount()); container.remove(); } };
}

describe('SpotPopup distance', () => {
  it('labels the distance straight-line and never prints minutes', async () => {
    const h = await mount({ lng: 119.86, lat: 16.309 }); // ~1 km north
    expect(h.container.textContent).toContain('1.0 km');
    expect(h.container.textContent).toContain('straight-line');
    expect(h.container.textContent).not.toMatch(/\bmin\b/);
    await h.unmount();
  });

  it('shows no distance at all while GPS is still the fallback centre', async () => {
    const h = await mount({ lng: 120.23, lat: 16.03 });
    expect(h.container.textContent).not.toContain('straight-line');
    expect(h.container.textContent).not.toContain('km');
    await h.unmount();
  });
});
