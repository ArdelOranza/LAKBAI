import { describe, it, expect } from 'vitest';
import { placeImage, staticMapThumb } from './staticMap.js';

const HEADLAND = { name: 'Balingasay Headland', lng: 119.869, lat: 16.302 };

describe('staticMapThumb', () => {
  it('builds a Mapbox Static API URL centred on the place with the token encoded', () => {
    const url = staticMapThumb(119.869, 16.302, 'pk.test');
    expect(url).toContain('https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/');
    expect(url).toContain('pin-s+0066FF(119.869,16.302)');
    expect(url).toContain('access_token=pk.test');
  });

  it('is null without a token or usable coordinates — never a broken image src', () => {
    expect(staticMapThumb(119.869, 16.302, '')).toBeNull();
    expect(staticMapThumb(null, 16.302, 'pk.test')).toBeNull();
    expect(staticMapThumb(119.869, undefined, 'pk.test')).toBeNull();
    expect(staticMapThumb(Number.NaN, Number.NaN, 'pk.test')).toBeNull();
  });
});

describe('placeImage', () => {
  it('prefers a real photo: photos[0] first, then the bare photo field', () => {
    expect(placeImage({ ...HEADLAND, photos: ['https://real/a.jpg', 'https://real/b.jpg'] }, 'pk.test'))
      .toBe('https://real/a.jpg');
    expect(placeImage({ ...HEADLAND, photo: 'https://real/one.jpg' }, 'pk.test'))
      .toBe('https://real/one.jpg');
  });

  it('falls back to a static map of the place when no photo exists', () => {
    const src = placeImage(HEADLAND, 'pk.test');
    expect(src).toContain('api.mapbox.com/styles/v1/mapbox/streets-v12/static/');
    expect(src).toContain('(119.869,16.302)');
  });

  it('returns null (not a junk value) with neither photo nor fix, so callers keep icons', () => {
    expect(placeImage({ name: 'Mystery', lng: null, lat: null }, 'pk.test')).toBeNull();
    expect(placeImage({ name: 'Mystery' }, 'pk.test')).toBeNull();
    expect(placeImage(null, 'pk.test')).toBeNull();
    expect(placeImage({ ...HEADLAND, photo: '   ' }, '')).toBeNull();
  });

  it('ignores non-string photo fields instead of rendering them', () => {
    expect(placeImage({ ...HEADLAND, photo: 42 }, 'pk.test'))
      .toContain('api.mapbox.com');
  });
});
