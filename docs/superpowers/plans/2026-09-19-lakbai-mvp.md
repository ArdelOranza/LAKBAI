# Lakbai MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pangasinan-only, chat-first Lakbai MVP: chat → verified suggestions with wow reveal → Mapbox map + cards → itinerary, nearby, reviews, emergency.

**Architecture:** `client/` (Vite + React, Mapbox GL, design tokens) talks to `server/` (Node + Express). Server grounds via Gemini with Search, verifies every candidate via Mapbox Search Box API bbox-locked to Pangasinan, drops out-of-box hallucinations, and serves itinerary + emergency endpoints.

**Tech Stack:** Vite 6 + React 18, mapbox-gl, Node 20+ + Express 4 + cors + dotenv, Gemini `v1beta` REST (`gemini-2.0-flash`), Mapbox Search Box API v1. Server tests: `node --test`. Client verification: `npm run build` + acceptance flows A1–A8.

**Spec:** `docs/superpowers/specs/2026-09-19-lakbai-mvp-design.md`

## Global Constraints

- Pangasinan bbox: lng 119.7–120.7, lat 15.7–16.5; Mapbox param `bbox=119.7,15.7,120.7,16.5`.
- Default map center: `[120.23, 16.03]` (Lingayen), zoom `9.5`.
- Max 8 cards per answer; dedupe by `mapbox_id`.
- Anti-slop: no Mapbox-verified coords → no card; no invented ratings/hours; every place ≥1 source URL.
- Secrets in root `.env` (gitignored): `GEMINI_API_KEY`, `VITE_MAPBOX_TOKEN`, `PORT=3001`. Client reads only `VITE_` vars.
- Design tokens: `--primary:#EA580C; --secondary:#0891B2; --accent:#D97706; --bg:#FFF7ED; --ink:#0F172A; --card:#FFFFFF; --border:#FCEAE1`. Font: Inter or Plus Jakarta Sans via Google Fonts. SVG icons only, 4.5:1 contrast, visible focus, `prefers-reduced-motion` disables animation, layouts at 375/768/1024/1440.
- Every interactive element gets a `data-testid`. Server never logs keys.

## Review Focus

- Out-of-scope query ("Boracay") → friendly redirect, zero cards. Pinned in Task 5 tests.
- Gemini returns unparseable JSON → server retries once without tools, then 502 with clear message, never a crash or fake card. Pinned in Task 4 tests.
- Mapbox returns zero features for a candidate → candidate dropped silently, answer still returns remaining cards. Pinned in Task 5 tests.
- Browser GPS denied → map stays on Pangasinan default, notice shown, chat still works. Pinned in Task 10 tests (manual).
- Missing env keys → server 503 with clear message; client shows setup notice. Pinned in Task 2 tests.

---

### Task 1: Scaffold client (Vite + React + tokens)

**Files:**
- Create: `client/package.json`, `client/vite.config.js`, `client/index.html`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/index.css`
- Test: `client` production build

**Interfaces:**
- Consumes: `VITE_MAPBOX_TOKEN`, `VITE_API_URL` (default `http://localhost:3001`) from env
- Produces: running dev server on `5173`, CSS vars from Global Constraints, `<div data-testid="app">` root

- [ ] **Step 1: Scaffold and install**

Run: `npm create vite@latest client -- --template react` then `npm install --prefix client` then `npm install --prefix client mapbox-gl`
Expected: `client/` exists with `package.json`

- [ ] **Step 2: Write tokens + shell**

`client/src/index.css`:
```css
:root{
  --primary:#EA580C; --secondary:#0891B2; --accent:#D97706;
  --bg:#FFF7ED; --ink:#0F172A; --card:#FFFFFF; --border:#FCEAE1;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,"Plus Jakarta Sans",system-ui,sans-serif}
button{cursor:pointer}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
```

`client/src/App.jsx`:
```jsx
export default function App(){
  return (<div data-testid="app"><h1>Lakbai</h1><p data-testid="scope-note">Pangasinan only · MVP</p></div>);
}
```

