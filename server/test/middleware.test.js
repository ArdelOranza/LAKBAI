// The public API surface: who may call it cross-origin and how often.
//
// These run against the real Express app. No model/network call is made: the
// CORS checks stop at the middleware, and the admin limiter is exercised with
// unauthenticated requests, which answer 401 without touching a data store.
const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_TOKEN = 'middleware-test-token';
process.env.ADMIN_TOKEN_HASH = '';

const app = require('../index.js');

async function withServer(fn){
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  try { await fn(`http://localhost:${server.address().port}`); }
  finally { server.close(); }
}

test('a deployed app origin is allowed and gets the CORS header', async () => {
  await withServer(async base => {
    const res = await fetch(base + '/api/health', { headers: { Origin: 'https://lakbai-app.onrender.com' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://lakbai-app.onrender.com');
  });
});

test('the local dev origin is allowed', async () => {
  await withServer(async base => {
    for (const origin of ['http://localhost:5199', 'http://localhost:5173', 'http://127.0.0.1:5199', 'capacitor://localhost']){
      const res = await fetch(base + '/api/health', { headers: { Origin: origin } });
      assert.equal(res.status, 200, origin + ' should be allowed');
      assert.equal(res.headers.get('access-control-allow-origin'), origin);
    }
  });
});

test('an unknown origin is refused with 403, not a wide-open header', async () => {
  await withServer(async base => {
    const res = await fetch(base + '/api/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

test('a request without an Origin (native app, curl, same-origin) still works', async () => {
  await withServer(async base => {
    const res = await fetch(base + '/api/health');
    assert.equal(res.status, 200);
  });
});

test('the admin surface is rate-limited per IP', async () => {
  await withServer(async base => {
    // 60 per 15 minutes for admin routes. All unauthenticated, so each answer
    // is a cheap 401 until the limit trips.
    let last = 0;
    for (let i = 0; i < 61; i++){
      const res = await fetch(base + '/api/admin/spots');
      last = res.status;
      if (i < 60) assert.equal(res.status, 401, 'request ' + (i + 1) + ' should reach auth');
    }
    assert.equal(last, 429, 'the 61st request should be limited');
  });
});
