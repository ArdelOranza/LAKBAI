const { test } = require('node:test');
const assert = require('node:assert/strict');
test('redirect intent returns zero places', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'redirect', answer: 'Try Pangasinan instead!', candidates: [{ name: 'Boracay' }], spotlight: null, sources: [] });
  const out = await recommend('Boracay?', null, { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(out.intent, 'redirect');
  assert.deepEqual(out.places, []);
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
