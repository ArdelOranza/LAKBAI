// Admin data must outlive the container. Render's free web service has no
// persistent disk, so production stores these documents in Supabase; the JSON
// file stays the backend for local dev and tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createJsonStore } = require('../jsonStore.js');
const { createPhotoCache } = require('../photoCache.js');

function tempFile(name){
  const file = path.join(os.tmpdir(), 'lakbai-store-' + process.pid + '-' + name + '.json');
  try { fs.unlinkSync(file); } catch { /* fresh */ }
  return file;
}

function fakeSupabase(rows = [], { failLoad = false, failSave = false } = {}){
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    calls.push({ url: String(url), method, headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : null });
    if (method === 'GET'){
      if (failLoad) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => rows };
    }
    if (failSave) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 201, json: async () => null };
  };
  return { calls, fetchImpl };
}

const ENV = { LAKBAI_STORE: 'supabase', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_KEY: 'service-key' };

test('without LAKBAI_STORE the file backend is used, even with Supabase keys present', async () => {
  const file = tempFile('file');
  const store = createJsonStore({
    name: 'admin-spots',
    file,
    defaults: { added: [] },
    env: { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_KEY: 'service-key' },
    fetchImpl: async () => { throw new Error('must not call Supabase'); },
  });
  assert.equal(store.backend, 'file');
  await store.write({ added: [{ id: 'a' }] });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { added: [{ id: 'a' }] });
  assert.deepEqual(store.read(), { added: [{ id: 'a' }] });
});

test('the Supabase backend hydrates the row and upserts on save', async () => {
  const { calls, fetchImpl } = fakeSupabase([{ doc: { patches: { p1: { name: 'Patched' } }, added: [], deleted: [] } }]);
  const store = createJsonStore({
    name: 'admin-spots',
    file: tempFile('supa'),
    defaults: () => ({ patches: {}, added: [], deleted: [] }),
    env: ENV,
    fetchImpl,
  });
  assert.equal(store.backend, 'supabase');
  await store.ready();
  assert.equal(store.read().patches.p1.name, 'Patched');

  await store.write({ patches: { p1: { name: 'Saved' } }, added: [], deleted: [] });
  const get = calls.find(c => c.method === 'GET');
  assert.match(get.url, /\/rest\/v1\/admin_documents\?name=eq\.admin-spots/);
  assert.equal(get.headers.apikey, 'service-key');
  assert.equal(get.headers.Authorization, 'Bearer service-key');

  const save = calls.find(c => c.method === 'POST');
  assert.match(save.url, /on_conflict=name/);
  assert.equal(save.body.name, 'admin-spots');
  assert.equal(save.body.doc.patches.p1.name, 'Saved');
});

test('a failed hydration refuses to save instead of overwriting the remote with defaults', async () => {
  const { calls, fetchImpl } = fakeSupabase([], { failLoad: true });
  const store = createJsonStore({
    name: 'admin-spots',
    file: tempFile('fail'),
    defaults: () => ({ patches: {}, added: [], deleted: [] }),
    env: ENV,
    fetchImpl,
  });
  await assert.rejects(() => store.ready(), /migration 0006|HTTP 500/i);
  await assert.rejects(() => store.write({ patches: {}, added: [{ id: 'x' }], deleted: [] }), /migration 0006|HTTP 500/i);
  assert.equal(calls.some(c => c.method === 'POST'), false, 'no write may land after a failed read');
});

test('an empty table reads as the defaults, not an error', async () => {
  const { fetchImpl } = fakeSupabase([]);
  const store = createJsonStore({
    name: 'admin-photos',
    file: tempFile('empty'),
    defaults: () => ({ places: {} }),
    env: ENV,
    fetchImpl,
  });
  await store.ready();
  assert.deepEqual(store.read(), { places: {} });
});

test('concurrent saves are sent in order', async () => {
  const order = [];
  const fetchImpl = async (url, opts = {}) => {
    if ((opts.method || 'GET') === 'GET') return { ok: true, json: async () => [] };
    const doc = JSON.parse(opts.body).doc;
    // Resolve the first save slower than the second: without a queue the
    // second would land first and the older document would win.
    await new Promise(r => setTimeout(r, doc.n === 1 ? 20 : 1));
    order.push(doc.n);
    return { ok: true };
  };
  const store = createJsonStore({ name: 'photo-cache', file: tempFile('order'), defaults: {}, env: ENV, fetchImpl });
  await Promise.all([store.write({ n: 1 }), store.write({ n: 2 })]);
  assert.deepEqual(order, [1, 2]);
});

test('the photo cache hydrates from and saves to Supabase', async () => {
  const key = 'patar beach|bolinao';
  const rows = [{ doc: { version: 1, photos: { [key]: { value: { src: 'https://x/p.jpg', page: '', title: '' }, at: Date.now() } } } }];
  const { calls, fetchImpl } = fakeSupabase(rows);
  const cache = createPhotoCache({ file: tempFile('cache'), env: ENV, fetchImpl, now: () => Date.now() });
  assert.equal(cache.backend, 'supabase');
  await cache.ready();
  assert.equal(cache.get(key).value.src, 'https://x/p.jpg');
  cache.set('other|town', null);
  await new Promise(r => setTimeout(r, 0));
  const save = calls.find(c => c.method === 'POST');
  assert.ok(save, 'a cache write is persisted');
  assert.ok(save.body.doc.photos['other|town']);
});
