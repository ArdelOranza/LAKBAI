const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseProximity, nearestTown, locationLine } = require('../location.js');

test('parseProximity accepts lng,lat and rejects junk', () => {
  assert.deepEqual(parseProximity('120.3333,16.0433'), { lng: 120.3333, lat: 16.0433 });
  assert.equal(parseProximity(''), null);
  assert.equal(parseProximity('abc,16'), null);
  assert.equal(parseProximity(null), null);
});

test('nearestTown resolves the Dagupan city centre to Dagupan', () => {
  assert.match(nearestTown(120.3333, 16.0433), /Dagupan/);
});

test('nearestTown stays null far outside the province', () => {
  assert.equal(nearestTown(121.0, 14.6), null);
});

test('locationLine is empty when there is no usable fix', async () => {
  assert.equal(await locationLine(''), '');
  assert.equal(await locationLine(null), '');
});
