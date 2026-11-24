// The Groq free tier caps a minute at 8k tokens, and our full context (≈14k
// tokens) is rejected with a 413 on every chat. These tests pin the compact
// payload that rides along for that provider: smaller, but still a real
// catalogue the model can answer from.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groundedChat } = require('../grounded.js');

const OK = JSON.stringify({ intent: 'discover', answer: 'ok', candidates: [], sources: [] });
const rows = text => text.split('\n').filter(l => l.startsWith('- ')).length;

test('a compact payload rides along for the provider with the tightest budget', async () => {
  let seen;
  await groundedChat('somewhere for a quiet anniversary', '120.341,16.043', {
    askFn: async (_system, payload, opts) => { seen = { payload, opts }; return OK; },
  });
  assert.ok(seen.opts, 'the model call carries provider options');
  assert.equal(typeof seen.opts.compact, 'string');
  assert.match(seen.opts.compact, /User request: somewhere for a quiet anniversary/);
  assert.match(seen.opts.compact, /INDEX/);
  assert.ok(seen.opts.compact.length <= 17000, 'compact fits the TPM budget, got ' + seen.opts.compact.length + ' chars');
  assert.ok(seen.opts.compact.length < seen.payload.length, 'compact is smaller than the full context');
});

test('the compact index still lists the catalogue when records fill the context', async () => {
  // Even with eight records riding along, the index must keep a broad list of
  // options — the model needs somewhere to look beyond the keyword hits.
  let seen;
  await groundedChat('what can I do here', '120.341,16.043', {
    askFn: async (_system, _payload, opts) => { seen = opts; return OK; },
  });
  assert.ok(rows(seen.compact) >= 100, 'compact index rows: ' + rows(seen.compact));
});

test('compact records are trimmed so a keyword-heavy ask keeps its index too', async () => {
  let seen;
  await groundedChat('what can I do in Bolinao today', '119.87,16.31', {
    askFn: async (_system, _payload, opts) => { seen = opts; return OK; },
  });
  assert.ok(seen.compact.length <= 17000, 'still fits, got ' + seen.compact.length + ' chars');
  assert.ok(rows(seen.compact) >= 40, 'the index survives the long records: ' + rows(seen.compact));
});