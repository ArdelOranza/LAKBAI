// @vitest-environment happy-dom
// U14-B: Mapbox-discovered places render as distinct pins on the live map,
// filtered by the same radius/chips as everything else, and tap into detail.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const markers = vi.hoisted(() => []);
const sess = vi.hoisted(() => ({ map: {} }));
const recommend = vi.hoisted(() => vi.fn(async () => ({ places: [{ id: 'ds1', name: 'Dataset Beach', lng: 119.86, lat: 16.3, photo: null, categories: ['Beach'] }] })));

vi.mock('../api.js', () => ({ recommend, chat: vi.fn(), itineraryFromSaved: vi.fn() }));
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../App.jsx', () => ({ FALLBACK_CENTER: { lng: 120.23, lat: 16.03 } }));
vi.mock('../sessionCache.js', () => ({
  sessionGet: k => sess.map[k] ?? null,
  sessionSet: (k, v) => { sess.map[k] = v; },
}));
vi.mock('../spots.js', () => ({ fetchSpots: vi.fn(async () => []) }));

// Lightweight stand-ins for the mapcn components: collect marker props.
vi.mock('@/components/ui/map', () => {
  let uid = 0;
  return {
    Map: ({ children }) => <div data-testid="mock-map">{children}</div>,
    MapMarker: ({ longitude, latitude, onClick, children }) => {
      markers.push({ id: 'mk' + (++uid), key: children?.props?.['data-mk'] || null, longitude, latitude });
      return (
        <div data-marker data-longitude={longitude} data-latitude={latitude} onClick={onClick}>
          {children}
        </div>
      );
    },
    MarkerContent: ({ children }) => <div className="marker-content">{children}</div>,
  };
});

import MapTab from './MapTab.jsx';

const DISCOVERED = [
  { id: 'box:d009j', name: 'Balingasay Headland', lng: 119.8695, lat: 16.3018, address: 'Balingasay, Bolinao, Pangasinan', categories: ['natural'], photo: '/photos/balingasay.jpg', hint: 'Bolinao', source: 'mapbox' },
  // far away: must never show inside a 5 km radius around the fix
  { id: 'box:d0020', name: 'Faraway Point', lng: 120.6, lat: 15.75, categories: [], photo: null, source: 'mapbox' },
];

async function mount(coords = { lng: 119.869, lat: 16.302 }){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = { coords, push: vi.fn(), showToast: vi.fn(), user: { id: 'u1' }, setTab: () => {} };
  await React.act(async () => { root.render(<MapTab {...props}/>); });
  await React.act(async () => { await new Promise(r => setTimeout(r, 10)); });
  return { container, props,
    async unmount(){ await React.act(async () => root.unmount()); container.remove(); },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  markers.length = 0;
  sess.map = { 'lakbai.discovered': [...DISCOVERED] };
});

describe('MapTab discovered pins', () => {
  it('Mapbox discoveries render as clearly-marked discover pins next to dataset pins', async () => {
    const h = await mount();
    const pins = Array.from(h.container.querySelectorAll('button.spot-pin'));
    expect(pins.some(b => b.getAttribute('aria-label') === 'Dataset Beach')).toBe(true);
    const discovered = pins.filter(b => b.className.includes('discover'));
    expect(discovered.map(b => b.getAttribute('aria-label')))
      .toEqual(['Balingasay Headland']); // Faraway Point is outside the 5 km radius
  });

  it('tapping a discovered pin opens its PlaceDetail', async () => {
    const h = await mount();
    const pin = h.container.querySelector('button.spot-pin.discover');
    await React.act(async () => {
      pin.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(h.props.push).toHaveBeenCalledTimes(1);
    expect(h.props.push.mock.calls[0][0].name).toBe('detail');
    expect(h.props.push.mock.calls[0][0].place.id).toBe('box:d009j');
  });

  it('the Beaches chip keeps the discovery filter behaviour of normal pins', async () => {
    const h = await mount();
    const chip = Array.from(h.container.querySelectorAll('.map-chips button, .map-chips .chip'))
      .find(b => b.textContent.trim() === 'Food');
    await React.act(async () => {
      chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    const pins = Array.from(h.container.querySelectorAll('button.spot-pin'));
    expect(pins.some(b => b.getAttribute('aria-label') === 'Balingasay Headland')).toBe(false);
    expect(pins.some(b => b.getAttribute('aria-label') === 'Dataset Beach')).toBe(false);
    await h.unmount();
  });

  it('shows your location marker with a locate-me button when GPS is on', async () => {
    const h = await mount({ lng: 119.869, lat: 16.302 });
    const you = h.container.querySelector('[data-testid="you-marker"]');
    expect(you).not.toBeNull();
    expect(you.textContent).toContain('You');
    expect(h.container.querySelector('[data-testid="locate-me"]')).not.toBeNull();
    await h.unmount();
  });

  it('no fake location marker while GPS is still the Pangasinan fallback', async () => {
    const h = await mount({ lng: 120.23, lat: 16.03 }); // FALLBACK_CENTER
    expect(h.container.querySelector('[data-testid="you-marker"]')).toBeNull();
    // locate button still visible so tapping explains state
    expect(h.container.querySelector('[data-testid="locate-me"]')).not.toBeNull();
    await h.unmount();
  });

  it('pins never draw a photo or static-map thumbnail (a map inside the map)', async () => {
    const h = await mount();
    // Even pins with a real photo and discovered pins with a Mapbox fallback
    // stay icon-only: the thumbnail made a second pin appear above the first.
    expect(h.container.querySelectorAll('button.spot-pin img').length).toBe(0);
    expect(h.container.querySelectorAll('.pin-photo').length).toBe(0);
    await h.unmount();
  });

  it('no session discoveries means no discover pins and no crash', async () => {
    sess.map = {};
    const h = await mount();
    expect(h.container.querySelectorAll('button.spot-pin.discover').length).toBe(0);
    expect(h.container.textContent).toBeTruthy();
    await h.unmount();
  });

  it('far zoom keeps the pin and its name in the DOM so the label can fade', async () => {
    const h = await mount(); // default radius 5 km → zoom 11.5
    expect(h.container.firstElementChild.className).toContain('pins-far');
    expect(h.container.querySelectorAll('.pin-drop').length)
      .toBe(h.container.querySelectorAll('button.spot-pin').length);
    const pin = h.container.querySelector('button.spot-pin');
    expect(pin.getAttribute('aria-label')).toBe('Dataset Beach');
    expect(pin.getAttribute('title')).toBe('Dataset Beach');
    // The name stays mounted and is hidden by CSS, so it can transition.
    expect(pin.querySelector('.pin-name').textContent).toBe('Dataset Beach');
    expect(pin.dataset.pin).not.toBeUndefined(); // declutter priority
    await h.unmount();
  });

  it('zooming into a neighbourhood (1 km) reveals the name below the pin', async () => {
    const h = await mount();
    const chip = Array.from(h.container.querySelectorAll('.map-chips button, .map-chips .chip'))
      .find(b => b.textContent.trim() === '1 km');
    await React.act(async () => {
      chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    expect(h.container.firstElementChild.className).not.toContain('pins-far');
    const pin = h.container.querySelector('button.spot-pin[aria-label="Dataset Beach"]');
    expect(pin.querySelector('.pin-name').textContent).toBe('Dataset Beach');
    expect(h.container.querySelectorAll('.pin-photo').length).toBe(0);
    expect(h.container.textContent).toContain('Balingasay Headland');
    await h.unmount();
  });
});
