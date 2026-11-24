// @vitest-environment happy-dom
// The map is a browse surface over the one shared catalogue: every pin it draws
// (curated, community or dataset) comes from the same list the Dining/Beaches
// screens read, and the chips are hotel / restaurant / beach / church / other.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const markers = vi.hoisted(() => []);
const sess = vi.hoisted(() => ({ map: {} }));
const catalogue = vi.hoisted(() => ({ fetchCatalogue: vi.fn() }));

vi.mock('../catalogue.js', () => ({ fetchCatalogue: catalogue.fetchCatalogue }));
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../App.jsx', () => ({ FALLBACK_CENTER: { lng: 120.23, lat: 16.03 } }));
vi.mock('../sessionCache.js', () => ({
  sessionGet: k => sess.map[k] ?? null,
  sessionSet: (k, v) => { sess.map[k] = v; },
}));

// Lightweight stand-ins for the mapcn components: collect marker props.
vi.mock('@/components/ui/map', () => {
  let uid = 0;
  return {
    Map: ({ children }) => <div data-testid="mock-map">{children}</div>,
    MapMarker: ({ longitude, latitude, onClick, anchor, offset, children }) => {
      markers.push({ id: 'mk' + (++uid), key: children?.props?.['data-mk'] || null, longitude, latitude, anchor, offset });
      return (
        <div data-marker data-anchor={anchor} data-longitude={longitude} data-latitude={latitude} data-offset={Array.isArray(offset) ? offset.join(',') : ''} onClick={onClick}>
          {children}
        </div>
      );
    },
    MarkerContent: ({ children }) => <div className="marker-content">{children}</div>,
  };
});

import MapTab from './MapTab.jsx';

