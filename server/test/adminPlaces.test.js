const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.LAKBAI_DATA = path.join(__dirname, 'fixtures', 'restaurants.json');
const overlayFile = path.join(os.tmpdir(), 'lakbai-admin-places-' + process.pid + '.json');
process.env.LAKBAI_ADMIN_PHOTOS_FILE = overlayFile;
try { fs.unlinkSync(overlayFile); } catch { /* fresh */ }
process.env.ADMIN_TOKEN = 'test-admin-token';

const app = require('../index.js');
const AUTH = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };

async function withServer(fn){
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  try { await fn(`http://localhost:${server.address().port}`); }
  finally { server.close(); }
}

test('restaurant photo endpoints are token-guarded, validated and persisted', async () => {
  await withServer(async base => {
    assert.equal((await fetch(base + '/api/admin/places')).status, 401);

    const list = await fetch(base + '/api/admin/places', { headers: AUTH });
    assert.equal(list.status, 200);
    const { places } = await list.json();
    assert.equal(places.length, 1);
    assert.equal(places[0].id, 'ChIJtest1');
    assert.deepEqual(places[0].photos, []);
    assert.ok(!('lng' in places[0]) || typeof places[0].lng === 'number', 'read-only row shape');

    const bad = await fetch(base + '/api/admin/places/ChIJtest1/photos', {
      method: 'PUT', headers: AUTH, body: JSON.stringify({ photos: ['javascript:alert(1)'] }),
    });
    assert.equal(bad.status, 400);

    const ok = await fetch(base + '/api/admin/places/ChIJtest1/photos', {
      method: 'PUT', headers: AUTH,
      body: JSON.stringify({ photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] }),
    });
    assert.equal(ok.status, 200);
    const saved = await ok.json();
    assert.deepEqual(saved.place.photos, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);

    const again = await (await fetch(base + '/api/admin/places', { headers: AUTH })).json();
    assert.deepEqual(again.places[0].photos, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);

    const missing = await fetch(base + '/api/admin/places/nope/photos', {
      method: 'PUT', headers: AUTH, body: JSON.stringify({ photos: [] }),
    });
    assert.equal(missing.status, 404);
  });
});
