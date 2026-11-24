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
const adminPhotos = require('./adminPhotos.js');
const { decodePlusCode } = require('./pluscode.js');
const { isWikimedia } = require('./photoHierarchy.js');

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
  // Western & coastal towns (from the 150-spot file) — anchors so a short
  // plus code can be decoded for every mapped town, not just the 12 above.
  'alaminos city': { lat: 16.1540, lng: 119.9760 },
  bolinao: { lat: 16.3850, lng: 119.9060 },
  burgos: { lat: 15.9970, lng: 119.8260 },
  dasol: { lat: 16.0260, lng: 119.9230 },
  anda: { lat: 16.2930, lng: 119.7780 },
  agno: { lat: 16.1250, lng: 119.8060 },
  bani: { lat: 16.1920, lng: 119.8640 },
  mabini: { lat: 16.1160, lng: 119.9400 },
  sual: { lat: 16.0280, lng: 120.1030 },
  manaoag: { lat: 16.0490, lng: 120.4890 },
  lingayen: { lat: 16.0170, lng: 120.2320 },
  'dagupan city': { lat: 16.0440, lng: 120.3330 },
  calasiao: { lat: 16.0440, lng: 120.2790 },
  'san fabian': { lat: 16.2000, lng: 120.3470 },
  binmaley: { lat: 16.0250, lng: 120.1950 },
  bugallon: { lat: 16.1660, lng: 120.1770 },
  aguilar: { lat: 16.2120, lng: 120.1300 },
  mangatarem: { lat: 15.7900, lng: 120.2900 },
  infanta: { lat: 15.8270, lng: 119.9140 },
  urbiztondo: { lat: 15.8020, lng: 119.9730 },
  labrador: { lat: 15.7880, lng: 120.1370 },
  'san jacinto': { lat: 16.1070, lng: 120.3230 },
  'santa barbara': { lat: 15.9640, lng: 120.3980 },
  malasiqui: { lat: 15.9040, lng: 120.3590 },
  mapandan: { lat: 16.0270, lng: 120.4540 },
  binalonan: { lat: 16.0610, lng: 120.5610 },
  pozorrubio: { lat: 16.1180, lng: 120.5520 },
  laoac: { lat: 16.0360, lng: 120.5280 },
  bautista: { lat: 16.0430, lng: 120.5200 },
  alcala: { lat: 16.0360, lng: 120.5380 },
  'santo tomas': { lat: 16.0060, lng: 120.6380 },
  asingan: { lat: 16.0120, lng: 120.6580 },
  'san manuel': { lat: 16.0550, lng: 120.6650 },
  mangaldan: { lat: 16.0630, lng: 120.3440 },
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
  // String fees (the 150-file's fee_in_venue paragraph): short = the first
  // money-bearing sentence, detail = full prose. The whole paragraph must
  // never be the displayed price.
  if (typeof fees !== 'object'){
    const s = str(fees);
    const parts = s.split(/(?<=[.!?])\s+|;/).map(x => x.trim()).filter(Boolean);
    const money = parts.find(x => /(₱|PHP|P\s?\d|peso)/i.test(x));
    const short = (money || parts[0] || s).trim().slice(0, 160);
    return { short, detail: s };
  }
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

// Every review list the provided files use, in order of preference: the 150-spot
// file calls them `real_reviews`, the 5-town files call them `reviews`. A bare
// numeric `reviews` is a review COUNT, not a list, and is skipped here.
function reviewListOf(raw, rr){
  const candidates = [raw.real_reviews, raw.reviews_list, raw.top_reviews, raw.reviews, rr && rr.verified_reviews];
  return candidates.find(Array.isArray) || [];
}

const REVIEW_DATE_RE = /\((\d{4}-\d{2}-\d{2})\)\s*$/;
const VISITOR_REVIEWS_MAX = 10;
// The 5-town file piles generated metadata notes into the same `reviews` array
// ("Price & Fee Verification", "Hours & Operations Note", "Rating & Volume
// Summary"). Those are facts about the place, not something a visitor said, and
// they must never render under a reviewer's name.
const META_REVIEW_RE = /\b(summary|verification|note|highlight|index)\b/i;

