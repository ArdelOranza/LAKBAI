const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpFile = path.join(os.tmpdir(), 'lakbai-admin-photos-' + process.pid + '.json');
process.env.LAKBAI_ADMIN_PHOTOS_FILE = tmpFile;
try { fs.unlinkSync(tmpFile); } catch { /* fresh */ }

const { photosFor, setPhotos, allPhotos } = require('../adminPhotos.js');

test('setPhotos persists real photos per restaurant id', () => {
  setPhotos('ChIJabc', ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  assert.deepEqual(photosFor('ChIJabc'), ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  assert.deepEqual(allPhotos()['ChIJabc'].photos, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  // a fresh read (no in-memory state) still sees them
  assert.deepEqual(photosFor('ChIJabc').length, 2);
  assert.deepEqual(photosFor('unknown'), []);
});

test('an empty list clears the entry instead of storing an empty overlay', () => {
  setPhotos('ChIJabc', []);
  assert.deepEqual(photosFor('ChIJabc'), []);
  assert.equal(allPhotos()['ChIJabc'], undefined);
});

test('rejects non-http URLs, non-arrays and caps the list at 20', () => {
  assert.throws(() => setPhotos('ChIJabc', ['javascript:alert(1)']), /http/i);
  assert.throws(() => setPhotos('ChIJabc', 'https://example.com/a.jpg'), /array/i);
  const many = Array.from({ length: 25 }, (_, i) => `https://example.com/${i}.jpg`);
  assert.equal(setPhotos('ChIJabc', many).photos.length, 20);
});

test('a corrupt or missing store reads as empty', () => {
  try { fs.unlinkSync(tmpFile); } catch { /* gone */ }
  assert.deepEqual(allPhotos(), {});
  fs.writeFileSync(tmpFile, '{ nope');
  assert.deepEqual(photosFor('ChIJabc'), []);
});
