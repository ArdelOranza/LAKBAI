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
test('parseAgentJson throws 502 on garbage with braces', () => {
  try {
    parseAgentJson('{not json}');
    assert.fail('should have thrown');
  } catch (e) {
    assert.match(e.message, /Could not parse/);
    assert.equal(e.status, 502);
  }
});
test('parseAgentJson handles fences and prose', () => {
  const raw = 'Here you go:\n```json\n{"intent":"food","answer":"a","candidates":[],"spotlight":null,"sources":[]}\n```\nEnjoy!';
  const out = parseAgentJson(raw);
  assert.equal(out.intent, 'food');
});
test('chatRecommend backs off across 3 attempts then succeeds', async () => {
  const { chatRecommend } = require('../agent.js');
  const good = '{"intent":"food","answer":"a","candidates":[],"spotlight":null,"sources":[]}';
  const realFetch = global.fetch;
  let calls = 0;
  const waits = [];
  global.fetch = async () => {
    calls++;
    if (calls < 3) return { ok: false, status: calls === 1 ? 429 : 503 };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: good }] } }] }) };
  };
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    const out = await chatRecommend('x', { wait: async (ms) => waits.push(ms) });
    assert.equal(out.intent, 'food');
    assert.equal(calls, 3);
    assert.deepEqual(waits, [1500, 3000]);
  } finally {
    global.fetch = realFetch;
  }
});
test('chatRecommend gives friendly busy message when exhausted', async () => {
  const { chatRecommend } = require('../agent.js');
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    await assert.rejects(chatRecommend('x', { wait: async () => {} }), /busy/);
  } finally {
    global.fetch = realFetch;
  }
});
test('chatRecommend retries without tools on 502', async () => {
  const { chatRecommend } = require('../agent.js');
  const good = '{"intent":"food","answer":"a","candidates":[],"spotlight":null,"sources":[]}';
  const realFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 502 };
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
