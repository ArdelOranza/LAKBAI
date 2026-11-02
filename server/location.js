// Where the traveler is, so the AI picks candidates near them instead of
// province-famous spots on the far side of Pangasinan. The proximity string
// is the same "lng,lat" the client already sends for Mapbox search.
const { SPOTS } = require('./spots.js');

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

function haversineKm(aLng, aLat, bLng, bLat){
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function parseProximity(proximity){
  const [lng, lat] = String(proximity || '').split(',').map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
}

/** Nearest curated spot's town — works offline, no Mapbox call. */
function nearestTown(lng, lat){
  let best = null;
  let bestKm = Infinity;
  for (const s of SPOTS){
    if (!Number.isFinite(s.lng) || !Number.isFinite(s.lat) || !s.town) continue;
    const km = haversineKm(lng, lat, s.lng, s.lat);
    if (km < bestKm){ bestKm = km; best = s.town; }
  }
  return best && bestKm <= 45 ? best : null;
}

async function townFor(lng, lat){
  const key = lng.toFixed(2) + ',' + lat.toFixed(2);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.town;
  let town = null;
  const token = process.env.VITE_MAPBOX_TOKEN;
  if (token){
    try {
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&limit=1&access_token=${token}`);
      if (r.ok){
        const data = await r.json();
        town = (data.features && data.features[0] && data.features[0].text) || null;
      }
    } catch { /* fall through to the curated fallback */ }
  }
  town = town || nearestTown(lng, lat) || 'Pangasinan';
  cache.set(key, { town, at: Date.now() });
  return town;
}

/**
 * One sentence appended to the user message. `chatRecommend` is untouched: it
 * already prefixes the message with the Pangasinan scope line.
 */
async function locationLine(proximity){
  const p = parseProximity(proximity);
  if (!p) return '';
  const town = await townFor(p.lng, p.lat);
  return `\nThe traveler is currently in ${town}, Pangasinan (${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}). Prioritise places in or near ${town} — most candidates should be within about 20 km. Only suggest somewhere farther when the request names it or it is clearly worth the drive.`;
}

module.exports = { haversineKm, parseProximity, nearestTown, townFor, locationLine };
