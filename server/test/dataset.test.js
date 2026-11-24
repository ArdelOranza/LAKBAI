const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.LAKBAI_DATA = path.join(__dirname, 'fixtures', 'dataset.json');
const overlayFile = path.join(os.tmpdir(), 'lakbai-dataset-photos-' + process.pid + '.json');
process.env.LAKBAI_ADMIN_PHOTOS_FILE = overlayFile;
try { fs.unlinkSync(overlayFile); } catch { /* fresh */ }

const { datasetInfo, allEntries, localChat, localRecommend, search, intentOf, genericPlanAsk, smallTalkReply, parseRating, normalize, pickList, withCoords, NO_MATCH } = require('../dataset.js');
const { setPhotos } = require('../adminPhotos.js');

/** Run a read against a throwaway dataset file, then put the fixture back. */
function withDataset(rows, fn){
  const file = path.join(os.tmpdir(), 'lakbai-dataset-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(file, JSON.stringify({ places: rows }), 'utf8');
  const before = process.env.LAKBAI_DATA;
  process.env.LAKBAI_DATA = file;
  try { return fn(); }
  finally {
    process.env.LAKBAI_DATA = before;
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }
}

test('the installed dataset is detected and normalised', () => {
  const info = datasetInfo();
  assert.equal(info.ready, true);
  assert.equal(info.count, 5);
  assert.ok(info.sig.includes('dataset.json'), 'signature names the file');
});

test('editing a row in place changes the dataset signature', () => {
  const file = process.env.LAKBAI_DATA;
  const before = datasetInfo().sig;
  const st = fs.statSync(file);
  try {
    fs.utimesSync(file, st.atime, new Date(st.mtimeMs - 5000));
    const after = datasetInfo().sig;
    // Same file, same row count — only the mtime moved. AI cache keys ride on
    // this signature, so an in-place edit must not serve yesterday's answer.
    assert.notEqual(after, before);
  } finally {
    fs.utimesSync(file, st.atime, st.mtime);
  }
  assert.equal(datasetInfo().sig, before);
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

test('two different businesses sharing a mall pin are both kept', () => {
  // A mall puts a dozen tenants within 50 m of each other. Treating proximity
  // alone as "same place" silently deleted 40 real places from the catalogue.
  const out = withDataset([
    { name: 'Cabalen - SM City Urdaneta Central', municipality_or_city: 'Urdaneta City', lat: 15.97610, lng: 120.57120, total_review_count: 120 },
    { name: "Classic Savory - SM City Urdaneta Central", municipality_or_city: 'Urdaneta City', lat: 15.97615, lng: 120.57125, total_review_count: 300 },
    { name: 'Starbucks Coffee - SM City Urdaneta Central', municipality_or_city: 'Urdaneta City', lat: 15.97618, lng: 120.57128, total_review_count: 900 },
  ], () => allEntries());
  assert.equal(out.length, 3);
});

test('the same place under two spellings still collapses to one row', () => {
  const out = withDataset([
    { name: 'URESHII KOI', municipality_or_city: 'Urdaneta City', lat: 15.97610, lng: 120.57120, total_review_count: 41 },
    { name: 'URESHII KOI Japanese Restaurant', municipality_or_city: 'Urdaneta City', lat: 15.97612, lng: 120.57121, total_review_count: 1900 },
  ], () => allEntries());
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'URESHII KOI Japanese Restaurant', 'the row with more reviews is the surviving one');
});

test('the fatter row wins even when its count is written as "1.9k"', () => {
  // Number("1.9k") is NaN, which used to hand the win to the thinner row.
  const out = withDataset([
    { name: 'Patar Beach', municipality_or_city: 'Bolinao', lat: 16.32000, lng: 119.79000, total_review_count: 41 },
    { name: 'Patar White Sand Beach', municipality_or_city: 'Bolinao', lat: 16.32010, lng: 119.79010, total_review_count: 1900 },
  ], () => allEntries());
  assert.equal(out.length, 1);
  assert.equal(out[0].reviews, '1.9k');
});

test('a Google Maps place id never reaches the address travellers see', () => {
  // Scraped files carry the source listing's id inside the address. It is not
  // part of the address, and it must not show under a place name.
  const entry = normalize({
    name: "Matutina - Gerry's Seafood House",
    municipality_or_city: 'Urdaneta City',
    location: "Brgy. Nancayasan, MacArthur Hwy, Urdaneta City, 2428 Pangasinan (Google Maps Place ID: ChIJJ5gzGP0-kTMRG-1ZO3hRkFg)",
  }, 0, 'restaurants');
  assert.equal(entry.address, 'Brgy. Nancayasan, MacArthur Hwy, Urdaneta City, 2428 Pangasinan');
  assert.ok(!/ChIJ/.test(entry.address + entry.name));

  const named = normalize({ name: 'Kainan sa Kamalig (Place ID: ChIJabc123456)', municipality: 'Urdaneta City' }, 1, 'restaurants');
  assert.equal(named.name, 'Kainan sa Kamalig');
});

test('the older files write ids, coordinates and phones in backticks — all of it goes', () => {
  // The shape actually present in pangasinan-150.json: plural label, two ids,
  // and a coordinates/phone note behind it.
  const entry = normalize({
    name: 'St. Vincent Ferrer Parish',
    municipality_or_city: 'Bayambang',
    location: 'RF54+F9V, Roxas Street, Town Proper (Poblacion), Bayambang, 2423 Pangasinan (Google Maps Place ID: `ChIJ____DxlJkTMR8hfnKrKiJ10`; Phone: `+63 75 529 2024`)',
  }, 0, 'tourist_spots');
  assert.equal(entry.address, 'RF54+F9V, Roxas Street, Town Proper (Poblacion), Bayambang, 2423 Pangasinan');
  assert.ok(!/ChIJ|Phone/.test(entry.address));

  const two = normalize({
    name: 'Bayambang Stop',
    municipality_or_city: 'Bayambang',
    location: 'Bayambang Road, Barangay Bani, Bayambang, 2423 Pangasinan (Google Maps Place IDs: `ChIJhRf7wT5JkTMRwcDsipUyS0o` / `ChIJg1QXwiJJkTMRsD4M75HaAu0`; Coordinates: `15°49′11′′N 120°26′39′′E`)',
  }, 0, 'tourist_spots');
  assert.equal(two.address, 'Bayambang Road, Barangay Bani, Bayambang, 2423 Pangasinan');

  // A parenthetical that is part of the name stays put.
  const kept = normalize({ name: 'Archdiocesan Shrine and Parish of St. Vincent Ferrer (Bayambang Church)', municipality_or_city: 'Bayambang' }, 0, 'tourist_spots');
  assert.equal(kept.name, 'Archdiocesan Shrine and Parish of St. Vincent Ferrer (Bayambang Church)');
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
  // A URL scraped off a listing page is not a photo of the place: it is an ad,
  // a brochure scan or a page hero shared by a dozen entries. The dataset no
  // longer hands those to the app; photos come from the admin map and the
  // Wikimedia name lookup.
  assert.equal(entry.photos.length, 0);
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

test('a trip request that names no place is planned, not refused', async () => {
  // "can you do a trip from here" has no dish, town or kind of place to match,
  // so it used to fall through to the honest no-match line. A generic day-out
  // request should still be answered with real, nearby places.
  assert.equal(intentOf('can you do a trip for me here'), 'plan');
  assert.equal(intentOf('do a trip from here'), 'plan');
  assert.equal(intentOf('what can i do here'), 'plan');
  const generic = search('do a trip from here', '120.341,16.043');
  assert.ok(generic.length > 0, 'a nameless trip request still returns verified places');
  assert.ok(generic.some(e => e.name === 'Tondaligan Beach Park'), 'attractions, not a dead end');
  const out = await localChat('can you do a trip from here', '120.341,16.043');
  assert.equal(out.intent, 'plan');
  assert.ok(out.candidates.length > 0);
  assert.notEqual(out.answer, NO_MATCH);
});

test('the generic trip fallback only fires when no place or town is named', () => {
  // "do a trip from here" names nothing, so best-effort places are fair game.
  assert.equal(genericPlanAsk('do a trip from here', 'plan'), true);
  assert.equal(genericPlanAsk('what can i do here', 'plan'), true);
  // A named, uncovered town must not be answered with Pangasinan places.
  assert.equal(genericPlanAsk('plan a trip to Baguio', 'plan'), false);
  assert.equal(genericPlanAsk('beaches near me', 'nearby'), false);
});

test('small talk gets a friendly line instead of the no-match line', () => {
  assert.match(smallTalkReply('hi'), /LakbAI/);
  assert.match(smallTalkReply('thank you!'), /welcome/i);
  assert.equal(smallTalkReply('hi, where can I eat in Dagupan'), null, 'a real request is not small talk');
  assert.equal(smallTalkReply('beaches'), null);
});

test('the dataset-only chat path answers small talk too (AI-quota fallback)', async () => {
  // When the model quota is out the route serves localChat; a greeting must not
  // become the no-match line just because the AI is unavailable.
  const out = await localChat('hi', '120.341,16.043');
  assert.match(out.answer, /LakbAI/);
  assert.equal(out.candidates.length, 0);
});

test('a duplicate restaurant under a parenthetical town suffix collapses to one row', () => {
  // pangasinan-150.json carries "MATUTINA-GERRY's Seafood House" and
  // "MATUTINA-GERRY's Seafood House (Dagupan)" in the same town, neither with a
  // coordinate, so the 50 m proximity merge could not see them.
  const out = withDataset([
    { name: "MATUTINA-GERRY's Seafood House", municipality_or_city: 'Dagupan City', total_review_count: 300 },
    { name: "MATUTINA-GERRY's Seafood House (Dagupan)", municipality_or_city: 'Dagupan City', total_review_count: 41 },
  ], () => allEntries());
  assert.equal(out.length, 1);
  assert.equal(out[0].reviews, '300', 'the fatter row survives');
});

test('the same base name in two different towns is still two rows', () => {
  // Branches in different towns are separate places and must stay separate.
  const out = withDataset([
    { name: "Matutina - Gerry's Seafood House (Dagupan)", municipality_or_city: 'Dagupan City' },
    { name: "Matutina - Gerry's Seafood House (Urdaneta)", municipality_or_city: 'Urdaneta City' },
  ], () => allEntries());
  assert.equal(out.length, 2);
});

test('a shared host name does not swallow the business inside it', () => {
  // Base names are compared lowercased: a naive strip-uppercase left
  // "SM City Rosales" (no coordinate, like the real mall row) and
  // "KFC - SM City Rosales" identical and deleted the restaurant.
  const out = withDataset([
    { name: 'SM City Rosales', municipality_or_city: 'Rosales' },
    { name: 'KFC - SM City Rosales', municipality_or_city: 'Rosales', lat: 15.8781997, lng: 120.6025975 },
  ], () => allEntries());
  assert.equal(out.length, 2);
});

test('an unmatched question says so instead of inventing a place', async () => {
  const out = await localChat('how do I file my taxes', '120.341,16.043');
  assert.equal(out.candidates.length, 0);
  assert.equal(out.answer, NO_MATCH);
});

test('the AI reference is exactly the provided files, not the curated map spots', () => {
  const names = allEntries().map(e => e.name);
  assert.ok(names.includes("Conrad's Dagupan"), 'the provided file is used');
  assert.ok(!names.some(n => /Hundred Islands|Patar Beach|Bolinao Falls/i.test(n)), 'curated spots stay out of the reference');
});

test('a beach request is not answered with the town restaurants', () => {
  const dagupan = search('best beaches in Dagupan', '120.341,16.043');
  assert.ok(dagupan.length > 0);
  assert.ok(dagupan.every(e => e.intents.includes('beach')), 'only beaches come back');
  assert.ok(!dagupan.some(e => e.name === "Conrad's Dagupan"), 'the restaurant is not a beach');
  // the file has no beach in Manaoag, so the honest answer is nothing
  assert.equal(search('beaches in Manaoag', '120.341,16.043').length, 0);
});

test('singular "beach" and plural "beaches" return the same places', () => {
  const singular = search('beach in Dagupan', '120.341,16.043');
  const plural = search('beaches in Dagupan', '120.341,16.043');
  assert.deepEqual(singular.map(e => e.name), plural.map(e => e.name));
  assert.ok(singular.some(e => e.name === 'Tondaligan Beach Park'));
  assert.ok(!singular.some(e => e.name === "Conrad's Dagupan"));
});

test('a bare "beaches" request returns beach entries, not restaurants', () => {
  const out = search('beaches', '120.341,16.043');
  assert.ok(out.length > 0);
  assert.ok(out.every(e => e.intents.includes('beach')));
});

test('the 150-spot file shape is understood (location prose, fee paragraph, comment reviews)', () => {
  const entry = normalize({
    id: 'pangasinan-001',
    name: 'Hundred Islands National Park (Governor\'s, Quezon, Marcos)',
    municipality_or_city: 'Alaminos City',
    region: 'Western Pangasinan',
    category: 'Island & Marine Park',
    location: 'Off the coast of Barangay Lucap, Alaminos City, 2404 Pangasinan (Pilgrimage Island Plus Code: 626R+5F4; Phone: +63 75 433 7532)',
    has_fee: true,
    fee_in_venue: 'Environmental Fee: PHP 40.00/person (Day Tour) or PHP 80.00/person (Overnight).',
    description: 'The first national park in the Philippines.',
    what_to_do: ['Go island hopping', 'Snorkel over giant clam sanctuaries'],
    rating: 4.6,
    total_review_count: 515,
    reviews: [{ comment: 'Islands are not far away from each other.', reviewer_or_source: 'Artur P' }],
    images: ['https://ak-d.tripcdn.com/images/100v1f000001h1anu6965.jpg'],
    verified_sources: [{ title: 'Alaminos City Official Hundred Islands Rates PDF', url: 'https://www.alaminoscity.gov.ph/i-choose-hundred-islands/download/HundredIslandsNationalPark-RatesFees.pdf' }],
  }, 0, 'tourist_spots');
  assert.equal(entry.name, 'Hundred Islands National Park (Governor\'s, Quezon, Marcos)');
  assert.equal(entry.town, 'Alaminos City');
  assert.equal(entry.rating, '4.6');
  assert.equal(entry.reviews, '515');
  assert.match(entry.price, /PHP 40\.00/);
  assert.deepEqual(entry.activities, ['Go island hopping', 'Snorkel over giant clam sanctuaries']);
  assert.equal(entry.photos.length, 0);
  assert.equal(entry.sourceUrls.length, 1);
  assert.equal(entry.quotes[0], 'Islands are not far away from each other.');
  assert.equal(entry.phone, '+63 75 433 7532');
});

test('a named town narrows the results to that town', () => {
  const out = search('places in Manaoag', '120.341,16.043');
  assert.ok(out.length > 0);
  assert.ok(out.every(e => e.town === 'Manaoag'));
});

test('admin restaurant photos reach dataset entries immediately', () => {
  const before = allEntries().find(e => e.id === 'conrads');
  assert.deepEqual(before.photos, []);
  setPhotos('conrads', ['https://example.com/conrad.jpg', 'https://example.com/conrad-2.jpg']);
  const after = allEntries().find(e => e.id === 'conrads');
  assert.deepEqual(after.photos, ['https://example.com/conrad.jpg', 'https://example.com/conrad-2.jpg']);
  // clearing brings the dataset back to its own (empty) list
  setPhotos('conrads', []);
  assert.deepEqual(allEntries().find(e => e.id === 'conrads').photos, []);
});

test('visitor reviews keep the quote, who said it and when — both file shapes', () => {
  // The 5-town file: { comment, reviewer_or_source } with the date glued to the
  // comment. The 150-spot file: { text, author, date }.
  const entry = normalize({
    name: "Matutina - Gerry's Seafood House",
    municipality_or_city: 'Urdaneta City',
    reviews: [
      { reviewer_or_source: 'Google Maps Verified Reviewer #1', comment: 'Bangus sisig is a must try. (2024-07-22)' },
      { author: 'Artur P', date: '2026-01-03', text: 'Fresh seafood and fast service.' },
      'Lovely place by the highway.',
    ],
  }, 0, 'restaurants');

  assert.deepEqual(entry.visitorReviews[0], { text: 'Bangus sisig is a must try.', source: 'Google Maps', date: '2024-07-22' });
  assert.deepEqual(entry.visitorReviews[1], { text: 'Fresh seafood and fast service.', source: 'Artur P', date: '2026-01-03' });
  assert.deepEqual(entry.visitorReviews[2], { text: 'Lovely place by the highway.', source: '', date: '' });
});

test('a curated review keeps its own score, and a place without reviews gets an empty list', () => {
  const conrads = allEntries().find(e => e.id === 'conrads');
  assert.deepEqual(conrads.visitorReviews, [
    { text: 'Pancit Bagnet and Beef Kare-Kare were excellent.', source: '', date: '', rating: 5 },
  ]);
  const plain = normalize({ name: 'Some Stall', municipality_or_city: 'Dagupan City' }, 0, 'restaurants');
  assert.deepEqual(plain.visitorReviews, []);
});

test('metadata notes are not dressed up as visitor reviews', () => {
  const entry = normalize({
    name: 'Kuya J Restaurant - SM City Urdaneta Central',
    municipality_or_city: 'Urdaneta City',
    reviews: [
      { reviewer_or_source: 'Google Maps Verified Reviewer #1', comment: 'Crispy pata is the reason to come.' },
      { reviewer_or_source: 'Google Maps Price & Fee Verification', comment: 'Menu Price Range: ₱400–₱900.' },
      { reviewer_or_source: 'Google Maps Rating & Volume Summary', comment: 'Verified rating of 4.4/5.' },
      { reviewer_or_source: 'Google Maps Hours & Operations Note', comment: 'Open 10am-9pm.' },
    ],
  }, 0, 'restaurants');
  assert.deepEqual(entry.visitorReviews.map(r => r.text), ['Crispy pata is the reason to come.']);
  assert.equal(entry.visitorReviews[0].source, 'Google Maps');
});

test('visitor reviews are capped so one place cannot bloat every payload', () => {
  const entry = normalize({
    name: 'Busy Place',
    municipality_or_city: 'Dagupan City',
    reviews: Array.from({ length: 30 }, (_, i) => ({ comment: 'review ' + i, author: 'Guest ' + i })),
  }, 0, 'restaurants');
  assert.equal(entry.visitorReviews.length, 10);
});

test('recommendations carry the visitor reviews through to the app', async () => {
  const out = await localRecommend('where to eat in Dagupan', '120.341,16.043');
  const conrads = (out.places || []).find(p => p.name === "Conrad's Dagupan");
  assert.ok(conrads, 'the fixture restaurant should be recommended');
  assert.deepEqual(conrads.visitorReviews, [
    { text: 'Pancit Bagnet and Beef Kare-Kare were excellent.', source: '', date: '', rating: 5 },
  ]);
});

/** Async twin of withDataset: keep the temp file alive until the read settles. */
async function withDatasetAsync(rows, fn){
  const file = path.join(os.tmpdir(), 'lakbai-dataset-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(file, JSON.stringify({ places: rows }), 'utf8');
  const before = process.env.LAKBAI_DATA;
  process.env.LAKBAI_DATA = file;
  try { return await fn(); }
  finally {
    process.env.LAKBAI_DATA = before;
    try { fs.unlinkSync(file); } catch { /* already gone */ }
  }
}

test('a coordinate outside Pangasinan is dropped, never used as a pin', () => {
  // pangasinan-150.json really carries this row: an Urdaneta park at 15.00 —
  // 108 km south, which showed up as a pin in the middle of nowhere.
  const bad = normalize({
    name: 'Urdaneta Park Landmark Monument',
    municipality_or_city: 'Urdaneta City',
    lat: 15.003965624999998, lng: 120.5761875,
  }, 0, 'tourist_spots');
  assert.equal(bad.lat, null);
  assert.equal(bad.lng, null, 'a province-locked app must not hold a coordinate it cannot vouch for');

  const good = normalize({ name: 'Patar Beach', municipality_or_city: 'Bolinao', lat: 16.32, lng: 119.79 }, 1);
  assert.equal(good.lat, 16.32);
});

test('a missing coordinate is only filled from a Mapbox hit that names the place', async () => {
  const realFetch = globalThis.fetch;
  const beforeToken = process.env.VITE_MAPBOX_TOKEN;
  process.env.VITE_MAPBOX_TOKEN = 'pk.test';
  const hits = [];
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ features: hits }) });
  // A house address that matched the search text must not become a pin.
  hits.push({ geometry: { coordinates: [120.5, 15.9] }, properties: { mapbox_id: 'm1', name: 'Some Random House' } });
  try {
    const [no] = await withCoords([normalize({ id: 'geocode-house-1', name: 'Camp Puor', municipality: 'Aguilar' }, 0)]);
    assert.equal(no.lat, null);
    assert.equal(no.lng, null);

    hits.length = 0;
    hits.push({ geometry: { coordinates: [120.5, 15.9] }, properties: { mapbox_id: 'm2', name: 'Camp Puor' } });
    const [yes] = await withCoords([normalize({ id: 'geocode-match-1', name: 'Camp Puor', municipality: 'Aguilar' }, 0)]);
    assert.equal(yes.lat, 15.9, 'a POI that carries the name is a real fix');
    assert.equal(yes.lng, 120.5);
  } finally {
    globalThis.fetch = realFetch;
    if (beforeToken === undefined) delete process.env.VITE_MAPBOX_TOKEN;
    else process.env.VITE_MAPBOX_TOKEN = beforeToken;
  }
});

test('scraped image URLs are not place photos', () => {
  // The scrape attached one page-hero image to every place on a page, and some
  // entries carry ads or brochure scans. None of those are photos of the place,
  // so the dataset no longer forwards them: photos come from the reviewed map,
  // the admin app and the Wikimedia name lookup.
  const shared = 'https://seepangasinan.com/wp-content/uploads/2021/03/Clave.jpg';
  const out = withDataset([
    { name: "Governor's Island", municipality_or_city: 'Alaminos City', lat: 16.21, lng: 120.04, photos: [shared] },
    { name: 'Bolinao Falls 1 (Cachoeira de Bolinao)', municipality_or_city: 'Bolinao', lat: 16.30, lng: 119.90, images: [shared] },
    { name: 'Patar Beach', municipality_or_city: 'Bolinao', lat: 16.32, lng: 119.79, verified_image_urls: ['https://example.com/patar.jpg'] },
  ], () => allEntries());
  assert.deepEqual(out.map(e => e.photos), [[], [], []]);
});

test('the admin photo map still supplies a real photo', () => {
  // The dataset itself carries no scraped images any more, so the admin overlay
  // is the one hand-curated photo source that reaches a card unchanged.
  const WIKI = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Beach.jpg/960px-Beach.jpg';
  setPhotos('conrads', [WIKI]);
  try {
    const entry = allEntries().find(e => e.id === 'conrads');
    assert.deepEqual(entry.photos, [WIKI]);
  } finally {
    setPhotos('conrads', []);
  }
});
