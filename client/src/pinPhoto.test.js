// Photo-in-pin rules: only close view gets a face, only a real photo goes in
// it, and a Mapbox static map is never drawn inside the map again.
import { describe, it, expect } from 'vitest';
import { pinPhoto, isStaticMap } from './pinPhoto.js';

const WIKI_960 = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Beach.jpg/960px-Beach.jpg';
const CURATED = 'https://example.com/curated.jpg';
const STATIC = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+0066FF(119.8,16.3)/119.8,16.3,14.5,0/600x340@2x?access_token=pk.test';

describe('pinPhoto', () => {
  it('keeps the pin photo-free at city/region zoom', () => {
    expect(pinPhoto({ photos: [WIKI_960] }, false)).toBeNull();
    expect(pinPhoto({ photos: [WIKI_960] })).toBeNull();
  });

  it('uses the first real photo at 1 km zoom', () => {
    const out = pinPhoto({ photos: [WIKI_960, CURATED] }, true);
    expect(out).not.toBeNull();
    expect(out).toContain('upload.wikimedia.org');
  });

  it('accepts a bare photo field too', () => {
    expect(pinPhoto({ photo: CURATED }, true)).toBe(CURATED);
  });

  it('shrinks a Wikimedia thumbnail down to pin size', () => {
    expect(pinPhoto({ photos: [WIKI_960] }, true)).toContain('/128px-');
    expect(pinPhoto({ photos: [WIKI_960] }, true)).not.toContain('/960px-');
  });

  it('leaves an admin/curated photo URL alone', () => {
    expect(pinPhoto({ photos: [CURATED] }, true)).toBe(CURATED);
  });

  it('never puts a Mapbox static map inside a pin', () => {
    expect(pinPhoto({ photos: [STATIC] }, true)).toBeNull();
    expect(pinPhoto({ photo: STATIC }, true)).toBeNull();
  });

  it('falls back to null when there is no photo at all', () => {
    expect(pinPhoto({}, true)).toBeNull();
    expect(pinPhoto({ photos: [], photo: null }, true)).toBeNull();
    expect(pinPhoto(null, true)).toBeNull();
  });
});

describe('isStaticMap', () => {
  it('recognises the Mapbox Static Images API', () => {
    expect(isStaticMap(STATIC)).toBe(true);
    expect(isStaticMap(WIKI_960)).toBe(false);
    expect(isStaticMap(CURATED)).toBe(false);
    expect(isStaticMap(null)).toBe(false);
  });
});
