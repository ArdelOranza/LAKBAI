// Local Pangasinan dataset search.
//
// When a dataset file is installed, /api/chat and /api/recommend answer from it
// instead of the Google-grounded Gemini call: every card comes from the JSON, so
// nothing is invented and no AI tokens are spent. agent.js is untouched — it
// stays the fallback whenever no dataset is installed.
//
// Drop a file at server/data/places.json (or set LAKBAI_DATA=/abs/path.json).
// Any array of objects works; the normaliser below accepts the common field
// spellings, so a hand-made file does not need to be reshaped first.
const fs = require('fs');
const path = require('path');
const { searchPlaces, inBox } = require('./places.js');
const { haversineKm, parseProximity } = require('./location.js');
const { isAttraction } = require('./attractions.js');

const DATA_DIR = path.join(__dirname, 'data');

// Activation point: drop the real Pangasinan file at server/data/places.json
// (or point LAKBAI_DATA at it). Nothing here runs until that file exists, so the
// existing AI path keeps working untouched in the meantime.

const NO_MATCH = "I don't have that in my Pangasinan list yet. Try a town (Dagupan, Alaminos, Bolinao), a dish, or a kind of place like beach, cafe or festival.";

let cache = { file: null, mtime: 0, entries: [] };
const geoCache = new Map();

const str = v => (v === null || v === undefined ? '' : String(v).trim());
const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function findFile(){
  const env = process.env.LAKBAI_DATA;
  if (env && fs.existsSync(env)) return env;
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.json')).sort();
    if (files.length){
      const preferred = files.find(f => f.toLowerCase() === 'places.json') || files[0];
      return path.join(DATA_DIR, preferred);
    }
  } catch { /* no data dir yet */ }
  return null;
}

const LIST_KEYS = ['places', 'restaurants', 'spots', 'items', 'entries', 'attractions', 'results', 'data'];
function pickList(raw){
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  for (const k of LIST_KEYS) if (Array.isArray(raw[k])) return raw[k];
  for (const v of Object.values(raw)) if (Array.isArray(v)) return v;
  return [];
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
    .map(r => str(typeof r === 'string' ? r : (r && (r.text || r.quote || r.review))))
    .filter(Boolean)
    .map(t => (t.length > 180 ? t.slice(0, 177).trimEnd() + '…' : t))
    .slice(0, 3);
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
  food: /\b(food|restaurant|cafe|coffee|eatery|grill|bar|bakery|dessert|kitchen|dining|seafood|carinderia|panciteria)\b/i,
  beach: /\b(beach|island|cove|coast|shore|sandbar)\b/i,
  nature: /\b(falls|waterfall|spring|cave|river|mountain|forest|park|eco|garden|lake)\b/i,
  culture: /\b(church|basilica|shrine|museum|heritage|historical|landmark|festival)\b/i,
  stay: /\b(hotel|resort|inn|transient|lodge|hostel|villa)\b/i,
  event: /\b(festival|fiesta|event)\b/i,
};

function intentsFor(entry){
  const text = `${entry.name} ${entry.categories.join(' ')} ${entry.description}`;
  return Object.entries(CATEGORY_HINTS).filter(([, re]) => re.test(text)).map(([k]) => k);
}

