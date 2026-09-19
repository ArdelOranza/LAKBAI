const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inBox } = require('../places.js');
test('inBox accepts Alaminos, rejects Boracay', () => {
  assert.equal(inBox(119.98, 16.15), true);
  assert.equal(inBox(120.58, 11.97), false);
});
