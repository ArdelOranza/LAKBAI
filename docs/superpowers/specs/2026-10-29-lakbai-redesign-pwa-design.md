# LakbAI Redesign + PWA — Design Spec

**Date:** 2026-10-29
**Status:** Draft for review

## Summary

Rebuild the LakbAI client's visual identity and navigation around the approved Figma-style mobile mockups, and ship the app as an installable, offline-capable PWA. The server (Node/Express + Gemini + Mapbox + Supabase) remains the same architecture; changes are additive.

Approved decisions from brainstorming:

- Auth: **email + password** via Supabase (magic-link login removed; Google button dropped, matching mockups).
- Preferences tags: **saved to the Supabase profile** (mirrored to localStorage for instant boot + offline).
- PWA: **installable + offline** shell (manifest + Workbox service worker via `vite-plugin-pwa`); API/map calls stay online.
- Restyle scope: **the whole app**, not just auth screens.
- Optimal-time hints: **sunset formula** computed from coordinates; category heuristics for food/dining slots.
- Weather: **Open-Meteo** (no API key, server-side, short cache). Card hidden on failure.
- Drive times: Mapbox duration API when available, haversine @ ~40 km/h fallback.
## Constraints

- **AI budget:** server Gemini calls are costly — cache `/api/recommend` and `/api/plan` results (same query+coords hash, short TTL, serve stale-on-error), reuse one generated itinerary per Saved-flow, and never call Gemini from tests. Client must not re-fire identical requests in a session.
- Success criteria: all mockup screens replicated 1:1 in layout, usable one-handed on a 360–430 px viewport, installable on Android/iOS home screen, cold-loads offline after first visit, existing server tests keep passing.

## Brand

- Primary blue `#1667D9` (CTA buttons, active nav, links); logo gradient `#2280E8 → #0A3D8F` (A-tent mark in a blue rounded square).
- Deep navy for headers `#0A2540`; soft blue chip backgrounds `#EFF6FF`; orange reserved for Emergency + rating stars (`#EA580C`).
- Font: Inter (Google Fonts, precached by the service worker), system-ui fallback.
- Logo redrawn as an inline SVG React component; static copies exported for manifest icons (192, 512, maskable 512) and `favicon.svg`.
- `design-system/lakbai/MASTER.md` updated to the blue palette so it stops contradicting the implementation.

## Screens & Flow

```
Splash → [Sign Up | Log In] → (first signup) Preferences → Home tabs
                              └─→ existing logins go straight to tabs
```

1. **Splash ("/")**: full-bleed photo (bundled Santorini-style hero), LakbAI logo + wordmark, tagline "Lakbai, smarter, not harder.", primary "Get Started →" button → Sign Up; secondary "Log In" link.
2. **Sign Up**: rounded white card over soft gradient; Email, Password, Confirm Password (eye toggles); validation (length ≥ 8, match) with inline errors; "Sign Up →"; "Already have an account? Log In".
3. **Log In**: Email + Password, "Forgot Password?" link (`resetPasswordForEmail`), "Log In →", "Don't have an account? Sign Up".
4. **Preferences**: "Let's personalize your trip." intro; "YOUR TRAVEL VIBE" chip grid (Beaches, Food & Dining, History, Nature, Cafés, Hidden Gems, Hiking & Camping, Island Hopping, Local Markets, Photography, Nightlife, Hiking, Cultural Sites, Budget Travel, Road Trips, Museums, Waterfalls) — multiselect with footer chips expandable to sub-chips if needed (keep flat for v1); "4 Selected" counter top-right; AI Recommendation Style info card; "Continue →". Shown once after first signup; re-openable from Profile → Travel Preferences.
5. **Home (tab 1)**: header "Explore {region}" + reverse-geocoded location line; orange **Emergency** pill toggling the existing emergency panel; search bar ("Search places, food, events…") with mic (Web Speech API, graceful fallback); 4 category quick-actions (Beaches, Restaurants, Local Food, Events); event banner card (date chip, title, venue, distance, photo — from server `festival` data); "Need a personalized plan?" CTA card → Chat tab; "Recommended for You" horizontal card scroller (server results) — photo, tag chip, + save button.
6. **Search results**: from Home search submit; filter chips All / Places / Food / Events; result rows (thumb, rating badge overlay, Free/Eco-fee label, title, address, haversine distance, chevron) → detail sheet. Tap = search route: calls existing `/api/recommend`, logs to `searches`.
7. **Detail sheet**: hero photo + photo count; date chip (events); title; location + distance; tag chips; **Directions** (Mapbox directions URL/app deep link) + **Save to Trip** (upsert `favorites`); "About the Destination" card with description, fees, festival, sources.
8. **Map (tab 2) — the touring map**: restyled mapcn (MapLibre/CARTO) map with floating search bar; **live GPS touring**: Shell tracks the device with `navigator.geolocation.watchPosition` (high accuracy; paused when the tab is backgrounded), and the map shows a pulsing blue "You are here" dot that moves in real time; radius chips (1 km / Within 5 km / 10 km) and category filter chips (All / Beaches / Food / Events); **tourist-spot pins for the whole province from a curated, bundled dataset** (12–16 spots: Patar White Beach, Cape Bolinao Lighthouse, Enchanted Cave, Bolinao Falls, Hundred Islands, Lingayen Beach & Capitol, Tambobong Beach, Tondol Beach, Manaoag Church, Cabongaoan Beach, Sunflower Maze, etc. — names/hints/towns/categories; coordinates hand-verified against Wikipedia during implementation; no AI, no per-request geocoding cost). Each spot carries an optional `photos` array that ships **empty — photo URLs are added by hand later** (edit the dataset file); until then the popup shows branded placeholder tiles;
    **tap a pin → bottom-sheet popup**: photo carousel area with dot navigation and a "{n} Photos" badge — **placeholder tiles styled per the LakbAI gradient** when no photos exist yet, filmstrip strip below reserving slots for the later photos, spot title, town + live distance from the touring dot, category chips, **Directions** + **Save to Trip** buttons, and the **user reviews** section — reviews are read from the public-read `reviews` table (filtered by place name), posted inline via the existing review form (works offline via the existing outbox queue). Places from search results reuse the same popup styling when opened from the map layer.
