const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CENTER } = require('../places.js');
test('default center is Philippines-wide', () => {
  assert.deepEqual(DEFAULT_CENTER, [121.77, 12.88]);
});
