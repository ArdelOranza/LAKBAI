const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Never read the committed photo map: tests own a temp file.
const tmpFile = path.join(os.tmpdir(), 'lakbai-spot-photos-' + process.pid + '.json');
process.env.LAKBAI_SPOT_PHOTOS_FILE = tmpFile;
try { fs.unlinkSync(tmpFile); } catch { /* fresh */ }

const { photoFor } = require('../spotPhotos.js');

test('photoFor returns the committed Wikimedia entry for an id', () => {
  fs.writeFileSync(tmpFile, JSON.stringify({
    photos: {
      'patar-beach-bolinao': {
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/p/patar.jpg',
        page: 'https://commons.wikimedia.org/wiki/File:Patar_Beach.jpg',
      },
    },
  }));
  assert.deepEqual(photoFor('patar-beach-bolinao'), {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/p/patar.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Patar_Beach.jpg',
  });
  assert.equal(photoFor('unknown-spot'), null);
});

test('photoFor survives a missing or corrupt file', () => {
  try { fs.unlinkSync(tmpFile); } catch { /* already gone */ }
  assert.equal(photoFor('patar-beach-bolinao'), null);
  fs.writeFileSync(tmpFile, '{ not json');
  assert.equal(photoFor('patar-beach-bolinao'), null);
});

test('photoFor ignores entries without an http(s) src', () => {
  fs.writeFileSync(tmpFile, JSON.stringify({
    photos: {
      bad: { src: 'javascript:alert(1)' },
      nosrc: { page: 'https://commons.wikimedia.org/wiki/File:X.jpg' },
    },
  }));
  assert.equal(photoFor('bad'), null);
  assert.equal(photoFor('nosrc'), null);
});
