// The Commons search API is rate limited. A lookup — hit or miss — has to be
// answered once and then read from disk, so restarts, repeat travellers and a
// map refresh never turn into HTTP 429s.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createPhotoCache } = require('../photoCache.js');
const { findPhoto, findCommonsPhoto } = require('../photos.js');

const DIR = path.join(os.tmpdir(), 'lakbai-photo-cache-' + process.pid);
fs.mkdirSync(DIR, { recursive: true });
function tempFile(name){
  const file = path.join(DIR, name + '-' + Math.random().toString(36).slice(2) + '.json');
  try { fs.unlinkSync(file); } catch { /* fresh */ }
  return file;
}
const fresh = file => createPhotoCache({ file });

const found = { query: { pages: { 1: {
  title: 'File:Patar Beach.jpg',
  thumbnail: { source: 'http://x/patar.jpg' },
  categories: [{ title: 'Category:Bolinao, Pangasinan' }],
} } } };
const empty = { query: { pages: {} } };

function counting(data){
  const calls = [];
  const fetch = async url => {
    calls.push(String(url));
    return { ok: true, json: async () => data };
  };
  return { calls, fetch };
}

test('a found photo is searched once, then served from the cache', async () => {
  const cache = fresh(tempFile('hit'));
  const { calls, fetch } = counting(found);
  const first = await findPhoto('Patar Beach', 'Bolinao', { fetch, cache });
  const second = await findPhoto('Patar Beach', 'Bolinao', { fetch, cache });
  assert.equal(first.src, 'http://x/patar.jpg');
  assert.equal(second.src, first.src);
  assert.equal(calls.length, 1, 'the second call must not touch Commons');
});

test('a miss is cached too, so an unphotographed place costs one request', async () => {
  const cache = fresh(tempFile('miss'));
  const { calls, fetch } = counting(empty);
  assert.equal(await findPhoto('Antong Falls', 'Sison', { fetch, cache }), null);
  assert.equal(await findPhoto('Antong Falls', 'Sison', { fetch, cache }), null);
  assert.equal(calls.length, 1);
});

test('the cache survives a restart', async () => {
  const file = tempFile('disk');
  const { fetch } = counting(found);
  await findPhoto('Patar Beach', 'Bolinao', { fetch, cache: createPhotoCache({ file }) });

  // A second process never calls the network: the fetch here fails the test.
  const offline = async () => { throw new Error('Commons must not be called'); };
  const afterRestart = await findPhoto('Patar Beach', 'Bolinao', { fetch: offline, cache: createPhotoCache({ file }) });
  assert.equal(afterRestart.src, 'http://x/patar.jpg');
});

test('a rate limit is not remembered as "no photo"', async () => {
  const cache = fresh(tempFile('429'));
  const limited = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(() => findCommonsPhoto('Patar Beach', 'Bolinao', { fetch: limited, cache }), /rate limited/);

  const { calls, fetch } = counting(found);
  const out = await findCommonsPhoto('Patar Beach', 'Bolinao', { fetch, cache });
  assert.equal(out.src, 'http://x/patar.jpg');
  assert.equal(calls.length, 1, 'the failed attempt must not have been cached');
});

test('the same name in a different town is a different lookup', async () => {
  const cache = fresh(tempFile('town'));
  const { calls, fetch } = counting(empty);
  await findPhoto('Public Plaza', 'Santa Barbara', { fetch, cache });
  await findPhoto('Public Plaza', 'Mangaldan', { fetch, cache });
  assert.equal(calls.length, 2);
});

test('an expired hit is searched again', async () => {
  let now = 1000;
  const file = tempFile('ttl');
  const cache = createPhotoCache({ file, hitTtl: 100, missTtl: 100, now: () => now });
  const { calls, fetch } = counting(found);
  await findPhoto('Patar Beach', 'Bolinao', { fetch, cache });
  now = 1050;
  await findPhoto('Patar Beach', 'Bolinao', { fetch, cache });
  assert.equal(calls.length, 1, 'inside the TTL the cache answers');
  now = 2000;
  await findPhoto('Patar Beach', 'Bolinao', { fetch, cache });
  assert.equal(calls.length, 2, 'after the TTL Commons is asked again');
});

test('a corrupt cache file is ignored instead of breaking photos', async () => {
  const file = tempFile('corrupt');
  fs.writeFileSync(file, '{not json', 'utf8');
  const cache = createPhotoCache({ file });
  const { calls, fetch } = counting(found);
  const out = await findPhoto('Patar Beach', 'Bolinao', { fetch, cache });
  assert.equal(out.src, 'http://x/patar.jpg');
  assert.equal(calls.length, 1);
});