function normalize(raw, index, kind = ''){
  if (!raw || typeof raw !== 'object') return null;
  const name = str(raw.name || raw.title || raw.place_name || raw.placeName);
  if (!name) return null;
  const town = str(raw.municipality || raw.town || raw.city || raw.locality || (typeof raw.location === 'string' ? raw.location : ''));
  const address = str(raw.address || raw.full_address || raw.formatted_address || raw.vicinity);
  const { rating, reviews } = parseRating(raw.rating ?? raw.average_rating ?? raw.avg_rating, raw.reviews ?? raw.review_count ?? raw.user_ratings_total ?? raw.total_reviews);
  const categories = listOf(raw.categories || raw.category || raw.type || raw.tags);
  // A restaurants-only file carries no category field, so the list key itself
  // tells us what these are.
  if (/restaurant|food|eater/i.test(kind) && !categories.length) categories.push('restaurant');
  const entry = {
    id: str(raw.id || raw.place_id || raw.placeId) || `${name}-${town}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    town,
    address,
    categories,
    lat: num(raw.lat ?? raw.latitude ?? (raw.coordinates && raw.coordinates.lat)),
    lng: num(raw.lng ?? raw.lon ?? raw.longitude ?? (raw.coordinates && raw.coordinates.lng)),
    rating,
    reviews,
    hours: listOf(raw.opening_hours || raw.hours).join(' · '),
    phone: str(raw.phone_number || raw.phone || raw.contact),
    website: str(raw.website || raw.site),
    mapsUrl: str(raw.google_maps_url || raw.maps_url || raw.map_url),
    description: str(raw.description || raw.blurb || raw.about || raw.summary),
    price: str(raw.price || raw.price_range || raw.fees),
    festival: str(raw.festival),
    quotes: reviewQuotes(raw.real_reviews || raw.reviews_list || raw.top_reviews),
  };
  entry.intents = intentsFor(entry);
  entry.searchText = [entry.name, entry.town, entry.address, entry.categories.join(' '), entry.description, entry.quotes.join(' ')].join(' ').toLowerCase();
  return entry;
}

function readEntries(){
  const file = findFile();
  if (!file) return [];
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { return []; }
  if (cache.file === file && cache.mtime === mtime) return cache.entries;
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
  const list = pickList(raw);
  const kind = !Array.isArray(raw) && raw && typeof raw === 'object'
    ? Object.keys(raw).find(k => raw[k] === list) || ''
    : '';
  const entries = list.map((item, i) => normalize(item, i, kind)).filter(Boolean);
  cache = { file, mtime, entries };
  return entries;
}

function datasetInfo(){
  const entries = readEntries();
  return { ready: entries.length > 0, file: cache.file, count: entries.length };
}

const STOP = new Set(['the', 'and', 'for', 'with', 'you', 'your', 'are', 'can', 'how', 'what', 'where', 'when', 'who', 'why', 'any', 'some', 'best', 'good', 'great', 'top', 'please', 'want', 'need', 'looking', 'find', 'show', 'give', 'recommend', 'suggest', 'near', 'around', 'close', 'about', 'there', 'here', 'this', 'that', 'from', 'have', 'has', 'get', 'try', 'place', 'places', 'spot', 'spots', 'trip', 'pangasinan', 'philippines', 'me', 'my', 'i', 'a', 'an', 'in', 'at', 'to', 'of', 'is', 'it', 'on', 'or', 'do', 'go', 'be']);

function tokens(message){
  return [...new Set(String(message || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
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
  if (intent !== 'discover' && intent !== 'nearby' && entry.intents.includes(intent)){ score += 3; matched = true; }
  if (here && Number.isFinite(entry.lat) && Number.isFinite(entry.lng)){
    const km = haversineKm(here.lng, here.lat, entry.lng, entry.lat);
    score += Math.max(0, 4 - km / 8);
  }
  const rating = Number(entry.rating);
  if (Number.isFinite(rating)) score += rating / 5;
  return { score, matched };
}

function distanceKm(entry, here){
  if (!here || !Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) return Infinity;
  return haversineKm(here.lng, here.lat, entry.lng, entry.lat);
}

/** Ranked dataset entries for a free-text request. */
function search(message, proximity, limit = 6){
  const entries = readEntries();
  if (!entries.length) return [];
  const intent = intentOf(message);
  const toks = tokens(message);
  const here = parseProximity(proximity);
  const scored = entries.map(entry => ({ entry, ...scoreEntry(entry, toks, intent, here) }));
  let hits = scored.filter(s => s.matched);
  if (!hits.length && intent !== 'discover') hits = scored.filter(s => s.entry.intents.includes(intent));
  if (!hits.length) return [];
  // "Where can I eat?" should not return a beach that happens to sit in the
  // town you named, as long as the file has actual food places.
  if (intent === 'food' || intent === 'event'){
    const typed = hits.filter(s => s.entry.intents.includes(intent));
    if (typed.length) hits = typed;
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
    const key = entry.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

/** Fill in coordinates for entries the file did not carry, via Mapbox (cached). */
async function withCoords(entries, proximity){
  await Promise.all(entries.map(async entry => {
    if (Number.isFinite(entry.lat) && Number.isFinite(entry.lng)) return;
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
  return entries;
}

function reasonFor(entry){
  if (entry.rating && entry.reviews) return `${entry.rating}★ from ${entry.reviews} Google reviews${entry.town ? ` in ${entry.town}` : ''}.`;
  if (entry.rating) return `${entry.rating}★ on Google${entry.town ? ` in ${entry.town}` : ''}.`;
  if (entry.description) return entry.description;
  return entry.town ? `A verified place in ${entry.town}.` : 'A verified place in Pangasinan.';
}

function answerFor(intent, entries){
  const lead = intent === 'food' ? 'Here is where to eat'
    : intent === 'event' ? 'Here are the events I have'
    : intent === 'nearby' ? 'Closest matches'
    : 'Here is what I found';
  const list = entries.slice(0, 5).map(e => `- **${e.name}**${e.town ? ` — ${e.town}` : ''}`).join('\n');
  return `${lead} in the Pangasinan list:\n${list}`;
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
    sources: e.mapsUrl ? [e.mapsUrl] : [],
    sourceKind: 'dataset',
  }));
  return { intent, answer: answerFor(intent, entries), places, spotlight: places.find(p => p.name === spotlightFor(entries)?.name) || null, source: 'dataset' };
}

module.exports = {
  datasetInfo,
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
