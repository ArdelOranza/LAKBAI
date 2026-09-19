const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchPlaces, DEFAULT_CENTER } = require('../places.js');
process.env.VITE_MAPBOX_TOKEN = process.env.VITE_MAPBOX_TOKEN || 'test-token';
test('searchPlaces maps features with no bbox lock', async () => {
  const realFetch = global.fetch;
  let url = '';
  global.fetch = async (u) => {
    url = String(u);
    return { ok: true, json: async () => ({ features: [
      { properties: { mapbox_id: 'x1', name: 'Boracay', full_address: 'Aklan', poi_category: ['beach'] }, geometry: { coordinates: [121.92, 11.97] } },
      { properties: { mapbox_id: 'x1', name: 'Dup', full_address: '', poi_category: [] }, geometry: { coordinates: [121.92, 11.97] } }
    ] }) };
  };
  try {
    const out = await searchPlaces('Boracay', null);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'Boracay');
    assert.ok(!url.includes('bbox='));
    assert.ok(url.includes('country=PH'));
  } finally {
    global.fetch = realFetch;
  }
});
test('default center is Philippines-wide', () => {
  assert.deepEqual(DEFAULT_CENTER, [121.77, 12.88]);
});