const CATALOGUE = [
  { id: 'ds1', name: 'Dataset Beach', lng: 119.86, lat: 16.3, photos: [], categories: ['Beach'] },
  // A real photo: only close view may draw it inside the pin head.
  { id: 'ds2', name: 'Sunset Grill', lng: 119.868, lat: 16.302, photos: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Food.jpg/960px-Food.jpg'], categories: ['restaurant'] },
  // A Mapbox static image is a fallback for cards, never a face for a pin.
  { id: 'ds3', name: 'Static Map Cafe', lng: 119.867, lat: 16.301, photo: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+0066FF(119.8,16.3)/119.8,16.3,14.5,0/600x340@2x?access_token=pk.test', photos: [], categories: ['restaurant'] },
  { id: 'church1', name: 'Bolinao Parish Church', lng: 119.865, lat: 16.299, photos: [], categories: ['Religious & Pilgrimage Site'] },
  { id: 'museum1', name: 'Bolinao Museum', lng: 119.864, lat: 16.2985, photos: [], categories: ['Historical, Museum & Cultural Heritage'] },
  { id: 'hotel1', name: 'Cozy Lodge', lng: 119.863, lat: 16.298, photos: [], categories: ['Hotels, Resorts, Inns & Staycations'] },
];

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

const labelsOf = (h, pin = 'spot') =>
  Array.from(h.container.querySelectorAll(`button.spot-pin[data-pin="${pin}"]`))
    .map(b => b.getAttribute('aria-label')).sort();

const clickChip = async (h, text) => {
  const chip = Array.from(h.container.querySelectorAll('.map-chips button, .map-chips .chip'))
    .find(b => b.textContent.trim() === text);
  expect(chip, 'chip ' + text).toBeTruthy();
  await React.act(async () => { chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
};

beforeEach(() => {
  document.body.innerHTML = '';
  markers.length = 0;
  sess.map = { 'lakbai.discovered': [...DISCOVERED] };
  catalogue.fetchCatalogue.mockReset();
  catalogue.fetchCatalogue.mockImplementation(async () => CATALOGUE);
});

describe('MapTab reads the shared catalogue', () => {
  it('draws catalogue pins and Mapbox discoveries side by side', async () => {
    const h = await mount();
    expect(labelsOf(h)).toEqual(['Bolinao Museum', 'Bolinao Parish Church', 'Cozy Lodge', 'Dataset Beach', 'Static Map Cafe', 'Sunset Grill']);
    // Faraway Point is outside the 5 km radius; the near one survives.
    expect(labelsOf(h, 'discover')).toEqual(['Balingasay Headland']);
    await h.unmount();
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
    await h.unmount();
  });

  it('no longer offers the old Food/Events chips', async () => {
    const h = await mount();
    const texts = Array.from(h.container.querySelectorAll('.map-chips button, .map-chips .chip')).map(b => b.textContent.trim());
    expect(texts).toEqual(expect.arrayContaining(['All', 'Hotels', 'Restaurants', 'Beaches', 'Churches', 'Others']));
    expect(texts).not.toContain('Food');
    expect(texts).not.toContain('Events');
    await h.unmount();
  });

  it('the Restaurants chip keeps restaurants, and hides everything else', async () => {
    const h = await mount();
    await clickChip(h, 'Restaurants');
    expect(labelsOf(h)).toEqual(['Static Map Cafe', 'Sunset Grill']);
    expect(labelsOf(h, 'discover')).toEqual([]); // a headland is not a restaurant
    await h.unmount();
  });

  it('the Churches chip shows houses of worship', async () => {
    const h = await mount();
    await clickChip(h, 'Churches');
    expect(labelsOf(h)).toEqual(['Bolinao Parish Church']);
    await h.unmount();
  });

  it('the Hotels chip shows lodging and leaves restaurants out', async () => {
    const h = await mount();
    await clickChip(h, 'Hotels');
    expect(labelsOf(h)).toEqual(['Cozy Lodge']);
    await h.unmount();
  });

  it('the Beaches chip shows coastal places', async () => {
    const h = await mount();
    await clickChip(h, 'Beaches');
    expect(labelsOf(h)).toEqual(['Dataset Beach']);
    await h.unmount();
  });

  it('the Others chip is the honest catch-all, never a copy of All', async () => {
    const h = await mount();
    await clickChip(h, 'Others');
    expect(labelsOf(h)).toEqual(['Bolinao Museum']);
    expect(labelsOf(h, 'discover')).toEqual(['Balingasay Headland']);
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
    expect(h.container.querySelector('[data-testid="locate-me"]')).not.toBeNull();
    await h.unmount();
  });

  it('centres every marker on its coordinate, dot and bubble alike', async () => {
    const h = await mount();
    expect(h.container.querySelectorAll('button.spot-pin').length).toBeGreaterThan(0);
    expect(markers.filter(m => m.anchor).every(m => m.anchor === 'center')).toBe(true);
    await h.unmount();
  });

  it('far zoom draws a real pin whose tip sits on the coordinate', async () => {
    const h = await mount();
    const pin = h.container.querySelector('button.spot-pin[aria-label="Dataset Beach"]');
    expect(pin.querySelector('.pin-dot .pin-shape')).not.toBeNull();
    expect(pin.querySelector('.pin-glyph')).toBeNull();
    const marker = pin.closest('[data-marker]');
    expect(marker.getAttribute('data-anchor')).toBe('center');
    expect(marker.getAttribute('data-offset')).toBe('0,-16');
    await h.unmount();
  });

  it('far zoom never draws a photo inside a pin', async () => {
    const h = await mount();
    expect(h.container.querySelectorAll('button.spot-pin img').length).toBe(0);
    expect(h.container.querySelectorAll('.pin-photo').length).toBe(0);
    await h.unmount();
  });

  it('at 1 km the pin head shows a real, pin-sized photo instead of the glyph', async () => {
    const h = await mount();
    await clickChip(h, '1 km');
    const pin = h.container.querySelector('button.spot-pin[aria-label="Sunset Grill"]');
    expect(pin.className).toContain('bubble');
    expect(pin.closest('[data-marker]').getAttribute('data-anchor')).toBe('center');
    expect(pin.querySelector('.pin-dot')).toBeNull();
    expect(pin.querySelector('.pin-bubble')).not.toBeNull();
    const img = pin.querySelector('img.pin-photo');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toContain('upload.wikimedia.org');
    expect(img.getAttribute('src')).toContain('/120px-');
    const beach = h.container.querySelector('button.spot-pin[aria-label="Dataset Beach"]');
    expect(beach.querySelector('img')).toBeNull();
    expect(beach.querySelector('.pin-bubble')).not.toBeNull();
    expect(beach.querySelector('.pin-core')).not.toBeNull();
    await h.unmount();
  });

  it('never puts a Mapbox static map inside a pin, even in close view', async () => {
    const h = await mount();
    await clickChip(h, '1 km');
    const pin = h.container.querySelector('button.spot-pin[aria-label="Static Map Cafe"]');
    expect(pin.querySelector('img')).toBeNull();
    expect(h.container.innerHTML).not.toContain('/static/pin-s');
    await h.unmount();
  });

  it('selecting a pin shows its full name and raises it above the rest', async () => {
    catalogue.fetchCatalogue.mockResolvedValueOnce([
      { id: 'long', name: 'Cape Bolinao Lighthouse And Coastal Viewpoint', lng: 119.869, lat: 16.302, categories: ['Landmark'], photos: [] },
    ]);
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
    await h.unmount();
  });

  it('no session discoveries means no discover pins and no crash', async () => {
    sess.map = {};
    const h = await mount();
    expect(h.container.querySelectorAll('button.spot-pin.discover').length).toBe(0);
    expect(h.container.querySelectorAll('button.spot-pin[data-pin="spot"]').length).toBe(CATALOGUE.length);
    await h.unmount();
  });

  it('far zoom keeps the pin and its name in the DOM so the label can fade', async () => {
    const h = await mount();
    expect(h.container.firstElementChild.className).toContain('pins-far');
    expect(h.container.querySelectorAll('.pin-dot').length)
      .toBe(h.container.querySelectorAll('button.spot-pin').length);
    const pin = h.container.querySelector('button.spot-pin');
    expect(pin.getAttribute('aria-label')).toBe('Dataset Beach');
    expect(pin.getAttribute('title')).toBe('Dataset Beach');
    expect(pin.querySelector('.pin-name').textContent).toBe('Dataset Beach');
    expect(pin.dataset.pin).not.toBeUndefined(); // declutter priority
    await h.unmount();
  });

  it('zooming into a neighbourhood (1 km) reveals the name beside the pin', async () => {
    const h = await mount();
    await clickChip(h, '1 km');
    expect(h.container.firstElementChild.className).not.toContain('pins-far');
    const pin = h.container.querySelector('button.spot-pin[aria-label="Dataset Beach"]');
    expect(pin.querySelector('.pin-name').textContent).toBe('Dataset Beach');
    expect(h.container.textContent).toContain('Balingasay Headland');
    await h.unmount();
  });

  it('draws one pin when the catalogue carries the same building twice', async () => {
    catalogue.fetchCatalogue.mockResolvedValueOnce([
      { id: 'cathedral-a', name: 'Urdaneta Cathedral', lng: 120.567, lat: 15.974, categories: ['Church'] },
      { id: 'cathedral-b', name: 'Urdaneta Cathedral', lng: 120.5673, lat: 15.9741, categories: ['Church'] },
    ]);
    const h = await mount({ lng: 120.5711, lat: 15.9761 });
    expect(labelsOf(h)).toEqual(['Urdaneta Cathedral']);
    await h.unmount();
  });

  it('never merges two mall tenants that share one coordinate', async () => {
    catalogue.fetchCatalogue.mockResolvedValueOnce([
      { id: 'kfc', name: 'KFC - SM City Rosales', lng: 120.6026, lat: 15.8782, categories: ['restaurant'] },
      { id: 'kuya', name: 'Kuya J Restaurant - SM City Rosales', lng: 120.6026, lat: 15.8782, categories: ['restaurant'] },
    ]);
    const h = await mount({ lng: 120.6026, lat: 15.8782 });
    expect(labelsOf(h)).toEqual(['KFC - SM City Rosales', 'Kuya J Restaurant - SM City Rosales']);
    await h.unmount();
  });

  it('drops a Mapbox discovery the catalogue already pins', async () => {
    sess.map = { 'lakbai.discovered': [
      { id: 'box:dup', name: 'Dataset Beach', lng: 119.8602, lat: 16.3002, categories: [], photo: null, source: 'mapbox' },
    ] };
    const h = await mount();
    expect(h.container.querySelectorAll('button.spot-pin.discover').length).toBe(0);
    expect(h.container.querySelectorAll('button.spot-pin[data-pin="spot"]').length).toBeGreaterThan(0);
    await h.unmount();
  });
});

describe('MapTab add-a-place entry', () => {
  const click = async (h, el) => {
    await React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  };

  it('offers a labelled button to add a place that is missing', async () => {
    const h = await mount();
    const fab = h.container.querySelector('[data-testid="add-place-fab"]');
    expect(fab).not.toBeNull();
    expect(fab.getAttribute('aria-label')).toBe('Add a missing place');
    await h.unmount();
  });

  it('opens the sheet over the map, and closing it puts the traveller back on the map', async () => {
    const h = await mount();
    await click(h, h.container.querySelector('[data-testid="add-place-fab"]'));
    expect(h.container.querySelector('[data-testid="add-place"]')).not.toBeNull();
    await click(h, h.container.querySelector('[data-testid="add-place-close"]'));
    expect(h.container.querySelector('[data-testid="add-place"]')).toBeNull();
    await h.unmount();
  });

  it('offers the same entry point from the empty-map state', async () => {
    sess.map = {};
    catalogue.fetchCatalogue.mockResolvedValueOnce([]);
    const h = await mount();
    const link = h.container.querySelector('[data-testid="add-place-link"]');
    expect(link).not.toBeNull();
    await click(h, link);
    expect(h.container.querySelector('[data-testid="add-place"]')).not.toBeNull();
    await h.unmount();
  });
});