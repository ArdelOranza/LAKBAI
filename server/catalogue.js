// The one place list the map and the browse screens share.
//
// Until now the map drew curated spots from /api/spots and dataset rows from
// /api/recommend, while Dining only read /api/spots — so the map showed
// restaurants the Dining list could never contain. This module joins both into
// a single catalogue (curated + admin + community spots, then every dataset row
// that owns a real coordinate) so both screens read the same source.
//
// Rows without a coordinate are dropped: they cannot be pinned, and a list that
// carries a place the map cannot show is the same desync in the other direction.
// Payloads are projected to the card shape (no full review lists / scrape
// provenance) so a ~350-place catalogue stays small enough to cache on-device.
const { allEntries, photoFields } = require('./dataset.js');
const spotList = require('./spotList.js');

// `Number(null)` is 0, so a blank coordinate must be rejected before coercion —
// otherwise a row with no point lands at 0,0 and still becomes a pin.
const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));
const hasPoint = p => Boolean(p) && Number.isFinite(num(p.lat)) && Number.isFinite(num(p.lng));

/** A rating as a number in 1..5, or null — never 0 for "unknown". */
function ratingOf(value){
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
}

function leanSpot(s){
  const photos = Array.isArray(s.photos) ? s.photos.slice() : (s.photo ? [s.photo] : []);
  return {
    id: s.id,
    name: s.name,
    town: s.town || '',
    lng: Number(s.lng),
    lat: Number(s.lat),
    categories: Array.isArray(s.categories) ? s.categories.slice() : [],
    rating: ratingOf(s.rating),
    fees: s.fees != null ? s.fees : (s.price != null ? s.price : null),
    address: s.address || '',
    description: s.blurb || s.description || '',
    festival: s.festival || '',
    photos,
    photo: photos[0] || s.photo || null,
    photoSource: s.photoSource || null,
    sourceKind: s.community ? 'community' : 'spot',
  };
}

function leanEntry(e){
  return {
    id: e.id,
    name: e.name,
    town: e.town || '',
    lng: Number(e.lng),
    lat: Number(e.lat),
    categories: Array.isArray(e.categories) ? e.categories.slice() : [],
    rating: ratingOf(e.rating),
    reviews: e.reviews || '',
    fees: e.price || null,
    address: e.address || '',
    description: e.description || '',
    festival: e.festival || '',
    activities: Array.isArray(e.activities) ? e.activities.slice() : [],
    ...photoFields(e.photos),
    sourceKind: 'dataset',
  };
}

function buildCatalogue({ curated = [], dataset = [] } = {}){
  const spots = (Array.isArray(curated) ? curated : []).filter(hasPoint).map(leanSpot);
  const rows = (Array.isArray(dataset) ? dataset : []).filter(hasPoint).map(leanEntry);
  return [...spots, ...rows];
}

/** The live union: curated + admin + approved community, then the dataset. */
async function fullCatalogue(){
  const curated = await spotList.listSpots();
  return buildCatalogue({ curated, dataset: allEntries() });
}

module.exports = { buildCatalogue, fullCatalogue, leanSpot, leanEntry };