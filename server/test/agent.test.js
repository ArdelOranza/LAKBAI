const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAgentJson } = require('../agent.js');
test('parseAgentJson extracts JSON with sources', () => {
  const raw = '```json\n{"intent":"food","answer":"Try Patar beach.","candidates":[{"name":"Patar Beach","hint":"Bolinao","reason":"White sand, real reviews"}],"spotlight":null,"sources":["https://example.com"]}\n```';
  const out = parseAgentJson(raw);
  assert.equal(out.intent, 'food');
  assert.equal(out.candidates.length, 1);
  assert.deepEqual(out.sources, ['https://example.com']);
});
test('parseAgentJson throws on garbage', () => {
  assert.throws(() => parseAgentJson('no json here at all!!!'), /Could not parse/);
});
test('chatRecommend retries without tools on 429', async () => {
  const { chatRecommend } = require('../agent.js');
  const good = '{"intent":"food","answer":"a","candidates":[],"spotlight":null,"sources":[]}';
  const realFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429 };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: good }] } }] }) };
  };
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    const out = await chatRecommend('x');
    assert.equal(out.intent, 'food');
    assert.equal(calls, 2);
  } finally {
    global.fetch = realFetch;
  }
});
