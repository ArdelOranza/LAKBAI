# LakbAI Redesign + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the LakbAI client to the approved blue mobile mockups (Splash → SignUp → LogIn → Preferences → 5-tab app: Home/Map/Chat/Saved/Profile + pushed detail/search/itinerary screens) and ship it as an installable, offline-capable PWA, with server-side caching so Gemini quota is not exhausted.

**Architecture:** Vite + React client keeps its Supabase/Mapbox/Gemini server. New presentational components live in `client/src/screens/`, pure logic (geo, prefs, filters, plan status) in small testable modules, UI primitives (Toast, TabBar, chips, logo) in `client/src/ui.jsx`. `App.jsx` becomes a tiny view-stack router driven by state — no router dependency. Server gains one Open-Meteo weather route and a TTL memory cache around every AI-backed route.

**Tech Stack:** React 19, Vite 8, @vitejs/plugin-react, supabase-js v2, **Tailwind CSS v4 + shadcn/ui + mapcn (maplibre-gl over free CARTO basemap tiles — no map token for the map display)**, vitest (new, node/happy-dom), vite-plugin-pwa + sharp (new, icons), Node `node:test` for server. Server keeps Mapbox REST for place search (`server/places.js` — untouched).

**Spec:** `docs/superpowers/specs/2026-10-29-lakbai-redesign-pwa-design.md`

## Global Constraints

- **Locked scope:** Pangasinan province only. Never edit `PANGASINAN_BBOX`, `inBox`, `DEFAULT_CENTER`, or the redirect gate in `server/places.js` / `server/verify.js`.
- **AI budget:** every AI-backed route (`/api/recommend`, `/api/chat`, `/api/plan`) MUST be wrapped in the TTL cache from Task 7. The client MUST cache results in `sessionStorage` (Task 8 helper). Tests MUST NOT hit Gemini/DeepSeek. One Generated Itinerary per Save-tab flow; re-entering it reuses the session cache.
- **Colors (exact):** primary `#1667D9`; logo/gradient `#2280E8 → #0A3D8F`; header ink `#0A2540`; soft chip bg `#EFF6FF`; emergency/star accent `#EA580C`; border `#E2E8F0`; muted ink `#64748B`.
- **Fonts:** Inter via `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap')`, `system-ui` fallback.
- **No new UI/router/state framework** — the one exception is the map: **Tailwind CSS v4 + shadcn/ui + mapcn (`@mapcn/map`, maplibre-gl)** are added for it, using **npm** (not pnpm). Remove the `mapbox-gl` client dependency once the map is swapped. MapLibre Web Worker is **self-hosted** in `public/` (`maplibre-gl-worker.mjs` + `maplibre-gl-shared.mjs` side by side, `lib.setWorkerUrl("/maplibre-gl-worker.mjs")`) — under a strict CSP that means `script-src 'self' ...` and `worker-src 'self' blob:` entries, and both files are SW-precached for offline. Server keeps Mapbox REST for `server/places.js` place search and the Mapbox geocoding REST call for the Home location line.
- **Mobile-first:** layouts target 360–430 px, `#root` capped at 430 px centered, bottom tab bar padded with `env(safe-area-inset-bottom)`.
- **Preserve test IDs** already used by screens (`login-email`, `chat-input`, `chat-send`, `saved-list`, `plan-build`, etc.) wherever those elements survive.
- Server tests: `node --test "test/*.test.js"` from `server/`. Client tests: `npm run test` from `client/`.

## Review Focus

These inputs/conditions the spec implies but no single screen's happy path exercises. Each is pinned by a test in the owning task.

1. **No GPS / permission denied / offline mount** — Home, Map and Saved must still render with fallback center `120.23,16.03` and Pangasinan defaults, never a blank screen. → pinned in Task 8 (`geoFallback` assertion) and Task 10 (MapTab renders on CARTO tiles with fallback center when GPS is denied).
2. **AI busy (429/503) or network error** — user sees a toast (never a crash), and the server's cache returns the previously-good result for the same key instead of failing. → pinned in Task 7 (`cached` stale-on-error test).
3. **Favorites/places with missing `lng`/`lat` or missing photo** — distance line is hidden, itinerary sorting places them last, image falls back to a gradient tile, no `NaN km`. → pinned in Task 8 (distance util test) and Task 11 (sort test).
4. **Duplicate / offline saves** — saving the same place twice upserts silently (unique `user_id,place_id`); reviews and favorite-deletions made offline are queued in the outbox and flush on reconnect. → pinned in Task 11 (outbox round-trip test).
5. **Plans with null `starts_at`** (rows saved before the migration or without a date) — show no status badge, appear in **All** filter only, never counted as Past or Active. → pinned in Task 3 (`planStatus(null)`).

---

### Task 1: Brand foundation — tokens, fonts, logo, UI primitives

**Files:**
- Modify: `client/src/index.css` (full rewrite)
- Create: `client/src/logo.jsx`
- Create: `client/src/ui.jsx`
- Create: `client/public/logo.svg`
- Modify: `client/index.html` (title, theme-color placeholder meta)
- Modify: `design-system/lakbai/MASTER.md` (color table + button spec to blue)

**Interfaces:**
- Produces: `export default function Logo({ size = 40, withWordmark = false })` from `logo.jsx`; from `ui.jsx`: `Toast({ toast, onClose })` (renders nothing when `toast` is null; props `{ text, kind }`), `TabBar({ tab, onTab })` (items `home|map|chat|saved|profile`), `Chip({ active, onClick, children })`, `PrimaryBtn({ children, onClick, wide, disabled })`, `ScreenTitle({ title, sub })`.

- [ ] **Step 1: Rewrite `client/src/index.css` with blue tokens**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root{
  --primary:#1667D9; --primary-strong:#0A3D8F; --grad-a:#2280E8; --grad-b:#0A3D8F;
  --ink:#0A2540; --muted-ink:#64748B; --bg:#FFFFFF; --chip:#EFF6FF; --chip-on:#1667D9;
  --accent:#EA580C; --border:#E2E8F0; --card:#FFFFFF; --radius:16px;
  --shadow:0 10px 24px -12px rgba(10,37,64,.18);
  --safe-bottom:env(safe-area-inset-bottom,0px);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%}
