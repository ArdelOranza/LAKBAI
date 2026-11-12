import { haversineKm } from './geo.js';

/**
 * Durable home feed cache.
 *
 * Home's "hidden gems" come from an AI call, and the app used to re-run it on
 * every cold launch (sessionStorage dies with the WebView) — the traveler stared
 * at "Finding hidden gems for you…" again and again. This keeps the last good
 * answer on the device, scoped to the account, and lets Home paint it instantly
 * while an aged copy refreshes in the background.
 */

const VERSION = 'v1';
const STALE_MS = 30 * 60 * 1000;
const STALE_KM = 8;

export function homeCacheKey(user){
  return `lakbai.home.${VERSION}:${user?.id || 'anon'}`;
}

/** Order-insensitive signature of the traveler's interests. */
export function prefsSignature(prefs){
  return (Array.isArray(prefs) ? [...prefs] : []).map(String).sort().join('|');
}

/** Cached entry for this traveler, or null when there is nothing we may trust. */
export function readHomeCache(user, coords, prefs, now = Date.now()){
  let raw;
  try { raw = localStorage.getItem(homeCacheKey(user)); } catch { return null; }
  if (!raw) return null;
  let entry;
  try { entry = JSON.parse(raw); } catch { return null; }
  if (!entry || !Array.isArray(entry.places) || !entry.places.length) return null;
  if (entry.prefs !== prefsSignature(prefs)) return null;
  if (!entry.at || !Number.isFinite(entry.at.lng) || !Number.isFinite(entry.at.lat)) return null;
  return { places: entry.places, at: entry.at, savedAt: entry.savedAt || 0, now };
}

/** True when an entry should refresh: aged out or the traveler moved far away. */
export function isStale(entry, coords, now = Date.now()){
  if (!entry) return true;
  if (!(now - entry.savedAt < STALE_MS)) return true;
  const km = haversineKm(entry.at.lng, entry.at.lat, coords?.lng, coords?.lat);
  return km != null && km > STALE_KM;
}

export function writeHomeCache(user, coords, prefs, places, now = Date.now()){
  if (!Array.isArray(places) || !places.length) return;
  try {
    localStorage.setItem(homeCacheKey(user), JSON.stringify({
      places,
      at: { lng: coords.lng, lat: coords.lat },
      prefs: prefsSignature(prefs),
      savedAt: now,
    }));
  } catch { /* storage full — the feed still works, it just won't be cached */ }
}

export function clearHomeCache(user){
  try { localStorage.removeItem(homeCacheKey(user)); } catch { /* ignore */ }
}
