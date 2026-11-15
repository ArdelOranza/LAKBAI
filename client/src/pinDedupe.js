/**
 * One pin per place.
 *
 * The map draws three independent layers — dataset recommendations, curated
 * spots and Mapbox discoveries. Nothing reconciled them, so a place that lives
 * in two of them (the curated catalogue and the imported dataset overlap a
 * lot) got two pins on the same building, tens of metres apart: two Urdaneta
 * Cathedral pins, two Manaoag basilicas, two Bolinao Falls 2 pins.
 *
 * Proximity alone must never merge two places: a mall puts a dozen different
 * restaurants on one coordinate. So a merge needs a name signal as well as the
 * distance gate.
 */
import { haversineKm } from './geo.js';

// Words that say what kind of place it is, not which one. Dropping them lets
// "Saints Peter and Paul Parish Church" meet "Saints Peter & Paul Parish Church"
// without letting "KFC" meet "Kuya J" just because both sit in SM City.
const NOISE = new Set([
  'the', 'and', 'of', 'in', 'at', 'on', 'by', 'a', 'an', 'de', 'la', 'el',
  'sm', 'mall', 'magic', 'city', 'public', 'town', 'proper',
  'park', 'plaza', 'square', 'beach', 'fall', 'cave', 'island', 'river',
  'church', 'parish', 'shrine', 'basilica', 'cathedral', 'chapel',
  'restaurant', 'restobar', 'cafe', 'coffee', 'grill', 'eatery', 'diner',
  'resort', 'hotel', 'inn', 'lodge',
  'view', 'viewpoint', 'deck', 'area', 'ground',
]);

const isNoise = w => NOISE.has(w) || NOISE.has(w.replace(/s$/, ''));

function words(name){
  return String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Identifying tokens: lower case, no type words; parentheticals included. */
export function pinTokens(name){
  return words(name).filter(w => !isNoise(w));
}

/** The same, but only the name in front of the parenthetical. */
function primaryTokens(name){
  return words(String(name || '').replace(/\([^)]*\)/g, ' ')).filter(w => !isNoise(w));
}

const compact = tokens => tokens.join('');
const DISTINCT_KM = 0.4;
const CLOSE_KM = 0.06;
const MAX_EXTRA = 2;

function isSubset(small, big){
  if (!small.length) return false;
  const have = new Set(big);
  return small.every(t => have.has(t));
}

/**
 * Could these two records be the same place?
 *
 * - a coordinate outside the radius gate is never the same place;
 * - the same identifying words, hyphen or space aside ("hot spring" vs
 *   "hotspring"), is the same place;
 * - one identifier inside the other is the same place when the extra words are
 *   a short modifier ("Urduja House" vs "Urduja House Grounds", or the
 *   parenthetical alias), not a second subject ("Manaoag" vs "Manaoag Museum &
 *   Souvenir Center");
 * - a one-word name that the longer one repeats, within 60 m, is the same place
 *   ("Malico" vs "Malico Rock View …", "Manaoag" vs "Manaoag Church").
 */
export function samePlace(a, b){
  if (!a || !b) return false;
  const km = haversineKm(Number(a.lng), Number(a.lat), Number(b.lng), Number(b.lat));
  if (km == null || km > DISTINCT_KM) return false;
  const ta = [...new Set(pinTokens(a.name))];
  const tb = [...new Set(pinTokens(b.name))];
  if (!ta.length || !tb.length) return false;
  const pa = [...new Set(primaryTokens(a.name))];
  const pb = [...new Set(primaryTokens(b.name))];
  if (pa.length && pb.length && compact(pa) === compact(pb)) return true;
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (isSubset(small, big) && big.length - small.length <= MAX_EXTRA) return true;
  const [one, many] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (one.length === 1 && many.length > 1 && many.includes(one[0]) && km <= CLOSE_KM) return true;
  return false;
}

/**
 * Drop the pins that duplicate an earlier layer's pin. Layers are passed in
 * priority order (the first layer wins), which matches the map's visual
 * priority: curated spot > dataset recommendation > Mapbox discovery.
 */
export function mergePins({ spots = [], rec = [], discover = [] } = {}){
  const kept = [];
  const layer = list => {
    const out = [];
    for (const place of list){
      if (!place) continue;
      if (!(Number.isFinite(place.lng) && Number.isFinite(place.lat))) continue;
      if (kept.some(k => k === place || samePlace(k, place))) continue;
      kept.push(place);
      out.push(place);
    }
    return out;
  };
  return { spots: layer(spots), rec: layer(rec), discover: layer(discover) };
}