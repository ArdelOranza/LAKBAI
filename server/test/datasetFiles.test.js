// server/data holds three kinds of JSON: place records, transit tables and
// runtime caches. Only the place records belong in the AI reference — the rest
// used to be globbed in, adding 48 zero-detail town rows and making every photo
// cache write look like a dataset change.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allEntries, datasetInfo } = require('../dataset.js');

test('the transit fare matrix is not ingested as places', () => {
  const ids = allEntries().map(e => e.id);
  assert.equal(ids.filter(id => /^PANG-/.test(String(id))).length, 0, 'LTFRB km rows leaked into the place set');
});

test('the dataset signature tracks place files only', () => {
  const { sig } = datasetInfo();
  for (const notPlace of ['photo-cache', 'ltfrb-', 'terminals-to-pangasinan', 'terminal-coords', 'spot-photos']){
    assert.ok(!sig.includes(notPlace), notPlace + ' must not bust the dataset cache: ' + sig);
  }
  assert.ok(sig.includes('places.json'), 'the real place files still count');
});
