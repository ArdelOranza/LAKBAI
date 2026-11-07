// PHOTO HIERARCHY — JSON → Wikimedia → Mapbox (must hold end-to-end)
// 1 JSON = curated dataset / admin photos (highest trust, hand-curated)
// 2 Wikimedia = real photo found via server/photos.findPhoto (secondary)
// 3 Mapbox = static map thumbnail (last resort, only when no real photo)
import { describe, it, expect } from 'vitest';
import { placeImage, photoSource, staticMapThumb } from './staticMap.js';

const TOKEN = 'pk.test';
const L = { lng: 119.869, lat: 16.302 };

describe('photo hierarchy (client)', () => {
  it('1st: JSON verified photo beats a Wikimedia photo when both exist', () => {
    const place = {
      ...L,
      photo: 'https://wikimedia.org/wiki/File.jpg', // secondary
      photoSource: 'wikimedia',
      photos: ['https://json.example.com/verified.jpg', 'https://wikimedia.org/wiki/File.jpg'],
      photoSources: ['json', 'wikimedia'],
    };
    expect(placeImage(place, TOKEN)).toBe('https://json.example.com/verified.jpg');
    expect(photoSource(place)).toBe('json');
  });

  it('2nd: Wikimedia real photo beats the Mapbox map when no JSON exists', () => {
    const place = {
      ...L,
      photo: 'https://upload.wikimedia.org/wikipedia/commons/File.jpg',
      photoSource: 'wikimedia',
    };
    expect(placeImage(place, TOKEN)).toContain('wikimedia.org');
    expect(placeImage(place, TOKEN)).not.toContain('api.mapbox.com/styles');
    expect(photoSource(place)).toBe('wikimedia');
  });

  it('3rd: Mapbox static map is only the last resort when neither exists', () => {
    const place = { ...L, photo: null, photos: [], photoSource: null };
    expect(placeImage(place, TOKEN)).toContain('api.mapbox.com/styles/v1/mapbox/streets-v12/static/');
    expect(photoSource(place)).toBe('mapbox');
  });

  it('infers json vs wikimedia from the URL when no explicit source tag exists', () => {
    expect(photoSource({ ...L, photo: 'https://upload.wikimedia.org/x.jpg' })).toBe('wikimedia');
    expect(photoSource({ ...L, photo: 'https://seepangasinan.com/x.jpg' })).toBe('json');
    expect(photoSource({ ...L, photos: ['https://upload.wikimedia.org/a.jpg'] })).toBe('wikimedia');
    expect(photoSource({ ...L })).toBe('mapbox');
  });
});