- [ ] **Step 3: Proxy API URL + build**

`client/vite.config.js` must define `server.proxy` for `/api` → `http://localhost:3001` (so relative `/api/*` calls work in dev):
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins:[react()], server:{ proxy:{ '/api':'http://localhost:3001' } } });
```
(`@vitejs/plugin-react` ships with the template.)

Run: `npm --prefix client run build`
Expected: PASS, `client/dist/` created

- [ ] **Step 4: Commit**

```bash
git add client .gitignore
git commit -m "feat: scaffold Vite React client with Lakbai tokens"
```

---

### Task 2: Scaffold server + health + key guard

**Files:**
- Create: `server/package.json`, `server/index.js`, `server/places.js` (stub exporting `PANGASINAN_BBOX`), `server/test/health.test.js`
- Test: `node --test server/test/`

**Interfaces:**
- Consumes: root `.env` (`PORT`, `GEMINI_API_KEY`, `VITE_MAPBOX_TOKEN`)
- Produces: `GET /api/health` → `{ok:true}`; `GET /api/ready` → `{gemini:bool, mapbox:bool}` (503 if either key missing); exports `PANGASINAN_BBOX='119.7,15.7,120.7,16.5'`, `DEFAULT_CENTER=[120.23,16.03]` from `server/places.js`

- [ ] **Step 1: Write failing test**

`server/test/health.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('bbox constant matches spec', () => {
  const { PANGASINAN_BBOX, DEFAULT_CENTER } = require('../places.js');
  assert.equal(PANGASINAN_BBOX, '119.7,15.7,120.7,16.5');
  assert.deepEqual(DEFAULT_CENTER, [120.23, 16.03]);
});
```
`server/package.json`: `{ "name":"lakbai-server", "type":"commonjs", "scripts":{ "start":"node index.js", "test":"node --test test/" }, "dependencies":{ "cors":"^2.8.5", "dotenv":"^16.4.5", "express":"^4.21.2" } }`

Run: `npm --prefix server test`
Expected: FAIL (`../places.js` missing)

- [ ] **Step 2: Minimal implementation**

`server/places.js`:
```js
const PANGASINAN_BBOX = '119.7,15.7,120.7,16.5';
const DEFAULT_CENTER = [120.23, 16.03];
module.exports = { PANGASINAN_BBOX, DEFAULT_CENTER };
```
`server/index.js`:
```js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/ready', (req, res) => {
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const mapbox = Boolean(process.env.VITE_MAPBOX_TOKEN);
  if (!gemini || !mapbox) return res.status(503).json({ gemini, mapbox, error: 'Missing API key(s). Set GEMINI_API_KEY and VITE_MAPBOX_TOKEN in root .env.' });
  res.json({ gemini, mapbox });
});
const PORT = process.env.PORT || 3001;
if (require.main === module) app.listen(PORT, () => console.log('Lakbai server on ' + PORT));
module.exports = app;
```

Run: `npm --prefix server install` then `npm --prefix server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server
git commit -m "feat: express server with health, ready, Pangasinan constants"
```

---

### Task 3: GET /api/places (Mapbox proxy, bbox-locked)

**Files:**
- Modify: `server/places.js` (add `searchPlaces`, `inBox`), `server/index.js` (mount route)
- Test: `server/test/places.test.js`

**Interfaces:**
- Consumes: `VITE_MAPBOX_TOKEN`
- Produces: `GET /api/places?q=&proximity=lng,lat&types=` → `{places:[{id,name,address,lng,lat,categories}]}`; `searchPlaces(q, proximity)`; `inBox(lng,lat)` bool

- [ ] **Step 1: Write the failing test**

`server/test/places.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inBox } = require('../places.js');
test('inBox accepts Alaminos, rejects Boracay', () => {
  assert.equal(inBox(119.98, 16.15), true);
  assert.equal(inBox(120.58, 11.97), false);
});
```

Run: `npm --prefix server test`
Expected: FAIL (`inBox` not defined)

- [ ] **Step 2: Implement**

Append to `server/places.js`:
```js
function inBox(lng, lat){
  return lng >= 119.7 && lng <= 120.7 && lat >= 15.7 && lat <= 16.5;
}
async function searchPlaces(q, proximity){
  const token = process.env.VITE_MAPBOX_TOKEN;
  if (!token) { const e = new Error('Missing VITE_MAPBOX_TOKEN'); e.status = 503; throw e; }
  const params = new URLSearchParams({
    q, language: 'en', limit: '8',
    bbox: PANGASINAN_BBOX,
    proximity: proximity || DEFAULT_CENTER.join(','),
    access_token: token
  });
  const r = await fetch('https://api.mapbox.com/search/searchbox/v1/forward?' + params);
  if (!r.ok) { const e = new Error('Mapbox error ' + r.status); e.status = 502; throw e; }
  const data = await r.json();
  const seen = new Set();
  const places = [];
  for (const f of (data.features || [])){
    const id = f.properties && f.properties.mapbox_id;
    const [lng, lat] = (f.geometry && f.geometry.coordinates) || [];
    if (!id || lng === undefined || !inBox(lng, lat) || seen.has(id)) continue;
    seen.add(id);
    places.push({
      id, lng, lat,
      name: f.properties.name,
      address: f.properties.full_address || f.properties.address || '',
      categories: (f.properties.poi_category || []).concat(f.properties.category || []).filter(Boolean)
    });
  }
  return places;
}
module.exports = { PANGASINAN_BBOX, DEFAULT_CENTER, inBox, searchPlaces };
```
In `server/index.js` before `app.listen` block:
```js
const { searchPlaces } = require('./places.js');
app.get('/api/places', async (req, res) => {
  try {
    const places = await searchPlaces(req.query.q || '', req.query.proximity);
    res.json({ places });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
```

Run: `npm --prefix server test`
Expected: PASS

- [ ] **Step 3: Live check (real API)**

Run: `node -e "require('dotenv').config();require('./server/places.js').searchPlaces('Hundred Islands',null).then(p=>console.log(p.length,(p[0]||{}).name))"` from repo root
Expected: prints a count ≥1 and a name (proves real Mapbox wiring)

- [ ] **Step 4: Commit**

```bash
git add server
git commit -m "feat: bbox-locked Mapbox places proxy"
```

---

### Task 4: POST /api/chat (Gemini grounded, strict JSON)

**Files:**
- Create: `server/agent.js`, `server/test/agent.test.js`
- Modify: `server/index.js` (mount route)

**Interfaces:**
- Consumes: `GEMINI_API_KEY`; exports `chatRecommend(message)` → `{intent, answer, candidates:[{name,hint,reason}], spotlight:{name,reason}|null, sources:[urls]}`
- Produces: `POST /api/chat {message}` → same object (candidates unverified here; verification is Task 5)

- [ ] **Step 1: Write the failing test**

`server/test/agent.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAgentJson } = require('../agent.js');
test('parseAgentJson extracts JSON with sources', () => {
  const raw = '```json\n{"intent":"food","answer":"Try Patar beach.","candidates":[{"name":"Patar Beach","hint":"Bolinao","reason":"White sand, real reviews"}],"spotlight":null,"sources":["https://example.com"]}\n```';
  const out = parseAgentJson(raw);
  assert.equal(out.intent, 'food');
  assert.equal(out.candidates.length, 1);
  assert.deepEqual(out.sources, ['https://example.com']);
});
test('parseAgentJson throws on garbage', () => {
  assert.throws(() => parseAgentJson('no json here at all!!!'), /Could not parse/);
});
```

Run: `npm --prefix server test`
Expected: FAIL (`../agent.js` missing)

- [ ] **Step 2: Implement**

`server/agent.js`:
```js
const MODEL = 'gemini-2.0-flash';
const SYSTEM = `You are Lakbai, a Pangasinan (Philippines) travel guide. Scope: ONLY Pangasinan province. Out-of-scope requests get intent "redirect" with an empty candidates list and a friendly redirect in answer. Never invent places, ratings, hours, or prices. Respond with JSON only: {"intent":"discover|food|event|itinerary|nearby|emergency|redirect","answer":"short markdown","candidates":[{"name":"exact place name","hint":"town or barangay","reason":"one grounded why"}],"spotlight":{"name":"...","reason":"..."}|null,"sources":["url"]}. Max 8 candidates. Spotlight = one non-obvious hidden gem from candidates, else null.`;
function parseAgentJson(raw){
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) throw Object.assign(new Error('Could not parse agent JSON'), { status: 502 });
  const obj = JSON.parse(m[0]);
  if (!obj.intent || !Array.isArray(obj.candidates) || !Array.isArray(obj.sources)) {
    throw Object.assign(new Error('Could not parse agent JSON'), { status: 502 });
  }
  return obj;
}
async function callGemini(payload, useTools){
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('Missing GEMINI_API_KEY'); e.status = 503; throw e; }
  const body = { system_instruction: { parts: [{ text: SYSTEM }] }, contents: [{ parts: [{ text: payload }] }], generationConfig: { responseMimeType: 'application/json' } };
  if (useTools) body.tools = [{ google_search: {} }];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!r.ok) { const e = new Error('Gemini error ' + r.status); e.status = r.status === 400 ? 400 : 502; throw e; }
  const data = await r.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}
