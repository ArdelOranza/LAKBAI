const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.LAKBAI_DATA = path.join(__dirname, 'fixtures', 'dataset.json');

const { datasetInfo, localChat, localRecommend, search, parseRating, normalize, pickList, NO_MATCH } = require('../dataset.js');

test('the installed dataset is detected and normalised', () => {
  const info = datasetInfo();
  assert.equal(info.ready, true);
  assert.equal(info.count, 4);
});

test('a Google-style rating string becomes a rating and a review count', () => {
  assert.deepEqual(parseRating('4.2/5 from 185 reviews'), { rating: '4.2', reviews: '185' });
  assert.deepEqual(parseRating(4.4, 1200), { rating: '4.4', reviews: '1.2k' });
  assert.deepEqual(parseRating('', ''), { rating: '', reviews: '' });
});

test('field spellings from hand-made files still normalise', () => {
  const a = normalize({ title: 'Patar Beach', city: 'Bolinao', latitude: 16.32, longitude: 119.79 });
  assert.equal(a.name, 'Patar Beach');
  assert.equal(a.town, 'Bolinao');
  assert.equal(a.lat, 16.32);
  const b = normalize({ name: 'Cafe', location: 'Dagupan', coordinates: { lat: 16.04, lng: 120.33 } });
  assert.equal(b.town, 'Dagupan');
  assert.equal(b.lng, 120.33);
});

test('an array file is accepted as-is', () => {
  assert.equal(pickList([{ name: 'A' }]).length, 1);
});

test('a restaurants-only file is treated as food without a category field', () => {
  const entry = normalize({ name: "Conrad's Dagupan", municipality: 'Dagupan City' }, 0, 'restaurants');
  assert.ok(entry.intents.includes('food'));
});

test('search matches the town and the dish, not the whole province', () => {
  const dagupan = search('where can I eat in Dagupan', '120.341,16.043');
  assert.equal(dagupan[0].name, "Conrad's Dagupan");
  const bagnet = search('bagnet', '');
  assert.ok(bagnet.some(p => p.name === "Conrad's Dagupan"));
});

test('chat answers come from the file, with ratings kept verbatim', async () => {
  const out = await localChat('beach in Dagupan', '120.341,16.043');
  assert.equal(out.source, 'dataset');
  assert.ok(out.candidates.length > 0);
  assert.ok(out.candidates.some(c => c.name === 'Tondaligan Beach Park'));
  assert.match(out.answer, /Tondaligan Beach Park/);
});

test('a hospital is never recommended as somewhere to visit', async () => {
  const out = await localRecommend('places in San Carlos', '120.348,15.928');
  assert.ok(out.places.every(p => !/hospital/i.test(p.name)));
  // The hospital was the only match, so the honest answer is "nothing here".
  assert.equal(out.places.length, 0);
  assert.equal(out.answer, NO_MATCH);
});

test('recommendations keep the fields the cards need', async () => {
  const out = await localRecommend('food in Dagupan', '120.341,16.043');
  const first = out.places[0];
  assert.equal(first.name, "Conrad's Dagupan");
  assert.equal(first.rating, '4.2');
  assert.equal(first.reviews, '185');
  assert.equal(first.sourceKind, 'dataset');
  assert.ok(first.sources[0].includes('google.com/maps'));
});

test('an unmatched question says so instead of inventing a place', async () => {
  const out = await localChat('how do I file my taxes', '120.341,16.043');
  assert.equal(out.candidates.length, 0);
  assert.equal(out.answer, NO_MATCH);
});
