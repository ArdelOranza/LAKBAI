const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpotList } = require('../spotList.js');

const CURATED = [
  { id: 'patar-beach-bolinao', name: 'Patar Beach', lat: 16.32, lng: 119.79, photos: [] },
  { id: 'lingayen-beach', name: 'Lingayen Beach', lat: 16.02, lng: 120.23, photos: [] },
];

test('an approved community place joins the curated catalogue', async () => {
  const list = createSpotList({
    listCurated: () => CURATED,
    approved: async () => [{ id: 'community-1', name: 'Tondol Sunset Grill', lat: 16.3, lng: 120.1, photos: ['https://x/y.jpg'] }],
  });
  const spots = await list.listSpots();
  assert.equal(spots.length, 3);
  assert.equal(spots[2].name, 'Tondol Sunset Grill');
  assert.equal(spots[0].name, 'Patar Beach', 'the curated list keeps its order');
});

test('no approved places means the catalogue is served untouched', async () => {
  const list = createSpotList({ listCurated: () => CURATED, approved: async () => [] });
  assert.deepEqual(await list.listSpots(), CURATED);
});

test('a submissions backend that is down cannot take the map down with it', async () => {
  // Unreachable Supabase, or migration 0005 not run yet.
  const list = createSpotList({
    listCurated: () => CURATED,
    approved: async () => { const e = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); e.status = 503; throw e; },
  });
  assert.deepEqual(await list.listSpots(), CURATED);
});

test('a community place without a point is not put on the map', async () => {
  const list = createSpotList({
    listCurated: () => CURATED,
    approved: async () => [
      { id: 'community-bad', name: 'No coordinates', lat: null, lng: null },
      { id: 'community-good', name: 'Has a point', lat: 15.98, lng: 120.57 },
    ],
  });
  const spots = await list.listSpots();
  assert.deepEqual(spots.map(s => s.id), ['patar-beach-bolinao', 'lingayen-beach', 'community-good']);
});
