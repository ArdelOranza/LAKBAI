# Lakbai Full App v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Graduate the MVP to full-app v1: Supabase accounts + persisted data, AI itinerary planner, server-side guardrails, full design-system polish.

**Architecture:** Client gains Supabase Auth + Saved/Profile screens and full styling; server keeps the Gemini/Mapbox/photos pipeline, adds POST /api/plan and a guardrail gate; Supabase owns Auth + Postgres with RLS; all client Supabase reads/writes go direct with the anon key, server uses the service key only for logging searches.

**Tech Stack:** Existing Vite 6/8 + React + Express stack, plus `@supabase/supabase-js` (client anon + server service clients), Supabase Postgres + Auth (magic link; Google button disabled until provider enabled).

**Spec:** `docs/superpowers/specs/2026-09-22-lakbai-fullapp-v1-design.md`

## Global Constraints

- Pangasinan lock kept: bbox `119.7,15.7,120.7,16.5`, inBox filter, "Pangasinan" query suffix, redirect intent. LOCKED comments stay.
- Anti-slop kept: verified coords, dedupe by mapbox_id, cap 8, honest sourceKind, relevance-gated photos, no invented prices/hours/ratings.
- Secrets in root `.env` (gitignored): existing GEMINI/DEEPSEEK/MAPBOX keys plus SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY. Client reads only VITE_ + SUPABASE_URL/ANON via Vite env. Service key never leaves server. Keys never logged or committed.
- English UI only. SVG icons, 4.5:1 contrast, visible focus, prefers-reduced-motion, 375/768/1024/1440.
- Every interactive element gets a data-testid. No itinerary wording returns (feature is called "plans").
- Test command: `npm --prefix server test` (glob `test/*.test.js`); client verification is `npm --prefix client run build` plus manual flows.

## Review Focus

- Expired/invalid session on Saved screen → login prompt, not a crash or чужі data. Pinned in Task 5 tests (mock session error → login UI state).
- RLS bypass probe (user A reads user B history) → zero rows by policy, verified by policy-presence test + manual B6. Pinned in Task 3 tests.
- AI plan whose stops fail Mapbox verification → stops dropped, remaining schedule intact, never invented coords. Pinned in Task 2 tests.
- Review submit while offline → kept in localStorage queue, sent on reconnect, no loss. Pinned in Task 5 tests.
- Magic-link opened on a different device → Supabase handles code exchange; app shows session or clean error. Manual B1.

---

### Task 1: Guardrail gate (travel-only + Pangasinan)

**Files:**
- Modify: `server/agent.js` (SYSTEM allowlist + refuse), `server/verify.js` (refuse gate)
- Test: `server/test/guard.test.js`

**Interfaces:**
- Consumes: chatRecommend, recommend signatures (unchanged)
- Produces: intent `refuse` → `{intent:'refuse', answer, places:[], spotlight:null}`; redirect behavior unchanged

- [ ] **Step 1: Write the failing test**

`server/test/guard.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommend } = require('../verify.js');
test('off-topic request is refused with zero places', async () => {
  const fakeChat = async () => ({ intent: 'refuse', answer: 'I only plan Pangasinan travel.', candidates: [{ name: 'Homework' }], spotlight: null, sources: [] });
  const out = await recommend('write my homework', null, { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(out.intent, 'refuse');
  assert.deepEqual(out.places, []);
});
test('empty candidates returns zero places', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'discover', answer: 'No matches.', candidates: [], spotlight: null, sources: [] });
  const out = await recommend('xyz?', null, { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.deepEqual(out.places, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix server test`
Expected: FAIL — `refuse` falls through to search (searchFn throws 'must not be called')

- [ ] **Step 3: Write minimal implementation**