9. **Chat (tab 3)**: existing AI assistant (messages + `/api/recommend`) restyled as a chat screen with the Gemini/plan entry points.
10. **Saved (tab 4)**: trip cards (photo, rating badge, title, category line, distance, optimal-time hint pill from sunset formula for beaches / heuristic windows for dining, X to remove → delete `favorites` row); **LakbAI Suggestions** panel (nearby + spotlight results, thumbnail, reason + distance, "+ Add" per item, "+ Add All"); **Generate Smart Itinerary** button → orders saved stops by distance from user, re-sequences beach stops around computed sunset time, calls existing `/api/plan`, renders itinerary; footnote text per mockup.
11. **Itinerary view**: title (AI-generated, editable), meta line (place, day × stop count), Day chip, Weather card (Open-Meteo temp/condition + est. total travel from Mapbox-haversine durations, hidden on failure), numbered timeline (photo, "AI Added" badge where the agent inserted optimizations, time window, drive-time chip, fee chip), **Save Itinerary** → `plans` upsert, toast confirmation. Accessible from Saved flow and Profile → Saved Itineraries.
12. **Profile (tab 5)**: avatar (member photo or initials circle), name, email, phone, Edit (name/phone via `profiles` upsert); stats (count of `plans` plans, count of `reviews`); menu: Saved Itineraries, Travel Preferences (re-open Preferences), My Reviews; red "Log Out" pill.
    - **Saved Itineraries list**: back header, "{n} Saved Plans" count, filter chips **All / Active / Past**, plan cards (thumbnail, title, date + stop count, temperature, status badge **Upcoming**/**Completed** derived from the plan's start date vs today), "Generate New AI Itinerary" button (enters the Saved→Smart-Itinerary flow), footer note "All plans synced offline — available without mobile data on coastal routes" backed by the existing `client/src/outbox.js` offline queue + local plan cache.
    - **My Reviews**: summary pill ("{n} Published Reviews · ★ {avg} Avg Rating"), review cards (thumbnail, place title, date, star row, text — free-text, Taglish welcome), **[Edit]** (inline editor) and **[Delete]** per review — supported by existing `reviews` update/delete RLS policies.

Navigation: bottom tab bar, 5 tabs, blue active state, safe-area padded. Toast component (blue check, close affordance) replaces all raw `notice` paragraphs, success and error alike.

## Data & Server

- Migration `0002_user_prefs.sql` (Supabase): `profiles` gains `preferences text[] not null default '{}'` and `phone text`; RSL inherited from `0001` ("own profile" all-privileges policy already covers upsert).
- Client always upserts `profiles` (id from user) on Preferences save and profile Edit; mirrors tags to `localStorage('lakbai.prefs')`.
- `/api/recommend` request body gains `prefs` (tag array) and `coords`; `server/agent.js` injects one sentence of context ("User favors: …") into the existing prompt — no other provider changes.
- Sunset: NOAA solar-position formula implemented client-side (`src/sunrise.js`) given lat/lng/date; dining heuristics per category (dinner 18:00–20:30 etc.).
- Weather: `GET /api/weather?lng=&lat=` server route → Open-Meteo current + 2-day summary, 30-min in-memory cache; testable via stubbed fetch.
- Existing endpoints unchanged otherwise; existing server contract of `places` (fees, categories, photos) drives all labels.

## PWA

- `vite-plugin-pwa` in `client`: manifest name "LakbAI", short name "LakbAI", `display: standalone`, theme color `#0B3E8F`, white background, icons 192/512 + maskable, `id`/`scope` at root.
- Workbox generateSW: precache built assets + Inter font + hero photo (runtime-cached font URLs); navigation fallback to `index.html`; auto-update (registration prompt dismissed — no custom prompt UI in v1).
- `index.html`: `viewport-fit=cover`, `theme-color`, apple-touch-icon, title "LakbAI", icon links.
- CSS: safe-area insets on bottom tab bar and toppers; 100dvh layout; `-webkit-tap-highlight-color` cleanup; offline shell renders with cached prefs (tags, saved trips from last sync) and a "You're offline — showing cached data" toast when API calls fail.

## Testing

- Add **vitest** to `client` with: auth form validation unit tests; prefs store (select/deselect/upsert/localStorage mirror) tests; `sunrise.js` sunset-time test against a known value; distance util test.
- One smoke test asserting the built output contains `manifest.webmanifest`, SW registration, and both icon sizes.
- Existing server tests: add tests for the weather route (stub) and the prefs-injection line in `agent.js`; all existing tests must stay green.
- Browser smoke test on `http://localhost` preview against each mockup screen at ~390 px.

## Out of scope (v1)

- Google OAuth, password-reset UI beyond the reset email link, group/protected plans, badge/icon editing, custom SW update prompt, sub-chip preference expansion.
