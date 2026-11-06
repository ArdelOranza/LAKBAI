// Local Pangasinan dataset.
//
// This file is the retriever and the safety net: grounded.js hands the matching
// rows to the AI as its only source of truth, and these same helpers answer
// directly when the AI is unavailable (or when LAKBAI_AI=off). agent.js is
// untouched — it stays the fallback whenever no dataset is installed.
//
// Drop a file at server/data/places.json (or set LAKBAI_DATA=/abs/path.json).
// Any array of objects works; the normaliser below accepts the common field
// spellings, so a hand-made file does not need to be reshaped first.
const fs = require('fs');
const path = require('path');
const { searchPlaces, inBox } = require('./places.js');
const { haversineKm, parseProximity } = require('./location.js');
const { isAttraction } = require('./attractions.js');
const { SPOTS } = require('./spots.js');
const { decodePlusCode } = require('./pluscode.js');

const DATA_DIR = path.join(__dirname, 'data');

// Activation point: drop the real Pangasinan file at server/data/places.json
// (or point LAKBAI_DATA at it). Nothing here runs until that file exists, so the
// existing AI path keeps working untouched in the meantime.

const NO_MATCH = "I don't have that in my Pangasinan list yet. Try a town (Dagupan, Alaminos, Bolinao), a dish, or a kind of place like beach, cafe or festival.";

let cache = { sig: '', entries: [] };
const geoCache = new Map();

const str = v => (v === null || v === undefined ? '' : String(v).trim());
const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Every JSON in server/data is part of the reference set: places.json holds the
// restaurants, spots.json the tourist spots. LAKBAI_DATA narrows it to one file
// (used by the tests).
function dataFiles(){
  const env = process.env.LAKBAI_DATA;
  if (env) return fs.existsSync(env) ? [env] : [];
  try {
    return fs.readdirSync(DATA_DIR)
      .filter(f => f.toLowerCase().endsWith('.json'))
      .sort()
      .map(f => path.join(DATA_DIR, f));
  } catch { return []; }
}

// --- coordinates that only exist in prose ---------------------------------
const PANGASINAN_CENTER = { lat: 16.03, lng: 120.23 };
// Approximate town centres, used as the reference point for short plus codes
// ("RF54+F9V"). A 4-character prefix covers a 1° cell, so these only need to be
// right to within ~50 km.
const TOWN_CENTERS = {
  bayambang: { lat: 15.8299, lng: 120.4500 },
  balungao: { lat: 15.9111, lng: 120.6900 },
  natividad: { lat: 16.0689, lng: 120.6694 },
  'san nicolas': { lat: 16.0000, lng: 120.6833 },
  sison: { lat: 16.0800, lng: 120.6200 },
  'san carlos city': { lat: 15.9283, lng: 120.3489 },
  tayug: { lat: 16.0300, lng: 120.7400 },
  'urdaneta city': { lat: 15.9761, lng: 120.5711 },
  umingan: { lat: 15.9289, lng: 120.8389 },
  rosales: { lat: 15.9526, lng: 120.6346 },
  villasis: { lat: 15.9000, lng: 120.5889 },
  'san quintin': { lat: 15.9844, lng: 120.5900 },
};