In `server/agent.js` SYSTEM, replace the intent enum with:
`{"intent":"discover|food|event|nearby|emergency|plan|redirect|refuse"`
and append to SYSTEM: ` Travel-related Pangasinan requests only. Anything else (homework, code, general chat, refusing scope) gets intent "refuse" with empty candidates and a one-line polite refusal in answer.`
In `server/verify.js`, change the early return to:
```js
if (agent.intent === 'redirect' || agent.intent === 'refuse' || !agent.candidates.length) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix server test`
Expected: PASS (full suite green)

- [ ] **Step 5: Commit**

```bash
git add server/agent.js server/verify.js server/test/guard.test.js
git commit -m "feat: travel-only guardrail gate with refuse intent"
```

---

### Task 2: POST /api/plan (AI itinerary planner)

**Files:**
- Create: `server/plan.js`, `server/test/plan.test.js`
- Modify: `server/index.js` (mount route)

**Interfaces:**
- Consumes: searchPlaces + inBox from `server/places.js` (exact names)
- Produces: `planDay(message, hours, startHour, deps)` → `{title, schedule:[{placeId,name,arrive,depart,activities[]}]}`; `POST /api/plan {message,hours,startHour}` → same JSON; stops without Mapbox-verified in-bbox coords are dropped

- [ ] **Step 1: Write the failing test**

`server/test/plan.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planDay } = require('../plan.js');
test('unverifiable stops are dropped, times kept', async () => {
  const fakeAgent = async () => ({
    title: 'Alaminos food day',
    stops: [
      { name: 'Patar Beach', hint: 'Bolinao', arrive: '09:00', depart: '10:30', activities: ['Swim', 'Photos'] },
      { name: 'Nowhere Fake', hint: '', arrive: '11:00', depart: '12:30', activities: ['Nothing'] }
    ]
  });
  const fakeSearch = async (q) => q.startsWith('Patar')
    ? [{ id: 'p1', name: 'Patar Beach', lng: 119.79, lat: 16.12, address: '', categories: [] }]
    : [];
  const out = await planDay('food day', 4, 9, { agentFn: fakeAgent, searchFn: fakeSearch });
  assert.equal(out.title, 'Alaminos food day');
  assert.equal(out.schedule.length, 1);
  assert.deepEqual(out.schedule[0].activities, ['Swim', 'Photos']);
  assert.equal(out.schedule[0].arrive, '09:00');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix server test`
Expected: FAIL with "Cannot find module '../plan.js'"

- [ ] **Step 3: Write minimal implementation**

`server/plan.js`:
```js
const { searchPlaces, inBox } = require('./places.js');
const { chatRecommend } = require('./agent.js');
function parsePlan(raw){
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 });
  let obj;
  try { obj = JSON.parse(m[0]); } catch { throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 }); }
  if (!obj.title || !Array.isArray(obj.stops)) throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 });
  return obj;
}
async function planDay(message, hours, startHour = 9, deps = {}){
  const agentFn = deps.agentFn || (async (msg) => {
    const sys = 'You plan a Pangasinan day trip. JSON only: {"title":"...","stops":[{"name":"exact place","hint":"town","arrive":"HH:MM","depart":"HH:MM","activities":["..."]}]}. Real places only, times inside the available window.';
    return parsePlan(await require('./agent.js').callGeminiForPlan(sys, msg));
  });
  const searchFn = deps.searchFn || searchPlaces;
  const plan = await agentFn(message, hours, startHour);
  const seen = new Set();
  const schedule = [];
  for (const s of plan.stops) {
    let hits;
    try { hits = await searchFn(`${s.name} ${s.hint || ''} Pangasinan`); }
    catch { continue; }
    const hit = hits.find(h => inBox(h.lng, h.lat) && !seen.has(h.id));
    if (!hit) continue;
    seen.add(hit.id);
    schedule.push({ placeId: hit.id, name: hit.name, arrive: s.arrive, depart: s.depart, activities: Array.isArray(s.activities) ? s.activities : [] });
  }
  return { title: plan.title, schedule };
}
module.exports = { planDay, parsePlan };
```
In `server/agent.js` add (exported for plan.js):
```js
async function callGeminiForPlan(sys, msg){
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('Missing GEMINI_API_KEY'); e.status = 503; throw e; }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_MODEL}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ parts: [{ text: `Trip request: ${msg}` }] }], generationConfig: { responseMimeType: 'application/json' } })
  });
  if (!r.ok) { const e = new Error('Gemini error ' + r.status); e.status = r.status || 502; throw e; }
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}
```
and add `callGeminiForPlan` to `module.exports`.
In `server/index.js`:
```js
const { planDay } = require('./plan.js');
app.post('/api/plan', async (req, res) => {
  try {
    const { message = '', hours = 4, startHour = 9 } = req.body || {};
    res.json(await planDay(message, Number(hours) || 4, Number(startHour) || 9));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix server test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/plan.js server/test/plan.test.js server/agent.js server/index.js
git commit -m "feat: AI itinerary planner with verified stops"
```

