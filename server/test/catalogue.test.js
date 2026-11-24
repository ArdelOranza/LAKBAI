const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCatalogue } = require('../catalogue.js');

const CURATED = [
  {
    id: 'patar-beach-bolinao', name: 'Patar Beach', town: 'Bolinao',
    lat: 16.32, lng: 119.79, categories: ['Beach', 'Nature'],
    photos: ['https://upload.wikimedia.org/wikipedia/commons/a/ab/Patar.jpg'],
  },
  { id: 'no-point', name: 'Unpinned Curated', town: 'Bolinao', lat: null, lng: null, categories: ['Beach'], photos: [] },
];

const DATASET = [
  {
    id: 'pangasinan-5towns-003', name: 'Kuya J Restaurant - SM City Urdaneta Central', town: 'Urdaneta City',
    lat: 15.9711989, lng: 120.572764, categories: ['Filipino & Seafood Family Dining'],
    rating: 4.4, reviews: '1.2k', price: '₱200–₱400', address: 'SM City Urdaneta, Urdaneta City',
    description: 'A family restaurant inside the mall.', festival: '', activities: ['Dine'],
    photos: [], quotes: ['Great sisig'], visitorReviews: [{ text: 'Great sisig', source: 'Google Maps' }],
    hours: '10am–9pm', phone: '0917 000 0000',
  },
  // A row with no honest coordinate must never become a pin on the map.
  { id: 'no-coords', name: 'Unpinned Dataset', town: 'Dagupan City', lat: null, lng: null, categories: ['restaurant'], photos: [] },
];

test('buildCatalogue joins the curated list and the pinned dataset rows', () => {
  const out = buildCatalogue({ curated: CURATED, dataset: DATASET });
  assert.deepEqual(out.map(p => p.id), ['patar-beach-bolinao', 'pangasinan-5towns-003']);
});

test('a curated spot keeps its categories and real photo list', () => {
  const spot = buildCatalogue({ curated: CURATED, dataset: [] })[0];
  assert.equal(spot.sourceKind, 'spot');
  assert.deepEqual(spot.categories, ['Beach', 'Nature']);
  assert.deepEqual(spot.photos, ['https://upload.wikimedia.org/wikipedia/commons/a/ab/Patar.jpg']);
});

test('a dataset row is projected to the card shape the map and lists render', () => {
  const row = buildCatalogue({ curated: [], dataset: DATASET })[0];
  assert.equal(row.sourceKind, 'dataset');
  assert.equal(row.name, 'Kuya J Restaurant - SM City Urdaneta Central');
  assert.equal(row.town, 'Urdaneta City');
  assert.equal(row.lat, 15.9711989);
  assert.deepEqual(row.categories, ['Filipino & Seafood Family Dining']);
  assert.equal(row.description, 'A family restaurant inside the mall.');
  assert.equal(row.address, 'SM City Urdaneta, Urdaneta City');
});

test('the catalogue payload stays lean — full review lists do not ride along', () => {
  const row = buildCatalogue({ curated: [], dataset: DATASET })[0];
  assert.equal(row.visitorReviews, undefined);
  assert.equal(row.quotes, undefined);
  assert.equal(row.hours, undefined);
  assert.equal(row.phone, undefined);
});

test('GET /api/catalogue serves one union with a point on every place', async () => {
  const app = require('../index.js');
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  try {
    const r = await fetch(`http://localhost:${server.address().port}/api/catalogue`);
    assert.equal(r.status, 200);
    const { places } = await r.json();
    assert.ok(Array.isArray(places));
    assert.ok(places.length > 100, 'the dataset rows join the curated spots');
    for (const p of places) {
      assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lng), p.name + ' has a real point');
      assert.ok(p.name && p.town, p.name + ' is labelled');
      assert.ok(Array.isArray(p.categories), p.name + ' carries categories');
    }
    const ids = new Set(places.map(p => p.id));
    assert.ok(ids.has('abagatanen-beach-agno'), 'a curated spot is present');
    assert.ok(places.some(p => p.sourceKind === 'dataset'), 'dataset rows are present');
    assert.ok(places.some(p => /Dagupeña Restaurant/.test(p.name)), 'a dataset restaurant is present');
  } finally {
    server.close();
  }
});