let townCenters = null;
function townCenter(town){
  const key = String(town || '').replace(/\s*\(.*$/, '').trim().toLowerCase();
  if (!key) return null;
  if (!townCenters){
    townCenters = new Map();
    for (const s of SPOTS){
      if (!s.town || !Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue;
      const k = String(s.town).toLowerCase();
      const prev = townCenters.get(k) || { lat: 0, lng: 0, n: 0 };
      townCenters.set(k, { lat: prev.lat + s.lat, lng: prev.lng + s.lng, n: prev.n + 1 });
    }
  }
  const hit = townCenters.get(key);
  if (hit && hit.n) return { lat: hit.lat / hit.n, lng: hit.lng / hit.n };
  return TOWN_CENTERS[key] || null;
}

function dmsToDecimal(deg, min, sec, hemi){
  const v = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return /[SW]/i.test(hemi) ? -v : v;
}

/** "15°49′11″N 120°26′39″E" or a Google plus code ("RF54+F9V"). */
function coordsFromText(text, town){
  const s = String(text || '');
  const dms = s.match(/(\d{1,3})°\s*(\d{1,2})[′'’]\s*(\d{1,2}(?:\.\d+)?)["″”]?\s*([NS])[,\s]*(\d{1,3})°\s*(\d{1,2})[′'’]\s*(\d{1,2}(?:\.\d+)?)["″”]?\s*([EW])/i);
  if (dms) return { lat: dmsToDecimal(dms[1], dms[2], dms[3], dms[4]), lng: dmsToDecimal(dms[5], dms[6], dms[7], dms[8]) };
  const plus = s.match(/\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3})\b/);
  if (!plus) return null;
  const code = plus[1];
  const isFull = code.indexOf('+') >= 8; // self-contained, no reference needed
  const ref = townCenter(town) || (isFull ? PANGASINAN_CENTER : null);
  // A short code decoded against the wrong reference lands in the wrong town, so
  // no coordinates is better than a pin in the sea.
  if (!ref) return null;
  return decodePlusCode(code, ref.lat, ref.lng) || null;
}

const feeLabel = k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
/** Fees arrive as a string or a big object of named rates. */
function feeText(fees){
  if (!fees) return { short: '', detail: '' };
  if (typeof fees !== 'object') return { short: str(fees), detail: str(fees) };
  // Flatten one level of nesting (e.g. { fees: { admission: '100' } }) and
  // drop nested objects deeper than that. A value under a "note/notes" key is
  // never the displayed price — it is prose, not a rate.
  const rows = [];
  const push = (k, v) => {
    if (v === null || v === undefined || v === '') return;
    if (typeof v === 'object' && !Array.isArray(v)){
      for (const [k2, v2] of Object.entries(v)) push(k2, v2);
      return;
    }
    rows.push([k, String(v)]);
  };
  for (const [k, v] of Object.entries(fees)) push(k, v);
  rows.sort(([a], [b]) => /admission|entrance|price|rate/i.test(a) ? -1 : /admission|entrance|price|rate/i.test(b) ? 1 : 0);
  const priced = rows.filter(([k]) => !/notes?/i.test(k));
  const priority = priced.find(([k]) => /admission|entrance/i.test(k)) || priced[0];
  return {
    short: priority ? str(priority[1]) : '',
    detail: rows.slice(0, 8).map(([k, v]) => `${feeLabel(k)}: ${v}`).join(' · '),
  };
}

const LIST_KEYS = ['places', 'restaurants', 'spots', 'tourist_spots', 'items', 'entries', 'attractions', 'results', 'data'];
function pickList(raw){
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  for (const k of LIST_KEYS) if (Array.isArray(raw[k])) return raw[k];
  const arrays = Object.values(raw).filter(Array.isArray);
  // Prefer the array that actually holds place-shaped records.
  return arrays.find(a => a.some(x => x && typeof x === 'object' && (x.name || x.title || x.official_name || x.place_name))) || arrays[0] || [];
}

function parseCount(raw){
  if (raw === null || raw === undefined || raw === '') return '';
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
}

function parseRating(raw, countRaw){
  let rating = '';
  let reviews = parseCount(countRaw);
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw <= 5) rating = raw.toFixed(1);
  else {
    const text = str(raw);
    const m = text.match(/(\d(?:\.\d+)?)\s*(?:\/\s*5|stars?|★)?/);
    if (m){
      const n = Number(m[1]);
      if (n > 0 && n <= 5) rating = n.toFixed(1);
    }
    if (!reviews){
      const rm = text.match(/([\d,.]+)\s*(k?)\s*review/i);
      if (rm) reviews = parseCount(rm[1] + rm[2]);
    }
  }
  return { rating, reviews };
}

function reviewQuotes(raw){
  if (!Array.isArray(raw)) return [];
  return raw
    .map(r => str(typeof r === 'string' ? r : (r && (r.text || r.quote || r.comment || r.review))))
    .filter(Boolean)
    .map(t => (t.length > 180 ? t.slice(0, 177).trimEnd() + '…' : t))
    .slice(0, 3);
}

/** The 150-spot file's `verified_sources` are { title, url } objects, not bare URLs. */
function sourceUrlsOf(raw){
  const direct = listOf(raw.verified_source_urls || raw.sources);
  if (direct.length) return direct;
  if (Array.isArray(raw.verified_sources)) return raw.verified_sources.map(s => str(s && (s.url || s.href || s.link))).filter(Boolean);
  if (Array.isArray(raw.sources)) return raw.sources.map(s => str(s && (s.url || s.href || s.link))).filter(Boolean);
  return [];
}

/** Phone numbers live inside the 150-spot file's `location` prose, not a field. */
function phoneFromText(text){
  const m = String(text || '').match(/(?:Phone:\s*)([\+\d][\d\s\/()-]*\d)/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** The 150-spot file has no festival field; a spot name of the form
 *  "X Festival (...)" is itself the festival signal. */
function festivalFromText(name, address){
  const m = String(name || '').match(/(.+?\bFestival\b)/i);
  if (m) return m[1].trim();
  const m2 = String(address || '').match(/(.+?\bFestival\b)/i);
  return m2 ? m2[1].trim() : '';
}

function listOf(v){
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  return str(v) ? [str(v)] : [];
}

const INTENT_WORDS = {
  food: /\b(eat|food|restaurant|kainan|kain|meal|lunch|dinner|breakfast|brunch|coffee|cafe|dish|seafood|grill|sisig|pizza|burger|pasta|milk tea|dessert|pancit|bagnet|bangus)\b/i,
  event: /\b(festival|fiesta|event|celebration|parade|carnival|fair)\b/i,
  nearby: /\b(near|nearby|around|close|malapit|walking distance)\b/i,
  emergency: /\b(hospital|emergency|ambulance|police|fire|accident|injured|medical|clinic)\b/i,
  plan: /\b(plan|itinerary|day trip|schedule)\b/i,
};

const CATEGORY_HINTS = {
  food: /\b(foods?|restaurants?|cafes|coffee|eateries|grills?|bars?|bakeries|desserts?|kitchens?|dining|seafood|carinderia|panciteria)\b/i,
  beach: /\b(beaches|beach|islands|island|coves|cove|coast|shore|sandbar)\b/i,
  nature: /\b(falls|waterfall|spring|cave|river|mountain|forest|park|eco|garden|lake)\b/i,
  culture: /\b(church|basilica|shrine|museum|heritage|historical|landmark|festival)\b/i,
  stay: /\b(hotels?|resorts?|inns?|transient|lodges?|hostels?|villas?)\b/i,
  event: /\b(festivals?|fiestas?|events?)\b/i,
};

// What kind of place the message is asking for. Used to keep a beach request
// from being answered with the town's restaurants when the provided files only
// carry restaurants there.
const KIND_WORDS = {
  beach: /\b(beaches|beach|islands|island|coves|cove|coast|shore|sandbar)\b/i,
  nature: /\b(falls|waterfalls|waterfall|springs|spring|caves|cave|rivers|river|mountains|mountain|forests|forest|eco[- ]?parks?|gardens|garden|lakes|lake|trails?|hiking)\b/i,
  culture: /\b(churches|church|basilicas|basilica|shrines|shrine|museums|museum|heritages?|historical|landmarks|landmark)\b/i,
  stay: /\b(hotels|hotel|resorts|resort|inns|inn|transient|lodges|hostel|villas|villa)\b/i,
  attraction: /\b(tourist|attractions?|sightseeing|spots?|things to do|places? to visit)\b/i,
};

function requestedKinds(message){
  return Object.keys(KIND_WORDS).filter(k => KIND_WORDS[k].test(String(message || '')));
}

function intentsFor(entry){
  const text = `${entry.name} ${entry.categories.join(' ')} ${entry.description}`;
  return Object.entries(CATEGORY_HINTS).filter(([, re]) => re.test(text)).map(([k]) => k);
}

function normalize(raw, index, kind = '', fileTag = ''){
  if (!raw || typeof raw !== 'object') return null;
  const name = str(raw.name || raw.title || raw.official_name || raw.place_name || raw.placeName);
  if (!name) return null;
  const town = str(raw.municipality || raw.town || raw.city || raw.locality || raw.municipality_or_city || (typeof raw.location === 'string' ? raw.location : '')).replace(/\s*\(.*$/, '').trim();
  // The 150-spot file calls this `location`; it carries the address (often with
  // the plus code) even when there is no separate address field.
  const address = str(raw.address || raw.full_address || raw.formatted_address || raw.vicinity || raw.exact_location_address || (typeof raw.location === 'string' ? raw.location : ''));
  const rr = raw.ratings_and_reviews && typeof raw.ratings_and_reviews === 'object' ? raw.ratings_and_reviews : {};
  // Numeric review counts win over a `reviews` array (the 150-spot file carries
  // both `total_review_count` and a `reviews` array of quote objects).
  const { rating, reviews } = parseRating(
    raw.rating ?? raw.average_rating ?? raw.avg_rating ?? rr.overall_rating,
    raw.total_review_count ?? raw.review_count ?? raw.user_ratings_total ?? raw.total_reviews ?? rr.total_review_count ?? raw.reviews
  );
  const categories = listOf(raw.categories || raw.category || raw.type || raw.tags);
  // A restaurants-only file carries no category field, so the list key itself
  // tells us what these are.
  if (/restaurant|food|eater/i.test(kind) && !categories.length) categories.push('restaurant');
  // `fee_in_venue` is the 150-spot file's prose paragraph of rates.
  const fees = feeText(raw.entrance_and_venue_fees || raw.fee_in_venue || raw.price || raw.price_range || raw.fees);
  let lat = num(raw.lat ?? raw.latitude ?? (raw.coordinates && raw.coordinates.lat));
  let lng = num(raw.lng ?? raw.lon ?? raw.longitude ?? (raw.coordinates && raw.coordinates.lng));
  if ((lat === null || lng === null) && address){
    const found = coordsFromText(address, town);
    if (found){ lat = found.lat; lng = found.lng; }
  }
  const entry = {
    id: str(raw.id || raw.place_id || raw.placeId) || `${fileTag ? fileTag + '-' : ''}${name}-${town}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    town,
    address,
    categories,
    lat,
    lng,
    rating,
    reviews,
    hours: listOf(raw.opening_hours || raw.hours).join(' · '),
    phone: str(raw.phone_number || raw.phone || raw.contact) || phoneFromText(address),
    website: str(raw.website || raw.site),
    mapsUrl: str(raw.google_maps_url || raw.maps_url || raw.map_url),
    sourceUrls: sourceUrlsOf(raw),
    photos: listOf(raw.verified_image_urls || raw.photos || raw.images),
    description: str(raw.description || raw.blurb || raw.about || raw.summary || raw.detailed_description),
    activities: listOf(raw.what_to_do_activities || raw.activities || raw.what_to_do),
    price: fees.short,
    feesDetail: fees.detail,
    festival: str(raw.festival) || festivalFromText(name, address),
    quotes: reviewQuotes(raw.real_reviews || raw.reviews_list || raw.top_reviews || raw.reviews || rr.verified_reviews),
  };
  entry.intents = intentsFor(entry);
  // The tourist-spot file has no category column; the derived kinds are good
  // enough for the card tags.
  if (!entry.categories.length && entry.intents.length){
    entry.categories = entry.intents.map(c => c.charAt(0).toUpperCase() + c.slice(1));
  }
  entry.searchText = [entry.name, entry.town, entry.address, entry.categories.join(' '), entry.description, entry.activities.join(' '), entry.feesDetail, entry.quotes.join(' ')].join(' ').toLowerCase();
  return entry;
}

function readEntries(){
  const files = dataFiles();
  if (!files.length) return [];
  const sig = files.map(f => {
    try { return f + ':' + fs.statSync(f).mtimeMs; } catch { return f + ':0'; }
  }).join('|');
  if (cache.sig === sig) return cache.entries;
  const entries = [];
  for (const file of files){
    let raw;
    try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const list = pickList(raw);
    const kind = !Array.isArray(raw) && raw && typeof raw === 'object'
      ? Object.keys(raw).find(k => raw[k] === list) || ''
      : '';
    const fileTag = path.basename(file, path.extname(file));
    list.forEach((item, i) => {
      const entry = normalize(item, i, kind, fileTag);
      if (entry) entries.push(entry);
    });
  }
  cache = { sig, entries };
  return entries;
}

function datasetInfo(){
  const entries = readEntries();
  return { ready: entries.length > 0, file: dataFiles().join(', '), count: entries.length };
}

// The AI reference is exactly the files in server/data — nothing else.
// server/spots.js still drives the map and the curated browsing screens, but it
// is deliberately NOT mixed in here: if a place is not in the provided files,
// the assistant says so instead of quietly answering from another list.
function allEntries(){
  const seen = new Set();
  const out = [];
  for (const entry of readEntries()){
    const key = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

const STOP = new Set(['the', 'and', 'for', 'with', 'you', 'your', 'are', 'can', 'how', 'what', 'where', 'when', 'who', 'why', 'any', 'some', 'best', 'good', 'great', 'top', 'please', 'want', 'need', 'looking', 'find', 'show', 'give', 'recommend', 'suggest', 'near', 'around', 'close', 'about', 'there', 'here', 'this', 'that', 'from', 'have', 'has', 'get', 'try', 'place', 'places', 'spot', 'spots', 'trip', 'pangasinan', 'philippines', 'me', 'my', 'i', 'a', 'an', 'in', 'at', 'to', 'of', 'is', 'it', 'on', 'or', 'do', 'go', 'be']);

function singular(w){
  // Normalise plurals so "beaches" and "beach" (and islands/coves/falls…)
  // match the same dataset entries.
  if (/ies$/.test(w) && w.length > 3) return w.slice(0, -3) + 'y';
  if (/es$/.test(w) && w.length > 2) return w.slice(0, -2);
  if (/s$/.test(w) && !/ss$/.test(w) && w.length > 3) return w.slice(0, -1);
  return w;
}

function tokens(message){
  return [...new Set(String(message || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(singular)
    .filter(t => t.length > 2 && !STOP.has(t)))];
}

function intentOf(message){
  const text = String(message || '');
  for (const key of ['emergency', 'event', 'food', 'nearby', 'plan']) if (INTENT_WORDS[key].test(text)) return key;
  return 'discover';
}

function scoreEntry(entry, toks, intent, here){
  const name = entry.name.toLowerCase();
  const town = entry.town.toLowerCase();
  let score = 0;
  let matched = false;
  for (const t of toks){
    if (name === t){ score += 9; matched = true; }
    else if (name.includes(t)){ score += 5; matched = true; }
    else if (town.includes(t)){ score += 3; matched = true; }
    else if (entry.searchText.includes(t)){ score += 1; matched = true; }
  }
  if (intent !== 'discover' && intent !== 'nearby' && entry.intents.includes(intent)){ score += 4; matched = true; }
  if (here && Number.isFinite(entry.lat) && Number.isFinite(entry.lng)){
    const km = haversineKm(here.lng, here.lat, entry.lng, entry.lat);
    score += Math.max(0, 4 - km / 8);
  }
  const rating = Number(entry.rating);
  if (Number.isFinite(rating)) score += rating / 5;
  return { score, matched };
}

const isFoodOnly = entry => entry.intents.includes('food') && !entry.intents.some(i => i !== 'food');

/** The town the message names, if the files cover it. */
function townFilterFor(message, entries){
  const text = ' ' + String(message || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const towns = [...new Set(entries.map(e => e.town).filter(Boolean))];
  for (const town of towns){
    const k = town.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (k && text.includes(` ${k} `)) return town;
  }
  for (const town of towns){
    const short = town.toLowerCase().replace(/\s+city$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (short && text.includes(` ${short} `)) return town;
  }
  return null;
}

function distanceKm(entry, here){
  if (!here || !Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) return Infinity;
  return haversineKm(here.lng, here.lat, entry.lng, entry.lat);
}

/** Ranked dataset entries for a free-text request. */
function search(message, proximity, limit = 6){
  const entries = allEntries();
  if (!entries.length) return [];
  const intent = intentOf(message);
  const toks = tokens(message);
  const here = parseProximity(proximity);
  const scored = entries.map(entry => ({ entry, ...scoreEntry(entry, toks, intent, here) }));
  let hits = scored.filter(s => s.matched);
  if (!hits.length && intent !== 'discover') hits = scored.filter(s => s.entry.intents.includes(intent));
  if (!hits.length) return [];
  // A named town wins over a loose word match elsewhere.
  const town = townFilterFor(message, entries);
  if (town){
    const local = hits.filter(s => s.entry.town === town);
    if (local.length) hits = local;
  }
  // "Where can I eat?" should not return a beach that happens to sit in the
  // town you named, as long as the file has actual food places.
  if (intent === 'food' || intent === 'event'){
    const typed = hits.filter(s => s.entry.intents.includes(intent));
    if (typed.length) hits = typed;
  }
  // A beach / falls / church request should not be answered with the town's
  // restaurants just because the town name matched. If the provided files have
  // nothing of that kind, the honest answer is "not in the data".
  const kinds = requestedKinds(message);
  const specific = kinds.filter(k => k !== 'attraction');
  if (specific.length){
    const typed = hits.filter(s => specific.some(k => s.entry.intents.includes(k)));
    if (!typed.length) return [];
    hits = typed;
  } else if (kinds.includes('attraction') && intent !== 'food' && intent !== 'event'){
    const typed = hits.filter(s => !isFoodOnly(s.entry));
    if (!typed.length) return [];
    hits = typed;
  }
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = distanceKm(a.entry, here), db = distanceKm(b.entry, here);
    if (da !== db) return da - db;
    return Number(b.entry.rating || 0) - Number(a.entry.rating || 0);
  });
  const seen = new Set();
  const out = [];
  for (const { entry } of hits){
    // Fuzzy dedupe: same place with a parenthetical suffix ("The Spa (Bolinao)")
    // must not surface twice.
    const key = entry.name.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

/** Fill in coordinates for entries the file did not carry, via Mapbox (cached). */
async function withCoords(entries, proximity){
  // Clone so the cached allEntries() objects are never mutated in place — a
  // geocode for one place must not poison another request's entry, and two
  // files' same-named fallback ids can no longer collide in geoCache.
  const out = entries.map(e => ({ ...e }));
  const missing = out.filter(entry => !(Number.isFinite(entry.lat) && Number.isFinite(entry.lng)));
  // Bound concurrent Mapbox calls (up to 61% of rows may need geocoding).
  for (let i = 0; i < missing.length; i += 5){
    await Promise.all(missing.slice(i, i + 5).map(async entry => {
      const hit = geoCache.get(entry.id);
      if (hit){ entry.lng = hit.lng; entry.lat = hit.lat; return; }
      try {
        const hits = await searchPlaces(`${entry.name} ${entry.town} Pangasinan`, proximity);
        const found = hits.find(h => inBox(h.lng, h.lat));
        if (found){
          entry.lng = found.lng;
          entry.lat = found.lat;
          geoCache.set(entry.id, { lng: found.lng, lat: found.lat });
        }
      } catch { /* no coords beats wrong coords */ }
    }));
  }
  return out;
}

function reasonFor(entry){
  const urls = entry.sourceUrls || [];
  const isGoogle = urls.some(u => /google\.com\/maps/i.test(String(u))) || /google\.com\/maps/i.test(entry.mapsUrl || '');
  const source = isGoogle ? 'Google' : '';
  if (entry.rating && entry.reviews) return `${entry.rating}★ from ${entry.reviews}${source ? ' ' + source : ''} reviews${entry.town ? ` in ${entry.town}` : ''}.`;
  if (entry.rating) return `${entry.rating}★${source ? ' on ' + source : ''}${entry.town ? ` in ${entry.town}` : ''}.`;
  if (entry.description) return entry.description;
  return entry.town ? `A verified place in ${entry.town}.` : 'A verified place in Pangasinan.';
}

const firstSentence = text => {
  const s = String(text || '').trim();
  const cut = s.match(/^.{40,160}?[.!?](\s|$)/);
  return (cut ? cut[0] : s.slice(0, 150)).trim();
};

function answerFor(intent, entries){
  const lead = intent === 'food' ? 'Where to eat'
    : intent === 'event' ? 'Events worth catching'
    : intent === 'nearby' ? 'Closest to you'
    : 'Worth a look';
  const bullets = entries.slice(0, 5).map(e => {
    const meta = [e.town, e.rating ? `${e.rating}★${e.reviews ? ` · ${e.reviews} reviews` : ''}` : '', e.price || ''].filter(Boolean).join(' · ');
    const why = e.description ? ' — ' + firstSentence(e.description) : '';
    return `- **${e.name}**${meta ? ` (${meta})` : ''}${why}`;
  }).join('\n');
  return `${lead}:\n${bullets}`;
}

function spotlightFor(entries){
  const rated = entries.filter(e => Number(e.rating) > 0);
  if (!rated.length) return null;
  const best = rated.slice().sort((a, b) => Number(b.rating) - Number(a.rating))[0];
  return { name: best.name, reason: reasonFor(best) };
}

/** Chat-shaped payload: what /api/chat used to return from the agent. */
async function localChat(message, proximity){
  const intent = intentOf(message);
  // Emergency: the dataset carries no emergency entries, so never answer from
  // thin air — guide to 911 and the nearest hospital instead of a travel dead
  // end. No hospital names or numbers are invented here; only 911 is universal.
  if (intent === 'emergency'){
    return {
      intent,
      answer: 'For an emergency, call 911 now, then go to the nearest hospital. The Emergency tab shows hospitals and police near you with numbers you can tap.',
      candidates: [], spotlight: null, sources: [], source: 'dataset',
    };
  }
  const entries = await withCoords(search(message, proximity), proximity);
  if (!entries.length) return { intent, answer: NO_MATCH, candidates: [], spotlight: null, sources: [], source: 'dataset' };
  return {
    intent,
    answer: answerFor(intent, entries),
    candidates: entries.map(e => ({
      name: e.name,
      hint: e.town,
      reason: reasonFor(e),
      rating: e.rating,
      reviews: e.reviews,
      peopleSay: e.quotes[0] || '',
      description: e.description,
      festival: e.festival,
      fees: e.price,
      lng: e.lng,
      lat: e.lat,
      categories: e.categories,
      photos: e.photos || [],
      photo: (e.photos && e.photos[0]) || null,
    })),
    spotlight: spotlightFor(entries),
    sources: entries.map(e => e.mapsUrl).filter(Boolean),
    source: 'dataset',
  };
}

/** Recommendation-shaped payload: what /api/recommend used to return. */
async function localRecommend(message, proximity, prefs = []){
  const intent = intentOf(message);
  const prefToks = tokens((prefs || []).join(' '));
  const ranked = search([message, ...(prefs || [])].join(' '), proximity) || [];
  let entries = ranked;
  if (prefToks.length && intent === 'discover'){
    const boosted = readEntries().filter(e => prefToks.some(t => e.searchText.includes(t)));
    entries = [...new Map([...entries, ...boosted].map(e => [e.id, e])).values()];
  }
  entries = (await withCoords(entries, proximity)).filter(e => isAttraction({ name: e.name, categories: e.categories }, intent));
  if (!entries.length) return { intent, answer: NO_MATCH, places: [], spotlight: null, source: 'dataset' };
  const here = parseProximity(proximity);
  if (here) entries.sort((a, b) => distanceKm(a, here) - distanceKm(b, here));
  const places = entries.map(e => ({
    id: e.id,
    name: e.name,
    lng: e.lng,
    lat: e.lat,
    address: e.address,
    categories: e.categories,
    hint: e.town,
    reason: reasonFor(e),
    rating: e.rating,
    reviews: e.reviews,
    peopleSay: e.quotes[0] || '',
    description: e.description,
    festival: e.festival,
    fees: e.price,
    photos: e.photos || [],
    photo: (e.photos && e.photos[0]) || null,
    sources: e.mapsUrl ? [e.mapsUrl] : [],
    sourceKind: 'dataset',
  }));
  return { intent, answer: answerFor(intent, entries), places, spotlight: places.find(p => p.name === spotlightFor(entries)?.name) || null, source: 'dataset' };
}

module.exports = {
  datasetInfo,
  allEntries,
  withCoords,
  reasonFor,
  answerFor,
  localChat,
  localRecommend,
  search,
  intentOf,
  tokens,
  normalize,
  pickList,
  parseRating,
  NO_MATCH,
};
