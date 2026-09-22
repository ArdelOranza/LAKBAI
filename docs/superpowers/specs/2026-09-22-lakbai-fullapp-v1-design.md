# Lakbai Full App v1 — Design Spec (2026-09-22)

## 1. Outcome
Graduate the MVP into a full app: styled mobile-first experience, Supabase
accounts, persisted favorites/reviews/history/saved itineraries, an
AI-planned itinerary builder, and server-side guardrails keeping every
answer travel-related and Pangasinan-only.

**Success criteria:** new user signs in (magic link), chats, saves favorites,
posts a review visible on another device, gets an AI day-plan with times and
activities, saves it, and sees it after re-login. Off-topic prompts
("write my homework") get a polite refusal with zero cards. Non-Pangasinan
trip requests get the Pangasinan redirect, zero cards.

**Non-goals:** bookings/payments, business admin portal, offline mode,
app-store packaging, push notifications.

## 2. Architecture
```
client/ (Vite + React, full design-system styling)
  AuthContext (Supabase session) -> Chat / Map+Cards / Saved / Profile
  bottom nav: Search · Saved · Profile
server/ (Node + Express; existing Gemini/Mapbox/photos pipeline stays)
  + user id passthrough (Supabase JWT verified via service client)
  + POST /api/plan -> AI itinerary (places, arrival/departure, activities)
  + guardrail gate in verify pipeline (travel-only + Pangasinan-only)
Supabase (Auth + Postgres + RLS)
```

## 3. Data model (Postgres + RLS)
- profiles (id uuid PK/FK auth.users, display_name)
- favorites (id, user_id, place_id, name, lng, lat, photo, created_at)
  RLS: owner read/write only.
- reviews (id, user_id, place_id, place_name, score 1-5, text, created_at)
  RLS: public read, owner write. localStorage kept as offline cache and
  offered for one-tap import on first login.
- searches (id, user_id, query, created_at) — private history.
- plans (id, user_id, title, schedule jsonb, created_at) — saved AI itineraries.

## 4. AI itinerary planner (POST /api/plan)
Input: {message, hours, startHour, userId?}. Agent returns ordered stops
with arrival/departure times and per-stop activities, all stops
Mapbox-verified inside the Pangasinan bbox (reuse verify pipeline).
Response: {title, schedule:[{placeId,name,arrive,depart,activities[]}]}.
Client "Save plan" writes to `plans` (logged in) or localStorage (guest).

## 5. Guardrails (server-enforced, tested)
1. Intent allowlist: discover|food|event|nearby|emergency|plan (+redirect
   for out-of-scope geography). Anything else (e.g. homework, code,
   general chat) -> polite refusal, zero places, zero cards.
2. Pangasinan lock kept: bbox + inBox + "Pangasinan" query suffix +
   redirect intent (existing behavior, untouched).
3. Anti-slop kept: verified coords, dedupe, cap 8, honest sourceKind,
   relevance-gated photos, no invented prices/hours/ratings.
4. Tests pin each: off-topic message, out-of-province trip, zero-feature
   candidate, per-item Mapbox failure.

## 6. Polish (ui-ux-pro-max)
Generate and persist Lakbai design system (design-system/lakbai/MASTER.md),
restyle chat/map/cards/spotlight/emergency, bottom nav, Saved + Profile
screens, empty/loading/error states. Tokens stay orange/teal/sand.
Checklist enforced: SVG icons, 4.5:1 contrast, visible focus,
reduced-motion, 375/768/1024/1440.

## 7. Secrets
`.env` (gitignored): existing GEMINI/DEEPSEEK/MAPBOX keys plus
SUPABASE_URL, SUPABASE_ANON_KEY (client-safe), SUPABASE_SERVICE_KEY
(server only, never ships to client). Keys never logged or committed.

## 8. Acceptance
- B1 magic-link login/logout roundtrip; session persists reload.
  (Google OAuth button ships wired but disabled until the provider is
  enabled in the Supabase dashboard.)
- B2 favorite on phone → visible on desktop; unfavorite removes.
- B3 review posted → visible logged-out; localStorage import offered once.
- B4 "2-day Alaminos food trip" → plan with times + activities, all stops
  inside Pangasinan; save → survives re-login.
- B5 "write my homework" → refusal, zero cards. "Boracay trip" → redirect.
- B6 existing suite green; RLS verified (user A cannot read user B history).
