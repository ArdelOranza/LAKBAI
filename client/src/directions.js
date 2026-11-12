/**
 * Mapbox Directions, in the app width.
 *
 * The old "Directions" buttons opened google.com/maps in another tab, which
 * left LakbAI entirely. This module fetches the same driving route Mapbox
 * would draw, normalises it, and hands the caller a polyline plus readable
 * turn steps — no browser hand-off.
 */

const DIRECTIONS_BASE = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
// Re-opening the same place within a session must not bill Mapbox twice.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function validPoint(p){
  return p && Number.isFinite(Number(p.lng)) && Number.isFinite(Number(p.lat));
}

function cacheKey(from, to){
  // ~11 m, not ~110 m: a reopened sheet must not reuse a route that starts
  // across an intersection from where the traveler now is.
  return [from.lng, from.lat, to.lng, to.lat].map(v => Number(v).toFixed(4)).join(',');
}

/** Mapbox Directions URL for a driving route, or null when we can't ask. */
export function directionsUrl({ from, to, token } = {}){
  if (!validPoint(from) || !validPoint(to) || !token) return null;
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const params = new URLSearchParams({
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'en',
    access_token: String(token),
  });
  return `${DIRECTIONS_BASE}/${coords}?${params.toString()}`;
}

/**
 * Flatten Mapbox's legs into one turn list.
 * Returns null when there is no usable route, so callers render an honest
 * "no route" state instead of an empty line and zero minutes.
 */
export function normalizeRoute(body){
  const route = body && Array.isArray(body.routes) ? body.routes[0] : null;
  if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) return null;
  const steps = (route.legs || [])
    .flatMap(leg => leg.steps || [])
    .map(step => ({
      instruction: step.maneuver?.instruction || 'Continue',
      distanceM: Number(step.distance) || 0,
      durationS: Number(step.duration) || 0,
      maneuver: step.maneuver?.type || 'continue',
      modifier: step.maneuver?.modifier || null,
    }));
  return {
    coordinates: route.geometry.coordinates,
    distanceM: Number(route.distance) || 0,
    durationS: Number(route.duration) || 0,
    steps,
  };
}

/** Route from `from` to `to` via Mapbox. Cached per trip; failures are not. */
export async function fetchRoute({ from, to, token, signal } = {}){
  const url = directionsUrl({ from, to, token });
  if (!url) throw new Error('No route — this place has no coordinates or the map token is missing.');
  const key = cacheKey(from, to);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.route;

  let res;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new Error('Could not get a route — check your connection and try again.');
  }
  if (!res.ok) throw new Error(`Could not get a route — Mapbox rejected the request (${res.status}).`);
  let body;
  try { body = await res.json(); } catch { throw new Error('Could not get a route — the map service sent something unreadable.'); }
  const route = normalizeRoute(body);
  if (!route) throw new Error('Could not get a route to this place by road.');
  cache.set(key, { at: Date.now(), route });
  return route;
}

/** Test/hot-reload hook: forget cached routes. */
export function clearRouteCache(){ cache.clear(); }

export function routeDistanceLabel(meters){
  const m = Number(meters);
  if (!Number.isFinite(m)) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function routeDurationLabel(seconds){
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '1 min';
  const mins = Math.max(1, Math.round(s / 60));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
