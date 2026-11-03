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

test('the tourist-spot file shape is understood, coordinates included', () => {
  const entry = normalize({
    id: 'bayambang-02',
    official_name: 'Archdiocesan Shrine and Parish of St. Vincent Ferrer (Bayambang Church)',
    municipality_or_city: 'Bayambang',
    exact_location_address: 'RF54+F9V, Roxas Street, Poblacion, Bayambang, 2423 Pangasinan',
    detailed_description: 'A 400-year-old brick church.',
    entrance_and_venue_fees: { admission_fee: 'Free admission', parking_fee: 'Free on-site parking' },
    what_to_do_activities: ['Attend Holy Mass', 'Perform Visita Iglesia'],
    ratings_and_reviews: {
      overall_rating: 4.5,
      total_review_count: 73,
      verified_reviews: [{ quote: 'Beautiful old church.' }],
    },
    verified_source_urls: ['https://seepangasinan.com/places/st-vincent-ferrer-parish-church/'],
    verified_image_urls: ['https://seepangasinan.com/a.jpg'],
  }, 0, 'tourist_spots');
  assert.equal(entry.name, 'Archdiocesan Shrine and Parish of St. Vincent Ferrer (Bayambang Church)');
  assert.equal(entry.town, 'Bayambang');
  assert.equal(entry.rating, '4.5');
  assert.equal(entry.reviews, '73');
  assert.equal(entry.price, 'Free admission');
  assert.match(entry.feesDetail, /Parking Fee: Free on-site parking/);
  assert.deepEqual(entry.activities, ['Attend Holy Mass', 'Perform Visita Iglesia']);
  assert.equal(entry.quotes[0], 'Beautiful old church.');
  assert.equal(entry.sourceUrls.length, 1);
  assert.equal(entry.photos.length, 1);
  assert.ok(Math.abs(entry.lat - 15.8087) < 0.02, 'decoded latitude');
  assert.ok(Math.abs(entry.lng - 120.4559) < 0.02, 'decoded longitude');
});

test('a short plus code in an unknown town is left without coordinates', () => {
  const entry = normalize({ name: 'Somewhere', municipality: 'Atlantis', exact_location_address: 'RF54+F9V, Atlantis' }, 0, 'tourist_spots');
  assert.equal(entry.lat, null);
  assert.equal(entry.lng, null);
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
  assert.ok(out.places.length > 0);
  assert.ok(out.places.every(p => !/hospital/i.test(p.name)));
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
