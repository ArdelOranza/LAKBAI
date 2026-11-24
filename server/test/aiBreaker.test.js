const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cooldownFor, FULL_MS, MIN_RATE_MS } = require('../aiBreaker.js');

test('a rate-limit window arms only as long as the provider asks', () => {
  // Groq says "try again in 42s": don't serve dataset answers for five minutes.
  assert.equal(cooldownFor({ retryAfterMs: 42000 }), 44000);
  // A tiny hint must not make the breaker flap on every message.
  assert.equal(cooldownFor({ retryAfterMs: 500 }), MIN_RATE_MS);
  // A provider asking for longer than the normal cooldown gets the normal one.
  assert.equal(cooldownFor({ retryAfterMs: 30 * 60000 }), FULL_MS);
});

test('an ordinary failure keeps the full cooldown', () => {
  assert.equal(cooldownFor(new Error('boom')), FULL_MS);
  assert.equal(cooldownFor({ status: 402 }), FULL_MS);
  assert.equal(cooldownFor(null), FULL_MS);
});