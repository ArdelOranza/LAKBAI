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
test('google image search wins when CSE is configured', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(String(url));
    if (String(url).includes('customsearch')) {
      return { ok: true, json: async () => ({ items: [{ link: 'http://g/patar.jpg', image: { contextLink: 'http://g/page' } }] }) };
    }
    throw new Error('wikimedia must not run');
  };
  const hadCx = process.env.GOOGLE_CSE_ID;
  const hadKey = process.env.GEMINI_API_KEY;
  process.env.GOOGLE_CSE_ID = 'test-cx';
  process.env.GEMINI_API_KEY = 'test-key';
  const { findPhoto } = require('../photos.js');
  try {
    const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
    assert.equal(out.src, 'http://g/patar.jpg');
    assert.equal(calls.length, 1);
  } finally {
    if (hadCx === undefined) delete process.env.GOOGLE_CSE_ID; else process.env.GOOGLE_CSE_ID = hadCx;
    if (hadKey === undefined) delete process.env.GEMINI_API_KEY;
  }
});
test('findPhoto prefers name match over nearby', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(String(url));
    if (String(url).includes('generator=search')) {
      return { ok: true, json: async () => ({ query: { pages: {
        7: { title: 'File:Patar Beach, Bolinao.jpg', thumbnail: { source: 'http://x/name.jpg' } }
      } } }) };
    }
    throw new Error('geosearch must not run');
  };
  const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
  assert.equal(out.src, 'http://x/name.jpg');
  assert.equal(calls.length, 1);
});
test('findPhoto falls back to nearby when name misses', async () => {
  const fake = async (url) => {
    if (String(url).includes('generator=search')) {
      return { ok: true, json: async () => ({ query: { pages: {
        8: { title: 'File:Unrelated road.jpg', thumbnail: { source: 'http://x/no.jpg' } }
      } } }) };
    }
    return { ok: true, json: async () => ({ query: { pages: {
      9: { title: 'File:Patar Beach shoreline.jpg', thumbnail: { source: 'http://x/geo.jpg' } }
    } } }) };
  };
  const out = await findPhoto('Patar Beach', 'Bolinao', 119.79, 16.12, { fetch: fake });
  assert.equal(out.src, 'http://x/geo.jpg');
});
