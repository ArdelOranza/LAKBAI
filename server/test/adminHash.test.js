const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireAdmin } = require('../adminSpots.js');

function mkRes(){
  const r = { code: null, body: null, status(c){ r.code = c; return r; }, json(o){ r.body = o; return r; } };
  return r;
}

function withEnv(vars, fn){
  const prev = {};
  for (const k of Object.keys(vars)){ prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  return Promise.resolve().then(fn).finally(() => {
    for (const k of Object.keys(prev)){ if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; }
  });
}

test('requireAdmin compares hashed, not plain — tampered token gets 401', async () => {
  await withEnv({ ADMIN_TOKEN: 'super-secret-admin-123', ADMIN_TOKEN_HASH: undefined }, async () => {
    // good token passes
    let res = mkRes(), nx = false;
    await requireAdmin({ headers: { 'x-admin-token': 'super-secret-admin-123' } }, res, () => { nx = true; });
    assert.equal(nx, true, 'good token should pass');
    // wrong token 401
    res = mkRes(); nx = false;
    await requireAdmin({ headers: { 'x-admin-token': 'wrong' } }, res, () => { nx = true; });
    assert.equal(nx, false);
    assert.equal(res.code, 401);
  });
});

test('a token longer than 256 bytes is refused before any hashing', async () => {
  await withEnv({ ADMIN_TOKEN: 'short-admin', ADMIN_TOKEN_HASH: undefined }, async () => {
    const res = mkRes();
    let nx = false;
    await requireAdmin({ headers: { 'x-admin-token': 'x'.repeat(257) } }, res, () => { nx = true; });
    assert.equal(nx, false);
    assert.equal(res.code, 401);
  });
});

test('a malformed ADMIN_TOKEN_HASH disables admin (503) instead of throwing', async () => {
  // A typo in the deployed hash must not turn every admin request into a stack.
  for (const bad of ['scrypt$nothex$also-not-hex', 'scrypt$ab', 'scrypt$$', 'scrypt$abcd$zzzz']){
    await withEnv({ ADMIN_TOKEN: undefined, ADMIN_TOKEN_HASH: bad }, async () => {
      const res = mkRes();
      let nx = false;
      await requireAdmin({ headers: { 'x-admin-token': 'anything' } }, res, () => { nx = true; });
      assert.equal(nx, false, bad + ' must not authenticate');
      assert.equal(res.code, 503, bad + ' should report admin disabled');
    });
  }
});

test('a well-formed ADMIN_TOKEN_HASH still authenticates', async () => {
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync('precomputed-secret', salt, 64);
  const pre = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
  await withEnv({ ADMIN_TOKEN: undefined, ADMIN_TOKEN_HASH: pre }, async () => {
    let res = mkRes(), nx = false;
    await requireAdmin({ headers: { 'x-admin-token': 'precomputed-secret' } }, res, () => { nx = true; });
    assert.equal(nx, true);
    res = mkRes(); nx = false;
    await requireAdmin({ headers: { 'x-admin-token': 'precomputed-secret2' } }, res, () => { nx = true; });
    assert.equal(nx, false);
    assert.equal(res.code, 401);
  });
});
