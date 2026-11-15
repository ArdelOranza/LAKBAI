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
