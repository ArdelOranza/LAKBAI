const { test } = require('node:test');
const assert = require('node:assert/strict');
test('bbox constant matches locked scope', () => {
  const { PANGASINAN_BBOX, DEFAULT_CENTER } = require('../places.js');
  assert.equal(PANGASINAN_BBOX, '119.7,15.7,120.7,16.5');
  assert.deepEqual(DEFAULT_CENTER, [120.23, 16.03]);
});