/** A trailing "(2026-01-03)" is the review's date, not part of the sentence. */
function reviewDateOf(value){
  const m = str(value).match(REVIEW_DATE_RE);
  return m ? m[1] : '';
}

/** "Google Maps Verified Reviewer #3" names the platform, not a person. */
function reviewSourceName(value){
  const s = str(value).replace(REVIEW_DATE_RE, '').replace(/\s*#\d+\s*$/, '').trim();
  return /^google maps (verified )?reviewer$/i.test(s) ? 'Google Maps' : s;
}

/**
 * The scraped visitor reviews as the app shows them: the words, who they came
 * from and when. Kept apart from a traveller's own review — these are not ours,
 * and the app labels each by its source. Capped so a busy place cannot bloat
 * every chat and recommendation payload.
 */
function visitorReviews(list){
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const r of list){
    const isText = typeof r === 'string';
    let text = str(isText ? r : (r && (r.text || r.quote || r.comment || r.review)));
    if (!text) continue;
    const source = isText ? '' : str(r.reviewer_or_source || r.author || r.source);
    if (META_REVIEW_RE.test(source)) continue;
    const date = (isText ? '' : str(r.date)) || reviewDateOf(source) || reviewDateOf(text);
    if (reviewDateOf(text)) text = text.replace(REVIEW_DATE_RE, '').trim();
    const review = { text, source: reviewSourceName(source), date };
    const score = isText ? null : num(r.rating);
    if (score != null && score >= 1 && score <= 5) review.rating = score;
    out.push(review);
    if (out.length >= VISITOR_REVIEWS_MAX) break;
  }
  return out;
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
  food: /\b(eat|food|restaurants?|kainan|kain|meals?|lunch|dinner|breakfast|brunch|coffee|cafes?|dishes|seafood|grills?|sisig|pizza|burger|pasta|milk tea|desserts?|pancit|bagnet|bangus)\b/i,
  event: /\b(festivals?|fiestas?|events?|celebrations?|parades?|carnivals?|fairs?)\b/i,
  nearby: /\b(near|nearby|around|close|malapit|walking distance)\b/i,
  emergency: /\b(hospital|emergency|ambulance|police|fire|accident|injured|medical|clinic)\b/i,
  plan: /\b(plans?|planning|itinerar(?:y|ies)|trips?|day ?trip|tours?|things to do|what (?:can|should) i do|schedule|explore)\b/i,
};

const CATEGORY_HINTS = {
  food: /\b(foods?|restaurants?|cafes|coffee|eateries|grills?|bars?|bakeries|desserts?|kitchens?|dining|seafood|carinderia|panciteria)\b/i,
  beach: /\b(beaches|beach|islands|island|coves|cove|coast|shore|sandbar)\b/i,
  nature: /\b(falls|waterfall|spring|cave|river|mountain|forest|park|eco|garden|lake)\b/i,
  culture: /\b(church|basilica|shrine|cathedral|parish|religious|pilgrimage|museum|heritage|historical|landmark|festival)\b/i,
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
  // Intents from name + categories only — a description that merely mentions
  // another kind ("coffee shop") must not tag the entry as food.
  const text = `${entry.name} ${entry.categories.join(' ')}`;
  return Object.entries(CATEGORY_HINTS).filter(([, re]) => re.test(text)).map(([k]) => k);
}

