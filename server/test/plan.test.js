const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planDay } = require('../plan.js');
test('unverifiable stops are dropped, times kept', async () => {
  const fakeAgent = async () => ({
    title: 'Alaminos food day',
    stops: [
      { name: 'Patar Beach', hint: 'Bolinao', arrive: '09:00', depart: '10:30', activities: ['Swim', 'Photos'] },
      { name: 'Nowhere Fake', hint: '', arrive: '11:00', depart: '12:30', activities: ['Nothing'] }
    ]
  });
  const fakeSearch = async (q) => q.startsWith('Patar')
    ? [{ id: 'p1', name: 'Patar Beach', lng: 119.79, lat: 16.12, address: '', categories: [] }]
    : [];
  const out = await planDay('food day', 4, 9, { agentFn: fakeAgent, searchFn: fakeSearch });
  assert.equal(out.title, 'Alaminos food day');
  assert.equal(out.schedule.length, 1);
  assert.deepEqual(out.schedule[0].activities, ['Swim', 'Photos']);
  assert.equal(out.schedule[0].arrive, '09:00');
});
test('plan generation retries once on 503', async () => {
  const realFetch = global.fetch;
  let calls = 0;
  const planJson = '{"title":"T","stops":[{"name":"Patar Beach","hint":"Bolinao","arrive":"09:00","depart":"10:30","activities":["Swim"]}]}';
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: planJson }] } }] }) };
  };
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    const fakeSearch = async () => [{ id: 'p1', name: 'Patar Beach', lng: 119.79, lat: 16.12, address: '', categories: [] }];
    const out = await planDay('food day', 4, 9, { searchFn: fakeSearch });
    assert.equal(out.schedule.length, 1);
    assert.equal(calls, 2);
  } finally {
    global.fetch = realFetch;
  }
});
test('plan falls back to deepseek when gemini is throttled', async () => {
  const realFetch = global.fetch;
  const urls = [];
  const planJson = '{"title":"T","stops":[]}';
  global.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('api.deepseek.com')) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: planJson } }] }) };
    }
    return { ok: false, status: 503 };
  };
  const hadKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'test-key';
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    const out = await planDay('food day', 4, 9, { searchFn: async () => [] });
    assert.equal(out.title, 'T');
    assert.ok(urls.some(u => u.includes('api.deepseek.com')));
  } finally {
    global.fetch = realFetch;
    if (hadKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  }
});
test('plan prompt carries the time window', async () => {
  const realFetch = global.fetch;
  let body = '';
  const planJson = '{"title":"T","stops":[]}';
  global.fetch = async (url, opts) => {
    body = opts.body;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: planJson }] } }] }) };
  };
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
    await planDay('food day', 6, 8, { searchFn: async () => [] });
    assert.ok(body.includes('6 hours') && body.includes('8:00'));
  } finally {
    global.fetch = realFetch;
  }
});
test('parsePlan ignores trailing prose braces', () => {
  const { parsePlan } = require('../plan.js');
  const out = parsePlan('Here: {"title":"T","stops":[]} done }');
  assert.equal(out.title, 'T');
});
