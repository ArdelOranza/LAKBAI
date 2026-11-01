// Sample debug account lifecycle (NOT for production use).
// Credentials: debug@lakbai.app / LakbaiDebug2026!
//   node scripts/debug-account.mjs --create   → signs up debug@lakbai.app (+ seeds when a session is available)
//   node scripts/debug-account.mjs --seed     → (re)seeds data after the email has been confirmed
//   node scripts/debug-account.mjs --remove   → deletes the account + all its rows (requires SUPABASE_SERVICE_KEY)
// Run from server/: node scripts/debug-account.mjs --create
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
const URL_BASE = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;
const EMAIL = 'debug@lakbai.app';
const PASSWORD = 'LakbaiDebug2026!';
const PREFS = ['Beaches', 'Food & Dining', 'Hidden Gems'];
const FAVS = [
  { place_id: 'hundred-islands-national-park-alaminos-city', name: 'Hundred Islands National Park', lng: 119.964, lat: 16.164 },
  { place_id: 'patar-beach-bolinao', name: 'Patar Beach', lng: 119.799, lat: 16.339 }
];
const PLAN = {
  title: 'Debug Sample Day Trip',
  starts_at: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) + 'T09:00:00Z',
  schedule: [
    { placeId: 'patar-beach-bolinao', name: 'Patar Beach', arrive: '09:00', depart: '11:30', activities: ['sunrise swim'] },
    { placeId: 'sungayan-grill-bolinao', name: 'Sungayan Grill', arrive: '12:00', depart: '13:30', activities: ['lunch on the river'] }
  ]
};
if (!URL_BASE || !ANON) { console.error('ERROR missing SUPABASE_URL / SUPABASE_ANON_KEY'); process.exit(1); }
const adminHeaders = () => ({ apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' });

async function rest(table, method, body, headers, qs = ''){
  const r = await fetch(`${URL_BASE}/rest/v1/${table}${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${table} ${method} ${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

async function adminFindByEmail(){
  const p = new URLSearchParams({ page: '1', per_page: '100' });
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users?${p}`, { headers: adminHeaders() });
  if (!r.ok) throw new Error('admin list ' + r.status);
  const d = await r.json();
  return (d.users || []).find(u => u.email === EMAIL) || null;
}

async function signUp(){
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const d = await r.json();
  if (!r.ok && !(d.message || '').includes('already')) throw new Error('signup ' + JSON.stringify(d).slice(0, 200));
  if (d.user && d.user.identities && d.user.identities.length === 0) throw new Error('user exists but is NOT confirmed — confirm the email in the dashboard, then run --seed');
  return { user: d.user, session: d.session };
}

async function signIn(){
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!r.ok) { const t = await r.text(); throw new Error('login failed (' + r.status + ') — confirm email? ' + t.slice(0, 200)); }
  const d = await r.json();
  return { user: d.user, token: d.access_token };
}

async function seed(uid, userHeaders){
  const results = [];
  const tryIt = async (label, fn) => { try { await fn(); results.push('OK   ' + label); } catch (e) { results.push('SKIP ' + label + ' → ' + e.message.slice(0, 160)); } };
  // Re-running is safe: every row below is matched before it is inserted.
  const exists = async (table, qs, headers) => ((await rest(table, 'GET', null, headers, qs + '&select=id&limit=1')) || []).length > 0;
  await tryIt('profile : preferences', async () => {
    if (await exists('profiles', `?id=eq.${uid}`, userHeaders)) return;
    await rest('profiles', 'POST', { id: uid, display_name: 'Debug Tester', phone: '+63 999 000 0001', preferences: PREFS }, userHeaders);
  });
  for (const f of FAVS) await tryIt('favorite: ' + f.name, async () => {
    if (await exists('favorites', `?user_id=eq.${uid}&place_id=eq.${f.place_id}`, userHeaders)) return;
    await rest('favorites', 'POST', { user_id: uid, ...f }, userHeaders);
  });
  await tryIt('review  : Patar Beach', async () => {
    if (await exists('reviews', `?user_id=eq.${uid}&place_id=eq.patar-beach-bolinao`, userHeaders)) return;
    await rest('reviews', 'POST', { user_id: uid, place_id: 'patar-beach-bolinao', place_name: 'Patar Beach', score: 5, text: 'Debug sample review — crisp water, best at dusk.' }, userHeaders);
  });
  await tryIt('plan    : Debug Sample Day Trip', async () => {
    if (await exists('plans', `?user_id=eq.${uid}&title=eq.${encodeURIComponent(PLAN.title)}`, userHeaders)) return;
    await rest('plans', 'POST', { user_id: uid, ...PLAN }, userHeaders);
  });
  results.forEach(l => console.log(l));
}

async function create(){
  let svcUser = SERVICE ? await adminFindByEmail().catch(() => null) : null;
  if (svcUser && !svcUser.email_confirmed_at) {
    const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${svcUser.id}`, { method: 'PUT', headers: adminHeaders(), body: JSON.stringify({ email_confirm: true }) });
    if (!r.ok) throw new Error('admin confirm ' + (await r.text()).slice(0, 200));
    console.log('confirmed existing user via admin API');
  } else if (svcUser) {
    console.log('account already confirmed — seeding data');
  } else {
    const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST', headers: adminHeaders(),
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { display_name: 'Debug Tester (SAMPLE — remove for prod)' } })
    });
    if (!r.ok) throw new Error('admin create ' + (await r.text()).slice(0, 200));
    console.log('created + confirmed user via admin API');
  }
  const { user, token } = await signIn();
  console.log('signed in as', user.id);
  await seed(user.id, { apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });
  console.log('LOGIN → email:', EMAIL, '| password:', PASSWORD);
}

async function seedCmd(){
  const { user, token } = await signIn();
  console.log('signed in as', user.id);
  await seed(user.id, { apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' });
}

async function remove(){
  if (!SERVICE) { console.error('ERROR remove needs SUPABASE_SERVICE_KEY (users cannot self-delete). Get it from Project Settings → API, or delete the user in the dashboard.'); process.exit(1); }
  const svcUser = await adminFindByEmail();
  if (!svcUser) { console.log('nothing to remove'); return; }
  const uid = svcUser.id;
  const rows = async (table, qs) => rest(table, 'DELETE', null, adminHeaders(), qs);
  await rows('plans', `?user_id=eq.${uid}`);
  await rows('reviews', `?user_id=eq.${uid}`);
  await rows('favorites', `?user_id=eq.${uid}`);
  await rows('profiles', `?id=eq.${uid}`);
  const d = await fetch(`${URL_BASE}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: adminHeaders() });
  if (!d.ok) throw new Error('admin delete ' + (await d.text()).slice(0, 200));
  console.log('removed sample account and all its rows');
}

const mode = process.argv.includes('--create') ? create : process.argv.includes('--seed') ? seedCmd : process.argv.includes('--remove') ? remove : null;
if (!mode) { console.log('usage: node scripts/debug-account.mjs --create | --seed | --remove'); process.exit(1); }
mode().catch(e => { console.error('ERROR', e.message); process.exit(1); });
