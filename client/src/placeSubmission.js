/**
 * The "add a missing place" flow's rules, with no React and no Supabase in
 * them: the vocabulary a submission may use, where a pin is allowed to land,
 * and what a complete form looks like. Both the sheet and the store read this,
 * so the form and the database row cannot drift apart.
 */

// Pangasinan's cities and municipalities, taken from the same LTFRB town
// directory the server quotes fares from
// (server/data/ltfrb-pangasinan-bus-fares.json). The directory annotates some
// entries for a page heading ("Lingayen (Provincial Capital)"); those
// annotations are dropped here, because this is a value a traveller picks.
export const TOWNS = [
  'Alaminos City', 'Bolinao', 'Agno', 'Anda', 'Bani', 'Burgos', 'Dasol', 'Infanta', 'Mabini', 'Sual',
  'Lingayen', 'Aguilar', 'Basista', 'Binmaley', 'Bugallon', 'Labrador', 'Mangatarem', 'Urbiztondo',
  'San Carlos City', 'Bayambang', 'Calasiao', 'Malasiqui', 'Mapandan', 'Santa Barbara',
  'Dagupan City', 'Manaoag', 'Mangaldan', 'San Fabian', 'San Jacinto',
  'Urdaneta City', 'Villasis', 'Alcala', 'Bautista', 'Binalonan', 'Laoac', 'Pozorrubio', 'Sison', 'Santo Tomas', 'Rosales',
  'Asingan', 'Balungao', 'Natividad', 'San Manuel', 'San Nicolas', 'San Quintin', 'Santa Maria', 'Tayug', 'Umingan',
];

// The words the app already sorts places by (filters.js, browse.js kindMatch).
// A submission picks one, so an approved place drops straight into the
// existing filters instead of needing a new category nobody filters on.
export const CATEGORIES = ['Beach', 'Nature', 'Food', 'Stay', 'Culture', 'Event'];

// The same province lock the database check and the server use
// (119.7,15.7,120.7,16.5): a mis-panned map cannot submit a pin in Manila.
export const PROVINCE_BBOX = { minLng: 119.7, minLat: 15.7, maxLng: 120.7, maxLat: 16.5 };

/** The note column is 500 characters; the form should not let it overflow. */
export const NOTE_MAX = 500;

export function inProvince(lng, lat){
  const x = Number(lng), y = Number(lat);
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= PROVINCE_BBOX.minLng && x <= PROVINCE_BBOX.maxLng
    && y >= PROVINCE_BBOX.minLat && y <= PROVINCE_BBOX.maxLat;
}

/** "16.0434, 120.3431" — latitude first, the way a map coordinate reads. */
export function pointLabel(point){
  if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) return '';
  return `${Number(point.lat).toFixed(4)}, ${Number(point.lng).toFixed(4)}`;
}

/**
 * The point a Continue tap would submit, or null when there is not one yet.
 * In "gps" mode a null fix means no fix has arrived — the caller must pass one
 * rather than letting this reach for the Pangasinan fallback centre, which is
 * where the app happens to look, not where the traveller is standing.
 */
export function resolvePoint({ mode, mapCenter, fix } = {}){
  const p = mode === 'gps' ? fix : mapCenter;
  if (!p || !inProvince(p.lng, p.lat)) return null;
  return { lng: Number(p.lng), lat: Number(p.lat) };
}

/** Why Continue is unavailable, in the traveller's words; null when it is ready. */
export function continueHint(opts = {}){
  if (opts.mode === 'gps' && !opts.fix) return 'Waiting for GPS...';
  if (!resolvePoint(opts)) return 'Move the map to place the pin inside Pangasinan';
  return null;
}

/** Name, one category and a town. Everything else on the form is optional. */
export function detailsComplete(draft = {}){
  const name = String(draft.name || '').trim();
  return name.length >= 2 && name.length <= 120
    && CATEGORIES.includes(draft.category)
    && TOWNS.includes(draft.town);
}

/** The row as `place_submissions` stores it: trimmed, one category, no empty strings. */
export function submissionRow(userId, draft = {}){
  const blank = v => { const s = String(v ?? '').trim(); return s === '' ? null : s; };
  const note = blank(draft.note);
  return {
    user_id: userId,
    name: String(draft.name || '').trim(),
    town: String(draft.town || '').trim(),
    barangay: blank(draft.barangay),
    categories: draft.category ? [draft.category] : [],
    lng: Number(draft.lng),
    lat: Number(draft.lat),
    note: note ? note.slice(0, NOTE_MAX) : null,
    hours: blank(draft.hours),
    price: blank(draft.price),
    photo_path: blank(draft.photoPath),
  };
}

const STATUS = {
  pending: { text: 'Pending', tone: 'pending' },
  approved: { text: 'Live', tone: 'live' },
  rejected: { text: 'Not added', tone: 'rejected' },
};

export function statusLabel(status){
  return STATUS[status] || STATUS.pending;
}

/** Only a row an editor has not opened yet can be taken back. */
export function canWithdraw(status){
  return status === 'pending';
}
