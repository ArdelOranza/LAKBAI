/**
 * The shared place catalogue, cached for offline use.
 *
 * `/api/catalogue` is the one list the map and the Dining/Beaches screens read.
 * It joins curated + community spots with the dataset rows (server-side), and
 * this module removes the overlap that survives — the same building often
 * appears in both layers. Merging keeps the earlier layer (curated first, then
 * community, then dataset), matching the map's visual priority.
 */
import { apiUrl } from './apiBase.js';
import { samePlace } from './pinDedupe.js';

const KEY = 'lakbai.catalogue';

function readLocal(){
  try { return JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]'); } catch { return []; }
}
function writeLocal(list){
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(list)); } catch { /* full / blocked storage */ }
}

/** A coordinate as a number, or NaN when the value is blank (Number(null) is 0). */
const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));

/** One place per building, keeping the first (highest-priority) source. */
export function dedupeCatalogue(list){
  const kept = [];
  for (const raw of Array.isArray(list) ? list : []){
    if (!raw) continue;
    const lng = num(raw.lng), lat = num(raw.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const place = { ...raw, lng, lat };
    if (kept.some(k => k.id === place.id || samePlace(k, place))) continue;
    kept.push(place);
  }
  return kept;
}

/** The catalogue, network-first (localStorage is only the offline fallback). */
export async function fetchCatalogue({ fetchImpl } = {}){
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const local = readLocal();
  try {
    const r = await doFetch(apiUrl('/api/catalogue'));
    if (!r.ok) throw new Error('catalogue unavailable');
    const { places } = await r.json();
    const out = dedupeCatalogue(places);
    writeLocal(out);
    return out;
  } catch (e) {
    if (Array.isArray(local) && local.length) return dedupeCatalogue(local);
    throw e;
  }
}

/** Invalidate the offline cache so the next fetch is guaranteed fresh. */
export function bustCatalogueCache(){
  try { globalThis.localStorage?.removeItem(KEY); } catch { /* ignore */ }
}