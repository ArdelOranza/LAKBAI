const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommend } = require('../verify.js');
test('off-topic request is refused with zero places', async () => {
  const fakeChat = async () => ({ intent: 'refuse', answer: 'I only plan Pangasinan travel.', candidates: [{ name: 'Homework' }], spotlight: null, sources: [] });
  let searched = false;
  const out = await recommend('write my homework', null, [], { chatFn: fakeChat, searchFn: async () => { searched = true; return []; } });
  assert.equal(out.intent, 'refuse');
  assert.deepEqual(out.places, []);
  assert.equal(searched, false);
});
test('empty candidates returns zero places', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'discover', answer: 'No matches.', candidates: [], spotlight: null, sources: [] });
  const out = await recommend('xyz?', null, [], { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.deepEqual(out.places, []);
});
