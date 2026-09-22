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
test('stripForInsert drops local-only at field', () => {
  delete require.cache[require.resolve('../../client/src/outbox.cjs')];
  global.localStorage = freshStorage();
  const { stripForInsert } = require('../../client/src/outbox.cjs');
  assert.deepEqual(stripForInsert({ place_id: 'p', score: 5, text: 't', at: 123 }), { place_id: 'p', score: 5, text: 't' });
});
test('corrupt outbox reads as empty, takeAll clears', () => {
  delete require.cache[require.resolve('../../client/src/outbox.cjs')];
  global.localStorage = freshStorage({ 'lakbai-review-outbox': 'not-json{{{' });
  const { readOutbox, takeAll, queueReview } = require('../../client/src/outbox.cjs');
  assert.deepEqual(readOutbox(), []);
  queueReview({ place_id: 'p' });
  assert.equal(takeAll().length, 1);
  assert.deepEqual(readOutbox(), []);
});
