// Reviewed place submissions: a traveller's pending row is invisible until an
// admin approves it, and an approved one must survive a redeploy — so the row
// lives in Supabase and the API reads it, never a file on the container.
//
// No network here: the store takes an injected fetch, so the tests drive the
// exact PostgREST and Storage calls the server will make.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toSpot, createStore } = require('../communityPlaces.js');

const CONFIG = { url: 'https://db.example', key: 'service-key' };

const ROW = {
  id: '11111111-2222-3333-4444-555555555555',
  user_id: 'user-1',
  status: 'pending',
  name: 'Tondol Sunset Grill',
  town: 'Anda',
  barangay: 'Tondol',
  categories: ['restaurant'],
  lng: 120.1,
  lat: 16.3,
  note: 'Grilled fish by the shore',
  hours: '4pm-10pm',
  price: '₱150-300',
  photo_path: 'user-1/photo.jpg',
  photo: null,
  review_note: null,
  reviewed_at: null,
  created_at: '2026-11-15T02:00:00.000Z',
};

/** Records every call and answers by URL fragment. */
function fakeFetch(routes){
  const calls = [];
  const f = async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    calls.push({ url: u, method, body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers || {} });
    for (const [needle, answer] of Object.entries(routes)){
      if (u.includes(needle) && (!answer.method || answer.method === method)){
        const body = typeof answer.body === 'function' ? answer.body({ url: u, method, opts }) : answer.body;
        return { ok: answer.ok !== false, status: answer.status || 200, json: async () => body, text: async () => JSON.stringify(body) };
      }
    }
    return { ok: false, status: 404, json: async () => ({ message: 'no route for ' + method + ' ' + u }), text: async () => '' };
  };
  f.calls = calls;
  return f;
}

const pendingRow = () => ({ ...ROW });

test('toSpot maps a stored row onto the spot shape the map already renders', () => {
  const spot = toSpot({ ...ROW, status: 'approved' });
  assert.equal(spot.id, 'community-11111111-2222-3333-4444-555555555555');
  assert.equal(spot.name, 'Tondol Sunset Grill');
  assert.equal(spot.town, 'Anda');
  assert.deepEqual(spot.categories, ['restaurant']);
  assert.equal(spot.lng, 120.1);
  assert.equal(spot.lat, 16.3);
  assert.equal(spot.photoSource, 'community');
  assert.equal(spot.community, true);
});

test('toSpot carries a published photo and stays photo-less when there is none', () => {
  const withPhoto = toSpot({ ...ROW, status: 'approved', photo: 'https://db.example/public/x.jpg' });
  assert.deepEqual(withPhoto.photos, ['https://db.example/public/x.jpg']);
  assert.equal(withPhoto.photo, 'https://db.example/public/x.jpg');

  const without = toSpot({ ...ROW, status: 'approved', photo: null });
  assert.deepEqual(without.photos, []);
  assert.equal(without.photo, null);
});

test('approvedSpots returns nothing instead of throwing when Supabase is not configured', async () => {
  const store = createStore({ config: null, fetch: () => { throw new Error('must not call the network'); } });
  assert.deepEqual(await store.approvedSpots(), []);
});

test('approvedSpots asks only for approved rows', async () => {
  const fetch = fakeFetch({ 'place_submissions': { body: [{ ...ROW, status: 'approved' }] } });
  const store = createStore({ config: CONFIG, fetch });
  const spots = await store.approvedSpots();
  assert.equal(spots.length, 1);
  assert.equal(spots[0].id, 'community-' + ROW.id);
  const call = fetch.calls[0];
  assert.equal(call.method, 'GET');
  assert.match(call.url, /status=eq\.approved/);
});

test('approvedSpots caches, and approving drops the cache so the pin shows up', async () => {
  const fetch = fakeFetch({
    'place_submissions?id=eq.': { method: 'GET', body: [pendingRow()] },
    'place_submissions': { body: [{ ...ROW, status: 'approved' }] },
  });
  const store = createStore({ config: CONFIG, fetch });
  await store.approvedSpots();
  const afterFirst = fetch.calls.length;
  await store.approvedSpots();
  assert.equal(fetch.calls.length, afterFirst, 'second read should come from cache');

  fetch.calls.length = 0;
  await store.approve(ROW.id);
  await store.approvedSpots();
  assert.ok(fetch.calls.some(c => c.url.includes('status=eq.approved')), 'cache should be stale after an approval');
});

