const { test } = require('node:test');
const assert = require('node:assert/strict');
function freshStorage(initial){
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}
test('stripForInsert drops local-only at field', async () => {
  global.localStorage = freshStorage();
  const { stripForInsert } = await import('../../client/src/outbox.js');
  assert.deepEqual(stripForInsert({ place_id: 'p', score: 5, text: 't', at: 123 }), { place_id: 'p', score: 5, text: 't' });
});
test('corrupt outbox reads as empty, takeAll clears', async () => {
  global.localStorage = freshStorage({ 'lakbai-review-outbox': 'not-json{{{' });
  const { readOutbox, takeAll, queueReview } = await import('../../client/src/outbox.js');
  assert.deepEqual(readOutbox(), []);
  queueReview({ place_id: 'p' });
  assert.equal(takeAll().length, 1);
  assert.deepEqual(readOutbox(), []);
});
