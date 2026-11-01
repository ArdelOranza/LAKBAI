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

/** Mapbox static map centred on the place, so cards are never imageless. */
export function mapThumb(lng, lat, token, { width = 600, height = 340 } = {}){
  if (!token || !hasCoords(lng, lat)) return null;
  const pin = `pin-s+1667D9(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},14.5,0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}

/** Normalised card data for one AI candidate. */
export function cardFor(candidate = {}, spots = []){
  const spot = matchSpot(candidate.name, spots);
  return {
    id: spot?.id || normalizeName(candidate.name),
    name: candidate.name || spot?.name || 'Unknown place',
    hint: candidate.hint || spot?.town || '',
    description: candidate.description || spot?.blurb || '',
    rating: toNumber(candidate.rating),
    tags: (spot?.categories || []).slice(0, 3),
    lng: spot?.lng,
    lat: spot?.lat,
    photo: (spot?.photos && spot.photos[0]) || null,
    spot,
  };
}