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
test('chatRecommend falls back to lite model when primary is throttled', async () => {
  const { chatRecommend } = require('../agent.js');
  const good = '{"intent":"food","answer":"a","candidates":[],"spotlight":null,"sources":[]}';
  const realFetch = global.fetch;
  const urls = [];
  let calls = 0;
  global.fetch = async (url) => {
    calls++;
    urls.push(String(url));
    if (calls < 3) return { ok: false, status: 429 };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: good }] } }] }) };
  };
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    const out = await chatRecommend('x', { wait: async () => {} });
    assert.equal(out.intent, 'food');
    assert.equal(calls, 3);
    assert.ok(urls[0].includes('gemini-3.6-flash'));
    assert.ok(urls[2].includes('gemini-flash-lite-latest'));
  } finally {
    global.fetch = realFetch;
  }
});
test('chatRecommend uses deepseek when all gemini attempts fail', async () => {
  const { chatRecommend } = require('../agent.js');
  const good = '{"intent":"food","answer":"a","candidates":[],"spotlight":null,"sources":[]}';
  const realFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('api.deepseek.com')) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: good } }] }) };
    }
    return { ok: false, status: 429 };
  };
  const hadKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'test-key';
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    const out = await chatRecommend('x', { wait: async () => {} });
    assert.equal(out.intent, 'food');
    assert.equal(urls.length, 4);
    assert.ok(urls[3].includes('api.deepseek.com'));
  } finally {
    global.fetch = realFetch;
    if (hadKey === undefined) delete process.env.DEEPSEEK_API_KEY;
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