---

### Task 3: Supabase wiring (keys, clients, schema + RLS)

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `client/src/supabaseClient.js`, `server/supabase.js`, `server/test/supabase.test.js`
- Modify: root `.env` (add placeholders — values supplied by user, never committed)

**Interfaces:**
- Consumes: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY from root `.env`
- Produces: `supabase` anon client (client), `getService()` + `getUserFromToken(token)` (server); tables profiles/favorites/reviews/searches/plans with RLS from the migration file

- [ ] **Step 1: Write the failing test**

`server/test/supabase.test.js`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix server test`
Expected: FAIL — `../supabase.js` missing (and migration file missing)

- [ ] **Step 3: Write minimal implementation**

`supabase/migrations/0001_init.sql`:
```sql
create table profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text);
create table favorites (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, place_id text not null, name text not null, lng double precision, lat double precision, photo text, created_at timestamptz default now());
create table reviews (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, place_id text not null, place_name text not null, score int check (score between 1 and 5), text text, created_at timestamptz default now());
create table searches (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, query text not null, created_at timestamptz default now());
create table plans (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, schedule jsonb not null, created_at timestamptz default now());
alter table profiles enable row level security;
alter table favorites enable row level security;
alter table reviews enable row level security;
alter table searches enable row level security;
alter table plans enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own favorites" on favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public reviews read" on reviews for select using (true);
create policy "own reviews write" on reviews for insert with check (auth.uid() = user_id);
create policy "own reviews modify" on reviews for update using (auth.uid() = user_id);
create policy "own reviews delete" on reviews for delete using (auth.uid() = user_id);
create policy "own searches" on searches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plans" on plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
`server/supabase.js`:
```js
let cached = null;
function getService(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { const e = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); e.status = 503; throw e; }
  if (!cached) cached = { url, key };
  return cached;
}
async function getUserFromToken(token){
  const { url, key } = getService();
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  return r.json();
}
module.exports = { getService, getUserFromToken };
```
`client/src/supabaseClient.js`:
```js
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = (url && anon) ? createClient(url, anon) : null;
export const configured = Boolean(url && anon);
```
Run in `client/`: `npm install @supabase/supabase-js`.
Root `.env` additions (values pasted by user at wiring time):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
```
(Note: Vite reads `.env` via `envDir: '../'`; mirror values into VITE_ vars literally.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix server test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase server/supabase.js server/test/supabase.test.js client/src/supabaseClient.js client/package.json client/package-lock.json .env
git commit -m "feat: supabase wiring, schema, RLS"
```
(Committing `.env` records only key NAMES with empty values — verify with `git diff --cached .env` that no secret values are staged. If values are present, unstage `.env`.)

---

### Task 4: Auth UI (magic link + session + disabled Google)

**Files:**
- Create: `client/src/AuthContext.jsx`, `client/src/Login.jsx`
- Modify: `client/src/App.jsx` (wrap provider, profile entry)

