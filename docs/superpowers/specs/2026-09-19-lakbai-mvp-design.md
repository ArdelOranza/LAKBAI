# Lakbai MVP — Design Spec (2026-09-19)

## 1. Intended outcome
A mobile-first web MVP where a tourist chats ("3 hours in Cebu, love food"),
the AI searches the internet + Mapbox, and the app shows a Mapbox map with
result cards. No styling; every core flow must work end-to-end.

**Success criteria:** user can chat → see pins + cards on map → build an
itinerary → find nearby via GPS → read/add reviews → see emergency info.
Each flow works against real APIs (Gemini, Mapbox) with `.env` keys.

**Non-goals (MVP):** styling/polish, auth, database, offline mode, app-store
packaging, admin panel for businesses/tourism offices.

## 2. Architecture
```
client/ (Vite + React, mobile-first, unstyled HTML + testids)
  ChatPanel -> results state -> ResultsMap (mapbox-gl) + Cards + ItineraryPanel
server/ (Node + Express, keys stay server-side)
  POST /api/chat       -> Gemini (Google Search grounding) -> intent + recommendations
  GET  /api/places     -> Mapbox Search Box API proxy (forward geocode + category search)
  POST /api/itinerary  -> time-budget scheduler over selected places
  GET  /api/emergency  -> Mapbox category search (hospital, police) + static hotlines
Reviews: localStorage only (no backend table in MVP).
GPS: browser geolocation API -> centers map, feeds /api/places proximity.
```

## 3. Components
| Unit | Does | Depends on |
|---|---|---|
| ChatPanel | message list + input, sends to /api/chat | results store |
| Agent (server) | classifies intent (discover/food/event/itinerary/nearby/emergency), grounds via Search, returns structured places | Gemini API |
| ResultsMap | Mapbox map, pins per place, centers on GPS or top result | Mapbox GL, VITE_MAPBOX_TOKEN |
| PlaceCards | card per place: name, category, rating, source link, "add to itinerary" | results store |
| ItineraryPanel | ordered stops with time blocks from available-hours input | /api/itinerary |
| NearbyButton | GPS fix -> /api/places?proximity=... -> map + cards | geolocation |
| Reviews | per-place 1-5 + text, localStorage keyed by place id | none |
| EmergencyPanel | hospitals/police near map center + hotline list | /api/emergency |

## 4. Data flow
1. Chat text -> POST /api/chat {message, location?} -> {intent, places[], answer}.
2. Places (name + Mapbox coords via /api/places) -> pins + cards.
3. "Add" buttons -> itinerary list -> POST /api/itinerary {places, hours} -> schedule.
4. GPS button -> geolocation -> re-centers map, nearby search.
5. Every place carries source URLs (grounding citations) so info is traceable.

## 5. Secrets & config
`.env` (gitignored): GEMINI_API_KEY, VITE_MAPBOX_TOKEN, PORT. Client only
sees VITE_ vars. Keys never logged, never committed.

## 6. Testing (no styling, function-first)
Manual scripted flows, each must pass before done:
- T1 chat "food in Cebu" -> >=3 cards with pins + sources.
- T2 GPS nearby -> map centers, restaurants/attractions listed.
- T3 itinerary "4 hours" -> ordered schedule covering selected stops.
- T4 review add/read persists after reload (localStorage).
- T5 emergency -> hospitals + police near center.
- T6 no-key fallback: server returns 503 with clear message (not a crash).
