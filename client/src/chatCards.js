/**
 * Turns an AI candidate into the data one chat card needs. The AI gives names,
 * hints and prose; the curated spots file supplies coordinates, real category
 * tags and (eventually) photos. Nothing here invents a field the API didn't send.
 */

export function normalizeName(name){
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Curated spot for a candidate name, tolerating shortened or padded names. */
export function matchSpot(name, spots = []){
  const n = normalizeName(name);
  if (!n) return null;
  const exact = spots.find(s => normalizeName(s.name) === n);
  if (exact) return exact;
  return spots.find(s => {
    const sn = normalizeName(s.name);
    return sn.length > 3 && (sn.includes(n) || n.includes(sn));
  }) || null;
}

function toNumber(value){
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hasCoords(lng, lat){
  const missing = v => v === null || v === undefined || v === '';
  if (missing(lng) || missing(lat)) return false;
  return Number.isFinite(Number(lng)) && Number.isFinite(Number(lat));
}

/** Re-exported from staticMap.js — the implementation lives there single-source. */
export { staticMapThumb as mapThumb } from './staticMap.js';

/** Old threads stored the extra results as "Name — Town" lines. Turn them
 *  back into the same card shape so history renders exactly like a fresh
 *  answer instead of falling back to a plain bullet list. */
export function cardsFromMore(lines = [], spots = []){
  return (Array.isArray(lines) ? lines : [])
    .map(line => {
      const raw = String(line || '').trim();
      const at = raw.indexOf(' — ');
      const name = at === -1 ? raw : raw.slice(0, at).trim();
      const hint = at === -1 ? '' : raw.slice(at + 3).trim();
      return cardFor({ name, hint }, spots);
    })
    .filter(c => c.name && c.name !== 'Unknown place');
}

/** Normalised card data for one AI candidate. */
export function cardFor(candidate = {}, spots = []){
  const spot = matchSpot(candidate.name, spots);
  const lng = spot?.lng ?? candidate.lng;
  const lat = spot?.lat ?? candidate.lat;
  // The dataset's own photo wins over the curated-spots fallback: the 150-spot
  // file carries real image URLs, and a server candidate photo is the most
  // specific thing we have for the name the AI just returned.
  return {
    id: spot?.id || normalizeName(candidate.name),
    name: candidate.name || spot?.name || 'Unknown place',
    hint: candidate.hint || spot?.town || '',
    description: candidate.description || spot?.blurb || '',
    rating: toNumber(candidate.rating),
    // Review counts come from the dataset row, never estimated.
    reviews: String(candidate.reviews ?? '').trim(),
    // Only what the model actually returned: no invented opening hours or prices.
    fees: String(candidate.fees || '').trim(),
    festival: String(candidate.festival || '').trim(),
    tags: (spot?.categories || candidate.categories || []).slice(0, 3),
    lng,
    lat,
    photos: (candidate.photos && candidate.photos.length) ? candidate.photos : (spot?.photos || []),
    photo: candidate.photo || (candidate.photos && candidate.photos[0]) || (spot?.photos && spot.photos[0]) || null,
    spot,
  };
}