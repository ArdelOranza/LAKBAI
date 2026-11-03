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
