// U14-B: live Mapbox discovery for places outside the curated dataset.
// All discovery goes through the server's bbox-locked /api/places proxy —
// never direct Mapbox calls from the client, and never outside Pangasinan.
import { describe, it, expect, vi } from 'vitest';
import { discoverPlaces } from './discover.js';

const SERVER_BODY = {
  places: [
    { id: 'd009j', name: 'Balingasay Headland', lng: 119.869, lat: 16.302, address: 'Balingasay, Bolinao, Pangasinan', categories: ['natural', 'landmark'] },
    { id: 'd009k', name: 'Bolinao Falls', lng: 119.84, lat: 16.223, address: 'Bolinao, Pangasinan', categories: ['waterfall'] },
    { id: 'bad', name: 'No Coordinates Point', lng: null, lat: null, address: '', categories: [] },
  ],
};

function okFetch(body = SERVER_BODY, meta = {}){
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => body, ...meta }));
}

describe('discoverPlaces', () => {
  it('hits the bbox-locked server proxy and normalises rows into place cards', async () => {
    const f = okFetch();
    const rows = await discoverPlaces('Bolingasay', '119.9,16.1', f);
    expect(f.mock.calls[0][0]).toBe('/api/places?q=Bolingasay&proximity=119.9%2C16.1');
    expect(rows).toHaveLength(2); // the coord-less row is dropped
    expect(rows[0]).toMatchObject({
      id: 'box:d009j', name: 'Balingasay Headland', lng: 119.869, lat: 16.302,
      source: 'mapbox', photo: null,
    });
    expect(rows[0].hint).toContain('Bolinao'); // town inferred from address
    expect(typeof rows[0].lng).toBe('number');
  });

  it('never queries without a real search term', async () => {
    const f = okFetch();
    expect(await discoverPlaces('', '119.9,16.1', f)).toEqual([]);
    expect(await discoverPlaces('   ', null, f)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('fails soft: proxy errors and offline yield [] instead of blanking search', async () => {
    expect(await discoverPlaces('x', null, vi.fn(async () => ({ ok: false, status: 502 })))).toEqual([]);
    expect(await discoverPlaces('x', null, vi.fn(async () => { throw new Error('net down'); }))).toEqual([]);
  });

  it('is safe when the payload is not a place payload', async () => {
    expect(await discoverPlaces('x', null, okFetch({ error: 'rate limited' }))).toEqual([]);
    expect(await discoverPlaces('x', null, okFetch([SERVER_BODY.places[0]]))).toHaveLength(1);
  });
});
