// The admin review endpoints, exercised through the real Express app.
//
// No database: globalThis.fetch is replaced with a tiny PostgREST/Storage stand-in
// backed by one mutable row, so the test drives the same calls the routes make.
// The point of these cases is the wiring — token guard, what reaches /api/spots,
// and the 400/404/409 answers — not the PostgREST plumbing (communityPlaces.test.js
// covers that directly).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.LAKBAI_DATA = path.join(__dirname, 'fixtures', 'restaurants.json');
process.env.LAKBAI_ADMIN_FILE = path.join(os.tmpdir(), 'lakbai-submissions-spots-' + process.pid + '.json');
process.env.ADMIN_TOKEN = 'test-admin-token';
process.env.SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';

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

let status = 'pending';
let photo = null;
let reviewNote = null;

function reset(){ status = 'pending'; photo = null; reviewNote = null; }

const replied = (body, ok = true, code = 200) => ({ ok, status: code, json: async () => body, text: async () => JSON.stringify(body) });

// The app under test talks to Supabase through globalThis.fetch; the test's own
// HTTP calls need the real one, so keep a handle before replacing it.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : null;
  if (u.includes('/auth/v1/admin/users/')) return replied({ email: 'traveler@example.com' });
  if (u.includes('/object/sign/')) return replied({ signedURL: '/object/sign/place-submissions/user-1/photo.jpg?token=abc' });
  if (u.includes('/object/copy')) return replied({ Key: 'place-photos/user-1/photo.jpg' });
  if (u.includes('/rest/v1/place_submissions')) {
    if (method === 'PATCH'){
      if (body.status) status = body.status;
      if (body.photo) photo = body.photo;
      if (body.review_note) reviewNote = body.review_note;
      return replied([{ ...ROW, status, photo, review_note: reviewNote }]);
    }
    const live = { ...ROW, status, photo, review_note: reviewNote };
    if (u.includes('status=eq.approved')) return replied(status === 'approved' ? [live] : []);
    if (u.includes('status=eq.pending')) return replied(status === 'pending' ? [live] : []);
    if (u.includes('id=eq.')) return replied(u.includes('id=eq.' + ROW.id) ? [live] : []);
  }
  return replied({ message: 'no route for ' + method + ' ' + u }, false, 404);
};

const community = require('../communityPlaces.js');
const app = require('../index.js');
const AUTH = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };

async function withServer(fn){
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  try { await fn(`http://localhost:${server.address().port}`); }
  finally { server.close(); }
}

const json = r => r.json();

test('the submission queue and its reviews are behind the admin token', async () => {
  await withServer(async base => {
    assert.equal((await realFetch(base + '/api/admin/submissions')).status, 401);
    assert.equal((await realFetch(base + '/api/admin/submissions', { method: 'POST', headers: AUTH })).status, 404);
    assert.equal((await realFetch(base + `/api/admin/submissions/${ROW.id}/approve`, { method: 'POST' })).status, 401);
    assert.equal((await realFetch(base + `/api/admin/submissions/${ROW.id}/reject`, { method: 'POST', body: JSON.stringify({ note: 'nope' }) })).status, 401);
    assert.equal((await realFetch(base + `/api/admin/submissions/${ROW.id}/photo`)).status, 401);
  });
});

test('a pending submission is queued with its submitter, and is not on the map yet', async () => {
  reset();
  community.invalidate();
  await withServer(async base => {
    const { submissions } = await json(await realFetch(base + '/api/admin/submissions', { headers: AUTH }));
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].status, 'pending');
    assert.equal(submissions[0].email, 'traveler@example.com');

    const { spots } = await json(await realFetch(base + '/api/spots'));
    assert.equal(spots.some(s => String(s.id).startsWith('community-')), false, 'pending must never reach the map');
  });
});

test('approving publishes the pin to /api/spots without a redeploy', async () => {
  reset();
  community.invalidate();
  await withServer(async base => {
    const approved = await json(await realFetch(base + `/api/admin/submissions/${ROW.id}/approve`, { method: 'POST', headers: AUTH }));
    assert.equal(approved.submission.status, 'approved');

    const { spots } = await json(await realFetch(base + '/api/spots'));
    const mine = spots.find(s => s.id === 'community-' + ROW.id);
    assert.ok(mine, 'the approved place must appear on the next fetch');
    assert.equal(mine.name, 'Tondol Sunset Grill');
    assert.equal(mine.photoSource, 'community');
    assert.equal(mine.photo, 'https://db.example/storage/v1/object/public/place-photos/user-1/photo.jpg');

    const { submissions } = await json(await realFetch(base + '/api/admin/submissions', { headers: AUTH }));
    assert.equal(submissions.length, 0, 'an approved row leaves the pending queue');
  });
});

test('approving a row that was already reviewed is a conflict, not a second publish', async () => {
  reset();
  await withServer(async base => {
    assert.equal((await realFetch(base + `/api/admin/submissions/${ROW.id}/approve`, { method: 'POST', headers: AUTH })).status, 200);
    assert.equal((await realFetch(base + `/api/admin/submissions/${ROW.id}/approve`, { method: 'POST', headers: AUTH })).status, 409);
  });
});

test('reject needs a reason, and stores the one the submitter will read', async () => {
  reset();
  community.invalidate();
  await withServer(async base => {
    const bare = await realFetch(base + `/api/admin/submissions/${ROW.id}/reject`, {
      method: 'POST', headers: AUTH, body: JSON.stringify({}),
    });
    assert.equal(bare.status, 400);
    assert.match((await json(bare)).error, /reason/i);

    const rejected = await json(await realFetch(base + `/api/admin/submissions/${ROW.id}/reject`, {
      method: 'POST', headers: AUTH, body: JSON.stringify({ note: 'Already on the map as Tondol Grill' }),
    }));
    assert.equal(rejected.submission.status, 'rejected');
    assert.equal(rejected.submission.review_note, 'Already on the map as Tondol Grill');

    const { spots } = await json(await realFetch(base + '/api/spots'));
    assert.equal(spots.some(s => s.id === 'community-' + ROW.id), false, 'a rejected place is never published');
  });
});

test('an unknown submission is a clean 404', async () => {
  await withServer(async base => {
    const res = await realFetch(base + '/api/admin/submissions/does-not-exist/approve', { method: 'POST', headers: AUTH });
    assert.equal(res.status, 404);
  });
});

test('a pending photo is handed over as a short-lived link, never a public URL', async () => {
  reset();
  await withServer(async base => {
    const { url } = await json(await realFetch(base + `/api/admin/submissions/${ROW.id}/photo`, { headers: AUTH }));
    assert.match(url, /token=abc/);
    assert.equal(url.includes('/public/'), false);
  });
});
