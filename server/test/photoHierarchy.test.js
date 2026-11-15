const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existingPhoto } = require('../photoHierarchy.js');

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Beach.jpg/960px-Beach.jpg';
const JSON_PHOTO = 'https://example.com/curated.jpg';

test('a multi-photo list keeps every photo instead of collapsing to one', () => {
  const out = existingPhoto({ photos: [WIKI, JSON_PHOTO] });
  assert.deepEqual(out.photos, [WIKI, JSON_PHOTO]);
  assert.equal(out.photo, WIKI);
  assert.equal(out.photoSource, 'wikimedia');
});

test('a curated photo wins and keeps the list order', () => {
  const out = existingPhoto({ photos: [JSON_PHOTO, WIKI] });
  assert.deepEqual(out.photos, [JSON_PHOTO, WIKI]);
  assert.equal(out.photoSource, 'json');
});

test('a bare photo field counts as an existing photo', () => {
  const out = existingPhoto({ photo: WIKI });
  assert.deepEqual(out.photos, [WIKI]);
  assert.equal(out.photoSource, 'wikimedia');
});

test('no photo at all returns null so the caller can look one up', () => {
  assert.equal(existingPhoto({}), null);
  assert.equal(existingPhoto({ photos: [], photo: null }), null);
  assert.equal(existingPhoto(null), null);
});

test('a scraped document scan is not a place photo', () => {
  // Abagatanen Beach showed a Scribd page of text with a title and paragraphs.
  const url = 'https://imgv2-1-f.scribdassets.com/img/document/437457918/original/242600f5c1/1?v=1';
  assert.equal(existingPhoto({ name: 'Abagatanen White Sand Beach', photo: url }), null);
});

test('a hotel ad collage does not stand in for a beach', () => {
  // Lingayen Beach showed "Capitol Resort Hotel" with a swimming-pool inset.
  const url = 'https://ilovepangasinan.com/wp-content/uploads/2019/01/Capitol-Resort-Hotel-cover.jpg';
  assert.equal(existingPhoto({ name: 'Lingayen Beach & Lingayen Baywalk', photo: url }), null);
});

test('a lodging listing photo is not a beach', () => {
  const url = 'https://images.trvl-media.com/lodging/37000000/36140000/x.jpg';
  assert.equal(existingPhoto({ name: 'Agno Umbrella Rocks (Sabangan Beach)', photo: url }), null);
});

test('a resort keeps its own listing photo', () => {
  const url = 'https://pix10.agoda.net/hotelImages/2090124/0/x.jpeg';
  const out = existingPhoto({ name: 'El Puerto Marina Beach Resort', photo: url });
  assert.equal(out.photo, url);
});

test('an untrusted photo is dropped from a list without losing a good one', () => {
  const junk = 'https://imgv2-1-f.scribdassets.com/img/document/1/x/1';
  const out = existingPhoto({ name: 'Patar Beach', photos: [junk, JSON_PHOTO] });
  assert.deepEqual(out.photos, [JSON_PHOTO]);
  assert.equal(out.photo, JSON_PHOTO);
});
