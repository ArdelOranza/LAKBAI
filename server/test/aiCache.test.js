const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cached } = require('../aiCache.js');

test('caches a loader value for the TTL', async () => {
  let n = 0; const loader = async () => ++n;
  assert.equal(await cached('k1', 60000, loader), 1);
  assert.equal(await cached('k1', 60000, loader), 1);       // no second call
  assert.equal(await cached('k2', 60000, loader), 2);
});

test('serves stale value instead of throwing (AI 429/503 — Review Focus #2)', async () => {
  const loader = async () => { const e = new Error('Gemini error 429'); e.status = 429; throw e; };
  assert.equal(await cached('k1', 60000, loader), 1);        // was set by the first test
});

test('error with no prior value propagates', async () => {
  await assert.rejects(() => cached('never', 1, async () => { throw new Error('boom'); }));
});
