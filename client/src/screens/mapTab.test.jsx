// @vitest-environment happy-dom
// U14-B: Mapbox-discovered places render as distinct pins on the live map,
// filtered by the same radius/chips as everything else, and tap into detail.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const markers = vi.hoisted(() => []);
const sess = vi.hoisted(() => ({ map: {} }));
const recommend = vi.hoisted(() => vi.fn(async () => ({ places: [
  { id: 'ds1', name: 'Dataset Beach', lng: 119.86, lat: 16.3, photo: null, categories: ['Beach'] },
  // A real photo: only close view may draw it inside the pin head.
  { id: 'ds2', name: 'Sunset Grill', lng: 119.868, lat: 16.302, photos: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Food.jpg/960px-Food.jpg'], categories: ['Food'] },
  // A Mapbox static image is a fallback for cards, never a face for a pin.
  { id: 'ds3', name: 'Static Map Cafe', lng: 119.867, lat: 16.301, photo: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+0066FF(119.8,16.3)/119.8,16.3,14.5,0/600x340@2x?access_token=pk.test', categories: ['Food'] },
] })));
const fetchSpots = vi.hoisted(() => vi.fn(async () => []));

vi.mock('../api.js', () => ({ recommend, chat: vi.fn(), itineraryFromSaved: vi.fn() }));
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../App.jsx', () => ({ FALLBACK_CENTER: { lng: 120.23, lat: 16.03 } }));
vi.mock('../sessionCache.js', () => ({
  sessionGet: k => sess.map[k] ?? null,
  sessionSet: (k, v) => { sess.map[k] = v; },
}));
vi.mock('../spots.js', () => ({ fetchSpots }));

// Lightweight stand-ins for the mapcn components: collect marker props.
vi.mock('@/components/ui/map', () => {
  let uid = 0;
  return {
    Map: ({ children }) => <div data-testid="mock-map">{children}</div>,
    MapMarker: ({ longitude, latitude, onClick, anchor, children }) => {
      markers.push({ id: 'mk' + (++uid), key: children?.props?.['data-mk'] || null, longitude, latitude, anchor });
      return (
        <div data-marker data-anchor={anchor} data-longitude={longitude} data-latitude={latitude} onClick={onClick}>
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

  it('drives the pin tip onto the coordinate, not the pin centre', async () => {
    const h = await mount();
    const pins = h.container.querySelectorAll('button.spot-pin').length;
    // MapLibre defaults to anchor="center"; a teardrop drawn that way points
    // ~15 px below the real place at city zoom.
    expect(pins).toBeGreaterThan(0);
    const anchored = new Set(markers.filter(m => m.anchor === 'bottom').map(m => `${m.longitude},${m.latitude}`));
    expect(anchored.size).toBe(pins);
    expect(markers.filter(m => m.anchor && m.anchor !== 'bottom').length).toBe(0);
    await h.unmount();
  });

  it('far zoom never draws a photo inside a pin', async () => {
    const h = await mount(); // default radius 5 km → zoom 11.5
    expect(h.container.querySelectorAll('button.spot-pin img').length).toBe(0);
    expect(h.container.querySelectorAll('.pin-photo').length).toBe(0);
    await h.unmount();
  });

  it('at 1 km the pin head shows a real, pin-sized photo instead of the glyph', async () => {
    const h = await mount();
    const chip = Array.from(h.container.querySelectorAll('.map-chips button, .map-chips .chip'))
      .find(b => b.textContent.trim() === '1 km');
    await React.act(async () => {
      chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    const pin = h.container.querySelector('button.spot-pin[aria-label="Sunset Grill"]');
    const img = pin.querySelector('img.pin-photo');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toContain('upload.wikimedia.org');
    // A 960 px thumbnail per pin would be megabytes for one neighbourhood.
    expect(img.getAttribute('src')).toContain('/128px-');
    // A place without a photo keeps its category glyph, not an empty head.
    const beach = h.container.querySelector('button.spot-pin[aria-label="Dataset Beach"]');
    expect(beach.querySelector('img')).toBeNull();
    expect(beach.querySelector('.pin-glyph')).not.toBeNull();
    await h.unmount();
  });

  it('never puts a Mapbox static map inside a pin, even in close view', async () => {
    const h = await mount();
    const chip = Array.from(h.container.querySelectorAll('.map-chips button, .map-chips .chip'))
      .find(b => b.textContent.trim() === '1 km');
    await React.act(async () => {
      chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    const pin = h.container.querySelector('button.spot-pin[aria-label="Static Map Cafe"]');
    expect(pin.querySelector('img')).toBeNull();
    expect(pin.querySelector('.pin-glyph')).not.toBeNull();
    expect(h.container.innerHTML).not.toContain('/static/pin-s');
    await h.unmount();
  });

  it('selecting a pin shows its full name and raises it above the rest', async () => {
    fetchSpots.mockResolvedValue([{ id: 'long', name: 'Cape Bolinao Lighthouse And Coastal Viewpoint', lng: 119.869, lat: 16.302, categories: ['Landmark'] }]);
    const h = await mount();
    const pin = h.container.querySelector('button.spot-pin[data-pin="spot"]');
    expect(pin.querySelector('.pin-name').textContent).not.toBe('Cape Bolinao Lighthouse And Coastal Viewpoint');
    await React.act(async () => {
      pin.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    const active = h.container.querySelector('button.spot-pin.active');
    expect(active).not.toBeNull();
    expect(active.getAttribute('aria-label')).toBe('Cape Bolinao Lighthouse And Coastal Viewpoint');
    expect(active.querySelector('.pin-name').textContent).toBe('Cape Bolinao Lighthouse And Coastal Viewpoint');
    expect(active.querySelector('.pin-glyph')).not.toBeNull();
    await h.unmount();
    fetchSpots.mockResolvedValue([]);
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
    expect(h.container.textContent).toContain('Balingasay Headland');
    await h.unmount();
  });
});
