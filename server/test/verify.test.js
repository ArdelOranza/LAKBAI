const { test } = require('node:test');
const assert = require('node:assert/strict');
test('empty candidates returns zero places', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'discover', answer: 'No matches found.', candidates: [], spotlight: null, sources: [] });
  const out = await recommend('xyz?', null, { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(out.intent, 'discover');
  assert.deepEqual(out.places, []);
});
test('one failing lookup does not nuke the answer', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Bad', reason: 'x' }, { name: 'Good', reason: 'y' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async (name) => {
    if (name.startsWith('Bad')) throw new Error('Mapbox 502');
    return [{ id: 'g1', name: 'Good', lng: 120.0, lat: 16.0, address: '', categories: [] }];
  };
  const out = await recommend('food?', null, { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places.length, 1);
  assert.equal(out.places[0].name, 'Good');
});
test('sourceKind marks map fallback honestly', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Patar Beach', reason: 'nice' }], spotlight: null, sources: [] });
  const fakeSearch = async () => [{ id: 'p1', name: 'Patar Beach', lng: 119.79, lat: 16.12, address: '', categories: [] }];
  const out = await recommend('food?', null, { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places[0].sourceKind, 'map');
  const fakeChat2 = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Patar Beach', reason: 'nice' }], spotlight: null, sources: ['https://s.com'] });
  const out2 = await recommend('food?', null, { chatFn: fakeChat2, searchFn: fakeSearch });
  assert.equal(out2.places[0].sourceKind, 'article');
});
test('duplicate hits are deduped', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Cafe', reason: 'x' }, { name: 'Cafe', reason: 'y' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async () => [{ id: 'c1', name: 'Cafe', lng: 120.58, lat: 11.97, address: '', categories: [] }];
  const out = await recommend('food?', null, { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places.length, 1);
});
