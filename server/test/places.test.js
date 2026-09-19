const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inBox, searchPlaces, PANGASINAN_BBOX, DEFAULT_CENTER } = require('../places.js');
process.env.VITE_MAPBOX_TOKEN = process.env.VITE_MAPBOX_TOKEN || 'test-token';
test('inBox accepts Alaminos, rejects Boracay', () => {
  assert.equal(inBox(119.98, 16.15), true);
  assert.equal(inBox(120.58, 11.97), false);
});
test('bbox constant matches locked scope', () => {
  assert.equal(PANGASINAN_BBOX, '119.7,15.7,120.7,16.5');
  assert.deepEqual(DEFAULT_CENTER, [120.23, 16.03]);
});
test('searchPlaces locks bbox and country, dedupes', async () => {
  const realFetch = global.fetch;
  let url = '';
  global.fetch = async (u) => {
    url = String(u);
    return { ok: true, json: async () => ({ features: [
      { properties: { mapbox_id: 'x1', name: 'Patar Beach', full_address: 'Bolinao', poi_category: ['beach'] }, geometry: { coordinates: [119.79, 16.12] } },
      { properties: { mapbox_id: 'x1', name: 'Dup', full_address: '', poi_category: [] }, geometry: { coordinates: [119.79, 16.12] } },
      { properties: { mapbox_id: 'x2', name: 'Boracay', full_address: 'Aklan', poi_category: ['beach'] }, geometry: { coordinates: [121.92, 11.97] } }
    ] }) };
  };
  try {
    const out = await searchPlaces('beach', null);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'Patar Beach');
    assert.ok(url.includes('bbox=119.7%2C15.7%2C120.7%2C16.5') || url.includes('bbox=119.7,15.7,120.7,16.5'));
    assert.ok(url.includes('country=PH'));
  } finally {
    global.fetch = realFetch;
  }
});
