// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';

vi.mock('../store.js', () => ({
  saveFavorite: vi.fn(async () => ({})),
  removeFavorite: vi.fn(async () => ({})),
  listFavorites: vi.fn(async () => ({ data: [] })),
  listPlaceReviews: vi.fn(async () => []),
}));
vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import PlaceDetail from './PlaceDetail.jsx';

const PLACE = {
  id: 'p1', name: 'Test Beach', lng: 120.1, lat: 16.1, photo: null,
  categories: ['Beach'], sources: [
    'javascript:alert(1)',
    'https://www.gov.ph/source-doc',
  ],
  reviews: [],
};

function render(place = PLACE){
  return renderToString(
    <PlaceDetail place={place} coords={{ lng: 120, lat: 16 }} push={() => {}} pop={() => {}} showToast={() => {}} setTab={() => {}} user={{ id: 'u1' }}/>
  );
}

beforeEach(() => {
  vi.stubGlobal('open', vi.fn(() => ({})));
});

describe('PlaceDetail source links', () => {
  it('never renders a javascript: href, and self-hosted sources keep their link', () => {
    const html = render();
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://www.gov.ph/source-doc"');
    // tabnabbing: popups never hand their opener to the destination
    expect(html).toMatch(/rel="[^"]*noopener/);
  });

  it('renders the unsafe source as inert text instead of a link', () => {
    const html = render();
    expect(html).not.toContain('<a href="javascript');
    // the address stays visible for transparency, just never clickable
    expect(html).toContain('data-testid="source-inert"');
    expect(html).toContain('javascript:alert(1)');
  });
});

describe('PlaceDetail directions popup', () => {  it('opens the maps URL without leaking the opener reference', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await React.act(async () => {
      root.render(
        <PlaceDetail place={PLACE} coords={{ lng: 120, lat: 16 }} push={() => {}} pop={() => {}} showToast={() => {}} setTab={() => {}} user={{ id: 'u1' }}/>
      );
    });
    const btn = container.querySelector('[data-testid="directions-btn"]');
    await React.act(async () => {
      btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(window.open).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=16.1,120.1',
      '_blank', 'noopener,noreferrer'
    );
    await React.act(async () => root.unmount());
    container.remove();
  });
});