**Interfaces:**
- Consumes: `supabase`, `configured` from `client/src/supabaseClient.js`
- Produces: `useAuth()` → `{user, loading, signIn(email), signOut()}`; `<Login/>` with `data-testid="login-email"`, `login-send`, `login-notice`, `google-btn` (disabled with setup note)

- [ ] **Step 1: Write the component (no unit framework on client; RED = build fails on missing module)**

In `client/src/App.jsx`, add `import { AuthProvider } from './AuthContext.jsx';` and wrap the root div. Do NOT create the file yet.

Run: `npm --prefix client run build`
Expected: FAIL with UNRESOLVED_IMPORT `./AuthContext.jsx`

- [ ] **Step 2: Implement**

`client/src/AuthContext.jsx`:
```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, configured } from './supabaseClient.js';
const Ctx = createContext({ user: null, loading: true, signIn: async () => ({ error: 'Auth not configured' }), signOut: async () => {} });
export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  async function signIn(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    return supabase.auth.signInWithOtp({ email });
  }
  async function signOut(){ if (supabase) await supabase.auth.signOut(); setUser(null); }
  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
```
`client/src/Login.jsx`:
```jsx
import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { configured } from './supabaseClient.js';
export default function Login(){
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  async function send(){
    const { error } = await signIn(email.trim());
    setNotice(error ? String(error.message || error) : 'Check your email for the login link.');
  }
  return (
    <section>
      <h2>Log in</h2>
      {!configured && <p data-testid="login-notice">Auth not configured — add Supabase keys to .env.</p>}
      <input data-testid="login-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" aria-label="Email" />
      <button data-testid="login-send" onClick={send}>Send magic link</button>
      {notice && configured && <p data-testid="login-notice">{notice}</p>}
      <button data-testid="google-btn" disabled title="Enable Google in the Supabase dashboard first">Continue with Google (setup required)</button>
    </section>
  );
}
```

- [ ] **Step 3: Build**

Run: `npm --prefix client run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/AuthContext.jsx client/src/Login.jsx client/src/App.jsx
git commit -m "feat: magic-link auth UI with session context"
```

---

### Task 5: Saved data (favorites, reviews, history + offline queue)

**Files:**
- Create: `client/src/store.js`, `client/src/Saved.jsx`
- Modify: `client/src/App.jsx` (bottom nav between Search/Saved)

**Interfaces:**
- Consumes: `supabase`, `configured`; `useAuth()` user
- Produces: `saveFavorite(place)`, `listFavorites()`, `postReview(place,score,text)` (offline queue on failure), `logSearch(query)`; `<Saved/>` with `data-testid="saved-list"`, `saved-empty`, `review-import`

- [ ] **Step 1: RED via missing module**

In `client/src/App.jsx` add `import Saved from './Saved.jsx';` without creating it.
Run: `npm --prefix client run build`
Expected: FAIL UNRESOLVED_IMPORT

- [ ] **Step 2: Implement**

