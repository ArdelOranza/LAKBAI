const { test } = require('node:test');
const assert = require('node:assert/strict');
test('redirect intent returns zero places', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'redirect', answer: 'Try Pangasinan instead!', candidates: [{ name: 'Boracay' }], spotlight: null, sources: [] });
  const out = await recommend('Boracay?', null, { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(out.intent, 'redirect');
  assert.deepEqual(out.places, []);
});
test('empty agent sources fall back to map link', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Patar Beach', reason: 'nice' }], spotlight: null, sources: [] });
  const fakeSearch = async () => [{ id: 'p1', name: 'Patar Beach', lng: 119.79, lat: 16.12, address: '', categories: [] }];
  const out = await recommend('food?', null, { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places.length, 1);
  assert.ok(out.places[0].sources[0].includes('google.com/maps/search'));
});
test('out-of-box candidates are dropped', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Boracay', reason: 'x' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async (name) => name === 'Boracay'
    ? [{ id: 'b1', name: 'Boracay', lng: 120.58, lat: 11.97, address: '', categories: [] }]
    : [];
  const out = await recommend('food?', null, { chatFn: fakeChat, searchFn: fakeSearch });
  assert.deepEqual(out.places, []);
});
