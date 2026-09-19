# Lakbai MVP — Design Spec (2026-09-19, rev2: Pangasinan-only)

## 1. Intended outcome
A mobile-first web MVP for **Pangasinan, Philippines only**. Tourist chats
("3 hours near Alaminos, love seafood"), the AI searches the internet +
Mapbox, and the app reveals suggestions with a wow moment, then a Mapbox
map with cards. MVP-level polish (not full design system, not unstyled).
Zero AI slop: every suggestion is real, verified, sourced.

**Success criteria:** chat → wow reveal → pins + cards on map → itinerary →
GPS nearby → reviews → emergency info. All flows real APIs (Gemini, Mapbox).
**Non-goals:** auth, database, offline, app-store packaging, business admin.

## 2. Scope lock: Pangasinan only
- Bounding box: lng 119.7–120.7, lat 15.7–16.5. Default center: Lingayen
  (16.03, 120.23), zoom ~9.5.
- Every server query auto-appends "Pangasinan" and passes Mapbox
  `bbox` + `proximity` (map center or GPS fix).
- Anti-slop gate: any place whose Mapbox-verified coords fall outside the
  bbox is dropped, never shown. Out-of-scope requests ("Boracay?") get a
  friendly redirect, not fake compliance.

## 3. Wow-factor suggestion UX
- Searching state: shimmer + live status line ("Searching Hundred Islands…").
- Reveal: staggered card entrance + map `flyTo` tour of top 3 pins.
- Spotlight: top "hidden gem" card (non-obvious pick: e.g. not Hundred
  Islands when everyone asks beaches) with a "why this" reason line.
- Every card: reason-why chip (grounded in source), category, distance,
  source link, "add to itinerary". Card tap → map flies to pin.
- `prefers-reduced-motion`: all animation off, final states only.

## 4. Anti-slop contract (server-enforced)
1. No Mapbox-verified coords → no card. Never invent locations.
2. No invented ratings/hours: show "unrated" / "hours unknown" when absent.
3. Every place carries ≥1 source URL (Gemini grounding citation).
4. Dedupe by Mapbox `mapbox_id`; cap 8 cards per answer.
5. Numbers (prices, times) only from sources; otherwise omitted.

## 5. Architecture
```
client/ (Vite + React, mobile-first, design tokens §7, testids)
  ChatPanel -> results store -> Reveal (stagger+flyTo) -> ResultsMap + Cards
  + ItineraryPanel + NearbyButton + Reviews + EmergencyPanel
server/ (Node + Express, keys server-side)
  POST /api/chat       -> Gemini + Google Search grounding -> intent + candidates
  GET  /api/places     -> Mapbox Search Box proxy (bbox-locked) -> verified coords
  POST /api/chat+places pipeline: candidates -> verify -> drop out-of-bbox -> cards
  POST /api/itinerary  -> time-budget scheduler over selected stops
  GET  /api/emergency  -> hospitals/police near center + Pangasinan hotlines
Reviews: localStorage keyed by mapbox_id. GPS: browser geolocation.
```

## 6. Components
| Unit | Does | Depends on |
|---|---|---|
| ChatPanel | messages + input → /api/chat | results store |
| Agent (server) | intent (discover/food/event/itinerary/nearby/emergency), Pangasinan-scoped grounding | Gemini API |
| Verify (server) | Mapbox verify each candidate, enforce bbox + anti-slop §4 | Mapbox API |
| ResultsMap | pins, flyTo tour, GPS recenter | mapbox-gl, VITE_MAPBOX_TOKEN |
| PlaceCards | staggered reveal, reason chip, spotlight gem, add-to-itinerary | results store |
| ItineraryPanel | ordered stops + time blocks from hours input | /api/itinerary |
| NearbyButton | GPS → /api/places proximity → map + cards | geolocation |
| Reviews | 1–5 + text, localStorage | none |
| EmergencyPanel | hospitals/police near center + hotlines | /api/emergency |

## 7. Design tokens (via ui-ux-pro-max, Lakbai travel profile)
Primary #EA580C (adventure orange) / Secondary #0891B2 (map teal) /
Accent #D97706 / BG #FFF7ED / Ink #0F172A / Card #FFFFFF / Border #FCEAE1.
Font: clean sans (Inter or Plus Jakarta Sans — plugin suggested Thai
typeface rejected: wrong locale). Checklist enforced: SVG icons only,
4.5:1 contrast, visible focus, reduced-motion, responsive 375/768/1024/1440.

## 8. Skills & process (consulted plugins)
- superpowers: test-driven-development (RED-GREEN per endpoint/component),
  verification-before-completion before "done", systematic-debugging on bugs.
- graphify: `graphify update .` after code lands; query-first for later work.
- ui-ux-pro-max: tokens §7 + pre-delivery checklist §7.

## 9. Secrets & config
`.env` (gitignored): GEMINI_API_KEY, VITE_MAPBOX_TOKEN, PORT. Client sees
only VITE_ vars. Never logged or committed.

## 10. Acceptance (all must pass)
- A1 chat "seafood Alaminos" → ≥3 verified Pangasinan cards + sources + pins.
- A2 hidden-gem spotlight present with grounded reason line.
- A3 out-of-scope "Boracay" → redirect, zero fake cards.
- A4 GPS nearby → centered map + restaurants/attractions.
- A5 itinerary "4 hours" → ordered schedule of selected stops.
- A6 review persists after reload. A7 emergency shows hospitals + police.
- A8 invented-rating scan: no card shows rating without source.
