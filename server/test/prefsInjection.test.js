const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommend } = require('../verify.js');

test('prefs string is appended to the agent payload, once', async () => {
  let sent;
  await recommend('beaches near me', '120.23,16.03', ['Beaches', 'Food & Dining'], {
    chatFn: async m => { sent = m; return { intent: 'redirect', answer: 'x', candidates: [], sources: [] }; },
    searchFn: async () => { throw new Error('should not search for redirect'); },
  });
  // chatFn receives the raw message with the prefs line appended; agent.js
  // then wraps it under "User request (Pangasinan, Philippines): ...".
  assert.match(sent, /beaches near me/);
  assert.match(sent, /User preferences: Beaches, Food & Dining\./);
  assert.equal(sent.split('User preferences').length - 1, 1); // appended once
});

test('no prefs → payload unchanged', async () => {
  let sent;
  await recommend('beaches', null, [], {
    chatFn: async m => { sent = m; return { intent: 'redirect', answer: 'x', candidates: [], sources: [] }; },
    searchFn: async () => { throw new Error('should not search for redirect'); },
  });
  assert.doesNotMatch(sent, /User preferences/);
});
