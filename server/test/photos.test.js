const { test } = require('node:test');
const assert = require('node:assert/strict');
const { relevant, pickPhoto, findPhoto } = require('../photos.js');
test('relevant matches place words, rejects random files', () => {
  assert.equal(relevant('File:Patar Beach, Bolinao.jpg', 'Patar Beach', 'Bolinao'), true);
  assert.equal(relevant('File:Lucap, Alaminos, Pangasinan - panoramio (1).jpg', 'Hundred Islands', 'Alaminos'), false);
});
test('pickPhoto skips thumbless and irrelevant pages', () => {
  const data = { query: { pages: {
    1: { title: 'File:Random road.jpg', thumbnail: { source: 'http://x/1.jpg' } },
    2: { title: 'File:Patar Beach aerial.jpg' },
    3: { title: 'File:Patar Beach shoreline.jpg', thumbnail: { source: 'http://x/3.jpg' } }
  } } };
  const out = pickPhoto(data, 'Patar Beach', 'Bolinao');
  assert.equal(out.src, 'http://x/3.jpg');
  assert.ok(out.page.includes('Patar'));
});
test('findPhoto returns null when nothing relevant', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ query: { pages: {
    9: { title: 'File:Somewhere else.jpg', thumbnail: { source: 'http://x/9.jpg' } }
  } } }) });
  const out = await findPhoto('Hundred Islands', 'Alaminos', 119.95, 16.21, { fetch: fake });
  assert.equal(out, null);
});
test('findPhoto prefers nearby relevant over name search', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(String(url));
    if (String(url).includes('geosearch')) {
      return { ok: true, json: async () => ({ query: { pages: {
        7: { title: 'File:Patar Beach, Bolinao.jpg', thumbnail: { source: 'http://x/geo.jpg' } }
      } } }) };
    }
    throw new Error('name search must not run');
  };
  const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
  assert.equal(out.src, 'http://x/geo.jpg');
  assert.equal(calls.length, 1);
});
