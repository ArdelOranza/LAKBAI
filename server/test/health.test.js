const { test } = require('node:test');
const assert = require('node:assert/strict');
test('default center matches spec', () => {
  const { DEFAULT_CENTER } = require('../places.js');
  assert.deepEqual(DEFAULT_CENTER, [120.23, 16.03]);
});
