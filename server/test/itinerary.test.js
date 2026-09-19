const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildItinerary } = require('../itinerary.js');
test('4 hours fits 2 stops starting 09:00', () => {
  const places = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const out = buildItinerary(places, 4, 9);
  assert.equal(out.schedule.length, 2);
  assert.equal(out.schedule[0].arrive, '09:00');
  assert.equal(out.schedule[0].depart, '10:30');
  assert.equal(out.schedule[1].arrive, '11:00');
});
