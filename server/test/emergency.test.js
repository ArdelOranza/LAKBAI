const { test } = require('node:test');
const assert = require('node:assert/strict');
test('hotlines always present', async () => {
  const app = require('../index.js');
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  try {
    const port = server.address().port;
    const r = await fetch(`http://localhost:${port}/api/emergency?proximity=120.23,16.03`);
    const body = await r.json();
    assert.ok(Array.isArray(body.hotlines) && body.hotlines.length >= 2);
    assert.ok(Array.isArray(body.hospitals) && Array.isArray(body.police));
  } finally {
    server.close();
  }
});
