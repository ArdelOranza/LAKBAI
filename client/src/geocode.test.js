// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reverseGeocode, resetGeocodeCache } from './geocode.js';

const TOKEN = 'test-token';
function respond(payload){
  return vi.fn(async () => ({ ok: true, json: async () => payload }));
}
function feature(text, regionText, placeType){
  const context = [];
  if (regionText) context.push({ id:'region.1', text: regionText });
  context.push({ id:'country.1', text:'Philippines' });
  return { features: [{ text, context, place_type: placeType || ['place'] }] };
}

/** A street/address fix: the municipality is only in `context.place`. */
function addressFeature(street, town, regionText){
  return {
    features: [{
      text: street,
      place_type: ['address'],
      context: [
        { id:'place.9', text: town },
        { id:'region.1', text: regionText },
        { id:'country.1', text:'Philippines' },
      ],
    }],
  };
}

beforeEach(() => {
  resetGeocodeCache();
  vi.stubEnv('VITE_MAPBOX_TOKEN', TOKEN);
});

describe('reverseGeocode', () => {
  it('labels the town with its region when the fix is in a known province', async () => {
    const fetchMock = respond(feature('Lingayen', 'Pangasinan'));
    vi.stubGlobal('fetch', fetchMock);
    const label = await reverseGeocode(120.23191, 16.02178);
    expect(label).toBe('Lingayen, Pangasinan');
  });

  it('never appends "Pangasinan" to a place outside the province', async () => {
    const fetchMock = respond(feature('Quezon City', null));
    vi.stubGlobal('fetch', fetchMock);
    const label = await reverseGeocode(121.05, 14.63);
    expect(label).toBe('Quezon City');
    expect(label).not.toContain('Pangasinan');
  });

  it('names Dagupan from any street in it, not the barangay or street name', async () => {
    const fetchMock = respond(addressFeature('Burgos Extension', 'Dagupan City', 'Pangasinan'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await reverseGeocode(120.333, 16.039)).toBe('Dagupan City, Pangasinan');
  });

  it('falls back to the province when the fix is between towns', async () => {
    const fetchMock = respond(feature('Pangasinan', null, ['region']));
    vi.stubGlobal('fetch', fetchMock);
    expect(await reverseGeocode(120.12, 16.2)).toBe('Pangasinan');
  });

  it('returns null and never fetches without a token', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await reverseGeocode(120.23, 16.03)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null on failure responses, empty features, and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await reverseGeocode(120.23, 16.03)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })));
    expect(await reverseGeocode(120.24, 16.03)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await reverseGeocode(120.25, 16.03)).toBeNull();
  });

  it('caches per ~100 m so jitters and StrictMode remounts do not refetch', async () => {
    const fetchMock = respond(feature('Lingayen', 'Pangasinan'));
    vi.stubGlobal('fetch', fetchMock);
    await reverseGeocode(120.23191, 16.02178); // first
    await reverseGeocode(120.23191, 16.02178); // same key
    await reverseGeocode(120.23194, 16.02179); // inside the same 100 m bucket
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
