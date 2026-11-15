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
  assert.ok(sql.includes('grant select, insert, update, delete on profiles, favorites, searches, plans to authenticated'));
  assert.ok(sql.includes('unique(user_id, place_id)'));
});
// 0005 is run by hand in the Supabase SQL editor, so the file itself has to be
// the whole job: the table, the buckets its photos live in, and the PostgREST
// reload without which the API still answers "table not found".
const submissions = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', '0005_place_submissions.sql'), 'utf8');

test('the submissions migration is safe to paste into the SQL editor', () => {
  assert.ok(submissions.includes('create table if not exists public.place_submissions'));
  assert.ok(submissions.includes('enable row level security'));
  // A pending photo is private; only the approved copy is public.
  assert.ok(/values \('place-submissions', 'place-submissions', false\)/.test(submissions));
  assert.ok(/values \('place-photos', 'place-photos', true\)/.test(submissions));
  // The client can never approve its own row.
  assert.ok(!/on public\.place_submissions\s*\n?\s*for update/.test(submissions));
  // Run it once and the API can see the table immediately: a real statement,
  // not just the note in the header comment.
  assert.ok(/^\s*notify\s+pgrst\s*,\s*'reload schema'\s*;/im.test(submissions), 'migration must reload the PostgREST schema cache');
});

test('a traveller can resubmit a place after a rejection', () => {
  // The index says "one row while pending". Without the WHERE clause it also
  // blocks a corrected resubmission forever, and the client reports the stale
  // row as "You already submitted this place."
  const index = submissions.match(/create unique index[^;]*;/is);
  assert.ok(index, 'missing unique index');
  assert.ok(/where\s+status\s*=\s*'pending'/i.test(index[0]), 'unique index must only cover pending rows');
});

test('missing service key throws 503, never leaks', () => {
  delete process.env.SUPABASE_SERVICE_KEY;
  const { getService } = require('../supabase.js');
  assert.throws(() => getService(), /SUPABASE_SERVICE_KEY/);
});
