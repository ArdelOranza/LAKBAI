const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.GROQ_API_KEY = 'test-key';
const { callGroq } = require('../groq.js');

test('a missing Groq key is a 503, not a crash', async () => {
  const prev = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    await assert.rejects(() => callGroq('sys', 'payload'), /Missing GROQ_API_KEY/);
  } finally {
    process.env.GROQ_API_KEY = prev;
  }
});

test('Groq is called OpenAI-style and the JSON content comes back', async () => {
  const realFetch = global.fetch;
  let seen;
  global.fetch = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
  };
  try {
    const out = await callGroq('SYS', 'PAYLOAD');
    assert.equal(out, '{"ok":true}');
    assert.match(seen.url, /api\.groq\.com\/openai\/v1\/chat\/completions/);
    assert.equal(seen.init.headers.Authorization, 'Bearer test-key');
    assert.equal(seen.body.messages[0].role, 'system');
    assert.equal(seen.body.messages[0].content, 'SYS');
    assert.equal(seen.body.messages[1].content, 'PAYLOAD');
    assert.deepEqual(seen.body.response_format, { type: 'json_object' });
  } finally {
    global.fetch = realFetch;
  }
});

test('a rate-limited Groq response is an error with the status attached', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  try {
    await assert.rejects(() => callGroq('sys', 'payload'), /Groq error 429/);
  } finally {
    global.fetch = realFetch;
  }
});

test('the completion length is bounded so a runaway answer cannot eat the budget', async () => {
  const realFetch = global.fetch;
  let body;
  global.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
  };
  try {
    await callGroq('sys', 'payload');
    assert.equal(body.max_tokens, 1600);
  } finally {
    global.fetch = realFetch;
  }
});

test('a TPM rejection carries the window the caller should wait', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 413,
    text: async () => JSON.stringify({ error: { message: 'Rate limit reached ... Please try again in 42.5s. Need more tokens?' } }),
  });
  try {
    await assert.rejects(() => callGroq('sys', 'payload'), e => {
      assert.equal(e.status, 413);
      assert.equal(e.retryAfterMs, 42500);
      return true;
    });
  } finally {
    global.fetch = realFetch;
  }
});

test('a retry-after header wins over the message text', async () => {
  const realFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    headers: { get: name => (name === 'retry-after' ? '7' : null) },
    text: async () => '',
  });
  try {
    await assert.rejects(() => callGroq('sys', 'payload'), e => e.retryAfterMs === 7000);
  } finally {
    global.fetch = realFetch;
  }
});