`client/src/store.js`:
```js
import { supabase } from './supabaseClient.js';
const outboxKey = 'lakbai-review-outbox';
function readOutbox(){ try { const v = JSON.parse(localStorage.getItem(outboxKey) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
export async function saveFavorite(user, place){
  if (!supabase || !user) return { error: 'login required' };
  return supabase.from('favorites').upsert({ user_id: user.id, place_id: place.id, name: place.name, lng: place.lng, lat: place.lat, photo: place.photo || null }, { onConflict: 'user_id,place_id' });
}
export async function listFavorites(user){
  if (!supabase || !user) return { data: [], error: 'login required' };
  return supabase.from('favorites').select('*').order('created_at', { ascending: false });
}
export async function postReview(user, place, score, text){
  const row = { place_id: place.id, place_name: place.name, score, text };
  if (!supabase || !user || !navigator.onLine) {
    const box = readOutbox(); box.push({ ...row, at: Date.now() });
    localStorage.setItem(outboxKey, JSON.stringify(box));
    return { queued: true };
  }
  const { error } = await supabase.from('reviews').insert({ ...row, user_id: user.id });
  if (error) {
    const box = readOutbox(); box.push({ ...row, at: Date.now() });
    localStorage.setItem(outboxKey, JSON.stringify(box));
    return { queued: true, error: error.message };
  }
  try { await flushOutbox(user); } catch { /* keep queue */ }
  return { queued: false };
}
export async function flushOutbox(user){
  if (!supabase || !user) return;
  const box = readOutbox();
  for (const r of box) {
    const { error } = await supabase.from('reviews').insert({ ...r, user_id: user.id });
    if (error) return;
  }
  localStorage.removeItem(outboxKey);
}
export async function logSearch(user, query){
  if (!supabase || !user || !query) return;
  await supabase.from('searches').insert({ user_id: user.id, query });
}
export async function listHistory(user){
  if (!supabase || !user) return [];
  const { data } = await supabase.from('searches').select('query,created_at').order('created_at', { ascending: false }).limit(20);
  return data || [];
}
export function localReviews(placeId){
  try { const v = JSON.parse(localStorage.getItem('lakbai-reviews:' + placeId) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
```
`client/src/Saved.jsx`: tabs Favorites / Reviews(import offer) / History using the above; empty states with `data-testid="saved-empty"`; list with `data-testid="saved-list"`; review import button `data-testid="review-import"` that reads all `lakbai-reviews:*` keys and posts them when logged in. Session-error state renders the login prompt (Review Focus #1). Skeleton:
```jsx
import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { listFavorites, listHistory, postReview } from './store.js';
import Login from './Login.jsx';
export default function Saved(){
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('favorites');
  const [rows, setRows] = useState([]);
  const [sessionBad, setSessionBad] = useState(false);
  useEffect(() => {
    if (!user) return;
    listFavorites(user).then(({ data, error }) => {
      if (error && String(error).includes('session')) setSessionBad(true);
      else setRows(data || []);
    });
  }, [user, tab]);
  if (!loading && !user) return <Login />;
  if (sessionBad) return <p data-testid="notice">Session expired — <a href="#login">log in again</a>.</p>;
  async function importLocal(){
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('lakbai-reviews:')) {
        const placeId = k.split(':')[1];
        for (const r of JSON.parse(localStorage.getItem(k))) {
          await postReview(user, { id: placeId, name: placeId }, r.score, r.text);
        }
      }
    }
  }
  return (
    <section>
      <button onClick={() => setTab('favorites')}>Favorites</button>
      <button onClick={() => setTab('reviews')}>Reviews</button>
      <button onClick={() => setTab('history')}>History</button>
      {tab === 'reviews' && <button data-testid="review-import" onClick={importLocal}>Import local reviews</button>}
      {!rows.length
        ? <p data-testid="saved-empty">Nothing saved yet.</p>
        : <ul data-testid="saved-list">{rows.map(r => <li key={r.id || r.query}>{r.name || r.query}</li>)}</ul>}
    </section>
  );
}
```
`client/src/App.jsx`: `const [tab, setTab] = useState('search')` + bottom nav buttons `data-testid="nav-search"`, `nav-saved`; Saved tab renders `<Saved/>`; call `logSearch(user, text)` inside `send()` when logged in.

- [ ] **Step 3: Build**

Run: `npm --prefix client run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/store.js client/src/Saved.jsx client/src/App.jsx
git commit -m "feat: favorites, reviews with offline queue, history"
```

---

### Task 6: Save plans + plan UI

**Files:**
- Create: `client/src/Plans.jsx`
- Modify: `client/src/App.jsx` (plan results section)

**Interfaces:**
- Consumes: `POST /api/plan` (Task 2), `supabase` (Task 3), `useAuth()`
- Produces: plan form (`plan-input`, `plan-hours`, `plan-build`), results (`plan-item`), save button (`plan-save`) writing to `plans` table or localStorage for guests

- [ ] **Step 1: RED via missing module** — import `Plans` in App.jsx before creating it; build FAILS.
- [ ] **Step 2: Implement** — `client/src/Plans.jsx`:
```jsx
import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { supabase } from './supabaseClient.js';
const BASE = import.meta.env.VITE_API_URL || '';
export default function Plans(){
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [hours, setHours] = useState(8);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  async function build(){
    setError('');
    const r = await fetch(`${BASE}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: input, hours: Number(hours) || 8 }) });
    if (!r.ok) { setError('Could not build plan'); return; }
    setPlan(await r.json());
  }
  async function save(){
    if (!plan) return;
    if (supabase && user) {
      await supabase.from('plans').insert({ user_id: user.id, title: plan.title, schedule: plan.schedule });
    } else {
      const all = JSON.parse(localStorage.getItem('lakbai-plans') || '[]');
      all.push({ ...plan, at: Date.now() });
      localStorage.setItem('lakbai-plans', JSON.stringify(all));
    }
  }
  return (
    <section>
      <h2>AI trip planner</h2>
      <input data-testid="plan-input" value={input} onChange={e => setInput(e.target.value)} placeholder="2-day Alaminos food trip" />
      <input data-testid="plan-hours" value={hours} onChange={e => setHours(e.target.value)} inputMode="numeric" aria-label="Hours" />
      <button data-testid="plan-build" onClick={build}>Build</button>
      {error && <p data-testid="notice">{error}</p>}
      {plan && <><h3>{plan.title}</h3><button data-testid="plan-save" onClick={save}>Save plan</button>
      <ol>{plan.schedule.map(s => <li key={s.placeId} data-testid="plan-item">{s.arrive}–{s.depart} {s.name}<ul>{(s.activities || []).map(a => <li key={a}>{a}</li>)}</ul></li>)}</ol></>}
    </section>
  );
}
```
Wire into App.jsx Saved tab or its own section (import + render).
- [ ] **Step 3: Build** — PASS.
- [ ] **Step 4: Commit** — `git add client/src/Plans.jsx client/src/App.jsx; git commit -m "feat: AI plan UI with save"`

---

### Task 7: Polish pass (design system + nav + states)

**Files:**
- Modify: `client/src/index.css`, `client/src/App.jsx`, `client/src/MapView.jsx`, `client/src/Panels.jsx`, `client/src/Saved.jsx`, `client/src/Plans.jsx`, `client/index.html` (title/meta only)
- Create: `design-system/lakbai/MASTER.md` (via ui-ux-pro-max persist)

**Interfaces:** none new — visual only, all testids preserved.

- [ ] **Step 1: Generate the system**

Run: `python .opencode/skills/ui-ux-pro-max/scripts/search.py "Philippines travel planner" --design-system --persist -p "Lakbai"`
Expected: `design-system/lakbai/MASTER.md` created; adopt its colors/tokens (keep orange/teal/sand identity).

- [ ] **Step 2: Restyle** — bottom nav, card design, spotlight treatment, Saved/Profile screens, empty/loading/error states per MASTER.md + plugin pre-delivery checklist (SVG icons, 4.5:1, focus, reduced-motion, 375/768/1024/1440).
- [ ] **Step 3: Build** — PASS.
- [ ] **Step 4: Commit** — `git add client design-system; git commit -m "style: full-app design system polish"`

---

### Task 8: RLS verification + acceptance + graph

**Files:** none (verification only)

- [ ] **Step 1: Full server suite** — `npm --prefix server test` → all PASS.
- [ ] **Step 2: Acceptance B1–B6** (needs Supabase keys in `.env` + SQL applied in dashboard) — run each flow at 375px; fix failures as bugs.
- [ ] **Step 3: Graph** — `graphify update .`.
- [ ] **Step 4: Commit anything pending** — exact paths only; verify `.env` untracked.
