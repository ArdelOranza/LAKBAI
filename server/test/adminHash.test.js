const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { requireAdmin } = require('../adminSpots.js');

function mkRes(){
  const r = { code: null, body: null, status(c){ r.code = c; return r; }, json(o){ r.body = o; return r; } };
  return r;
}

test('requireAdmin compares hashed, not plain — tampered token gets 401', () => {
  const prev = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'super-secret-admin-123';
  // good token passes
  let res = mkRes(), nx = false;
  requireAdmin({ headers: { 'x-admin-token': 'super-secret-admin-123' } }, res, () => { nx = true; });
  assert.equal(nx, true, 'good token should pass');
  // wrong token 401
  res = mkRes(); nx = false;
  requireAdmin({ headers: { 'x-admin-token': 'wrong' } }, res, () => { nx = true; });
  assert.equal(nx, false);
  assert.equal(res.code, 401);
  if (prev === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = prev;
});
