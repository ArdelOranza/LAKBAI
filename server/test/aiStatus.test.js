const { test } = require('node:test');
const assert = require('node:assert/strict');
const { aiStatus, keyConfigured } = require('../aiStatus.js');

test('a configured, idle AI reads as usable', () => {
  const s = aiStatus({ useAi: true, downUntil: 0, now: 1000, env: { GEMINI_API_KEY: 'x' } });
  assert.equal(s.ai, true);
  assert.equal(s.configured, true);
});

test('the breaker or the off-switch turns the AI status off', () => {
  assert.equal(aiStatus({ useAi: true, downUntil: 5000, now: 1000, env: { GEMINI_API_KEY: 'x' } }).ai, false);
  assert.equal(aiStatus({ useAi: false, downUntil: 0, now: 1000, env: { GEMINI_API_KEY: 'x' } }).ai, false);
});

test('no provider key means not configured', () => {
  assert.equal(keyConfigured({}), false);
  assert.equal(keyConfigured({ GROQ_API_KEY: 'g' }), true);
  assert.equal(keyConfigured({ DEEPSEEK_API_KEY: 'd' }), true);
  assert.equal(keyConfigured({ TOKEN_HARBOR_API_KEY: 't' }), true);
  assert.equal(aiStatus({ useAi: true, downUntil: 0, now: 1000, env: {} }).configured, false);
});

test('GET /api/ai-status reports the model state as booleans', async () => {
  const app = require('../index.js');
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  try {
    const r = await fetch(`http://localhost:${server.address().port}/api/ai-status`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(typeof body.ai, 'boolean');
    assert.equal(typeof body.configured, 'boolean');
  } finally {
    server.close();
  }
});
