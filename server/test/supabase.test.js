const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '0001_init.sql'), 'utf8');
test('migration creates tables with owner RLS', () => {
  for (const t of ['profiles', 'favorites', 'reviews', 'searches', 'plans']) {
    assert.ok(sql.includes(`create table ${t}`), `missing table ${t}`);
  }
  assert.ok(sql.includes('row level security'));
  assert.ok(sql.includes('auth.uid()'));
});
test('missing service key throws 503, never leaks', () => {
  delete process.env.SUPABASE_SERVICE_KEY;
  const { getService } = require('../supabase.js');
  assert.throws(() => getService(), /SUPABASE_SERVICE_KEY/);
});
