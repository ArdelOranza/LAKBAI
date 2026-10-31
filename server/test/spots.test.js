const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SPOTS } = require('../spots.js');
test('curated spots: the official 6-district list, deduped, labels set', () => {
  assert.ok(SPOTS.length >= 65, 'the full official list ships (>= 65 entries)');
  const ids = new Set(SPOTS.map(s => s.id));
  assert.equal(ids.size, SPOTS.length, 'unique ids');
  for (const s of SPOTS){
    assert.ok(s.name && s.town, s.name + ' labeled');
    assert.ok(['1','2','3','4','5','6'].includes(String(s.district)), s.name + ' district in 1..6');
    assert.ok(Array.isArray(s.categories), s.name + ' categories array exists');
    assert.ok(Array.isArray(s.photos), s.name + ' photos array exists (empty until added by hand)');
  }
});
test('pinned spots (with coords) stay inside the locked Pangasinan bbox; >= 80% resolved', () => {
  const pinned = SPOTS.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat));
  assert.ok(pinned.length >= Math.floor(SPOTS.length * 0.8), '80% geocoded');
  for (const s of pinned){
    assert.ok(s.lng >= 119.7 && s.lng <= 120.7 && s.lat >= 15.7 && s.lat <= 16.5, s.name + ' in bbox');
  }
});