async function chatRecommend(message){
  const payload = `User request (Pangasinan, Philippines): ${message}`;
  try {
    return parseAgentJson(await callGemini(payload, true));
  } catch (e) {
    if (e.status === 400) return parseAgentJson(await callGemini(payload, false));
    throw e;
  }
}
module.exports = { chatRecommend, parseAgentJson };
```
Mount in `server/index.js`:
```js
const { chatRecommend } = require('./agent.js');
app.post('/api/chat', async (req, res) => {
  try {
    res.json(await chatRecommend(req.body.message || ''));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
```

Run: `npm --prefix server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server
git commit -m "feat: Gemini grounded chat agent with strict JSON"
```

---

### Task 5: Verify pipeline (chat → Mapbox → cards, slop gate)

**Files:**
- Create: `server/verify.js`, `server/test/verify.test.js`
- Modify: `server/index.js` (`POST /api/recommend`)

**Interfaces:**
- Consumes: `chatRecommend` (agent.js), `searchPlaces` + `inBox` (places.js)
- Produces: `POST /api/recommend {message, proximity?}` → `{intent, answer, places:[{id,name,address,lng,lat,categories,reason,sources}], spotlight:{...place} | null}` — every place Mapbox-verified inside bbox, deduped, ≤8; `redirect` intent → `{intent:'redirect', answer, places:[]}`

- [ ] **Step 1: Write the failing test**

`server/test/verify.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('redirect intent returns zero places', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'redirect', answer: 'Try Pangasinan instead!', candidates: [{ name: 'Boracay' }], spotlight: null, sources: [] });
  const out = await recommend('Boracay?', null, { chatFn: fakeChat, searchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(out.intent, 'redirect');
  assert.deepEqual(out.places, []);
});
test('out-of-box candidates are dropped', async () => {
  const { recommend } = require('../verify.js');
  const fakeChat = async () => ({ intent: 'food', answer: 'a', candidates: [{ name: 'Boracay', reason: 'x' }], spotlight: null, sources: ['https://s.com'] });
  const fakeSearch = async (name) => name === 'Boracay'
    ? [{ id: 'b1', name: 'Boracay', lng: 120.58, lat: 11.97, address: '', categories: [] }]
    : [];
  const out = await recommend('food?', null, { chatFn: fakeChat, searchFn: fakeSearch });
  assert.deepEqual(out.places, []);
});
```

Run: `npm --prefix server test`
Expected: FAIL (`../verify.js` missing)

- [ ] **Step 2: Implement**

`server/verify.js`:
```js
const { chatRecommend } = require('./agent.js');
const { searchPlaces, inBox } = require('./places.js');
async function recommend(message, proximity, deps = {}) {
  const chatFn = deps.chatFn || chatRecommend;
  const searchFn = deps.searchFn || searchPlaces;
  const agent = await chatFn(message);
  if (agent.intent === 'redirect' || !agent.candidates.length) {
    return { intent: agent.intent, answer: agent.answer, places: [], spotlight: null };
  }
  const seen = new Set();
  const places = [];
  for (const c of agent.candidates.slice(0, 8)) {
    const hits = await searchFn(`${c.name} ${c.hint || ''} Pangasinan`, proximity);
    const hit = hits.find(h => inBox(h.lng, h.lat) && !seen.has(h.id));
    if (!hit) continue;
    seen.add(hit.id);
    places.push({ ...hit, reason: c.reason || '', sources: agent.sources || [] });
    if (places.length >= 8) break;
  }
  let spotlight = null;
  if (agent.spotlight) {
    spotlight = places.find(p => p.name.toLowerCase().includes(agent.spotlight.name.toLowerCase().split(' ')[0])) || null;
  }
  return { intent: agent.intent, answer: agent.answer, places, spotlight };
}
module.exports = { recommend };
```
Mount in `server/index.js`:
```js
const { recommend } = require('./verify.js');
app.post('/api/recommend', async (req, res) => {
  try {
    res.json(await recommend(req.body.message || '', req.body.proximity));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
```

Run: `npm --prefix server test`
Expected: PASS (all suites, incl. redirect + drop tests)

- [ ] **Step 3: Commit**

```bash
git add server
git commit -m "feat: verified recommend pipeline with slop gate"
```

---

### Task 6: POST /api/itinerary (time-budget scheduler)

**Files:**
- Create: `server/itinerary.js`, `server/test/itinerary.test.js`
- Modify: `server/index.js` (mount route)

**Interfaces:**
- Consumes: places array `{id,name,lng,lat}`
- Produces: `POST /api/itinerary {places, hours, startHour=9}` → `{schedule:[{placeId,name,arrive,depart}]}` — 90 min per stop + 30 min travel, HH:MM 24h strings, stops cut to fit hours

- [ ] **Step 1: Write the failing test**

`server/test/itinerary.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildItinerary } = require('../itinerary.js');
test('4 hours fits 2 stops starting 09:00', () => {
  const places = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const out = buildItinerary(places, 4, 9);
  assert.equal(out.schedule.length, 2);
  assert.equal(out.schedule[0].arrive, '09:00');
  assert.equal(out.schedule[0].depart, '10:30');
  assert.equal(out.schedule[1].arrive, '11:00');
});
```

Run: `npm --prefix server test`
Expected: FAIL (`../itinerary.js` missing)

- [ ] **Step 2: Implement**

`server/itinerary.js`:
```js
const STOP_MIN = 90, TRAVEL_MIN = 30;
function fmt(totalMin){
  const h = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const m = String(totalMin % 60).padStart(2, '0');
  return `${h}:${m}`;
}
function buildItinerary(places, hours, startHour = 9){
  const budget = Math.max(1, hours) * 60;
  let cursor = startHour * 60;
  const end = cursor + budget;
  const schedule = [];
  for (const p of places) {
    if (cursor + STOP_MIN > end) break;
    schedule.push({ placeId: p.id, name: p.name, arrive: fmt(cursor), depart: fmt(cursor + STOP_MIN) });
    cursor += STOP_MIN + TRAVEL_MIN;
  }
  return { schedule };
}
module.exports = { buildItinerary };
```
Mount in `server/index.js`:
```js
const { buildItinerary } = require('./itinerary.js');
app.post('/api/itinerary', (req, res) => {
  const { places = [], hours = 4, startHour = 9 } = req.body || {};
  res.json(buildItinerary(places, Number(hours) || 4, Number(startHour) || 9));
});
```

Run: `npm --prefix server test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server
git commit -m "feat: time-budget itinerary scheduler"
```

---

### Task 7: GET /api/emergency + static hotlines

**Files:**
- Modify: `server/index.js` (route), `server/test/` add `emergency.test.js` with injected search

**Interfaces:**
- Consumes: `searchPlaces`
- Produces: `GET /api/emergency?proximity=lng,lat` → `{hospitals:[places], police:[places], hotlines:[{name,number}]}` — hospitals/police are bbox-verified; hotlines static: `[{name:'Pangasinan PDRRMO',number:'(075) 542-6802'},{name:'National Emergency',number:'911'}]`

- [ ] **Step 1: Write the failing test**

`server/test/emergency.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('hotlines always present', async () => {
  const app = require('../index.js');
  const server = app.listen(0);
  await new Promise(r => server.on('listening', r));
  const port = server.address().port;
  const r = await fetch(`http://localhost:${port}/api/emergency?proximity=120.23,16.03`);
  const body = await r.json();
  server.close();
  assert.ok(Array.isArray(body.hotlines) && body.hotlines.length >= 2);
  assert.ok(Array.isArray(body.hospitals) && Array.isArray(body.police));
});
```

Run: `npm --prefix server test`
Expected: FAIL (route missing → 404 HTML, `body.hotlines` undefined)

- [ ] **Step 2: Implement**

In `server/index.js`:
```js
const HOTLINES = [
  { name: 'Pangasinan PDRRMO', number: '(075) 542-6802' },
  { name: 'National Emergency', number: '911' }
];
app.get('/api/emergency', async (req, res) => {
  try {
    const proximity = req.query.proximity;
    const [hospitals, police] = await Promise.all([
      searchPlaces('hospital', proximity),
      searchPlaces('police station', proximity)
    ]);
    res.json({ hospitals: hospitals.slice(0, 5), police: police.slice(0, 5), hotlines: HOTLINES });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
```

Run: `npm --prefix server test`
Expected: PASS (hits real Mapbox; hospitals/police near Lingayen exist)

- [ ] **Step 3: Commit**

```bash
git add server
git commit -m "feat: emergency hospitals, police, hotlines"
```

---

### Task 8: Client map + chat + reveal (wow)

**Files:**
- Create: `client/src/api.js`, `client/src/MapView.jsx`, modify `client/src/App.jsx`
- Test: production build + manual A1–A3

**Interfaces:**
- Consumes: `/api/recommend`, `/api/itinerary`, `VITE_MAPBOX_TOKEN`, `VITE_API_URL`
- Produces: chat sends → shimmer status → staggered cards + `flyTo` tour; card tap flies to pin; `data-testid`s: `chat-input`, `chat-send`, `search-status`, `place-card`, `spotlight`, `map`

- [ ] **Step 1: API client**

`client/src/api.js`:
```js
const BASE = import.meta.env.VITE_API_URL || '';
export async function recommend(message, proximity){
  const r = await fetch(`${BASE}/api/recommend`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message, proximity }) });
  if (!r.ok) throw new Error((await r.json()).error || 'request failed');
  return r.json();
}
export async function itinerary(places, hours){
  const r = await fetch(`${BASE}/api/itinerary`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ places, hours }) });
  return r.json();
}
```

- [ ] **Step 2: Map + chat UI**

`client/src/MapView.jsx`:
```jsx
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
export default function MapView({ places, focus }){
  const divRef = useRef(null), mapRef = useRef(null), markers = useRef([]);
  useEffect(() => {
    mapRef.current = new mapboxgl.Map({ container: divRef.current, style: 'mapbox://styles/mapbox/streets-v12', center: [120.23, 16.03], zoom: 9.5 });
    return () => mapRef.current.remove();
  }, []);
  useEffect(() => {
    markers.current.forEach(m => m.remove()); markers.current = [];
    places.forEach((p, i) => {
      const m = new mapboxgl.Marker().setLngLat([p.lng, p.lat]).addTo(mapRef.current);
      markers.current.push(m);
      if (i < 3) setTimeout(() => mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 12 }), i * 900);
    });
  }, [places]);
  useEffect(() => { if (focus) mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 13 }); }, [focus]);
  return <div data-testid="map" ref={divRef} style={{ height: 320 }} />;
}
```
`App.jsx`: chat state (`messages`, `places`, `spotlight`, `status`, `focus`), `send()` calls `recommend()`, renders `MapView`, spotlight card (`data-testid="spotlight"`), cards (`data-testid="place-card"`, staggered via inline `animationDelay`, `prefers-reduced-motion` handled by CSS), reason chips, source links, "add to itinerary" buttons collecting into state.

- [ ] **Step 3: Build**

Run: `npm --prefix client run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client
git commit -m "feat: chat, map flyTo tour, staggered cards"
```

---

### Task 9: Itinerary panel + nearby GPS + reviews + emergency UI

**Files:**
- Modify: `client/src/App.jsx` (or new `Panels.jsx` — one file, imported by App)
- Test: build + manual A4–A7

**Interfaces:**
- Consumes: Task 8 state + `itinerary()` from api.js, `/api/emergency`, `localStorage`
- Produces: `data-testid`s: `hours-input`, `itinerary-build`, `itinerary-item`, `nearby-btn`, `review-form`, `review-item`, `emergency-panel`

- [ ] **Step 1: Build panels** — hours input + Build button → `itinerary(selected, hours)` → ordered `itinerary-item`s with arrive/depart:
```jsx
const [hours, setHours] = useState(4);
const [schedule, setSchedule] = useState([]);
async function buildPlan(){
  const out = await itinerary(selected, Number(hours) || 4);
  setSchedule(out.schedule);
}
// <input data-testid="hours-input" value={hours} onChange={e=>setHours(e.target.value)} />
// <button data-testid="itinerary-build" onClick={buildPlan}>Build</button>
// {schedule.map(s => <li key={s.placeId} data-testid="itinerary-item">{s.name} {s.arrive}–{s.depart}</li>)}
```
Nearby button → GPS → recommend with proximity; denial falls back with notice:
```jsx
function nearby(){
  navigator.geolocation.getCurrentPosition(
    pos => recommend('nearby attractions and restaurants', `${pos.coords.longitude},${pos.coords.latitude}`).then(applyResults),
    () => setNotice('GPS unavailable — showing Pangasinan')
  );
}
// <button data-testid="nearby-btn" onClick={nearby}>Nearby</button>
```
Reviews per place, persisted to localStorage:
```jsx
function useReviews(placeId){
  const key = 'lakbai-reviews:' + placeId;
  const [reviews, setReviews] = useState(() => JSON.parse(localStorage.getItem(key) || '[]'));
  function add(score, text){
    const next = [...reviews, { score, text, at: Date.now() }];
    setReviews(next); localStorage.setItem(key, JSON.stringify(next));
  }
  return { reviews, add };
}
// form: <form data-testid="review-form"> score 1–5 + text; list: <li data-testid="review-item">
```
Emergency panel:
```jsx
const [emer, setEmer] = useState(null);
useEffect(() => { fetch(`${BASE}/api/emergency?proximity=120.23,16.03`).then(r=>r.json()).then(setEmer); }, []);
// <section data-testid="emergency-panel"> hospitals, police, hotlines </section>
```

- [ ] **Step 2: Build**

Run: `npm --prefix client run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client
git commit -m "feat: itinerary, nearby GPS, reviews, emergency panels"
```

---

### Task 10: Acceptance, graphify, done

**Files:** none (verification only)

- [ ] **Step 1: Run full server suite** — `npm --prefix server test` → all PASS.
- [ ] **Step 2: Manual acceptance A1–A8** — start server (`npm --prefix server start`) + client (`npm --prefix client run dev`), run flows A1–A8 from spec §10 on a phone-width viewport (375px). Fix failures as bugs (systematic-debugging), re-run.
- [ ] **Step 3: Update graph** — `graphify update .` (AST-only, no API cost).
- [ ] **Step 4: Commit anything pending** — `git add -A` (verify `.env` stays untracked: `git status --short | Select-String ".env"` must print nothing) + commit.
