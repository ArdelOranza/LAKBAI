// One-shot: apply supabase/migrations to the live DB via the supabase CLI pooler URL.
// The CLI wraps each call in a prepared statement, so statements are executed one at a time.
// Usage: node scripts/apply-migrations.mjs
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const DB_URL = 'postgresql://postgres.khtqzqewnogjwoyshyiq:Lakbai0909461@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';
const FILES = ['supabase/migrations/0001_init.sql', 'supabase/migrations/0002_user_prefs.sql'];

const tmp = mkdtempSync(join(tmpdir(), 'lakbai-mig-'));
let i = 0;
for (const file of FILES) {
  const sql = readFileSync(file, 'utf8');
  const statements = sql.split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    const tmpFile = join(tmp, `s${i++}.sql`);
    writeFileSync(tmpFile, stmt + ';');
    try {
      const out = execFileSync('npx.cmd', ['supabase', 'db', 'query', '--db-url', DB_URL, '-f', tmpFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true });
      console.log('OK  ', file, '→', stmt.slice(0, 48).replace(/\s+/g, ' '));
    } catch (e) {
      const msg = (e.stderr || e.message || '').slice(0, 200);
      if (/already exists|duplicate/i.test(e.stdout || '') || /already exists|duplicate/i.test(msg)) {
        console.log('SKIP', stmt.slice(0, 48).replace(/\s+/g, ' '), '(already exists)');
      } else {
        console.error('FAIL', file, '→', stmt.slice(0, 48).replace(/\s+/g, ' '), '\n     ', msg.replace(/\s+/g, ' '));
        process.exitCode = 1;
      }
    }
  }
}
rmSync(tmp, { recursive: true, force: true });
console.log('migrations applied');
