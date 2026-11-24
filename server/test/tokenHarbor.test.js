// Token Harbor (https://tokenharbor.ai) is an OpenAI-compatible gateway with
// free routes, so one key covers every model we need while Gemini's free quota
// is exhausted. The free `deepseek-v4.1-flash:free` route takes our full
// grounded context (1M window), which the Groq fallback cannot.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.TOKEN_HARBOR_API_KEY = 'th-test-key';
const { callTokenHarbor, DEFAULT_MODEL } = require('../tokenHarbor.js');

const ok = content => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

test('a missing Token Harbor key is a 503, not a crash', async () => {
  const prev = process.env.TOKEN_HARBOR_API_KEY;
  delete process.env.TOKEN_HARBOR_API_KEY;
  try {
    await assert.rejects(() => callTokenHarbor('sys', 'payload'), /Missing TOKEN_HARBOR_API_KEY/);
  } finally {
    process.env.TOKEN_HARBOR_API_KEY = prev;
  }
});

test('Token Harbor is called OpenAI-style and the JSON content comes back', async () => {
  const realFetch = global.fetch;
  let seen;
  global.fetch = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return ok('{"ok":true}');
  };
  try {
    const out = await callTokenHarbor('SYS', 'PAYLOAD');
    assert.equal(out, '{"ok":true}');
    assert.match(seen.url, /tokenharbor\.ai\/v1\/chat\/completions/);
    assert.equal(seen.init.headers.Authorization, 'Bearer th-test-key');
    assert.equal(seen.body.messages[0].content, 'SYS');
    assert.equal(seen.body.messages[1].content, 'PAYLOAD');
    assert.equal(seen.body.model, DEFAULT_MODEL);
    assert.equal(seen.body.response_format.type, 'json_object');
    assert.equal(seen.body.max_tokens, 1600);
  } finally {
    global.fetch = realFetch;
  }
});

test('a rate limit carries the window the caller should wait', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    headers: { get: name => (name === 'retry-after' ? '9' : null) },
    text: async () => '',
  });
  try {
    await assert.rejects(() => callTokenHarbor('sys', 'payload'), e => {
      assert.equal(e.status, 429);
      assert.equal(e.retryAfterMs, 9000);
      return true;
    });
  } finally {
    global.fetch = realFetch;
  }
});

test('empty content is a failure, not a success', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ok('   ');
  try {
    await assert.rejects(() => callTokenHarbor('sys', 'payload'), /Token Harbor returned empty content/);
  } finally {
    global.fetch = realFetch;
  }
});

test('the chat chain answers through Token Harbor before any Gemini call', async () => {
  process.env.LAKBAI_DATA = path.join(__dirname, 'fixtures', 'dataset.json');
  const { groundedChat } = require('../grounded.js');
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    if (!String(url).includes('tokenharbor.ai')) throw new Error('unexpected provider: ' + url);
    return ok(JSON.stringify({
      intent: 'discover',
      answer: 'A quiet anniversary starts with a slow dinner in Dagupan.',
      candidates: [{ name: "Conrad's Dagupan" }],
      sources: [],
    }));
  };
  try {
    const out = await groundedChat('somewhere for a quiet anniversary', '120.341,16.043');
    assert.equal(calls.length, 1);
    assert.match(calls[0], /tokenharbor\.ai/);
    assert.match(out.answer, /slow dinner/);
    assert.equal(out.source, 'dataset+ai');
  } finally {
    global.fetch = realFetch;
  }
});