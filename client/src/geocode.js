// Reverse geocoding for the Home location line. One small, testable sink for the
// Mapbox call; the module-level cache is keyed per ~100 m so GPS jitter and
// StrictMode's dev double-mount never re-hit the API.
const bucket = v => Math.round(v * 1000) / 1000;
const keyFor = (lng, lat) => bucket(lng) + ',' + bucket(lat);
const cache = new Map();

export function resetGeocodeCache(){ cache.clear(); }

/** Truthful label for a fix: "<Town>, <Region>" when the geocoder reports a
 *  region, else just "<Town>". Returns null when there is nothing to show
 *  (no token, offline, or an unusable response) — callers keep their last label. */
export async function reverseGeocode(lng, lat){
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;
  const key = keyFor(lng, lat);
  if (cache.has(key)) return cache.get(key);
  let label = null;
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&limit=1&access_token=${token}`);
    if (r.ok){
      const data = await r.json();
      const f = data.features && data.features[0];
      if (f && f.text){
        const region = (f.context || []).find(c => String(c.id || '').startsWith('region.'));
        label = region && region.text ? `${f.text}, ${region.text}` : f.text;
      }
    }
  } catch { /* offline or blocked: null keeps the last good label */ }
  cache.set(key, label);
  return label;
}