test('approve flips a pending row and guards against a double review', async () => {
  const fetch = fakeFetch({
    'place_submissions?id=eq.': { method: 'GET', body: [pendingRow()] },
    'place_submissions': { method: 'PATCH', body: [{ ...ROW, status: 'approved' }] },
  });
  const store = createStore({ config: CONFIG, fetch });
  const row = await store.approve(ROW.id);
  assert.equal(row.status, 'approved');
  const patch = fetch.calls.find(c => c.method === 'PATCH');
  assert.ok(patch, 'must PATCH the row');
  assert.match(patch.url, /status=eq\.pending/, 'the guard must be part of the WHERE, not just the body');
  assert.equal(patch.body.status, 'approved');
});

test('approve refuses a row that is not pending', async () => {
  const fetch = fakeFetch({ 'place_submissions?id=eq.': { body: [{ ...ROW, status: 'approved' }] } });
  const store = createStore({ config: CONFIG, fetch });
  await assert.rejects(() => store.approve(ROW.id), e => e.status === 409);
  assert.equal(fetch.calls.some(c => c.method === 'PATCH'), false, 'must not write');
});

test('approve reports an unknown submission as 404', async () => {
  const fetch = fakeFetch({ 'place_submissions?id=eq.': { body: [] } });
  const store = createStore({ config: CONFIG, fetch });
  await assert.rejects(() => store.approve('nope'), e => e.status === 404);
});

test('approve promotes the private photo into the public bucket', async () => {
  const fetch = fakeFetch({
    'place_submissions?id=eq.': { method: 'GET', body: [pendingRow()] },
    'place_submissions': { method: 'PATCH', body: [{ ...ROW, status: 'approved' }] },
    '/object/copy': { method: 'POST', body: { Key: 'place-photos/user-1/photo.jpg' } },
  });
  const store = createStore({ config: CONFIG, fetch });
  await store.approve(ROW.id);
  const copy = fetch.calls.find(c => c.url.includes('/object/copy'));
  assert.ok(copy, 'the object must be copied, not just referenced');
  assert.equal(copy.body.bucketId, 'place-submissions');
  assert.equal(copy.body.sourceKey, 'user-1/photo.jpg');
  assert.equal(copy.body.destinationBucket, 'place-photos');
  assert.equal(copy.body.destinationKey, 'user-1/photo.jpg');
});

test('reject demands a real reason before it writes anything', async () => {
  const fetch = fakeFetch({ 'place_submissions?id=eq.': { body: [pendingRow()] } });
  const store = createStore({ config: CONFIG, fetch });
  await assert.rejects(() => store.reject(ROW.id), e => e.status === 400);
  await assert.rejects(() => store.reject(ROW.id, '  no '), e => e.status === 400);
  assert.equal(fetch.calls.some(c => c.method === 'PATCH'), false);
});

test('reject stores the reason and removes the private photo', async () => {
  const fetch = fakeFetch({
    'place_submissions?id=eq.': { method: 'GET', body: [pendingRow()] },
    'place_submissions': { method: 'PATCH', body: [{ ...ROW, status: 'rejected' }] },
    'place-submissions/user-1/photo.jpg': { method: 'DELETE', body: {} },
  });
  const store = createStore({ config: CONFIG, fetch });
  await store.reject(ROW.id, 'Duplicate of an approved place');
  const patch = fetch.calls.find(c => c.method === 'PATCH');
  assert.equal(patch.body.status, 'rejected');
  assert.equal(patch.body.review_note, 'Duplicate of an approved place');
  assert.match(patch.url, /status=eq\.pending/);
  const del = fetch.calls.find(c => c.method === 'DELETE');
  assert.ok(del, 'a rejected photo must not linger in the private bucket');
  assert.match(del.url, /object\/place-submissions\/user-1\/photo\.jpg/);
});