body{margin:0;background:#F8FAFC;color:var(--ink);font-family:Inter,system-ui,sans-serif;line-height:1.5}
#root{max-width:430px;margin:0 auto;min-height:100dvh;background:var(--bg);display:flex;flex-direction:column;position:relative}
h1{font-size:26px;font-weight:800;letter-spacing:-.6px;margin:16px 0 4px}
h2{font-size:20px;margin:16px 0 8px}
h3{font-size:17px;margin:12px 0 4px}
p{margin:8px 0}
button{cursor:pointer;font:inherit;background:var(--card);color:var(--ink);border:1px solid var(--border);border-radius:999px;padding:10px 16px;transition:transform .15s ease,background .15s ease}
button:hover{background:#F1F5F9}
button:active{transform:scale(.97)}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
button:disabled{opacity:.55;cursor:not-allowed}
input,select,textarea{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;width:100%}
a{color:var(--primary);text-decoration:none}
.pane{padding:0 20px}
.primary-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;border-radius:999px;border:none;background:var(--primary);color:#fff;font-weight:600;font-size:16px;box-shadow:0 8px 20px -8px rgba(22,103,217,.5)}
.primary-btn:hover{background:var(--primary-strong)}
.chip{border-radius:999px;border:1px solid var(--border);padding:9px 15px;font-size:14px;background:#fff;color:var(--ink)}
.chip.active{background:var(--chip-on);border-color:var(--chip-on);color:#fff}
.tabbar{position:sticky;bottom:0;z-index:20;display:flex;justify-content:space-around;align-items:center;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-top:1px solid var(--border);padding:8px 8px calc(8px + var(--safe-bottom));margin-top:auto}
.tabbar button{background:none;border:none;display:flex;flex-direction:column;gap:2px;align-items:center;color:var(--muted-ink);font-size:10px;font-weight:600;padding:6px 14px;border-radius:14px}
.tabbar button.active{color:var(--primary)}
.tabbar button.active .tabdot{width:34px;height:34px;border-radius:12px;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff}
.toast{position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:99;max-width:390px;background:#F8FAFF;border:1px solid #DBEAFE;border-radius:16px;box-shadow:var(--shadow);padding:14px 16px;display:flex;gap:10px;font-size:14px;color:var(--ink)}
.toast .tick{flex:0 0 30px;height:30px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center}
.toast.error .tick{background:var(--accent)}
.toast button{background:none;border:none;padding:2px;color:var(--muted-ink)}
@keyframes shimmer{0%{opacity:.45}50%{opacity:1}100%{opacity:.45}}
.shimmer{animation:shimmer 1.2s ease-in-out infinite;color:var(--primary);font-weight:600}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
```

- [ ] **Step 2: Create `client/src/logo.jsx`** — rounded-square gradient mark with white "A" and blue pill, matching `svgviewer-output(7).svg`:

```jsx
export default function Logo({ size = 40, withWordmark = false }){
  const mark = (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={withWordmark ? 'lgw' : 'lg'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2280E8"/><stop offset="1" stopColor="#0A3D8F"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="34" fill={`url(#${withWordmark ? 'lgw' : 'lg'})`}/>
      <path fill="#fff" d="M36 104 C35 86 45 27 49 21 Q51 18 60 18 Q69 18 71 21 C75 27 85 86 84 104 L68 104 C68 96 70 62 66 54 Q65 51 60 51 Q55 51 54 54 C50 62 52 96 52 104 Z"/>
      <rect x="53" y="30" width="14" height="26" rx="7" fill="#1667D9"/>
    </svg>
  );
  if (!withWordmark) return mark;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      {mark}
      <div>
        <div style={{ fontWeight:800, fontSize:size*0.9, color:'var(--ink)', lineHeight:1 }}>LakbAI</div>
        <div style={{ fontSize:11, color:'var(--muted-ink)', marginTop:2 }}>Lakbai, smarter, not harder.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `client/src/ui.jsx`** with primitives:

```jsx
export function Toast({ toast, onClose }){
  if (!toast) return null;
  return (
    <div role="status" data-testid="toast" className={'toast ' + (toast.kind || '')}>
      <span className="tick">{toast.kind === 'error' ? '!' : '✓'}</span>
      <span style={{ flex:1 }}>
        <b>{toast.text}</b>
        {toast.detail && <div style={{ color:'var(--muted-ink)' }}>{toast.detail}</div>}
      </span>
      <button onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}
const TAB_ITEMS = [
  ['home','Home'],['map','Map'],['chat','Chat'],['saved','Saved'],['profile','Profile']
];
export function TabBar({ tab, onTab }){
  return (
    <nav className="tabbar" aria-label="Main">
      {TAB_ITEMS.map(([id,label]) => (
        <button key={id} data-testid={'nav-' + id} className={tab === id ? 'active' : ''} aria-current={tab === id} onClick={() => onTab(id)}>
          <span className={tab === id ? 'tabdot' : ''}><TabIcon id={id}/></span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
function TabIcon({ id }){
  const p = { width:20, height:20, fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' };
  if (id === 'home') return <svg {...p} viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>;
  if (id === 'map') return <svg {...p} viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>;
  if (id === 'chat') return <svg {...p} viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>;
  if (id === 'saved') return <svg {...p} viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2"/></svg>;
  return <svg {...p} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"/></svg>;
}
export function Chip({ active, onClick, children }){
  return <button type="button" className={'chip' + (active ? ' active' : '')} onClick={onClick}>{children}</button>;
}
export function PrimaryBtn({ children, onClick, wide, disabled, testid }){
  return <button data-testid={testid} className={'primary-btn' + (wide ? ' wide' : '')} onClick={onClick} disabled={disabled}>{children}</button>;
}
```

- [ ] **Step 4: Update `client/index.html`** — `<title>LakbAI</title>`, `<meta name="theme-color" content="#0B3E8F"/>`, keep charset/viewport (viewport gets `viewport-fit=cover` in Task 14; adding it now is fine and harmless: set it now).

- [ ] **Step 5: Create standalone `client/public/logo.svg`** — same artwork as the JSX (static copy for icons/fallback favicon; replace current favicon.svg contents with the mark).

- [ ] **Step 6: Update `design-system/lakbai/MASTER.md`** — color table: Primary `#1667D9`, Background `#FFFFFF`, Foreground `#0A2540`, Border `#E2E8F0`, Accent `#EA580C`; Typography → Inter (body + headings); button CSS background `#1667D9`.

- [ ] **Step 7: Verify** — from `client/`: `npm run build` passes; `npm run preview` and open in browser: white canvas, max 430 px column even when window is wide.

- [ ] **Step 8: Commit** — `git add client/src/index.css client/src/logo.jsx client/src/ui.jsx client/public/logo.svg client/index.html design-system/lakbai/MASTER.md && git commit -m "feat(client): blue LakbAI brand tokens, logo, UI primitives"`

---

### Task 2: Client test rig + pure geo/sun utilities

**Files:**
- Create: `client/src/geo.js`
- Test: `client/src/geo.test.js` (new vitest run)
- Modify: `client/package.json` (devDeps + scripts)

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces (used by Tasks 8–12): `haversineKm(lng1, lat1, lng2, lat2) → number|null` (null if any arg is not a finite number); `driveMinutes(km) → int|null` (km/40 h, min 1); `sunsetUTC(lng, lat, date) → minutes-since-UTC-midnight (number)`; `formatClock(utcMinutes, lng) → "5:15 PM"` (UTC minute set → Date; device-locale 12h time); `timeHint(category, sunsetStr) → string` (beaches → `Optimal sunset: ${sunsetStr}`; food/café → `Ideal dinner: 6:30 PM`; else empty string).

- [ ] **Step 1: Add test rig** — from `client/`: `npm install -D vitest`, and in `package.json` scripts add `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test (`client/src/geo.test.js`)**

```js
import { describe, it, expect } from 'vitest';
import { haversineKm, driveMinutes, sunsetUTC, timeHint } from './geo.js';
describe('haversineKm', () => {
  it('computes a known short distance', () => {
    expect(haversineKm(120.0876, 16.1617, 120.2899, 16.0327)).toBeCloseTo(25.3, 0); // Alaminos ≈ Dagupan
  });
  it('returns null on missing coordinates (no NaN reaches the UI)', () => {
    expect(haversineKm(120.2, 16.0, undefined, 16.1)).toBeNull();
  });
});
describe('driveMinutes', () => {
  it('40 km/h heuristic, minimum 1', () => {
    expect(driveMinutes(40)).toBe(60); expect(driveMinutes(0.1)).toBe(1); expect(driveMinutes(undefined)).toBeNull();
  });
});
describe('sunsetUTC', () => {
  it('Bolinao 2026-10-29 sunset ≈ 10:0x UTC (≈6:0x PM PHT), within ±30 min', () => {
    const m = sunsetUTC(120.23, 16.03, new Date('2026-10-29T00:00:00Z'));
    expect(m).toBeGreaterThan(570); expect(m).toBeLessThan(630);
  });
});
describe('timeHint', () => {
  it('beaches get sunset hint, dining gets dinner window, others empty', () => {
    expect(timeHint('Beach / Coastal', '5:46 PM')).toBe('Optimal sunset: 5:46 PM');
    expect(timeHint('Restaurant', '')).toBe('Ideal dinner: 6:30 PM');
    expect(timeHint('Park', '')).toBe('');
  });
});
```

- [ ] **Step 3: Run** `npm run test` from `client/` — Expected: FAIL, `Cannot find module './geo.js'`.

- [ ] **Step 4: Implement `client/src/geo.js`**

```js
const DEG = Math.PI / 180;
export function haversineKm(lng1, lat1, lng2, lat2){
  const xs = [lng1, lat1, lng2, lat2];
  if (xs.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * DEG, dLng = (lng2 - lng1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
export function driveMinutes(km){
  if (typeof km !== 'number' || !Number.isFinite(km)) return null;
  return Math.max(1, Math.round((km / 40) * 60));
}
// Low-precision NOAA solar position (good to ~±2 min at this latitude).
export function sunsetUTC(lng, lat, date){
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86400000);
  const g = 2 * Math.PI / 365 * (day - 1 + 0.5);
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g); // radians
  const latR = lat * DEG;
  const cosHA = (Math.cos(90.833 * DEG) - Math.sin(latR) * Math.sin(decl)) / (Math.cos(latR) * Math.cos(decl));
  const ha = Math.acos(Math.max(-1, Math.min(1, cosHA))) / DEG; // degrees
  const noon = 720 - 4 * lng; // solar noon, minutes UTC
  return ((noon + 4 * ha) + 1440) % 1440;
}
export function formatClock(utcMinutes, lng = 0){
  const ms = Date.UTC(2000, 0, 1, Math.floor(utcMinutes / 60), Math.round(utcMinutes % 60)) - lng * 4 * 60000;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function timeHint(category, sunsetStr){
  const c = String(category || '');
  if (/beach|coastal|island|i.test(c.replace(/\s+/g,'\/i'))/) return ''; // placeholder replaced below
}
```

> ⚠ Implement `timeHint` literally as: `if (/beach|coastal|island/i.test(c)) return 'Optimal sunset: ' + sunsetStr; if (/food|dining|restaurant|cafe|grill/i.test(c)) return 'Ideal dinner: 6:30 PM'; return '';` — the block above got mangled while writing; write the clean version.

- [ ] **Step 5: Run** `npm run test` — Expected: PASS (all 6).

- [ ] **Step 6: Commit** — `git add client/package.json client/package-lock.json client/src/geo.js client/src/geo.test.js && git commit -m "feat(client): vitest rig + haversine/sunset/timeHint utils"`

---

### Task 3: Supabase migration + prefs store + plan status

**Files:**
- Create: `supabase/migrations/0002_user_prefs.sql`
- Create: `client/src/prefs.js`
- Create: `client/src/planStatus.js`
- Test: `client/src/prefs.test.js`
- Test: `client/src/planStatus.test.js`

**Interfaces:**
- Consumes: `supabase` from `client/src/supabaseClient.js`.
- Produces (Tasks 4, 5, 13): `TAGS` (string[], tags listed in the spec §4); `readLocalPrefs() → string[]`; `writeLocalPrefs(tags)`; `toggleTag(current, tag) → string[]`; `savePrefs(user, tags)` (supabase upsert + mirror local); `loadPrefs(user) → Promise<{preferences, display_name, phone}>` (falls back to local when remote empty — does NOT need auth); from `planStatus.js`: `planStatus(starts_at, now = new Date()) → 'Upcoming'|'Active'|'Completed'|null` (null for missing date), `STATUS_FILTERS = [['All','all'],['Active','active'],['Past','past']]`, `matchesFilter(status, filterKey)` (null status only matches `all`).

- [ ] **Step 1: Write the failing tests**

```js
// client/src/prefs.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { toggleTag, readLocalPrefs, writeLocalPrefs } from './prefs.js';
beforeEach(() => { state.clear(); });
describe('toggleTag', () => {
  it('adds then removes', () => {
    let t = toggleTag([], 'Beaches'); expect(t).toEqual(['Beaches']);
    t = toggleTag(t, 'Nature'); expect(t).toEqual(['Beaches', 'Nature']);
    t = toggleTag(t, 'Beaches'); expect(t).toEqual(['Nature']);
  });
});
```

```js
// client/src/planStatus.test.js
import { describe, it, expect } from 'vitest';
import { planStatus, matchesFilter } from './planStatus.js';
const NOW = new Date('2026-10-24T12:00:00Z');
describe('planStatus', () => {
  it('future → Upcoming, same day → Active, past → Completed, missing → null', () => {
    expect(planStatus('2026-11-02T00:00:00Z', NOW)).toBe('Upcoming');
    expect(planStatus('2026-10-24T00:00:00Z', NOW)).toBe('Active');
    expect(planStatus('2026-09-01T00:00:00Z', NOW)).toBe('Completed');
    expect(planStatus(null, NOW)).toBeNull();
  });
  it('null status only matches All', () => {
    expect(matchesFilter(null, 'all')).toBe(true);
    expect(matchesFilter(null, 'active')).toBe(false);
    expect(matchesFilter('Active', 'active')).toBe(true);
  });
});
```

Note: `prefs.test.js` with localStorage needs jsdom. Add to `client/package.json`: `"devDependencies"` already gets vitest; run localStorage-dependent tests with `vitest --environment happy-dom` by adding to `scripts`: `"test": "vitest run --environment happy-dom"`. (happy-dom ships with vitest, no extra package.)

- [ ] **Step 2: Run tests — Expected: FAIL** (modules missing).

- [ ] **Step 3: Write `supabase/migrations/0002_user_prefs.sql`**

```sql
alter table profiles add column if not exists preferences text[] not null default '{}';
alter table profiles add column if not exists phone text;
alter table plans add column if not exists starts_at timestamptz;
```

(Existing "own profile" and "own plans" RLS policies in `0001_init.sql` already allow the upsert/insert this enables. Apply to the Supabase project with `supabase db push` or SQL editor before testing screens that use prefs.)

- [ ] **Step 4: Implement `client/src/prefs.js`**

```js
import { supabase } from './supabaseClient.js';
export const TAGS = ['Beaches','Food & Dining','History','Nature','Cafés','Hidden Gems','Hiking & Camping','Island Hopping','Local Markets','Photography','Nightlife','Cultural Sites','Budget Travel','Road Trips','Museums','Waterfalls'];
const KEY = 'lakbai.prefs';
export function readLocalPrefs(){
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function writeLocalPrefs(tags){ localStorage.setItem(KEY, JSON.stringify(tags || [])); }
export function toggleTag(current, tag){ return current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]; }
export async function savePrefs(user, tags){
  if (supabase && user) await supabase.from('profiles').upsert({ id: user.id, preferences: tags });
  writeLocalPrefs(tags);
}
export async function loadPrefs(user){
  if (supabase && user){
    const { data } = await supabase.from('profiles').select('preferences,display_name,phone').eq('id', user.id).maybeSingle();
    if (data){
      if ((data.preferences || []).length) writeLocalPrefs(data.preferences);
      return data;
    }
  }
  return { preferences: readLocalPrefs(), display_name: null, phone: null };
}
```

- [ ] **Step 5: Implement `client/src/planStatus.js`**

```js
const DAY = 86400000;
function bounds(startsAt){ const t = new Date(startsAt).getTime(); return [t, t + DAY - 1]; }
export function planStatus(startsAt, now = new Date()){
  if (!startsAt) return null;
  const t = now.getTime();
  const [lo, hi] = bounds(startsAt);
  if (t < lo) return 'Upcoming';
  if (t > hi) return 'Completed';
  return 'Active';
}
export function matchesFilter(status, filterKey){
  if (filterKey === 'all') return true;
  return Boolean(status) && status.toLowerCase() === filterKey; // 'active' / 'past'→Completed? no:
}
```

> ⚠ Filter mapping is: `active` ↔ status `'Active'`, `past` ↔ status `'Completed'`. Implement `matchesFilter` as: `if (!status) return false; return filterKey === 'active' ? status === 'Active' : filterKey === 'past' ? status === 'Completed' : true;`

- [ ] **Step 6: Run** `npm run test` from `client/` — Expected: PASS.

- [ ] **Step 7: Commit** — `git add supabase/migrations/0002_user_prefs.sql client/src/prefs.js client/src/prefs.test.js client/src/planStatus.js client/src/planStatus.test.js && git commit -m "feat: profiles.preferences+phone, plans.starts_at migration; prefs & planStatus utils"`

---

### Task 4: Password auth + Splash / Sign Up / Log In screens

**Files:**
- Modify: `client/src/AuthContext.jsx`
- Create: `client/src/authValidate.js`
- Create: `client/src/screens/Splash.jsx`, `client/src/screens/SignUp.jsx`, `client/src/screens/LogIn.jsx`
- Test: `client/src/authValidate.test.js`
- Delete: `client/src/Login.jsx` — NOT in this task (still imported by `Saved.jsx`); removed in Task 6.

**Interfaces:**
- Consumes: `logo.jsx`, `ui.jsx` primitives, `screens/` folder pattern.
- Produces: `AuthContext` gains `signUp(email, password) → { error? } | { needsConfirm?: true }`, `signInWithPassword(email, password) → { error? }`, `resetPassword(email) → { error? }`; screens: `Splash({ onGetStarted, onLogIn })`, `SignUp({ onAuthed, onSwitchToLogin })`, `LogIn({ onAuthed, onSwitchToSignup })` — `onAuthed(kind)` is called with `'signup'` or `'login'` after a session/factor succeeds; screens keep testids `signup-email`, `signup-password`, `signup-confirm`, `signup-send`; `login-email`, `login-password`, `login-send`; splash CTA testid `get-started`.

- [ ] **Step 1: Write failing validation tests (`client/src/authValidate.test.js`)**

```js
import { describe, it, expect } from 'vitest';
import { validateSignup, validateLogin } from './authValidate.js';
describe('validateSignup', () => {
  it('rejects bad email, short password, mismatched confirm', () => {
    expect(validateSignup({ email:'nope', password:'12345678', confirm:'12345678' })).toEqual({ ok:false, field:'email', message:'Enter a valid email address.' });
    expect(validateSignup({ email:'a@b.com', password:'123', confirm:'123' })).toEqual({ ok:false, field:'password', message:'Password must be at least 8 characters.' });
    expect(validateSignup({ email:'a@b.com', password:'12345678', confirm:'12345679' })).toEqual({ ok:false, field:'confirm', message:'Passwords do not match.' });
  });
  it('accepts a clean form', () => {
    expect(validateSignup({ email:'a@b.com', password:'onetwothree', confirm:'onetwothree' })).toEqual({ ok:true });
  });
});
describe('validateLogin', () => {
  it('needs email + non-empty password', () => {
    expect(validateLogin({ email:'', password:'x' }).ok).toBe(false);
    expect(validateLogin({ email:'a@b.com', password:'' }).ok).toBe(false);
    expect(validateLogin({ email:'a@b.com', password:'x' }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npm run test` — FAIL. Implement `client/src/authValidate.js`:

```js
const EMAIL = /.+@.+\..+/;
export function validateSignup({ email, password, confirm }){
  if (!EMAIL.test(String(email || ''))) return { ok:false, field:'email', message:'Enter a valid email address.' };
  if (String(password || '').length < 8) return { ok:false, field:'password', message:'Password must be at least 8 characters.' };
  if (password !== confirm) return { ok:false, field:'confirm', message:'Passwords do not match.' };
  return { ok:true };
}
export function validateLogin({ email, password }){
  if (!EMAIL.test(String(email || ''))) return { ok:false, field:'email', message:'Enter a valid email address.' };
  if (!String(password || '').length) return { ok:false, field:'password', message:'Enter your password.' };
  return { ok:true };
}
```

- [ ] **Step 3: Run test — PASS.** Update `client/src/AuthContext.jsx` (replace `signIn` with password trio; magic-link path removed):

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, configured } from './supabaseClient.js';
const Ctx = createContext({ user:null, loading:true, signUp:async()=>({error:'Auth not configured'}), signInWithPassword:async()=>({error:'Auth not configured'}), resetPassword:async()=>({error:'Auth not configured'}), signOut:async()=>{} });
const friendly = (e) => e ? (String(e.message||e) || 'Auth error') : '';
export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  async function signUp(email, password){
    if (!supabase) return { error: friendly('Auth not configured — add Supabase keys to .env.') };
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { error: friendly(error) };
    return data.session ? {} : { needsConfirm: true, detail: 'Check your email to confirm your account, then log in.' };
  }
  async function signInWithPassword(email, password){
    if (!supabase) return { error: friendly('Auth not configured.') };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: friendly(error) } : {};
  }
  async function resetPassword(email){
    if (!supabase) return { error: friendly('Auth not configured.') };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    return error ? { error: friendly(error) } : { detail: 'Password reset link sent. Check your email.' };
  }
  async function signOut(){ if (supabase) await supabase.auth.signOut(); setUser(null); }
  return <Ctx.Provider value={{ user, loading, configured, signUp, signInWithPassword, resetPassword, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
```

- [ ] **Step 4: Build the three screens.** Common look per mockups: soft sky gradient backdrop (`linear-gradient(180deg,#EAF3FD,#FDFEFF)`), centered logo, white rounded-top card with form; primary pill button with arrow; footer switch line. `SignUp.jsx` skeleton:

```jsx
import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { validateSignup } from '../authValidate.js';
import Logo from '../logo.jsx';
import { PrimaryBtn } from '../ui.jsx';
export default function SignUp({ onAuthed, onSwitchToLogin }){
  const { signUp } = useAuth();
  const [form, setForm] = useState({ email:'', password:'', confirm:'' });
  const [show, setShow] = useState({ password:false, confirm:false });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(){
    const v = validateSignup(form);
    if (!v.ok) { setErr(v); return; }
    setBusy(true); setErr(null);
    const res = await signUp(form.email, form.password);
    setBusy(false);
    if (res.error) setErr({ field:null, message:res.error, detail:res.detail });
    else onAuthed(res.needsConfirm ? 'confirm' : 'signup', res.detail);
  }
  const Eye = ({ k }) => <button type="button" className="chip" onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))} aria-label={'Toggle ' + k}>{show[k] ? '🙈' : '👁'}</button>;
  return (
    <main>
      <div style={{ display:'grid', placeItems:'center', padding:'48px 0 24px' }}><Logo size={72}/></div>
      <section className="pane" style={{ background:'var(--bg)', borderRadius:'28px 28px 0 0', paddingTop:28, paddingBottom:28 }}>
        <h1 style={{ textAlign:'center' }}>Create an Account</h1>
        <p style={{ textAlign:'center', color:'var(--muted-ink)', fontSize:14 }}>Sign up to unlock your personal AI guide.</p>
        {['email','password','confirm'].map(k => (/* email / password / confirm inputs, bind to form[k], testids signup-* */ null))}
        {err && <p data-testid="signup-error" style={{ color:'var(--accent)' }}>{err.message}</p>}
        <PrimaryBtn testid="signup-send" disabled={busy} onClick={submit}>Sign Up →</PrimaryBtn>
        <p style={{ textAlign:'center', marginTop:16 }}>Already have an account? <b><a href="#" onClick={e => { e.preventDefault(); onSwitchToLogin(); }}>Log In</a></b></p>
      </section>
    </main>
  );
}
```

> Expand the three `/* maps */` inputs literally in the implementation (email row with ✉ icon, password with 🔒 + Eye toggle bound to `show.password`, confirm same with its own toggle bound to `show.confirm`); labels **Email Address**, **Password**, **Confirm Password** stacked above inputs. Same card pattern for `LogIn.jsx` (title "Log In your Account", fields Email/Password + eye, blue **Forgot Password?** link calling `resetPassword` and showing its `detail` inline, PrimaryBtn "Log In →", footer "Don't have an account? Sign Up"). `Splash.jsx`: full-bleed photo `<img src="/hero.jpg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>` (create `client/public/hero.jpg` — any bundled coastal hero; a placeholder from the Porto-Baltic stock is fine), overlaid gradient for legibility, bottom sheet area with Logo `{withWordmark:true}` centered, and `PrimaryBtn testid="get-started"` "Get Started →" calling `onGetStarted`, plus a small "Log In" text button under it.

- [ ] **Step 5: Verify in preview** — `npm run preview`: Splash renders photo + logo + CTA; SignUp shows inline error for short password before hitting Supabase; LogIn shows the six-star password error from Supabase ("Invalid login credentials") in the error slot.

- [ ] **Step 6: Commit** — `git add client/src/AuthContext.jsx client/src/authValidate.js client/src/authValidate.test.js client/src/screens/Splash.jsx client/src/screens/SignUp.jsx client/src/screens/LogIn.jsx && git commit -m "feat(client): email+password auth context, Splash/SignUp/LogIn screens"`

---

### Task 5: Preferences screen + post-signup gate

**Files:**
- Create: `client/src/screens/Preferences.jsx`
- Test: `client/src/prefs.test.js` (extend with loadPrefs fallback behavior using a supabase-less scenario: with `supabase === null`, `loadPrefs(null)` resolves from localStorage — covered in Step 3 test)

**Interfaces:**
- Consumes: `prefs.js` (`TAGS`, `toggleTag`, `readLocalPrefs`, `savePrefs`), `ui.jsx`, `logo.jsx`.
- Produces: `Preferences({ onContinue })` — screen shows "Let's personalize your trip.", chip grid of `TAGS`, right-aligned live counter `"{n} Selected"`, "AI Recommendation Style" info card (static copy: "LakbAI curates destinations matching your selected tags with real-time transit routes"), `continue-btn` PrimaryBtn "Continue →" that calls `savePrefs` then `onContinue()`.

- [ ] **Step 1: Extend `prefs.test.js`** with:

```js
it('savePrefs without supabase still mirrors locally', async () => {
  await savePrefs(null, ['Nature']);
  expect(readLocalPrefs()).toEqual(['Nature']);
});
it('toggleTag dedupes', () => {
  expect(toggleTag(['Nature'], 'Nature')).toEqual([]);
});
```

(import `savePrefs` too; localStorage available via happy-dom selected in package.json script.)

- [ ] **Step 2: Run** — FAIL (savePrefs not exported yet from prior task? it is — assert the localStorage path only; if passing, skip ahead).

- [ ] **Step 3: Implement `client/src/screens/Preferences.jsx`**

```jsx
import { useState } from 'react';
import { TAGS, toggleTag, readLocalPrefs, savePrefs } from '../prefs.js';
import { useAuth } from '../AuthContext.jsx';
import Logo from '../logo.jsx';
import { Chip, PrimaryBtn } from '../ui.jsx';
export default function Preferences({ onContinue }){
  const { user } = useAuth();
  const [picked, setPicked] = useState(() => readLocalPrefs());
  const [busy, setBusy] = useState(false);
  async function done(){
    setBusy(true);
    await savePrefs(user, picked);
    setBusy(false);
    onContinue(picked);
  }
  return (
    <main className="pane" style={{ paddingTop:24, paddingBottom:28 }}>
      <div style={{ display:'grid', placeItems:'center' }}><Logo size={56}/></div>
      <h1>Let’s personalize your trip.</h1>
      <p style={{ color:'var(--muted-ink)', fontSize:14, marginTop:-4 }}>Please select the interests you want to explore.</p>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'10px 0 8px' }}>
        <b style={{ fontSize:12, letterSpacing:1 }}>YOUR TRAVEL VIBE</b>
        <span data-testid="pref-count" style={{ color:'var(--primary)', fontSize:13, fontWeight:600 }}>{picked.length} Selected</span>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        {TAGS.map(t => <Chip key={t} active={picked.includes(t)} onClick={() => setPicked(c => toggleTag(c, t))}>{t}</Chip>)}
      </div>
      <div style={{ background:'var(--chip)', borderRadius:16, padding:16, marginTop:20, display:'flex', gap:12 }}>
        <span style={{ fontSize:22 }}>✦</span>
        <span>
          <b style={{ color:'var(--primary)' }}>AI Recommendation Style</b>
          <p style={{ fontSize:13, color:'var(--muted-ink)', margin:'4px 0 0' }}>LakbAI curates destinations matching your selected tags with real-time transit routes</p>
        </span>
      </div>
      <PrimaryBtn testid="continue-btn" wide disabled={busy} onClick={done}>Continue →</PrimaryBtn>
    </main>
  );
}
```

- [ ] **Step 4: Verify** — run vitest; preview: toggling chips updates counter; Continue writes localStorage (`lakbai.prefs`).

- [ ] **Step 5: Commit** — `git add client/src/screens/Preferences.jsx client/src/prefs.test.js && git commit -m "feat(client): Preferences onboarding screen"`

---

### Task 6: App shell — flow gate, tab bar, view stack, toasts

**Files:**
- Modify: `client/src/App.jsx` (full rewrite)
- Delete: `client/src/Login.jsx`
- Modify: `client/src/Saved.jsx` (drop the `Login.jsx` import; stub SelectedTab body temporarily import new flow only — final Saved build lands in Task 11; if Task 6 is executed before Task 11, `Saved.jsx` keeps working with a plain list, restyled later.)

**Interfaces:**
- Consumes: everything so far.
- Produces (all later screens depend on): `Shell` state contract —
  - `coords` `{ lng: 120.23, lat: 16.03 }` or `{ lng, lat }` from geolocation; resolved once in Shell and passed to Home/Map/Saved as `coords`.
  - `stack` of views + `push(view)`, `pop()`; view objects: `{name:'search', query}`, `{name:'detail', place}`, `{name:'prefs'}`, `{name:'itineraries'}`, `{name:'myReviews'}`, `{name:'itinerary', plan}`.
  - `showToast(text, kind='ok')` + `Toast` rendered once at Shell level (replaces the raw `notice` paragraphs).
  - `flow` gate: `null` user + no override → `Splash`; `override==='signup'` → SignUp (switchable to LogIn); `override==='login'` → LogIn; user exists && `stage==='prefs'` → Preferences; else tabs.
  - `stage` transitions: `onAuthed('signup')` → once user session appears (effect watching `user`), set `stage:'prefs'` and clear override; `onAuthed('login' | 'confirm')` → clear override only → tabs. Preferences `onContinue` → `stage:null` (+ write flag `lakbai.prefsSeen` for later re-opens via Profile).
  - `signOut()` → clears `stage`, overrides, and stack back to splash.
  - Shell resolves `map` requests with fallback center when GPS denied (`coords` constant `FALLBACK_CENTER` above).

- [ ] **Step 1: Implement `App.jsx` template**

```jsx
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { Toast, TabBar } from './ui.jsx';
import { readLocalPrefs } from './prefs.js';
import Splash from './screens/Splash.jsx';
import SignUp from './screens/SignUp.jsx';
import LogIn from './screens/LogIn.jsx';
import Preferences from './screens/Preferences.jsx';
import HomeTab from './screens/Home.jsx';
import MapTab from './screens/MapTab.jsx';
import ChatTab from './screens/ChatTab.jsx';
import SavedTab from './screens/SavedTab.jsx';
import ProfileTab from './screens/Profile.jsx';
export const FALLBACK_CENTER = { lng: 120.23, lat: 16.03 };
export default function App(){ return <AuthProvider><Shell/></AuthProvider>; }
function Shell(){
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [authStage, setAuthStage] = useState(null);   // 'signup' | 'login' override before session exists
  const [stage, setStage] = useState(null);           // 'prefs' overlay after signup
  const [toast, setToast] = useState(null);
  const [coords, setCoords] = useState(FALLBACK_CENTER);
  const push = view => setStack(s => [...s, view]);
  const pop = () => setStack(s => s.slice(0, -1));
  const showToast = (text, kind='ok', detail) => setToast({ text, kind, detail });
  useEffect(() => {                                   // LIVE touring GPS (Review Focus #1)
    if (!('geolocation' in navigator)) return;
    const OPTS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 };
    const onOk = pos => setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
    let id = navigator.geolocation.watchPosition(onOk, () => {}, OPTS); // errors keep Pangasinan fallback
    const onHide = () => {                             // battery: no GPS while backgrounded
      navigator.geolocation.clearWatch(id);
      if (!document.hidden) id = navigator.geolocation.watchPosition(onOk, () => {}, OPTS);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => { navigator.geolocation.clearWatch(id); document.removeEventListener('visibilitychange', onHide); };
  }, []);
  useEffect(() => {                                   // first-session → prefs gate
    if (user && !stage && !localStorage.getItem('lakbai.prefsSeen') && readLocalPrefs().length === 0) setStage('prefs');
  }, [user]);  // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return null;
  if (!user || stage === 'authless') {
    const flow = authStage || 'splash';
    if (stage === 'prefs') return <Preferences onContinue={() => { localStorage.setItem('lakbai.prefsSeen','1'); setStage(null); }}/>;
    if (authStage === 'signup') return <SignUp onAuthed={() => setAuthStage(null)} onSwitchToLogin={() => setAuthStage('login')} />;
    if (authStage === 'login') return <LogIn onAuthed={() => setAuthStage(null)} onSwitchToSignup={() => setAuthStage('signup')} />;
    return <Splash onGetStarted={() => setAuthStage('signup')} onLogIn={() => setAuthStage('login')} />;
  }
  if (stage === 'prefs') return <Preferences onContinue={() => { localStorage.setItem('lakbai.prefsSeen','1'); setStage(null); }}/>;
  const top = stack[stack.length - 1];
  const view = top && top.name; // switch below
  const screenProps = { coords, push, pop, showToast, setTab, user };
  let body;
  if (view === 'search') body = <SearchResults query={top.query} {...screenProps}/>;
  else if (view === 'detail') body = <PlaceDetail place={top.place} {...screenProps}/>;
  else if (view === 'prefs-edit') body = <Preferences onContinue={() => { localStorage.setItem('lakbai.prefsSeen','1'); pop(); }}/>;
  else if (view === 'itineraries') body = <Itineraries {...screenProps}/>;
  else if (view === 'myReviews') body = <MyReviews {...screenProps}/>;
  else if (view === 'itinerary') body = <ItineraryView plan={top.plan} {...screenProps}/>;
  else if (tab === 'home') body = <HomeTab {...screenProps}/>;
  else if (tab === 'map') body = <MapTab {...screenProps}/>;
  else if (tab === 'chat') body = <ChatTab {...screenProps}/>;
  else if (tab === 'saved') body = <SavedTab {...screenProps}/>;
  else body = <Profile {...screenProps}/>;
  return (
    <div data-testid="app">
      <Toast toast={toast} onClose={() => setToast(null)} />
      {body}
      <TabBar tab={tab} onTab={t => { setStack([]); setTab(t); }} />
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder screens** so the shell compiles: `screens/Home.jsx`, `screens/MapTab.jsx`, `screens/ChatTab.jsx`, `screens/SavedTab.jsx`, `screens/Profile.jsx` each export a stub `<main className="pane"><h1>{name}</h1></main>` (full builds in Tasks 8–13), and `SearchResults`, `PlaceDetail`, `Itineraries`, `MyReviews`, `ItineraryView` stubs too.

- [ ] **Step 3: Wire Saved.jsx-away** — delete `client/src/Login.jsx`; remove its import from `client/src/Saved.jsx` (the file becomes unused this task once SavedTab exists; simply delete the import line so module resolution stays clean until Task 11 replaces it).

- [ ] **Step 4: Verify** — `npm run build` passes; preview: splash → Get Started → (no supabase session in dev) stays; with a real account: first login lands on Preferences once, Continue → Home with 5-item bottom TabBar; tapping a tab switches stub; toast component shows when `showToast` wired in stub Home.

- [ ] **Step 5: Commit** — `git add -A client/src && git commit -m "feat(client): view-stack shell, flow gate (splash/signup/login/prefs), tab bar, toast system"`

---

### Task 7: Server — AI response cache, prefs injection, weather route

**Files:**
- Create: `server/aiCache.js`
- Create: `server/weather.js`
- Modify: `server/index.js` (routes wrap cache; weather route; recommend passes prefs)
- Modify: `server/verify.js` (recommend signature gains prefs)
- Test: `server/test/aiCache.test.js`
- Test: `server/test/weather.test.js`
- Test: `server/test/prefsInjection.test.js`

**Interfaces:**
- Produces: `aiCache.cached(key, ttlMs, loader) → Promise<value>` (memory Map; returns cached value when fresh; **serves stale value instead of throwing** on loader error; caps ~200 entries); `weather.getWeather(lng, lat, deps) → { tempC:int, condition:string }`; `recommend(message, proximity, prefs, deps)` — same output shape as before, `prefs` string array appended into the agent payload.

- [ ] **Step 1: Write failing tests**

```js
// server/test/aiCache.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cached } = require('../aiCache.js');
test('caches a loader value for the TTL', async () => {
  let n = 0; const loader = async () => ++n;
  assert.equal(await cached('k1', 60000, loader), 1);
  assert.equal(await cached('k1', 60000, loader), 1);       // no second call
  assert.equal(await cached('k2', 60000, loader), 2);
});
test('serves stale value instead of throwing (AI 429/503 — Review Focus #2)', async () => {
  const loader = async () => { const e = new Error('Gemini error 429'); e.status = 429; throw e; };
  assert.equal(await cached('k1', 60000, loader), 1);        // was set by the first test
});
test('error with no prior value propagates', async () => {
  await assert.rejects(() => cached('never', 1, async () => { throw new Error('boom'); }));
});
```

```js
// server/test/weather.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getWeather } = require('../weather.js');
test('maps open-meteo payload (no live fetch)', async () => {
  const out = await getWeather(120, 16, { fetch: async () => ({ ok:true, json: async () => ({ current:{ temperature_2m:29.4, weather_code:0 } }) }) });
  assert.deepEqual(out, { tempC:29, condition:'Clear' });
});
test('throws status 502 on bad response', async () => {
  await assert.rejects(() => getWeather(120, 16, { fetch: async () => ({ ok:false, status:500, json: async () => ({}) }) }), /Open-Meteo error 500/);
});
```

```js
// server/test/prefsInjection.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommend } = require('../verify.js');
test('prefs string is appended to the agent payload, once — Review Focus: no extra AI calls', async () => {
  let sent; 
  await recommend('beaches near me', '120.23,16.03', ['Beaches', 'Food & Dining'], {
    chatFn: async m => { sent = m; return { intent:'redirect', answer:'x', candidates:[], sources:[] }; },
    searchFn: async () => { throw new Error('should not search for redirect'); },
  });
  assert.match(sent, /User request \(Pangasinan, Philippines\): beaches near me/);
  assert.match(sent, /User preferences: Beaches, Food & Dining\./);
});
test('no prefs → payload unchanged', async () => {
  let sent;
  await recommend('beaches', null, [], { chatFn: async m => { sent = m; return { intent:'redirect', answer:'x', candidates:[], sources:[] }; }, searchFn: async () => { throw new Error('no'); } });
  assert.doesNotMatch(sent, /User preferences/);
});
```

- [ ] **Step 2: Run** `npm test` from `server/` — Expected: FAIL (3 modules missing).

- [ ] **Step 3: Implement `server/aiCache.js`**

```js
const store = new Map();
async function cached(key, ttlMs, loader){
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const value = await loader();
    if (store.size >= 200) store.delete(store.keys().next().value);
    store.set(key, { value, at: Date.now() });
    return value;
  } catch (e) {
    if (hit) return hit.value; // stale-on-error: AI outage never nukes a working answer
    throw e;
  }
}
module.exports = { cached };
```

- [ ] **Step 4: Implement `server/weather.js`**

```js
const CODES = { 0:'Clear', 1:'Mostly Clear', 2:'Partly Cloudy', 3:'Cloudy', 45:'Fog', 48:'Fog', 51:'Drizzle', 53:'Drizzle', 61:'Rain', 63:'Rain', 65:'Heavy Rain', 71:'Snow', 80:'Showers', 81:'Showers', 95:'Thunderstorm', 96:'Thunderstorm', 99:'Thunderstorm' };
async function getWeather(lng, lat, deps = {}){
  const f = deps.fetch || fetch;
  const r = await f(`https://api.open-meteo.com/v1/forecast?longitude=${lng}&latitude=${lat}&current=temperature_2m,weather_code&timezone=auto`);
  if (!r.ok) { const e = new Error('Open-Meteo error ' + (r.status || 'failed')); e.status = 502; throw e; }
  const d = await r.json();
  return { tempC: Math.round(d.current.temperature_2m), condition: CODES[d.current.weather_code] || 'Mixed' };
}
module.exports = { getWeather };
```

- [ ] **Step 5: Update `server/verify.js`** — change ONLY the head of `recommend` (signature + payload build):

```js
async function recommend(message, proximity, prefs = [], deps = {}){
  const chatFn = deps.chatFn || chatRecommend;
  ...
  const prefLine = Array.isArray(prefs) && prefs.length ? `\nUser preferences: ${prefs.join(', ')}. Use these to bias candidates and order results.` : '';
  const agent = await chatFn(`${message}${prefLine}`);
```

(the rest of the function, bbox filtering, photo attach — untouched.)

- [ ] **Step 6: Update `server/index.js` routes**

```js
const { cached } = require('./aiCache.js');
const { getWeather } = require('./weather.js');

app.post('/api/recommend', async (req, res) => {
  try {
    const b = req.body || {};
    const key = 'rec:' + (b.message || '') + '|' + (b.proximity || '') + '|' + ((b.prefs || []).join(','));
    res.json(await cached(key, 10 * 60 * 1000, () => recommend(b.message || '', b.proximity, b.prefs || [])));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.post('/api/chat', async (req, res) => {
  try {
    const b = req.body || {};
    const key = 'chat:' + (b.message || '');
    res.json(await cached(key, 10 * 60 * 1000, () => chatRecommend(b.message || '')));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.post('/api/plan', async (req, res) => {
  try {
    const { message = '', hours = 4, startHour = 9 } = req.body || {};
    const key = 'plan:' + (message || '') + '|' + hours + '|' + startHour;
    res.json(await cached(key, 60 * 60 * 1000, () => planDay(message, Number(hours) || 4, Number(startHour) || 9)));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.get('/api/weather', async (req, res) => {
  try {
    const lng = Number(req.query.lng), lat = Number(req.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return res.status(400).json({ error: 'lng and lat required' });
    const key = 'weather:' + lng.toFixed(2) + ',' + lat.toFixed(2);
    res.json(await cached(key, 30 * 60 * 1000, () => getWeather(lng, lat)));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
```

- [ ] **Step 7: Run** `npm test` — Expected: PASS (all existing + 8 new).

- [ ] **Step 8: Commit** — `git add server && git commit -m "feat(server): TTL cache on AI routes (stale-on-error), prefs injection, Open-Meteo weather route"`

---

### Task 8: Home tab — header, emergency, search, quick actions, event banner, recommended

**Files:**
- Create: `client/src/sessionCache.js`
- Create: `client/src/screens/Home.jsx`
- Modify: `client/src/api.js` (`recommend` gains `prefs`; delete dead `itinerary()` — endpoint never existed on the server)
- Create: `client/src/festival.js` + Test `client/src/festival.test.js`

**Interfaces:**
- Consumes: `recommend(message, proximity, prefs)` (prefs from `readLocalPrefs()`), Shell props `{ coords, push, showToast, setTab }`, `logo.jsx`, `ui.jsx`, `sun geo.js`.
- Produces: `sessionCache.js`: `sessionGet(key) → value|null`, `sessionSet(key, value)` (JSON in `sessionStorage`, swallow quota errors); `festival.dateRange(text) → "OCT 24 – OCT 25" | "NOV 5" | null`; Home renders: header "Explore Pangasinan" + location text via Mapbox reverse geocoding (`client/src/geocode.js` `reverseGeocode(coords) → string|null`, fetch `https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json?types=place&limit=1&access_token=TOKEN`, fallback "Bolinao, Pangasinan"? — fallback to `coords === FALLBACK_CENTER ? 'Bolinao, Pangasinan' : 'Pangasinan'` without a network call when token is missing), orange Emergency pill toggling `<EmergencyPanel proximity={`${lng},${lat}`}/>` from `Panels.jsx` (kept, restyled inline with the blue theme), search bar (`home-search` input + `mic-btn` via Web Speech), 4 quick-action buttons, event banner card, plan CTA, recommended scroller.

- [ ] **Step 1: Write failing test (`client/src/festival.test.js`)**

```js
import { describe, it, expect } from 'vitest';
import { dateRange } from './festival.js';
it('extracts "Oct 24 – Oct 25" style ranges', () => {
  expect(dateRange('Mangunguna Festival Oct 24 – Oct 25 in Poblacion')).toBe('OCT 24 – OCT 25');
});
it('extracts single dates', () => {
  expect(dateRange('Held every May 5')).toBe('MAY 5');
});
it('null when no date present', () => { expect(dateRange('no festival')).toBeNull(); });
```

Implement `festival.js`:

```js
export function dateRange(text){
  const m = String(text || '').match(/([A-Z][a-z]{2,8})\s+(\d{1,2})(?:\s*[–—-]\s*(?:([A-Z][a-z]{2,8})\s+)?(\d{1,2}))?/);
  if (!m) return null;
  const a = m[1].toUpperCase() + ' ' + m[2];
  return m[4] ? a + ' – ' + (m[3] || m[1]).toUpperCase() + ' ' + m[4] : a;
}
```

- [ ] **Step 2: `sessionCache.js`**

```js
export function sessionGet(key){
  try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function sessionSet(key, value){
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* full storage: ignore */ }
}
```

- [ ] **Step 3: Update `client/src/api.js`**

```js
const BASE = import.meta.env.VITE_API_URL || '';
async function readError(r){ try { const b = await r.json(); return b.error || 'request failed'; } catch { return r.statusText || 'request failed'; } }
export async function recommend(message, proximity, prefs = []){
  const r = await fetch(`${BASE}/api/recommend`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message, proximity, prefs }) });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
```

- [ ] **Step 4: Implement `screens/Home.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { haversineKm, formatDistance } from '../geo.js';
import { saveFavorite } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { EmergencyPanel } from '../Panels.jsx';
import { dateRange } from '../festival.js';
import { Chip, PrimaryBtn } from '../ui.jsx';
import Logo from '../logo.jsx';

const QUICK = [['Beaches','🏖','beaches worth visiting'],['Restaurants','🍽','good restaurants'],['Local Food','🥘','local Pangasinan food to try'],['Events','📅','events and festivals this month']];
export default function Home({ coords, push, showToast, setTab }){
  const { user } = useAuth();
  const [ Residential ] = useState(true); // reserved
  const [place, setPlace] = useState('Bolinao, Pangasinan');
  const [query, setQuery] = useState('');
  const [recs, setRecs] = useState(sessionGet('lakbai.rec.home') || []);
  const [event, setEvent] = useState(null);
  const [showEmerg, setShowEmerg] = useState(false);
  const [listening, setListening] = useState(false);
  useEffect(() => { /* reverse geocode via mapbox if token; silent failure keeps fallback */ }, [coords]);
  useEffect(() => {
    if (recs.length) { setEvent(recs.find(p => p.festival && dateRange(p.festival)) || null); return; }
    recommend('top attractions, events and hidden gems', `${coords.lng},${coords.lat}`, readLocalPrefs())
      .then(out => { const ps = out.places || []; setRecs(ps); sessionSet('lakbai.rec.home', ps); setEvent(ps.find(p => p.festival && dateRange(p.festival)) || null); })
      .catch(e => showToast('Could not load recommendations', 'error', e.message));
  }, []);  // eslint-disable-line
  function search(text){
    const q = String(text || '').trim(); if (!q) return;
    push({ name:'search', query:q });
  }
  function mic(){
    const S = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!S) { showToast('Voice search not supported here', 'error'); return; }
    const r = new S(); r.lang = 'en-PH';
    r.onresult = e => { setListening(false); setQuery(e.results[0][0].transcript); search(e.results[0][0].transcript); };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    setListening(true); r.start();
  }
  async function fav(p){
    const res = await saveFavorite(user, p);
    showToast(res.error ? 'Sign in to save' : 'Added to Saved', res.error ? 'error' : 'ok');
  }
  return (
    <div>
      <header className="pane" style={{ paddingTop:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h1 style={{ margin:0 }}>Explore Pangasinan</h1>
          <button className="chip" style={{ borderColor:'#FED7AA', color:'var(--accent)', fontWeight:600 }} data-testid="emergency-pill" onClick={() => setShowEmerg(s => !s)}>Emergency</button>
        </div>
        <p style={{ color:'var(--muted-ink)', fontSize:14 }}>📍 {place}</p>
        <div style={{ display:'flex', gap:8, background:'#fff', border:'1px solid var(--border)', borderRadius:999, padding:'8px 8px 8px 16px', alignItems:'center' }}>
          <span>🔍</span>
          <input data-testid="home-search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(query); }} placeholder="Search places, food, events…" style={{ border:'none', padding:4 }}/>
          <button className="chip" data-testid="mic-btn" onClick={mic} style={{ opacity: listening ? .5 : 1 }}>🎙</button>
        </div>
      </header>
      <div className="pane" style={{ display:'flex', justifyContent:'space-between', margin:'14px 0' }}>
        {QUICK.map(([label, icon, q]) => (
          <button key={label} data-testid={'quick-' + label.split(' ')[0].toLowerCase()} onClick={() => search(q)} style={{ background:'none', border:'none', display:'grid', justifyItems:'center', fontSize:11 }}>
            <span style={{ width:52, height:52, borderRadius:18, background:'var(--chip)', display:'grid', placeItems:'center', fontSize:22, color:'var(--primary)' }}>{icon}</span>
            <span style={{ marginTop:6 }}>{label}</span>
          </button>
        ))}
      </div>
      <div className="pane">
        {event && (
          <article data-testid="event-banner" style={{ position:'relative', borderRadius:22, overflow:'hidden', boxShadow:'var(--shadow)', cursor:'pointer' }} onClick={() => event && push({ name:'detail', place:event })}>
            {event.photo && <img src={event.photo} alt="" style={{ width:'100%', height:200, objectFit:'cover' }}/>}
            <div style={{ position:'absolute', inset:'auto 0 0 0', background:'linear-gradient(transparent, rgba(10,37,64,.85))', color:'#fff', padding:16 }}>
              <span style={{ fontSize:11, letterSpacing:1, opacity:.85 }}>{dateRange(event.festival)}</span>
              <h3 style={{ margin:'2px 0' }}>{event.name}</h3>
              <p style={{ fontSize:12, opacity:.9 }}>📍 {event.hint || event.address}</p>
            </div>
            <span style={{ position:'absolute', right:14, top:'50%', width:34, height:34, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}>→</span>
          </article>
        )}
        <div data-testid="plan-cta" onClick={() => setTab('chat')} style={{ background:'var(--chip)', borderRadius:18, padding:14, margin:'16px 0', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <span style={{ width:40, height:40, borderRadius:14, background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}>✦</span>
          <span style={{ flex:1 }}>
            <b>Need a personalized plan?</b>
            <p style={{ margin:0, fontSize:13, color:'var(--muted-ink)' }}>Let LakbAI orchestrate your day in {place.split(',')[0]}</p>
          </span>
          <span style={{ width:34, height:34, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}>→</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <h2>Recommended for You</h2><a href="#" onClick={e => { e.preventDefault(); search('best places to visit'); }} style={{ fontSize:13 }}>See All →</a>
        </div>
        <div data-testid="recs" style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8 }}>
          {recs.map(p => (
            <article key={p.id} style={{ flex:'0 0 220px', borderRadius:18, background:'#fff', border:'1px solid var(--border)', overflow:'hidden', cursor:'pointer' }} onClick={() => push({ name:'detail', place:p })}>
              <div style={{ position:'relative', height:130, background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}>
                {p.photo && <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
                <span className="chip" style={{ position:'absolute', left:8, top:8, fontSize:11 }}>{(p.categories && p.categories[0]) || 'Pangasinan'}</span>
                <button className="chip" data-testid={'fav-' + p.id} onClick={e => { e.stopPropagation(); fav(p); }} style={{ position:'absolute', right:8, top:8, width:30, height:30, padding:0, borderRadius:'50%', background:'var(--primary)', color:'#fff', border:'none' }}>+</button>
                {haversineKm(coords.lng, coords.lat, p.lng, p.lat) != null && <span style={{ position:'absolute', left:8, bottom:8, fontSize:11, color:'#fff' }}>📍 {formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat))}</span>}
              </div>
              <div style={{ padding:10 }}>
                <b>{p.name}</b>
                <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'2px 0 0' }}>{p.reason}</p>
                {p.rating && <p style={{ fontSize:12 }}>★ {p.rating}{p.reviews ? ` (${p.reviews})` : ''}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
      {showEmerg && <EmergencyPanel proximity={`${coords.lng},${coords.lat}`} />}
    </div>
  );
}
```

> Also add to `geo.js`: `export function formatDistance(km){ if (km == null) return ''; return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'; }` + a test line (null → '', 0.24 → '240 m', 2.4 → '2.4 km').

- [ ] **Step 5: Verify** — vitest PASS; preview home with server running (`npm run start` in server/) + GPS or fallback: quick action opens SearchResults stub; emergency pill toggles panel; ++ note the single recommend call is session-cached (repeat mount = no new server hit — bridal this by watching server console; the AI cache protects on repeat too).

- [ ] **Step 6: Commit** — `git add client/src && git commit -m "feat(client): Home tab — header, emergency pill, voice search, quick actions, event banner, recommendations"`

---

### Task 9: Search results + detail sheet + save to trip

**Files:**
- Create: `client/src/filters.js` + Test `client/src/filters.test.js`
- Create: `client/src/screens/SearchResults.jsx`
- Create: `client/src/screens/PlaceDetail.jsx`

**Interfaces:**
- Consumes: `sessionGet/Set`, `recommend`, `geo.js`, `store.saveFavorite`, Shell `push/pop/showToast`.
- Produces: `filters.filterPlaces(places, kind) → array` (kind `all|places|food|events`), plus `export const MATCH = { Beaches:/beach|coast|island/i, Food:FOOD, Events:EVENT }` and `matches(place, label) → bool` (used by Map's filter chips in Task 10); `SearchResults({ query, coords, push, pop, showToast })` uses `sessionGet('lakbai.rec:'+query) || recommend(...)`; rows testid `result-row`; places line shows `Free` when `!place.fees || /free/i.test(fees)` else `place.fees`. `PlaceDetail({ place, ... })` — hero, meta chips, two buttons `directions-btn` (Google Maps dir link) and `save-trip-btn` (saveFavorite → toast), About card with `{description, fees, festival, sources}`.

- [ ] **Step 1: Failing test (`client/src/filters.test.js`)**

```js
import { describe, it, expect } from 'vitest';
import { filterPlaces } from './filters.js';
const A = { id:'1', name:'Patar White Beach', categories:['beach'], fees:'' };
const B = { id:'2', name:'Sungayan Grill', categories:['restaurant'], fees:'Eco fee P60' };
const C = { id:'3', name:'Mangunguna Festival', categories:['festival'], festival:'Oct 24 – Oct 25' };
it('kinds filter correctly', () => {
  expect(filterPlaces([A, B, C], 'all')).toHaveLength(3);
  expect(filterPlaces([A, B, C], 'food')).toEqual([B]);
  expect(filterPlaces([A, B, C], 'events')).toEqual([C]);
  expect(filterPlaces([A, B, C], 'places')).toEqual([A]);
});
it('matches() drives map filter chips', () => {
  expect(matches(A, 'Beaches')).toBe(true);
  expect(matches(B, 'Beaches')).toBe(false);
  expect(matches(B, 'All')).toBe(true);
});
```

- [ ] **Step 2: Run FAIL → implement `filters.js`**

```js
const FOOD = /restaurant|food|cafe|grill|dining|eat/i;
const EVENT = /festival|event/i;
export const MATCH = { Beaches:/beach|coast|island/i, Food:FOOD, Events:EVENT };
export function matches(place, label){
  if (label === 'All') return true;
  const hay = (place.categories || []).join(' ') + ' ' + (place.name || '');
  return MATCH[label] ? MATCH[label].test(hay) : true;
}
export function filterPlaces(places, kind){
  const ps = places || [];
  if (kind === 'food') return ps.filter(p => FOOD.test((p.categories || []).join(' ') + ' ' + (p.name || '')));
  if (kind === 'events') return ps.filter(p => p.festival || EVENT.test((p.categories || []).join(' ') + ' ' + (p.name || '')));
  if (kind === 'places') return ps.filter(p => !FOOD.test((p.categories || []).join(' ') + ' ' + (p.name || '')) && !(p.festival || EVENT.test((p.categories || []).join(' ') + ' ' + (p.name || ''))));
  return ps;
}
```

- [ ] **Step 3: `SearchResults.jsx`** — sticky bar (`search-bar` input prefilled from `query`, mic hidden), chips `All | Places | Food | Events` (Chip active state), list:

```jsx
<article data-testid="result-row" onClick={() => push({ name:'detail', place:p })} style={{ display:'flex', gap:12, padding:12, border:'1px solid var(--border)', borderRadius:18, background:'#fff', cursor:'pointer' }}>
  <div style={{ position:'relative', width:104, height:104, flex:'0 0 104px', borderRadius:14, overflow:'hidden', background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}>
    {p.photo && <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }}/>}
    {p.rating && <span className="chip" style={{ position:'absolute', left:6, top:6, fontSize:10 }}>★ {p.rating}</span>}
  </div>
  <div style={{ flex:1, minWidth:0 }}>
    {feeLabel(p) && <span style={{ fontSize:11, color:'var(--muted-ink)' }}>{feeLabel(p)}</span>}
    <b style={{ display:'block' }}>{p.name}</b>
    <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'2px 0' }}>{p.address || (p.hint ? p.hint + ', Bolinao, Pangasinan' : 'Pangasinan')}</p>
    <p style={{ fontSize:12 }}>📍 {formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat))} km away</p>  // hide the whole line when formatDistance returns ''
  </div>
  <span>›</span>
</article>
```

`feeLabel(p)` — put in `filters.js`: `p.fees && !/free/i.test(p.fees) ? p.fees : 'Free'`. Data loads via the same session-cached recommend; "no data" renders `<p data-testid="search-empty">Nothing found — try another search.</p>`.

- [ ] **Step 4: `PlaceDetail.jsx`** — full per mockup 4: back `pop()` circle button top-left, hero photo (`hero-photo`), "N Photos" badge only when photo exists, date chip `dateRange(place.festival)`; title, `📍 {address || hint}` + distance; category chips (`p.categories.slice(0,4)`); button row: secondary `directions-btn` "🧭 Directions" → `window.open('https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng)`; primary `save-trip-btn` "⊕ Save to Trip" → `saveFavorite(user, place)` → toast "Added to Saved"; card "About the Destination" with paragraphs for description, festival note (" OCT 24 – OCT 25 · Free entry" style line when applicable), fees, and source links list when `p.sources?.length`.

- [ ] **Step 5: Verify** — preview: quick action → results rows; tap row → detail; Save twice → second toast still success (upsert), Directions opens new tab.

- [ ] **Step 6: Commit** — `git add client/src && git commit -m "feat(client): search results with filter chips, place detail with save/directions"`

---

### Task 10: Tailwind + shadcn setup; Map tab on mapcn; Chat tab restyle

**Files:**
- Modify: `client/package.json` (deps: `tailwindcss @tailwindcss/vite` dev, `maplibre-gl` via shadcn)
- Create: `client/components.json`, `client/jsconfig.json`, `client/src/components/ui/map.jsx` (via shadcn CLI), `client/src/screens/MapTab.jsx`
- Modify: `client/vite.config.js` (Tailwind plugin + `@` alias), `client/src/index.css` (`@import "tailwindcss";` on top), `client/src/index.html` (CSP entries if/when deployed hardening)
- Delete: `client/src/MapView.jsx`, `mapbox-gl` from `client/package.json` (server REST usage stays)

**Interfaces:**
- Consumes: `/api/recommend` (cached) + `filters.matches`, Shell props.
- Produces: `MapTab({ coords, push, showToast })` — free CARTO basemap (auto light/dark), radius chips `['1 km','Within 5 km','10 km']` testids `radius-1|5|10`, category filter chip cycling `All → Beaches → Food → Events` via `filters.matches`, pins from results, pulsing blue "You are here" dot, route/selected-place flyTo. `ChatTab({ showToast })` — restyled chat (messages list, sticky bottom composer, existing testids preserved, shimmer status, Ready error → toast instead of inline crash).

- [ ] **Step 1: Tailwind v4** — from `client/`: `npm install tailwindcss @tailwindcss/vite`; add to `vite.config.js` plugins: `import tailwindcss from '@tailwindcss/vite'` + `plugins: [react(), tailwindcss()]`; top of `src/index.css`: `@import "tailwindcss";` (existing custom CSS below it stays valid).

- [ ] **Step 2: shadcn/ui init + path alias** — create `client/jsconfig.json`:

```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```

add the same alias to `vite.config.js` (`resolve: { alias: { '@': path.resolve(__dirname, './src') } }`), then `npx shadcn@latest init` (choose neutral + CSS variables). Verify `components.json` is created.

- [ ] **Step 3: Add mapcn** — `npx shadcn@latest add @mapcn/map` (installs `maplibre-gl`, creates `src/components/ui/map.jsx`). Then **self-host the worker** per mapcn docs:

```bash
cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs public/
```

and in `src/components/ui/map.jsx` replace the unpkg URL near `loadMapLibre()`: `lib.setWorkerUrl("/maplibre-gl-worker.mjs");`

- [ ] **Step 4: Remove mapbox-gl** — `npm uninstall mapbox-gl`; delete `client/src/MapView.jsx`; fix any lingering imports (none after Task 8/9 — they only used `filters`/`api`).

- [ ] **Step 5: `MapTab.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { recommend } from '../api.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { readLocalPrefs } from '../prefs.js';
import { matches } from '../filters.js';
import { Map, MapControls } from '@/components/ui/map';
import { Chip } from '../ui.jsx';
const RADII = [[1,'1 km'],[5,'Within 5 km'],[10,'10 km']];
const FILTERS = ['All','Beaches','Food','Events'];
export default function MapTab({ coords, push, showToast }){
  const [radius, setRadius] = useState(5);
  const [filter, setFilter] = useState('All');
  const [places, setPlaces] = useState(sessionGet('lakbai.rec.nearby:5') || []);
  const [focus, setFocus] = useState(null);
  useEffect(() => {
    const key = 'lakbai.rec.nearby:' + radius;
    const hit = sessionGet(key);
    if (hit) { setPlaces(hit); return; }
    recommend(`nearby Pangasinan attractions restaurants events within ${radius} km`, `${coords.lng},${coords.lat}`, readLocalPrefs())
      .then(out => { const ps = out.places || []; setPlaces(ps); sessionSet(key, ps); showToast('Showing ' + ps.length + ' nearby stops'); })
      .catch(e => showToast('Map data unavailable', 'error', e.message));
  }, [radius]);  // eslint-disable-line
  const filtered = places.filter(p => matches(p, filter));
  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:5, background:'rgba(255,255,255,.95)', borderRadius:999, padding:'10px 16px', boxShadow:'var(--shadow)', cursor:'pointer' }} onClick={() => push({ name:'search', query:'' })}>
        🔍 <span style={{ color:'var(--muted-ink)', fontSize:14 }}>Search places, food, events…</span>
      </div>
      <div style={{ position:'absolute', top:60, left:12, right:12, zIndex:5, display:'flex', gap:8, overflowX:'auto' }}>
        {RADII.map(([km, label]) => <Chip key={km} active={radius === km} onClick={() => setRadius(km)} data-testid={'radius-' + km}>{label}</Chip>)}
        {FILTERS.map(f => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === 'Beaches' ? '🏖 ' + f : f}</Chip>)}
      </div>
      <Map center={[coords.lng, coords.lat]} zoom={11} style={{ height:'calc(100dvh - 210px)' }} onStyleData={/* mount markers per mapcn docs */ null}>
        <MapControls />
      </Map>
      {/* pins + you-are-here dot are added via the maplibre instance from mapcn (component exposes the map ref); see docs markers section */}
    </div>
  );
}
```

> ⚠ mapcn marker API: follow the mapcn docs for adding pins/projection on `onLoad`; if the component does not expose a marker prop, use raw `maplibre-gl` `Marker` elements on the returned map instance (`new Marker({ element: el }).setLngLat(...).addTo(map)`) — white `el` circles, and the pulsing blue `.userdot` element pinned at `coords` with the label "You are here" (CSS in `index.css`). The `filtered` list also renders the distance line with `formatDistance` so Review Focus #1/#3 stay honored.

- [ ] **Step 6: `ChatTab.jsx`** — the chat section extracted from the old Shell (scrollable message list, bottom sticky composer with `chat-input` + `chat-send`, "Searching…" shimmer, existing testids preserved). On send failure the toast shows `e.message` instead of crashing.

- [ ] **Step 7: Verify** — preview: map renders **without any tokens** on CARTO tiles; radius change re-issues one cached request per radius per session; pins render; "You are here" shows when GPS granted (fallback center keeps working when denied); map is fully usable on Safari/Chrome mobile viewport sizes; dark mode flips automatically.

- [ ] **Step 8: Commit** — `git add -A client && git commit -m "feat(client): Tailwind+shadcn, mapcn map on CARTO tiles with self-hosted worker, map tab, chat restyle"`

---

### Task 11: Saved tab — trip cards, suggestions, Generate Smart Itinerary, itinerary view

**Files:**
- Modify: `client/src/store.js` (plan + review-list helpers, expanded outbox)
- Modify: `client/src/outbox.js` (multi-kind outbox: `review` entries via `queueReview`, plus `favdelete` dequeue)
- Create: `client/src/screens/SavedTab.jsx`
- Create: `client/src/screens/ItineraryView.jsx`
- Test: `client/src/outbox.test.js` (outbox round-trip + queue/delete both kinds)

**Interfaces:**
- Consumes: `listFavorites` (existing), `geo.js` sunset & distance, `panStatus` (Task 3), `/api/plan` via `itineraryFromSaved(listOfNames, hours=8)` in `api.js` (`POST /api/plan { message: 'A day trip in Pangasinan visiting: name1, name2, name3', hours:8, startHour:9 }`, session-cached under the joined names).
- Produces (`store.js`):
  - `removeFavorite(user, placeId) → { queued?:true }` (online delete, offline `queueFavDelete`)
  - `listPlans(user) → supabase select plans order created_at desc` (+ merges `localStorage 'lakbai-plans'` rows when supabase absent)
  - `savePlan(user, plan) → insert { user_id, title, schedule, starts_at }` (+ localStorage fallback)
- Outbox (both kinds: `{ kind:'review', ...row }` and `{ kind:'favdelete', placeId }`) — `flushOutbox` loops, dispatches by kind; migration-safe.

- [ ] **Step 1: Failing outbox test (`client/src/outbox.test.js`)**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { queueReview, queueFavDelete, readOutbox, takeAll } from './outbox.js';
beforeEach(() => localStorage.clear());
it('queues and strips reviews and deletions separately', () => {
  queueReview({ place_id:'p1', place_name:'A', score:5, text:'hi' });
  queueFavDelete('p2');
  const box = readOutbox();
  expect(box).toHaveLength(2);
  expect(box[0].kind).toBe('review');
  expect(box[1]).toEqual({ kind:'favdelete', placeId:'p2' });
  expect(takeAll()).toHaveLength(2);
  expect(readOutbox()).toHaveLength(0);
});
```

Implement: extend `queueReview` to tag `{ kind:'review', ...row }` (bump `stripForInsert` to strip `kind` too); add:

```js
export function queueFavDelete(placeId){
  const box = readRaw(); box.push({ kind:'favdelete', placeId }); localStorage.setItem(KEY, JSON.stringify(box)); return box;
}
```

`flushOutbox` in `store.js` loops: `kind==='review'` → insert as today; `kind==='favdelete'` → `supabase.from('favorites').delete().eq('user_id', user.id).eq('place_id', r.placeId)`.

- [ ] **Step 2: Run** vitest — FAIL then PASS after edits above.

- [ ] **Step 3: `store.js` helpers** (testids: `saved-list`, `remove-fav`, `suggestions`, `add-sugg`, `add-all-sugg`, `generate-itinerary`)

- [ ] **Step 4: `SavedTab.jsx`** — "Saved Trips" header + place; list of `favorites` cards (photo/gradient, ★rating ONLY when `rows.rating` — favorites table has no rating: show name/category line + distance + timeHint pill using `place.festival`-free categories `['beach'] default` — hint derived from `place.categories[0]` + `sunsetTime(coords)`, e.g. "Optimal sunset: 5:46 PM" chip with 🍽 variant for food); `X` button (`remove-fav`) → `removeFavorite` + optimistic row removal + toast "Itinerary removed"? — no: toast "Removed from Saved". "LakbAI Suggestions" card list (session-cached recommend "hidden gems attractions near me") with per-row `+ Add` (`add-sugg`) and "+ Add All"; "Generate Smart Itinerary" primary → builds message from current favorites' names (`users favorites.map(f => f.name).join(', ')`) → `itineraryFromSaved(names)` → push `{ name:'itinerary', plan }`. foot text under button: "LakbAI will automatically sequence stops by distance and sunset timing."

- [ ] **Step 5: `ItineraryView.jsx`** — header back `pop`, top-right "Save Itinerary" chip (`save-plan`), title `plan.title` (editable: clicking pencil toggles input), meta "📍 Bolinao, Pangasinan • 1 Day × 4 Stops" derived from `plan.schedule.length` and `plan.starts_at`; single "Day 1" chip; weather card from `/api/weather?lng&lat` (hidden gracefully — Review Focus #1 cousin); numbered timeline rows `01..`: photo: favorite-matched `f.photo` else gradient tile, "✦ AI Added" chip when the stop's name is NOT among the names that generated the plan (pass `inputNames` via the `plan` object — keep `plan.inputNames` attached at generate time), time window `{arrive} – {depart}` blue, name, drive chip `driveMinutes` between consecutive coords (favorites coords; hide when unknown), fees chip only when fee data known (search result fee excluded here — placeholder hides fee chip), footer "Save Itinerary" when not yet saved; after save → toast "Itinerary Saved — You can view saved itineraries under Profile Tab named Saved Itineraries" (exact copy from the mockup, minus the typo), + `plan.saved=true`.

- [ ] **Step 6: Verify** — vitest PASS; preview with data: Saved lists; generate flows end-to-end with server up; offline → generate shows "offline — connect to generate" toast; favorites offline removal queued (outbox file grows in localStorage).

- [ ] **Step 7: Commit** — `git add client/src && git commit -m "feat(client): saved trips, outbox multi-kind, smart itinerary generate + itinerary view"`.

---

### Task 12: Touring map — live GPS dot, curated spot pins, popup with placeholder photos + user reviews

**Files:**
- Create: `server/spots.js` (curated dataset)
- Create: `client/src/spots.js` (client fetch + persistent cache)
- Create: `client/src/screens/SpotPopup.jsx`
- Modify: `client/src/screens/MapTab.jsx` (extend the Task 10 map)
- Modify: `client/src/store.js` (`listPlaceReviews`)
- Modify: `client/src/index.css` (`.userdot` pulse, popup sheet styles)
- Test: `server/test/spots.test.js`

**Interfaces:**
- Consumes: mapcn `Map` from Task 10, Shell `coords` (now a **live-updating** value from Task 6's `watchPosition`), `filters.matches`, `geo.haversineKm/formatDistance`, `store.saveFavorite/postReview/flushOutbox`.
- Produces:
  - `server/spots.js`: `SPOTS → [{ id, name, town, district, lng, lat, categories: [], blurb: '', photos: [] }]` — the **user-supplied official list, all 70+ spots across Districts 1–6**; every resolved lng/lat inside the locked bbox (coords filled once by `scripts/geocode-spots.mjs` against Mapbox Searchbox; unresolvable entries stay `null` → not pinned); **`photos: []` empty — photo URLs are added by hand later** (the file is the single place to edit);
  - `GET /api/spots` in `server/index.js` → `{ spots }` (static, wrapped in `cached()` 24 h anyway);
  - `client/src/spots.js`: `fetchSpots() → Promise<SPOTS[]>` — `localStorage 'lakbai.spots'` first (offline pins, Review Focus #1), network refresh in background;
  - `store.listPlaceReviews(name) → supabase.from('reviews').select('*').eq('place_name', name).order('created_at', { ascending:false })` (public read policy already in `0001`);
  - `SpotPopup({ spot, coords, pop, showToast, user })` — bottom sheet per the mockup's detail look: carousel area (dot navigation, "{n} Photos" badge; **placeholder tiles** — branded blue gradient + place-icon + "Photo coming soon" caption — when `photos` is empty; when photos added later, `<img>` tiles from the URLs), filmstrip thumbnails, title, `📍 {town}` + live distance from the touring dot, category chips, Directions + Save to Trip (same handlers as Task 9 detail), and **Reviews**: user review cards (stars, text, date) + inline review form (score select + textarea → `postReview` → outbox-queued when offline, `flushOutbox` on success).

- [ ] **Step 1: Write the failing test (`server/test/spots.test.js`)**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SPOTS } = require('../spots.js');
test('curated spots: the official 6-district list, deduped, labels set', () => {
  assert.ok(SPOTS.length >= 65, 'the full official list ships (>= 65 entries)');
  const ids = new Set(SPOTS.map(s => s.id));
  assert.equal(ids.size, SPOTS.length, 'unique ids');
  for (const s of SPOTS){
    assert.ok(s.name && s.town, s.name + ' labeled');
    assert.ok(['1','2','3','4','5','6'].includes(String(s.district)), s.name + ' district in 1..6');
    assert.ok(Array.isArray(s.categories), s.name + ' categories array exists');
    assert.ok(Array.isArray(s.photos), s.name + ' photos array exists (empty until added by hand)');
  }
});
test('pinned spots (with coords) stay inside the locked Pangasinan bbox; >= 80% resolved', () => {
  const pinned = SPOTS.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat));
  assert.ok(pinned.length >= Math.floor(SPOTS.length * 0.8), '80% geocoded');
  for (const s of pinned){
    assert.ok(s.lng >= 119.7 && s.lng <= 120.7 && s.lat >= 15.7 && s.lat <= 16.5, s.name + ' in bbox');
  }
});
```

- [ ] **Step 2: Run** `npm test` (server) — Expected: FAIL (`../spots.js` missing).

- [ ] **Step 3: Implement `server/spots.js`** — the **official district-by-district list the user supplied** (70 entries across Districts 1–6, below), composed this way: literal arrays of `[name, town]` per district, mapped into spot objects with an id, a district field, sensible category guesses (Beach/Nature/Heritage/Cultural/Food/Adventure), `blurb: ''` (free to add later), `photos: []` (filled by hand later — this file is the single place to add photo URLs), and `lng: null, lat: null` resolved by the geocode script. Keep the LOCKED-SCOPE comment header.

```js
// Official Pangasinan tourist spots (user-supplied, by congressional district).
// photos: leave `photos: []` until real photo URLs exist — added by hand here
// later (no external fetches). lng/lat: filled once via scripts/geocode-spots.mjs.
const DISTRICTS = {
  '1': [['Abagatanen Beach','Agno'],['Agnos Beach','Agno'],['Andron Buyanging Beach','Anda'],
    ['Balingasay River','Bolinao'],['Bangrin Marine Protected Area','Bani'],['Binabalian River','Infanta'],
    ['Bolinao Falls 1','Bolinao'],['Bolinao Falls 2','Bolinao'],['Bolinao Falls 3A','Bolinao'],
    ['Bolo Beach Resort','Alaminos'],['Cabongaoan Beach','Burgos'],['Cape Bolinao Lighthouse','Bolinao'],
    ['Colibra Island','Dasol'],['Death Pool','Burgos'],['Enchanted Cave','Bolinao'],
    ["Governor's Island",'Alaminos City'],['Hundred Islands National Park','Alaminos City'],['Marcos Island','Bani'],
    ['Nalsoc Cave','Bani'],['Patar Beach','Bolinao'],['Patar Rock Formation','Bolinao'],
    ['Pilgrimage Island','Alaminos City'],['Puerto del Sol','Bolinao'],['Rock Garden Resort','Bolinao'],
    ['Santiago Island','Bolinao'],['Sungayan Grill','Bolinao'],['Tara Falls','Bolinao'],
    ['Tambobong Beach','Dasol'],['Tondol Beach','Anda'],['Wonderful Cave','Bolinao']],
  '2': [['Binmaley Beach','Binmaley'],['Capitol','Lingayen'],['Daang Kalikasan','Mangatarem'],
    ['Lingayen Baywalk','Lingayen'],['Lingayen Heritage Park','Lingayen'],['Manleluag Spring National Park','Mangatarem'],
    ['Narciso Ramos Ancestral House Area','Lingayen'],['Narciso Ramos Sports and Civic Center (NRSCC)','Lingayen'],
    ['Tubuan Beach','Labrador'],['Urduja House Grounds','Lingayen'],['Veterans Memorial Park','Lingayen']],
  '3': [['Calasiao Puto and Pasalubong Center','Calasiao'],['Jech\'s Bakery & Restaurant','Calasiao'],
    ['Les Boissons','Dagupan'],['Malacañang of the North Pangasinan','Bayambang'],["Mapandan People's Park",'Mapandan'],
    ['Minor Basilica of Saint Dominic','San Carlos City'],['Pisces Coffee Hub','San Carlos City'],
    ['Public Plaza','Santa Barbara'],['San Carlos City Plaza','San Carlos City'],
    ['Saints Peter & Paul Parish Church','Calasiao'],['Tito\'s Cafe','San Carlos City']],
  '4': [['Bonuan Blue Beach','Dagupan City'],['Cafe Zero','Dagupan City'],['CSI Stadia and Lifestyle Center','Dagupan City'],
    ['Dawel River Cruise Area','San Fabian'],['Hardin sa Paraiso','Manaoag'],['Kainan ni Mang Peping','Dagupan'],
    ['Kanto Cafe Tapuac','Dagupan City'],['Manaoag Church (Minor Basilica of Our Lady of Manaoag)','Manaoag'],
    ['Mangaldan Plaza','Mangaldan'],['Pantal River','Dagupan City'],['Rizal Park','Manaoag'],
    ['San Fabian Beach','San Fabian'],['Silverios','Dagupan'],['Sunset Hill Cafe & Cabins','San Fabian'],
    ['Tondaligan Beach','Dagupan City']],
  '5': [['Antong Falls','Sison'],['Lipit Secret Falls','Sison'],['Matutina-Gerry\'s Seafood House','Urdaneta City'],
    ['Saint Jude Thaddeus Parish Church of Pozorrubio','Pozorrubio'],['Little N','Sison'],
    ['Cathedral of Our Lady of the Immaculate Conception','Urdaneta City'],['Urdaneta City Plaza','Urdaneta City'],
    ['Villasis Plaza','Villasis']],
  '6': [['Balungao Hilltop Adventure and Hotspring','Balungao'],['Malico','San Nicolas'],
    ['Municipality Park','Balungao'],['San Nicolas Church','San Nicolas'],['Tayug Ecopark','Tayug'],['Umingan Plaza','Umingan']],
};
const CATEGORY_HINTS = [ // first matching regex wins; spot-check in the preview
  [/beach|river|island|cave|falls|pool|spring|hot ?spring|mangrove|hilltop|ecopark/i, ['Beach','Nature']],
  [/cafe|restaurant|bakery|puto|pasalubong|grill|seafood|stadia|lifestyle|silverios|boissons|kainan|matutina|pisces|jech|tito|little ?n/i, ['Food','Dining']],
  [/church|basilica|cathedral|parish|capitol|heritage|museum|malacanang|urduja|ancestral|civic|center/i, ['Heritage','Cultural']],
];
function categoriesFor(name){
  for (const [rx, cats] of CATEGORY_HINTS) if (rx.test(name)) return cats;
  return ['Heritage','Cultural'];  // civic parks/plazas default
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SPOTS = Object.entries(DISTRICTS).flatMap(([district, list]) => list.map(([name, town]) => ({
  id: slug(`${name}-${town}`), name, town, district, categories: categoriesFor(name),
  blurb: '', photos: [],
  lng: null, lat: null,                        // resolved by scripts/geocode-spots.mjs (Step 3b)
})));
module.exports = { SPOTS };
```

> gist: shores/caves/falls → Beach+Nature; eateries → Food+Dining; civic and religious sites → Heritage+Cultural. Verify every spot's chips in the preview and adjust the regexes — categories drive the map filter chips.

- [ ] **Step 3b: Coordinate resolution (one-time, dev script)** — create `server/scripts/geocode-spots.mjs` (ESM one-off, run as `node --env-file=../.env scripts/geocode-spots.mjs [--dry-run]` from `server/`; uses the existing `VITE_MAPBOX_TOKEN`, Mapbox **Searchbox** endpoint used by `places.js`, locked bbox filter):

```js
// usage: node scripts/geocode-spots.mjs [--dry-run]
import { writeFileSync } from 'node:fs';
const { SPOTS } = await import('../spots.js');
const KEY = process.env.VITE_MAPBOX_TOKEN;
const inBox = (lng, lat) => lng >= 119.7 && lng <= 120.7 && lat >= 15.7 && lat <= 16.5;
for (const s of SPOTS.filter(s => !Number.isFinite(s.lng))){
  const u = 'https://api.mapbox.com/search/searchbox/v1/forward?' + new URLSearchParams({
    q: `${s.name} ${s.town} Pangasinan`, language: 'en', limit: '1',
    bbox: '119.7,15.7,120.7,16.5', country: 'PH', access_token: KEY });
  const r = await fetch(u); if (!r.ok) { console.log('FAIL', s.name, r.status); continue; }
  const d = await r.json();
  const [lng, lat] = d.features?.[0]?.geometry?.coordinates || [];
  if (Number.isFinite(lng) && inBox(lng, lat)) { s.lng = Math.round(lng*1000)/1000; s.lat = Math.round(lat*1000)/1000; console.log('OK  ', s.name, '→', s.lng, s.lat); }
  else console.log('MISS', s.name, s.town);          // stays null → not pinned; fine
}
if (process.argv.includes('--dry-run')) process.exit(0);
// write back: regenerate the SPOTS literal from current values (simplest: emit JSON to spots-coords.json imported by spots.js)
writeFileSync(new URL('../spots-coords.json', import.meta.url), JSON.stringify(Object.fromEntries(SPOTS.map(s => [s.id, [s.lng, s.lat]])), null, 2));
console.log('written spots-coords.json');
```

Rework `server/spots.js` tail to merge that file: `const COORDS = require('./spots-coords.json');` and in the map: `lng: COORDS[slug(...)]?.[0] ?? null, lat: ...`. Goal: **≥80 % of the 70 pins resolved** (test enforces); stragglers (e.g. `Little N`, unnamed cafes) stay null → excluded from the map/popup until coords are added by hand (a short `TODO coords:` comment list is left in the file for those).

- [ ] **Step 4: Run** `npm test` — PASS (`>= 65` entries, unique ids, ≥80 % pinned inside bbox). Wire the route in `server/index.js`:

```js
const { SPOTS } = require('./spots.js');
app.get('/api/spots', async (req, res) => {
  try { res.json(await cached('spots:all', 24 * 60 * 60 * 1000, async () => ({ spots: SPOTS }))); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
```

- [ ] **Step 5: Implement `client/src/spots.js`**

```js
export async function fetchSpots(){
  let local = [];
  try { local = JSON.parse(localStorage.getItem('lakbai.spots') || '[]'); } catch {}
  if (local.length) return local;                       // instant pins, even offline
  const r = await fetch('/api/spots');
  if (!r.ok) throw new Error('spots unavailable');
  const { spots } = await r.json();
  try { localStorage.setItem('lakbai.spots', JSON.stringify(spots)); } catch {}
  return spots;
}
```

- [ ] **Step 6: Extend MapTab** — pins from `fetchSpots()` (filter chips apply `matches(spot, label)` on `categories`), each pin is a custom element per mapcn docs (32 px white circle with a category emoji and a blue border; tap sets `selectedSpot`); spots with `lng: null` are skipped (not pinned); the **live dot**: existing coords prop re-renders a `.userdot` marker (pulsing blue circle CSS `.userdot::after` animation) whose position follows the touring GPS; category zoom fits bounds to the visible pins; pins update only when the filter chips change.

- [ ] **Step 7: Implement `SpotPopup.jsx`** — fixed bottom sheet (`.spot-sheet` CSS: rounded-top 24 px, shadow, max-height 82vh, scroll inside, grab-handle):

```jsx
export default function SpotPopup({ spot, coords, pop, showToast, user }){
  const [slide, setSlide] = useState(0);
  const photos = spot.photos && spot.photos.length ? spot.photos : null;
  const km = haversineKm(coords.lng, coords.lat, spot.lng, spot.lat);
  const [reviews, setReviews] = useState([]);
  useEffect(() => { listPlaceReviews(spot.name).then(setReviews).catch(() => {}); }, [spot.name]);
  // carousel: horizontal scroll-snap slides; one <img> per photo URL, or a
  // <PlaceholderTile index={i}/> (gradient + '📢 Photo coming soon' caption);
  // dots = photos.length || 3 reserved placeholder dots; badge '{n} Photos' where n = photos?.length || 0
  // filmstrip: thumbnails left-aligned, tap scrolls the carousel to that index
  // buttons: Direction (Google Maps dir same as Task 9) + Save to Trip (saveFavorite → toast)
  // reviews list (read from reviews table) + form (score select + textarea; postReview(svg user) — offline queues via outbox) + empty state 'No reviews yet — be the first!'
}
```

> Implement the skeleton literally with the described structure. `placeholder tile`: reuse the logo gradient `linear-gradient(135deg,#2280E8,#0A3D8F)` with a centered outline of a mountain/camera glyph and caption "Photo coming soon".

- [ ] **Step 8: Verify** — vitest/server suites PASS; preview: Map tab shows all pins at province zoom, filter chips narrow pins, tap pin → popup with placeholders + reviews; review posted appears; phone GPS simulated via Chrome DevTools → Sensors: dot follows a manual route while "touring"; airplane-mode reload keeps pins (localStorage) and dot keeps updating (GPS is a device API, needs network only for tiles).

- [ ] **Step 9: Commit** — `git add -A server client && git commit -m "feat: touring map — live GPS dot, curated Pangasinan pins, spot popup with photo placeholders + user reviews"`

---

### Task 13: Profile tab + Saved Itineraries list + My Reviews

**Files:**
- Create: `client/src/screens/Profile.jsx` (real content replacing stub)
- Create: `client/src/screens/Itineraries.jsx`
- Create: `client/src/screens/MyReviews.jsx`

**Interfaces:**
- Consumes: `loadPrefs` (Task 3), `listPlans/savePlan` (Task 11), `planStatus/matchesFilter` (Task 3), `postReview` list/update/delete via `supabase` (own policies already in 0001).
- Produces:
  - `Profile` — avatar = initials circle from email; name (display_name fallback = email prefix); email + `phone`; `Edit` toggles inline name+phone form → `saveProfile` (new `store.js` helper: `saveProfile(user, {display_name, phone})` = profiles upsert); stats: **Trips Planned** = count of `listPlans`, **Reviews Written** = count of `listMyReviews`; menu rows → `push({name:'itineraries'}}`, `push({name:'prefs-edit'})`, `push({name:'myReviews'})`; red **Log Out** pill → signOut + reset stage to splash (`signOut` already exported by AuthContext via Shell prop — pass through `screenProps` as `signOut`).
  - `Itineraries({ pop, push, setTab, showToast })` — back header, "{n} Saved Plans", "Your Pangasinan Journeys", chips All/Active/Past via `matchesFilter(planStatus(p.starts_at))`; rows: gradient/thumb (favorite-matched photo by title match else tile), title, "{date} • {k} Stops" (date = starts_at short format else 'No date'), temp chip only when weather cached from Task 7 sessionSet('lakbai.wx', {tempC, condition}), badge per status; click → `push({name:'itinerary', plan})`; **Generate New AI Itinerary** button → `setTab('saved')`; footer "All plans synced offline — Available without mobile data on coastal routes" with info dot.
  - `MyReviews({ pop, showToast })` — back header; summary pill "n Published Reviews · ★ avg"; review cards from `supabase.from('reviews').select('*')` (new `store.js` `listMyReviews(user)`), `Edit` toggles inline score select + textarea → `updateReview(user, id, {score, text})`, `Delete` → `deleteReview(user, id)`; empty state "No reviews yet."

- [ ] **Step 1: Implement store helpers** (one commit with the three screens after preview)

```js
export async function saveProfile(user, { display_name, phone }){
  if (!supabase || !user) return { error:'login required' };
  return supabase.from('profiles').upsert({ id:user.id, display_name, phone });
}
export async function listMyReviews(user){
  if (!supabase || !user) return [];
  const { data } = await supabase.from('reviews').select('*').eq('user_id', user.id).order('created_at', { ascending:false }).limit(50);
  return data || [];
}
export async function updateReview(user, id, { score, text }){
  if (!supabase || !user) return { error:'login required' };
  return supabase.from('reviews').update({ score, text }).eq('id', id).eq('user_id', user.id);
}
export async function deleteReview(user, id){
  if (!supabase || !user) return { error:'login required' };
  return supabase.from('reviews').delete().eq('id', id).eq('user_id', user.id);
}
```

- [ ] **Step 2: Screens per interfaces above; mockup fidelity** (avatar circle 64px, two-stat grid white-on-white cards with blue numerals, menu list card with 40px icon chips in `--chip` bg, pill Log Out `#FEE2E2`-ish red-soft).

- [ ] **Step 3: Verify** — profile shows counts; Add/edit/delete review cycles; Logout → splash.

- [ ] **Step 4: Commit** — `git add client/src && git commit -m "feat(client): profile tab with stats/menu, saved itineraries list with filters, my reviews CRUD"`

---

### Task 14: PWA — manifest, icons, service worker, offline shell

**Files:**
- Modify: `client/package.json` (devDeps `vite-plugin-pwa`, `sharp`; script `icons`)
- Create: `client/scripts/make-icons.mjs`
- Modify: `client/vite.config.js`
- Modify: `client/index.html` (apple-touch-icon etc.)
- Modify: `client/src/main.jsx` (SW update hook — none needed if auto)

**Interfaces:**
- Produces: installable PWA: `manifest.webmanifest` (icons 192 + 512 + maskable 512 + apple 180), `sw.js` precaching app shell + Google Fonts runtime cache, offline navigation fallback to `index.html`.

- [ ] **Step 1: Icons script** — `npm install -D vite-plugin-pwa sharp` from `client/`; create `client/scripts/make-icons.mjs`:

```js
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive:true });
const svg = readFileSync('public/logo.svg');
// square icons: logo on transparent, padded
await sharp(svg, { density:300 }).resize(192, 192).toFile('public/pwa-192.png');
await sharp(svg, { density:300 }).resize(512, 512).toFile('public/pwa-512.png');
await sharp(svg, { density:300 }).resize(180, 180).toFile('public/apple-touch-icon.png');
// maskable: full-bleed blue gradient canvas, mark at 60% safe zone
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2280E8"/><stop offset="1" stop-color="#0A3D8F"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/></svg>`;
await sharp(Buffer.from(maskSvg)).composite([{ input: await sharp(svg, { density:300 }).resize(320, 320).toBuffer(), gravity:'centre' }]).png().toFile('public/maskable-512.png');
console.log('icons done');
```

Add `"icons": "node scripts/make-icons.mjs"` script; run it. Verify the four PNGs appear.

- [ ] **Step 2: `vite.config.js`** — add VitePWA:

```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['hero.jpg'],
    manifest: {
      id: '/',
      name: 'LakbAI', short_name: 'LakbAI',
      description: 'Lakbai, smarter, not harder. AI travel guide for Pangasinan.',
      theme_color: '#0B3E8F', background_color: '#FFFFFF', display: 'standalone',
      start_url: '/', scope: '/',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2,mjs}'], // includes self-hosted maplibre worker files
      runtimeCaching: [{
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//i,
        handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60*60*24*365 } }
      }]
    }
  })],
  envDir: '../',
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
```

- [ ] **Step 3: `index.html`** — final head: charset, `viewport content="width=device-width, initial-scale=1.0, viewport-fit=cover"`, `theme-color #0B3E8F`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, title LakbAI. If a strict CSP is later applied, include `script-src 'self'` (worker is self-hosted — no unpkg needed) and `worker-src 'self' blob:';`.

- [ ] **Step 3b: Offline map check** — with the app installed/offline, the Map tab's own worker files load from `public/` (SW-precached via the `.mjs` glob), while live CARTO tiles need network — the cached region of the map renders and the rest shows the blank-tile fallback. UI must stay interactive (Review Focus #1).

- [ ] **Step 4: Offline smoke check** — `npm run build && npm run preview`; DevTools → Application: manifest valid + icons resolve; Network tab → Offline reload → app shell still paints (hero, logo, tabs), AI panels fail with toasts instead of blank.

- [ ] **Step 5: Commit** — `git add client && git commit -m "feat(client): PWA manifest, generated icons, Workbox SW with offline shell + font caching"`

---

### Task 15: Final verification + docs

**Files:**
- Modify: `design-system/lakbai/MASTER.md` (final pass — done in Task 1; confirm)
- Run all suites; refresh graphify graph (repo instruction).

- [ ] **Step 1:** From `server/`: `npm test` — all existing + new tests PASS.
- [ ] **Step 2:** From `client/`: `npm run test` — PASS; `npm run build` — PASS with manifest + SW emitted.
- [ ] **Step 3:** Full walkthrough in preview at ~390×844: Splash → Sign Up → Preferences (15 chips + counter updates) → Home (banner card, CTA, recommended cards, emergency panel) → search "beaches" (rows, filters) → detail (save/directions/about) → Map (radius chips, you-are-here) → Chat send/answer → Saved (card remove, suggestion + Add, Generate → itinerary view → Save → toast) → Profile (edit name/phone, stats, Saved Itineraries list w/ badges + All/Active/Past, My Reviews edit+delete, Log Out → Splash). Compare against every mockup; fix visual deltas on the spot (small CSS nudges allowed without a task).
- [ ] **Step 4:** Commit any remaining nudges: `git commit -m "polish: final designers' pass vs mockups"`.
- [ ] **Step 5:** `graphify update .` to keep the knowledge graph current (repo instruction).

## Notes

- The old `MapView` focus flyTo behavior, `Panels.jsx` reviews/EmergencyPanel, `store.js` review flows, and `sessionCache`-free paths keep working; restyle happens by screens consuming these instead of Shell duplication.
- `client/src/sessionCache.js` is the client-side gate against repeated AI calls; server-side `aiCache` double-guard is the real budget shield (also covers cross-session repeats for hot queries).
