/**
 * Mapbox Static Images as the universal photo fallback (U14-A).
 *
 * Real dataset photos stay primary; when a place has none but does have a
 * location, we render a small static map of it instead of a blank slot, so a
 * traveler always gets a visual anchor for every recommended place.
 */

function hasCoords(lng, lat){
  const missing = v => v === null || v === undefined || v === '';
  if (missing(lng) || missing(lat)) return false;
  return Number.isFinite(Number(lng)) && Number.isFinite(Number(lat));
}

/** Mapbox static map centred on the place, so cards are never imageless. */
export function staticMapThumb(lng, lat, token, { width = 600, height = 340 } = {}){
  if (!token || !hasCoords(lng, lat)) return null;
  const pin = `pin-s+0066FF(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},14.5,0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}

/** The public Mapbox token, read at call time so tests can stub the env. */
export function mapboxToken(){
  return import.meta.env?.VITE_MAPBOX_TOKEN || '';
}

/**
 * Photo hierarchy (enforced everywhere, edited JSON first):
 *   1 'json'      — curated dataset / admin-verified URL (highest trust)
 *   2 'wikimedia' — real photo found server-side via Wikimedia Commons
 *   3 'mapbox'    — static map thumbnail (last resort, when no real photo)
 */
export const PHOTO_HIERARCHY = ['json', 'wikimedia', 'mapbox'];

function isWikimedia(u){
  return /wikimedia\.org|upload\.wikimedia|commons\.wikimedia/i.test(String(u || ''));
}
function inferSource(url){
  if (!url) return null;
  return isWikimedia(url) ? 'wikimedia' : 'json';
  // any other http(s) image is a curated/JSON/admin photo
}

/** Where this place's photo comes from, in hierarchy order. */
export function photoSource(place){
  if (!place || typeof place !== 'object') return null;
  // Explicit tag wins (server sets it) — but a tagged json must still win over a tagged wikimedia when both exist.
  const photos = Array.isArray(place.photos) ? place.photos.filter(p => typeof p === 'string' && p.trim()) : [];
  const bare = (typeof place.photo === 'string' && place.photo.trim()) ? place.photo.trim() : null;
  const sources = Array.isArray(place.photoSources) ? place.photoSources : null;
  // 1) JSON: curated photos array or explicit json tag
  if (sources && sources[0] === 'json') return 'json';
  if (place.photoSource === 'json' && (photos.length || bare)) return 'json';
  if (photos.length && !isWikimedia(photos[0])) {
    // first photo is not wikimedia → curated/json
    if (!place.photoSource || place.photoSource === 'json') return 'json';
  }
  if (bare && !isWikimedia(bare) && (!place.photoSource || place.photoSource === 'json')) return 'json';
  // 2) Wikimedia real photo
  if (place.photoSource === 'wikimedia' && (photos.length || bare)) return 'wikimedia';
  if (photos.length && isWikimedia(photos[0])) return 'wikimedia';
  if (bare && isWikimedia(bare)) return 'wikimedia';
  // legacy: any non-wikimedia http photo is json
  if (photos.length || bare) return 'json';
  // 3) Mapbox fallback (needs coords to be renderable, but provenance is still mapbox)
  return 'mapbox';
}

/** First image to show for a place — honours JSON → Wikimedia → Mapbox. */
export function placeImage(place, token, opts){
  if (!place || typeof place !== 'object') return null;
  const photos = Array.isArray(place.photos) ? place.photos.filter(p => typeof p === 'string' && p.trim()) : [];
  const bare = (typeof place.photo === 'string' && place.photo.trim()) ? place.photo.trim() : null;
  // Hierarchy pick: prefer the highest-ranked candidate present.
  // Server sends ordered photos[]; client re-ranks defensively so array order
  // alone can never make a wikimedia map beat a json photo.
  const ranked = [];
  for (const u of photos) ranked.push(u);
  if (bare && !photos.includes(bare)) ranked.push(bare);
  if (ranked.length){
    const find = pred => ranked.find(pred);
    const jsonPick = find(u => !isWikimedia(u));
    const wikiPick = find(u => isWikimedia(u));
    // JSON wins if it exists anywhere in the list, even if wikimedia was first
    const pick = jsonPick || wikiPick || ranked[0];
    if (pick) return pick.trim();
  }
  return staticMapThumb(place?.lng, place?.lat, token, opts);
}
