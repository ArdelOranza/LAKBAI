const { test } = require('node:test');
const assert = require('node:assert/strict');
test('redirect intent returns zero places', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'redirect', answer: 'Try Pangasinan instead!', candidates: [{ name: 'Boracay' }], spotlight: null, sources: [] });
  const out = await recommend('Boracay?', null, [], { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(out.intent, 'redirect');
  assert.deepEqual(out.places, []);
});
test('one failing lookup does not nuke the answer', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Bad', reason: 'x' }, { name: 'Good', reason: 'y' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async (name) => {
    if (name.startsWith('Bad')) throw new Error('Mapbox 502');
    return [{ id: 'g1', name: 'Good', lng: 120.0, lat: 16.0, address: '', categories: [] }];
  };
  const out = await recommend('food?', null, [], { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places.length, 1);
  assert.equal(out.places[0].name, 'Good');
});
test('sourceKind marks map fallback honestly', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Patar Beach', reason: 'nice' }], spotlight: null, sources: [] });
  const fakeSearch = async () => [{ id: 'p1', name: 'Patar Beach', lng: 119.79, lat: 16.12, address: '', categories: [] }];
  const out = await recommend('food?', null, [], { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places.length, 1);
  assert.equal(out.places[0].sourceKind, 'map');
  assert.ok(out.places[0].sources[0].includes('google.com/maps/search'));
  const fakeChat2 = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Patar Beach', reason: 'nice' }], spotlight: null, sources: ['https://s.com'] });
  const out2 = await recommend('food?', null, [], { chatFn: fakeChat2, searchFn: fakeSearch });
  assert.equal(out2.places[0].sourceKind, 'article');
});
test('out-of-box candidates are dropped', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Boracay', reason: 'x' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async () => [{ id: 'b1', name: 'Boracay', lng: 120.58, lat: 11.97, address: '', categories: [] }];
  const out = await recommend('food?', null, [], { chatFn: fakeChat, searchFn: fakeSearch });
  assert.deepEqual(out.places, []);
});
test('ratings and visitor voice pass through when grounded', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Cafe', reason: 'x', rating: '4.6', reviews: '1.2k', peopleSay: 'best halo-halo' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async () => [{ id: 'c1', name: 'Cafe', lng: 120.0, lat: 16.0, address: '', categories: [] }];
  const out = await recommend('food?', null, [], { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places[0].rating, '4.6');
  assert.equal(out.places[0].peopleSay, 'best halo-halo');
});
test('duplicate hits are deduped', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Cafe', reason: 'x' }, { name: 'Cafe', reason: 'y' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async () => [{ id: 'c1', name: 'Cafe', lng: 120.0, lat: 16.0, address: '', categories: [] }];
  const out = await recommend('food?', null, [], { chatFn: fakeChat, searchFn: fakeSearch });
  assert.equal(out.places.length, 1);
});
test('the traveler location is appended to the AI request', async () => {
  const { recommend } = require('../verify.js');
  let seen = '';
  const fakeChat = async (msg) => { seen = msg; return { intent: 'discover', answer: 'a', candidates: [], spotlight: null, sources: [] }; };
  await recommend('top spots', '120.333,16.043', ['Beaches'], {
    chatFn: fakeChat,
    searchFn: async () => [],
    locationLine: async () => '\nThe traveler is currently in Dagupan City, Pangasinan.'
  });
  assert.match(seen, /Dagupan City/);
  assert.match(seen, /Beaches/);
});
test('places are ordered by distance from the traveler', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'discover', answer: 'a', candidates: [{ name: 'Far', reason: 'x' }, { name: 'Near', reason: 'y' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async (q) => q.startsWith('Far')
    ? [{ id: 'f1', name: 'Far', lng: 119.79, lat: 16.12, address: '', categories: [] }]
    : [{ id: 'n1', name: 'Near', lng: 120.34, lat: 16.04, address: '', categories: [] }];
  const out = await recommend('food?', '120.333,16.043', [], { chatFn: fakeChat, searchFn: fakeSearch, locationLine: async () => '' });
  assert.deepEqual(out.places.map(p => p.name), ['Near', 'Far']);
});
test('a hospital candidate is dropped from the results', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'discover', answer: 'a', candidates: [{ name: 'Pangasinan Provincial Hospital', reason: 'x' }, { name: 'Dagupan City Museum', reason: 'y' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async (q) => q.startsWith('Pangasinan Provincial')
    ? [{ id: 'h1', name: 'Pangasinan Provincial Hospital', lng: 120.34, lat: 15.93, address: '', categories: ['health services', 'hospital'] }]
    : [{ id: 'm1', name: 'Dagupan City Museum', lng: 120.34, lat: 16.04, address: '', categories: ['museum'] }];
  const out = await recommend('top attractions', '120.333,16.043', [], { chatFn: fakeChat, searchFn: fakeSearch, locationLine: async () => '' });
  assert.deepEqual(out.places.map(p => p.name), ['Dagupan City Museum']);
});
