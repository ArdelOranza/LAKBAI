const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp file so tests never touch the real admin-spots.json
const tmpFile = path.join(os.tmpdir(), 'lakbai-admin-spots-' + process.pid + '.json');
process.env.LAKBAI_ADMIN_FILE = tmpFile;
try { fs.unlinkSync(tmpFile); } catch { /* fresh */ }
const spotPhotosFile = path.join(os.tmpdir(), 'lakbai-admin-spot-photos-' + process.pid + '.json');
process.env.LAKBAI_SPOT_PHOTOS_FILE = spotPhotosFile;
try { fs.unlinkSync(spotPhotosFile); } catch { /* fresh */ }

const { listSpots, getSpot, createSpot, updateSpot, deleteSpot, validateSpot, requireAdmin } = require('../adminSpots.js');

function resetFile(doc){
  fs.writeFileSync(tmpFile, JSON.stringify(doc || { patches: {}, added: [], deleted: [] }, null, 2));
}

test('curated base ships when admin file is empty', () => {
  resetFile({ patches: {}, added: [], deleted: [] });
  const spots = listSpots();
  assert.ok(spots.length >= 65, 'base count');
  assert.ok(spots.every(s => s.name && s.town));
});

test('updateSpot patches a base spot, incl. photos, and persists', () => {
  resetFile({ patches: {}, added: [], deleted: [] });
  const base = listSpots()[0];
  const updated = updateSpot(base.id, { name: base.name + ' — edited', photos: ['https://example.com/a.jpg'], blurb: 'new blurb' });
  assert.equal(updated.name, base.name + ' — edited');
  assert.deepEqual(updated.photos, ['https://example.com/a.jpg']);
  assert.equal(updated.blurb, 'new blurb');
  // persisted: fresh read sees the patch
  assert.equal(getSpot(base.id).name, base.name + ' — edited');
});

test('createSpot adds a new site and invalid coords are rejected', () => {
  resetFile({ patches: {}, added: [], deleted: [] });
  const created = createSpot({ name: 'Test Falls', town: 'Bolinao', district: '1', lng: 119.84, lat: 16.25, categories: ['Nature'], photos: ['https://example.com/f.jpg'] });
  assert.ok(created.id.startsWith('custom-'));
  assert.equal(getSpot(created.id).name, 'Test Falls');
  assert.ok(listSpots().some(s => s.id === created.id));
  // outside bbox must throw 400
  assert.throws(() => createSpot({ name: 'Boracay', town: 'Aklan', lng: 121.9, lat: 11.9 }), /outside|bbox|Pangasinan/i);
  // bad photo URL must throw
  assert.throws(() => updateSpot(created.id, { photos: ['javascript:alert(1)'] }), /http/i);
});

test('deleteSpot hides a base spot and validateSpot rejects empty names', () => {
  resetFile({ patches: {}, added: [], deleted: [] });
  const base = listSpots()[0];
  deleteSpot(base.id);
  assert.equal(getSpot(base.id), null);
  assert.ok(!listSpots().some(s => s.id === base.id));
  assert.throws(() => validateSpot({ name: '  ', town: '' }), /name|town/i);
  assert.throws(() => updateSpot('missing-id', { name: 'x' }), /not found|Not found/i);
});

test('wikimedia photos fill empty spots, admin photos still win', () => {
  resetFile({ patches: {}, added: [], deleted: [] });
  const id = 'patar-beach-bolinao';
  fs.writeFileSync(spotPhotosFile, JSON.stringify({ photos: {
    [id]: { src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/w/patar.jpg', page: 'https://commons.wikimedia.org/wiki/File:Patar_Beach.jpg' },
  } }));
  const filled = listSpots().find(s => s.id === id);
  assert.deepEqual(filled.photos, ['https://upload.wikimedia.org/wikipedia/commons/thumb/w/patar.jpg']);
  assert.equal(filled.photoSource, 'wikimedia');
  assert.equal(filled.photoPage, 'https://commons.wikimedia.org/wiki/File:Patar_Beach.jpg');
  // a curated/admin photo must win over the Wikimedia mapping
  updateSpot(id, { photos: ['https://example.com/admin.jpg'] });
  const admin = listSpots().find(s => s.id === id);
  assert.deepEqual(admin.photos, ['https://example.com/admin.jpg']);
  assert.equal(admin.photoSource, 'json');
  // a spot with no mapping keeps the map fallback
  const bare = listSpots().find(s => s.id !== id && !(s.photos || []).length);
  assert.ok(bare, 'an unmapped empty spot exists');
  assert.equal(bare.photoSource, 'mapbox');
});

test('requireAdmin guards by x-admin-token', () => {
  const prev = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'secret-admin-token';
  const mk = hdr => ({
    headers: hdr || {},
    setStatus: (c) => { calls.code = c; return { json: (o) => { calls.body = o; } }; },
    status: (c) => { calls.code = c; return { json: (o) => { calls.body = o; } }; },
    json: (o) => { calls.body = o; },
  });
  let calls, next;
  // good token passes through
  calls = {}; let passed = false;
  requireAdmin(mk({ 'x-admin-token': 'secret-admin-token' }), mk({ 'x-admin-token': 'secret-admin-token' }), () => { passed = true; });
  assert.equal(passed, true);
  // bad token 401
  calls = {}; passed = false;
  const req2 = { headers: { 'x-admin-token': 'wrong' } };
  const res2 = { status(c){ calls.code = c; this.statusCode = c; return this; }, json(o){ calls.body = o; } };
  requireAdmin(req2, res2, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(calls.code, 401);
  if (prev === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = prev;
});
