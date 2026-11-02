const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAttraction, attractionLine } = require('../attractions.js');

test('a hospital is not an attraction', () => {
  assert.equal(isAttraction({ name: 'Pangasinan Provincial Hospital', categories: ['health services', 'hospital', 'services'] }), false);
  assert.equal(isAttraction({ name: 'San Carlos City Health Center', categories: [] }), false);
  assert.equal(isAttraction({ name: 'Mercury Drug', categories: ['pharmacy'] }), false);
});

test('a hospital is still valid for an emergency lookup', () => {
  assert.equal(isAttraction({ name: 'Pangasinan Provincial Hospital', categories: ['hospital'] }, 'emergency'), true);
});

test('attractions with no Mapbox categories survive', () => {
  assert.equal(isAttraction({ name: 'Tondaligan Beach Park', categories: [] }), true);
  assert.equal(isAttraction({ name: 'Dagupan City Museum', categories: ['museum', 'tourist attraction'] }), true);
  assert.equal(isAttraction({ name: 'The Minor Basilica of Our Lady of the Rosary of Manaoag', categories: ['place of worship'] }), true);
});

test('restaurants, stays and events survive', () => {
  assert.equal(isAttraction({ name: 'Les Boissons', categories: ['food', 'restaurant'] }), true);
  assert.equal(isAttraction({ name: 'Lucky Swiss Transient House', categories: ['lodging'] }), true);
  assert.equal(isAttraction({ name: 'Bangus Festival', categories: [] }), true);
});

test('services a traveler would not visit are dropped', () => {
  for (const name of ['City Hall', 'Dagupan City Police Station', 'Land Bank', 'Bolinao National High School', 'Regional Trial Court', 'Petron Gas Station']) {
    assert.equal(isAttraction({ name, categories: [] }), false, name);
  }
});

test('the AI is told to keep candidates visitable, except for emergencies', () => {
  assert.match(attractionLine('top attractions near me'), /Never hospitals/);
  assert.equal(attractionLine('I need a hospital now'), '');
  assert.equal(attractionLine(''), '');
});
