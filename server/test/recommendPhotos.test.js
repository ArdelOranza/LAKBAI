// /api/recommend is what fills the live map and the search cards. A place with
// no usable photo used to reach the app with only a Mapbox static-map fallback,
// even though Wikimedia Commons had a real photo of it. These cases drive the
// real Express app through the same Wikimedia lookup /api/places already uses.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DIR = path.join(os.tmpdir(), 'lakbai-recommend-photos-' + process.pid);
fs.mkdirSync(DIR, { recursive: true });
const DATA = path.join(DIR, 'places.json');
const PHOTOS = path.join(DIR, 'photos.json');
const ADMIN = path.join(DIR, 'admin-spots.json');
const PHOTO_CACHE = path.join(DIR, 'photo-cache.json');
try { fs.unlinkSync(PHOTOS); } catch { /* fresh */ }
try { fs.unlinkSync(PHOTO_CACHE); } catch { /* fresh */ }

fs.writeFileSync(DATA, JSON.stringify({
  places: [
    { name: 'Patar Beach', municipality: 'Bolinao', categories: ['beach'], lat: 16.32, lng: 119.79 },
    {
      name: 'Bolinao Falls 2', municipality: 'Bolinao', categories: ['falls'], lat: 16.30, lng: 119.80,
      photos: ['https://example.com/bolinao-falls-2.jpg'],
    },
  ],
}), 'utf8');

process.env.LAKBAI_DATA = DATA;
process.env.LAKBAI_ADMIN_PHOTOS_FILE = PHOTOS;
process.env.LAKBAI_ADMIN_FILE = ADMIN;
process.env.LAKBAI_PHOTO_CACHE_FILE = PHOTO_CACHE;
process.env.LAKBAI_AI = 'off';
process.env.VITE_MAPBOX_TOKEN = 'pk.test';

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Patar_white_beach.jpg/960px-Patar_white_beach.jpg';
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  calls.push(u);
  if (!u.includes('commons.wikimedia.org')) throw new Error('unexpected upstream: ' + u);
  return {
    ok: true, status: 200,
    json: async () => ({
      query: {
        pages: {
          1: {
            title: 'File:Patar white beach.jpg',
            thumbnail: { source: WIKI },
            categories: [{ title: 'Category:Beaches of Bolinao, Pangasinan' }],
          },
        },
      },
    }),
  };
};

const { setPhotos } = require('../adminPhotos.js');
const app = require('../index.js');

async function withServer(fn){
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  try { await fn(`http://localhost:${server.address().port}`); }
  finally { await new Promise(r => server.close(r)); }
}

async function recommend(base, message){
  const r = await realFetch(base + '/api/recommend', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, proximity: '119.79,16.32', prefs: [] }),
  });
  return r.json();
}

test('a place with no photo gets the Wikimedia one before it reaches the app', async () => {
  await withServer(async (base) => {
    const out = await recommend(base, 'Patar Beach');
    const place = (out.places || [])[0];
    assert.ok(place, 'Patar Beach should be recommended');
    assert.equal(place.name, 'Patar Beach');
    assert.equal(place.photoSource, 'wikimedia');
    assert.equal(place.photo, WIKI);
    assert.equal(place.photos.length, 1);
    assert.ok(calls.some(u => u.includes('commons.wikimedia.org')), 'Commons is the only image search');
  });
});

test('a place that already has a real photo is never re-searched', async () => {
  // A curated/admin photo is already a decision. Look it up again and the
  // Wikimedia result could replace a hand-checked picture with a worse one.
  const CURATED = 'https://example.com/bolinao-falls-2.jpg';
  setPhotos('places-bolinao-falls-2-bolinao-1', [CURATED]);
  try {
    await withServer(async (base) => {
      const before = calls.filter(u => u.includes('commons.wikimedia.org')).length;
      const out = await recommend(base, 'Bolinao Falls 2');
      const place = (out.places || [])[0];
      assert.ok(place);
      assert.equal(place.photo, CURATED);
      assert.equal(place.photoSource, 'json', 'a unique curated photo is not relabelled');
      assert.equal(calls.filter(u => u.includes('commons.wikimedia.org')).length, before, 'no lookup for a photographed place');
    });
  } finally {
    setPhotos('places-bolinao-falls-2-bolinao-1', []);
  }
});