// Scraped source files carry the listing id inside the address, e.g.
// "... 2428 Pangasinan (Google Maps Place ID: ChIJ...)" or the older
// "... (Google Maps Place IDs: `ChIJ...` / `ChIJ...`; Coordinates: `15°49′N`)"
// shape. That is provenance, not an address, and it must never render under a
// place name. A parenthetical that is part of the name ("(Bayambang Church)")
// is left alone.
const META_PAREN_RE = /\(([^()]*)\)/g;
const META_LABEL_RE = /^\s*(?:google\s+maps\s+)?(?:place\s*ids?|coordinates?|plus\s*code|phone|contact|telephone)\s*[:#]/i;
const PLACE_ID_RE = /[(,[]?\s*(?:google\s+maps\s+)?place\s*ids?\s*[:#-]?\s*[`'"\s]*[A-Za-z0-9_/`'"\s-]{8,}/gi;
const BARE_PLACE_ID_RE = /\bChI[A-Za-z0-9_-]{8,}\b/g;

function stripPlaceIds(value){
  let s = String(value == null ? '' : value);
  s = s.replace(META_PAREN_RE, (whole, inner) => (META_LABEL_RE.test(inner) ? ' ' : whole));
  s = s.replace(PLACE_ID_RE, ' ').replace(BARE_PLACE_ID_RE, ' ');
  return s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/[,\s]+$/, '')
    .trim();
}

function normalize(raw, index, kind = '', fileTag = ''){
  if (!raw || typeof raw !== 'object') return null;
  const name = stripPlaceIds(str(raw.name || raw.title || raw.official_name || raw.place_name || raw.placeName));
  if (!name) return null;
  const town = stripPlaceIds(str(raw.municipality || raw.town || raw.city || raw.locality || raw.municipality_or_city || (typeof raw.location === 'string' ? raw.location : '')).replace(/\s*\(.*$/, ''));
  // The 150-spot file calls this `location`; it carries the address (often with
  // the plus code) even when there is no separate address field.
  const address = stripPlaceIds(str(raw.address || raw.full_address || raw.formatted_address || raw.vicinity || raw.exact_location_address || (typeof raw.location === 'string' ? raw.location : '')));
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
  // A province-locked app must not hold a coordinate it cannot vouch for. The
  // 150-spot scrape carries a handful of rows geocoded far outside Pangasinan
  // (an Urdaneta park at lat 15.00, Hundred Islands at lng 119.04), and each one
  // drew a pin in the middle of nowhere. Null is honest; a wrong pin is not.
  if (!(lat !== null && lng !== null && inBox(lng, lat))){ lat = null; lng = null; }
  const entry = {
    id: str(raw.id || raw.place_id || raw.placeId) || `${fileTag ? fileTag + '-' : ''}${name}-${town}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    town,
    kind,
    source: fileTag,
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
    // No scraped images. `verified_image_urls` in the source JSON are page
    // heroes and ads, not photographs of the place — a Lingayen card showed a
    // resort brochure, a beach showed a Scribd page of text. Photos come from
    // the admin/hand-reviewed map and the Wikimedia name lookup instead.
    photos: [],
    description: str(raw.description || raw.blurb || raw.about || raw.summary || raw.detailed_description),
    activities: listOf(raw.what_to_do_activities || raw.activities || raw.what_to_do),
    price: fees.short,
    feesDetail: fees.detail,
    festival: str(raw.festival) || festivalFromText(name, address),
    quotes: reviewQuotes(reviewListOf(raw, rr)),
    // The full scraped review list, with source and date — what the app shows in
    // a place's "what visitors say" section.
    visitorReviews: visitorReviews(reviewListOf(raw, rr)),
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

/** Files + mtimes: an in-place edit (same row count) still changes it. */
function fileSignature(files){
  return files.map(f => {
    try { return f + ':' + fs.statSync(f).mtimeMs; } catch { return f + ':0'; }
  }).join('|');
}

function readEntries(){
  const files = dataFiles();
  if (!files.length) return [];
  const sig = fileSignature(files);
  if (cache.sig !== sig){
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
  }
  // Admin photo edits are applied on every read, so they show up immediately
  // without restarting or touching the committed dataset.
  const overlay = adminPhotos.allPhotos();
  if (!Object.keys(overlay).length) return cache.entries;
  return cache.entries.map(e => overlay[e.id] ? { ...e, photos: overlay[e.id].photos.slice() } : e);
}

function datasetInfo(){
  const entries = readEntries();
  const files = dataFiles();
  return { ready: entries.length > 0, file: files.join(', '), count: entries.length, sig: fileSignature(files) };
}

// The AI reference is exactly the files in server/data — nothing else.
// server/spots.js still drives the map and the curated browsing screens, but it
// is deliberately NOT mixed in here: if a place is not in the provided files,
// the assistant says so instead of quietly answering from another list.
function normalizedName(name){
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** The first word that actually names the place ("patar" in "Patar Beach"). */
function firstSignificantWord(normalized){
  return normalized.split(' ').find(w => w.length > 2 && !STOP.has(w)) || '';
}

/**
 * Could these two names be the same place spelled differently?
 * Proximity alone cannot answer that: a mall puts a dozen different businesses
 * on one coordinate. So either one name contains the other ("URESHII KOI" vs
 * "URESHII KOI Japanese Restaurant"), or they lead with the same place word
 * ("Patar Beach" vs "Patar White Sand Beach"). "Cabalen - SM City ..." and
 * "Classic Savory - SM City ..." share only the mall, and stay separate.
 */
function samePlaceName(a, b){
  const na = normalizedName(a), nb = normalizedName(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const fa = firstSignificantWord(na);
  return Boolean(fa) && fa === firstSignificantWord(nb);
}

/** Review counts arrive as "1.2k", "41" or 1200 — compare them as numbers. */
function reviewCount(entry){
  const m = String(entry && entry.reviews == null ? '' : entry.reviews).trim().match(/(\d+(?:\.\d+)?)\s*([kK])?/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  return m[2] ? n * 1000 : n;
}

const hasCoords = e => Number.isFinite(e.lat) && Number.isFinite(e.lng);

/** The name with a parenthetical qualifier removed: "Foo (Dagupan)" → "Foo". */
function baseName(name){
  return String(name || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * How much of a real place a row carries. When two rows turn out to be the same
 * place, the richer one survives: a coordinate first, then a phone, an address,
 * a description, and finally the review count.
 */
function richness(entry){
  return (hasCoords(entry) ? 1e6 : 0)
    + (entry.phone ? 1e4 : 0)
    + (entry.address ? 1e3 : 0)
    + (entry.description ? 1e2 : 0)
    + reviewCount(entry);
}

/** Rows grouped by town, so a merge can never cross town lines. */
function byTown(entries){
  const groups = new Map();
  for (const e of entries){
    const k = String(e.town || '').toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  return groups.values();
}

function allEntries(){
  // 1. The same name twice is the same place, full stop.
  const seen = new Set();
  let out = [];
  for (const entry of readEntries()){
    const key = normalizedName(entry.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  // 2. Same place listed twice under slightly different names (pangasinan-150
  // vs spots.json): the same pin (within 50 m) + same town + a shared name ⇒ one
  // row. Proximity alone is not enough — every tenant of a mall carries the
  // mall's single coordinate, so "near each other" once deleted Cabalen,
  // Classic Savory and Starbucks as if they were one restaurant.
  const nearDup = new Set();
  for (const group of byTown(out)){
    for (let i = 0; i < group.length; i++){
      const a = group[i];
      if (!hasCoords(a)) continue;
      for (let j = i + 1; j < group.length; j++){
        const b = group[j];
        if (!hasCoords(b)) continue;
        if (haversineKm(a.lng, a.lat, b.lng, b.lat) < 0.05 && samePlaceName(a.name, b.name)){
          nearDup.add(richness(a) >= richness(b) ? b.id : a.id);
        }
      }
    }
  }
  out = out.filter(e => !nearDup.has(e.id));
  // 3. The same place under a parenthetical town suffix, with no coordinate in
  // either row ("MATUTINA-GERRY's Seafood House" vs "... (Dagupan)"). Proximity
  // has nothing to measure, so an identical base name inside one town is the
  // whole signal. Different towns (the Urdaneta branch) stay separate.
  const nameDup = new Set();
  for (const group of byTown(out)){
    const byBase = new Map();
    for (const e of group){
      const k = baseName(e.name);
      if (!k) continue;
      if (!byBase.has(k)) byBase.set(k, []);
      byBase.get(k).push(e);
    }
    for (const list of byBase.values()){
      if (list.length < 2) continue;
      const best = list.slice().sort((a, b) => richness(b) - richness(a))[0];
      for (const e of list) if (e !== best) nameDup.add(e.id);
    }
  }
  return out.filter(e => !nameDup.has(e.id));
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

// Words that ask for a day out without naming a place: "plan a day here",
// "what can I do", "a trip". When every token is one of these, the traveler gave
// no town, dish or kind of place, so the best real options are fair game.
const GENERIC_ASK = new Set([
  'plan', 'planning', 'day', 'trip', 'itinerary', 'tour', 'thing', 'activity',
  'explore', 'do', 'go', 'see', 'visit', 'here', 'now', 'today', 'time', 'around',
]);

/** True when a plan/nearby request names no place, town or kind of place. */
function genericPlanAsk(message, intent){
  if (intent !== 'plan' && intent !== 'nearby') return false;
  return tokens(message).every(t => GENERIC_ASK.has(t));
}

// Small talk is answered directly: a greeting or a thank-you must not spend a
// model call (or fall through to the no-match line). Requiring zero meaningful
// tokens keeps "hi, where can I eat in Dagupan" out of this path.
const SMALL_TALK = /^(?:hi+|hey+|hello+|yo|sup|good (?:morning|afternoon|evening)|kumusta|kamusta|musta|thanks?|thank you|ty|salamat|bye+|goodbye|see (?:you|ya)|who are you|what are you|what can you do|what do you do)[\s!.,?]*$/i;

function smallTalkReply(message){
  const text = String(message || '').trim();
  // The pattern is anchored, so a real request that merely starts with "hi"
  // ("hi, where can I eat in Dagupan") never matches.
  if (!text || !SMALL_TALK.test(text)) return null;
  if (/thank|salamat|\bty\b/i.test(text)) return "You're welcome! Ask me about a town, a dish or a place in Pangasinan anytime.";
  if (/bye|see (?:you|ya)/i.test(text)) return "Safe travels! Come back anytime you need a place in Pangasinan.";
  if (/who are you|what are you|what (?:can|do) you do/i.test(text)) return "I'm LakbAI, your Pangasinan travel guide. Ask me about places, food, fees, or a day trip.";
  return 'Hi! I\'m LakbAI. Ask me about a town, a dish or a place in Pangasinan — or say "plan a day here".';
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
  // A request that names no place ("plan a trip", "what can I do here") has no
  // token to match, so offer the best real places instead of a dead end. Food
  // is kept out of a day-out unless the traveler actually asked for it.
  if (!hits.length && genericPlanAsk(message, intent)){
    hits = scored.filter(s => !isFoodOnly(s.entry));
    if (!hits.length) hits = scored;
  }
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
        // The hit must *be* the place, not just be nearby: a name search returns
        // the street's houses too, and accepting the first in-box result is how
        // a beach with no coordinate got pinned to somebody's house.
        const found = hits.find(h => inBox(h.lng, h.lat) && samePlaceName(entry.name, h.name));
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

/**
 * Photo fields every payload carries, labelled with where the photo came from:
 * a Wikimedia file is `wikimedia`, a curated/admin/dataset URL is `json`, and
 * no photo at all means the client draws its Mapbox static-map fallback.
 */
function photoFields(photos){
  const list = (Array.isArray(photos) ? photos : []).filter(p => typeof p === 'string' && p.trim());
  const photo = list[0] || null;
  return {
    photos: list,
    photo,
    photoSource: photo ? (isWikimedia(photo) ? 'wikimedia' : 'json') : 'mapbox',
  };
}

function answerFor(intent, entries){
  const lead = intent === 'food' ? 'Where to eat'
    : intent === 'event' ? 'Events worth catching'
    : intent === 'nearby' ? 'Closest to you'
    : intent === 'plan' ? 'A day worth taking'
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
  // A greeting or a thank-you is answered here too: when the model quota is out
  // the chat falls back to this path, and small talk must not become the
  // no-match line just because the AI is unavailable.
  const hello = smallTalkReply(message);
  if (hello) return { intent: 'discover', answer: hello, candidates: [], spotlight: null, sources: [], source: 'dataset' };
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
      visitorReviews: e.visitorReviews || [],
      description: e.description,
      festival: e.festival,
      fees: e.price,
      lng: e.lng,
      lat: e.lat,
      categories: e.categories,
      ...photoFields(e.photos),
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
    visitorReviews: e.visitorReviews || [],
    description: e.description,
    festival: e.festival,
    fees: e.price,
    ...photoFields(e.photos),
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
  genericPlanAsk,
  smallTalkReply,
  tokens,
  normalize,
  pickList,
  parseRating,
  photoFields,
  NO_MATCH,
};