test('the queue lists pending rows with the submitter, and never the approved ones', async () => {
  const fetch = fakeFetch({
    'place_submissions': { method: 'GET', body: [pendingRow()] },
    'admin/users/user-1': { body: { email: 'traveler@example.com' } },
  });
  const store = createStore({ config: CONFIG, fetch });
  const queue = await store.listQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].email, 'traveler@example.com');
  assert.equal(queue[0].status, 'pending');
  const read = fetch.calls.find(c => c.method === 'GET' && c.url.includes('place_submissions'));
  assert.match(read.url, /status=eq\.pending/);
});

test('the queue still shows the row when the submitter email cannot be read', async () => {
  const fetch = fakeFetch({ 'place_submissions': { method: 'GET', body: [pendingRow()] } });
  const store = createStore({ config: CONFIG, fetch });
  const queue = await store.listQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].email, null);
});

test('photoUrl signs a short-lived link instead of exposing the pending object', async () => {
  const fetch = fakeFetch({
    'place_submissions?id=eq.': { method: 'GET', body: [pendingRow()] },
    '/object/sign/place-submissions/user-1/photo.jpg': { method: 'POST', body: { signedURL: '/object/sign/place-submissions/user-1/photo.jpg?token=abc' } },
  });
  const store = createStore({ config: CONFIG, fetch });
  const url = await store.photoUrl(ROW.id);
  assert.equal(url, 'https://db.example/storage/v1/object/sign/place-submissions/user-1/photo.jpg?token=abc');
  const sign = fetch.calls.find(c => c.url.includes('/object/sign/'));
  assert.equal(sign.body.expiresIn, 60);
  assert.ok(!url.includes('/public/'), 'a pending photo must never be public');
});

test('photoUrl is 404 for a submission without a photo', async () => {
  const fetch = fakeFetch({ 'place_submissions?id=eq.': { body: [{ ...ROW, photo_path: null }] } });
  const store = createStore({ config: CONFIG, fetch });
  await assert.rejects(() => store.photoUrl(ROW.id), e => e.status === 404);
});

test('approve never promotes a photo that lives in another user folder', async () => {
  // The row is inserted by the traveller, so photo_path is attacker-controlled.
  // A service-role copy of someone else's private object would publish it.
  const foreign = { ...pendingRow(), photo_path: 'user-2/photo.jpg' };
  const fetch = fakeFetch({
    'place_submissions?id=eq.': { method: 'GET', body: [foreign] },
    'place_submissions': { method: 'PATCH', body: [{ ...foreign, status: 'approved' }] },
    '/object/copy': { method: 'POST', body: { Key: 'place-photos/user-2/photo.jpg' } },
  });
  const store = createStore({ config: CONFIG, fetch });
  const row = await store.approve(ROW.id);
  assert.equal(fetch.calls.some(c => c.url.includes('/object/copy')), false, 'must not copy a foreign object');
  assert.equal(row.photo, null);
});

test('reject never deletes a photo that lives in another user folder', async () => {
  const foreign = { ...pendingRow(), photo_path: 'user-2/photo.jpg' };
  const fetch = fakeFetch({
    'place_submissions?id=eq.': { method: 'GET', body: [foreign] },
    'place_submissions': { method: 'PATCH', body: [{ ...foreign, status: 'rejected' }] },
    'place-submissions/user-2/photo.jpg': { method: 'DELETE', body: {} },
  });
  const store = createStore({ config: CONFIG, fetch });
  await store.reject(ROW.id, 'Not a real place');
  assert.equal(fetch.calls.some(c => c.method === 'DELETE'), false, 'must not delete a foreign object');
});

test('photoUrl refuses a foreign or traversing path instead of signing it', async () => {
  for (const photo_path of ['user-2/photo.jpg', '../secret.jpg', '/etc/passwd', 'user-1/../../secret.jpg']){
    const fetch = fakeFetch({
      'place_submissions?id=eq.': { method: 'GET', body: [{ ...ROW, photo_path }] },
      '/object/sign/': { method: 'POST', body: { signedURL: '/x?token=abc' } },
    });
    const store = createStore({ config: CONFIG, fetch });
    await assert.rejects(() => store.photoUrl(ROW.id), e => e.status === 404, photo_path + ' must be refused');
    assert.equal(fetch.calls.some(c => c.url.includes('/object/sign/')), false);
  }
});
