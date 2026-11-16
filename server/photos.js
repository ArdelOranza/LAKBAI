/**
 * Wikimedia Commons photo lookup for places the curated map does not cover.
 *
 * Two rules come from real bad matches:
 *  - the feature noun is required, not just the town name. Dropping "beach"
 *    from the match words let "5772Estanza, Lingayen, Pangasinan 31.jpg" (a
 *    barangay photo dump of houses) caption Estanza Beach, and
 *    "Sunset at Lingayen Capitol.jpg" caption Lingayen Beach.
 *  - name search only. Google image search and Commons geosearch return
 *    whatever is popular or nearby, which is how a church interior ended up on
 *    a beach card. A miss is fine: the client falls back to a static map.
 */
const STOP = new Set([
  'the', 'and', 'with', 'of', 'in', 'de', 'la', 'el', 'file', 'image',
  'photo', 'jpg', 'jpeg', 'png', 'webp', 'commons', 'wikimedia',
  'pangasinan', 'philippines', 'philippine'
]);

// Subjects that mean the file is about something else: a house, a room, a
// wedding, a selfie, a scan of a brochure. Only rejected when the place itself
// is not that thing.
const JUNK = new Set([
  'house', 'home', 'residence', 'mansion', 'apartment', 'dwelling',
  'interior', 'altar', 'wedding', 'reception', 'selfie', 'portrait',
  'screenshot', 'logo', 'seal', 'diagram', 'certificate', 'poster', 'banner',
  'document', 'collage', 'brochure', 'flyer', 'scan', 'map', 'room', 'lobby',
  'menu', 'tarpaulin', 'flag', 'flags',
]);

// Words that describe how a place looks, not which place it is. "Abagatanen
// White Sand Beach" is the same beach as "Abagatanen Beach of Pangasinan", so
// demanding "white" and "sand" in the file title rejected the right photo.
const DESCRIPTOR = new Set([
  'white', 'sand', 'black', 'blue', 'crystal', 'clear', 'water', 'sea', 'ocean',
  'view', 'views', 'viewpoint', 'scenic', 'beautiful', 'sunset', 'sunrise',
  'paradise', 'natural', 'nature', 'national', 'protected', 'landscape',
  'tourist', 'spot', 'area', 'site',
]);

// The noun that says what kind of place this is. It must be in the file title,
// or "Sunset at Lingayen Capitol" could stand in for "Lingayen Beach".
const FEATURE = new Set([
  'beach', 'coast', 'shore', 'sandbar', 'cove', 'island', 'fall', 'river',
  'spring', 'cave', 'church', 'shrine', 'park', 'plaza', 'market', 'museum',
  'lighthouse', 'garden', 'mountain', 'hill', 'lake', 'rock', 'resort', 'hotel',
]);

// A Commons file that is not a photograph cannot caption a place. Ruby's
// (Labrador) showed page one of an FBI report: its PDF title carried "2402"
// and "Jack Ruby", so it passed a title match it should never have reached.
const NOT_PHOTO = /\.(pdf|djvu|svg|gif|ogv|webm|ogg|mp3|wav|flac|xcf|stl|zip)\s*$/i;

// A seal, an icon or a locator map is small. A photograph of a place is not:
// "Calasiao Pangasinan.png" was the municipal seal at 150x165.
const MIN_PHOTO_PX = 400;

// How far a file may be geotagged from the place it claims to show. A town and
// its barangays fit well inside this; another province or country does not.
const MAX_KM = 40;

// Pangasinan's municipalities and cities. A file whose category names a
// different one of them is a photo of that other place: "Burgos" was captioned
// with the San Carlos City Hall because its category said San Carlos.
const PANGASINAN_TOWNS = [
  'agno', 'aguilar', 'alaminos', 'alcala', 'anda', 'asingan', 'balungao',
  'bani', 'basista', 'bautista', 'bayambang', 'binalonan', 'binmaley',
  'bolinao', 'bugallon', 'burgos', 'calasiao', 'dagupan', 'dasol', 'infanta',
  'labrador', 'laoac', 'lingayen', 'mabini', 'malasiqui', 'manaoag',
  'mangaldan', 'mangatarem', 'mapandan', 'natividad', 'pozorrubio', 'rosales',
  'san carlos', 'san fabian', 'san jacinto', 'san manuel', 'san nicolas',
  'san quintin', 'santa barbara', 'santa maria', 'santo tomas', 'sison',
  'sual', 'tayug', 'umingan', 'urbiztondo', 'urdaneta', 'villasis'
];

// Address parts that name a region, not the town. Useless as a search hint,
// and "Pangasinan" would pull province-wide photo dumps back in.
const REGION = new Set([
  'philippines', 'philippine', 'pangasinan', 'luzon', 'region i',
  'ilocos region', 'central luzon'
]);

/** The town to pair with a place name in a Commons search query.
 *  "Lingayen, 2401, Philippines" used to yield "2401" — the postcode — and
 *  "intitle:lingayen beach 2401" matches nothing. Plus codes are worse: the
 *  curated Lingayen Beach address ends "(Plus Codes: 26PM+RQ9, 26PJ+WG4, ...)",
 *  so splitting on commas handed Commons "26PJ+JCH)". Drop the noise and take
 *  the last real locality, so a street or barangay in front of it cannot win. */
function hintFromAddress(address){
  const clean = String(address || '').replace(/\([^)]*\)/g, ' ');
  const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
  const places = parts.filter(p =>
    !/^\d[\d\s-]*$/.test(p) &&                 // bare postcode
    !/^\d{4}\s/.test(p) &&                     // "2401 Pangasinan"
    !/\b[0-9A-Z]{4}\+[0-9A-Z]{2,}/i.test(p) && // plus code
    !REGION.has(p.toLowerCase())
  );
  return places.length ? places[places.length - 1] : '';
}

/** The town hint for a place row. An explicit hint (curated dataset or admin
 *  row) is deliberate, so it wins; only a row without one parses its address. */
function photoHint(place){
  const explicit = String((place && (place.hint || place.town)) || '').trim();
  return explicit || hintFromAddress(place && place.address);
}

/** Cache key for a Commons lookup. Same-name places at different coordinates
 *  are different places: "Santo Tomas" near Manaoag is not the municipality
 *  50 km away, and must not reuse its market photo. Three decimals is about
 *  100 m, so repeat requests for one place still hit. */
function photoCacheKey(place){
  const name = String((place && place.name) || '').toLowerCase();
  const lat = Number(place && place.lat);
  const lng = Number(place && place.lng);
  const at = Number.isFinite(lat) && Number.isFinite(lng)
    ? lat.toFixed(3) + ',' + lng.toFixed(3)
    : '';
  return name + '|' + photoHint(place).toLowerCase() + '|' + at;
}

// A compound name ("Lingayen Beach & Lingayen Baywalk") is one destination, so
// a file that names any of its parts is honest. The primary segment drives the
// search query; every segment is allowed to satisfy the match.
function segments(name){
  return String(name || '')
    .split(/\s*(?:&|,|\/|\||\(|\s-\s)\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}
function primaryName(name){
  return segments(name)[0] || String(name || '');
}

/** True when a place has no name of its own — Mapbox labels some shops just
 *  "Lingayen", the town they sit in. Every town file would then "match", which
 *  is how a church captioned an ice-cream shop. Without a feature noun to pin
 *  (a real "Lingayen Beach" still searches), a town-only name gets no lookup. */
function namesOnlyTown(name, hint){
  const own = tokens(primaryName(name));
  if (own.some(t => FEATURE.has(t))) return false;
  const distinctive = own.filter(t => !DESCRIPTOR.has(t) && !FEATURE.has(t));
  if (!distinctive.length) return true;
  const town = new Set(tokens(hint));
  return distinctive.every(t => town.has(t));
}

/** Lowercase word tokens with file/place boilerplate dropped. */
function searchWords(s){
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter(w => w.length > 1 && !STOP.has(w));
}
/** Same tokens with trailing plurals collapsed so "falls"/"fall" compare
 *  equal. Used for matching, not for the search query. */
function tokens(s){
  return searchWords(s).map(w => w.replace(/s$/, ''));
}

/** Terms for Commons search. Only the distinctive words are pinned with
 *  intitle: — pinning every word ("intitle:white intitle:sand") matched almost
 *  nothing. The feature noun and the town stay plain so recall stays wide. */
function searchFor(name, hint){
  const seg = primaryName(name);
  const all = tokens(seg);
  const distinctive = [...new Set(all.filter(t => !DESCRIPTOR.has(t) && !FEATURE.has(t)))];
  const feature = all.find(t => FEATURE.has(t));
  const town = String(hint || '').trim();
  const q = [...distinctive.map(w => 'intitle:' + w), feature, town].filter(Boolean).join(' ');
  return q || town;
}

/** Great-circle distance in km between two {lat,lng} points. */
function kmBetween(a, b){
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** True when text names a Pangasinan town that is not this place. */
function otherTown(text, name, hint){
  const lower = String(text || '').toLowerCase();
  if (!lower) return false;
  const own = new Set([...tokens(name), ...tokens(hint)]);
  return PANGASINAN_TOWNS.some(town =>
    new RegExp('\\b' + town + '\\b').test(lower) &&
    !town.split(' ').every(w => own.has(w))
  );
}

/** Conservative match: the distinctive words of one name segment must all
 *  appear in the file title, at least one feature noun must appear too, a
 *  numbered feature must keep its own number, and an unrelated subject in the
 *  title rejects the file outright. A name with no feature noun of its own
 *  (a barangay, a beach with a bare name) also needs location proof — the
 *  province in the title, or `located` from Commons metadata — see below. */
function strictRelevant(title, name, hint, located){
  if (NOT_PHOTO.test(String(title || ''))) return false;
  const have = tokens(title);
  const haveSet = new Set(have);
  const want = new Set(String(name || '').match(/\d+/g) || []);
  // Parenthetical numbers are sequence labels ("(2).jpg"), not the feature's
  // own number, so they cannot prove "Bolinao Falls 2" is the right falls.
  const got = new Set(String(title || '').replace(/\([^)]*\)/g, ' ').match(/\d+/g) || []);
  if (want.size) {
    for (const n of want) if (!got.has(n)) return false;
  }
  const parts = segments(name).map(seg => {
    const all = [...new Set(tokens(seg))];
    return {
      distinctive: all.filter(t => !DESCRIPTOR.has(t) && !FEATURE.has(t)),
      features: all.filter(t => FEATURE.has(t)),
      keys: all,
    };
  }).filter(p => p.distinctive.length);
  if (!parts.length) return false;
  return parts.some(({ distinctive, features, keys }) => {
    if (!distinctive.every(k => haveSet.has(k))) return false;
    // Without a feature noun any file that repeats the town would pass.
    if (features.length && !features.some(f => haveSet.has(f))) return false;
    // "Patar" is also an Indian poet, "Labrador" a dog breed, "Agno" a map of
    // a Swiss village and "Bautista" a river in Venezuela. With no feature noun
    // of its own the name alone proves nothing, and a feature word in the file
    // ("River") does not prove location. The file must carry the province in
    // its title or prove its location through Commons metadata.
    if (!features.length) {
      // Province names are STOP words for matching, so read them raw.
      const namesRegion = /\b(?:pangasinan|philippines)\b/i.test(String(title || ''));
      if (!namesRegion && !located) return false;
    }
    if (have.some(t => JUNK.has(t) && !keys.includes(t))) return false;
    return true;
  });
}

function pickStrict(data, name, hint, place){
  const pages = (data.query && data.query.pages) || {};
  const here = place && Number.isFinite(place.lat) && Number.isFinite(place.lng) ? place : null;
  const cats = p => (p.categories || []).map(c => String(c.title || '').replace(/^category:\s*/i, ''));
  // Distance from the place, or null when either side has no coordinates.
  const km = p => {
    const c = p.coordinates && p.coordinates[0];
    if (!here || !c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return null;
    return kmBetween(here, { lat: c.lat, lng: c.lon });
  };
  const near = p => {
    const d = km(p);
    return d !== null && d <= MAX_KM;
  };
  // Location proof for a bare name: the file is geotagged here, its categories
  // name the province/country, or a category is the town itself. A category
  // that names a different Pangasinan town disproves it instead.
  const located = p => {
    if (near(p)) return true;
    const list = cats(p);
    if (list.some(c => otherTown(c, name, hint))) return false;
    const own = new Set([...tokens(name), ...tokens(hint)]);
    return list.some(c => {
      if (/\b(?:pangasinan|philippines)\b/i.test(c)) return true;
      const words = tokens(c);
      return words.length > 0 && words.every(w => own.has(w));
    });
  };
  const relevant = Object.values(pages).filter(p => {
    if (!p.thumbnail) return false;
    // A seal or an icon cannot stand in for a photograph of the place.
    const info = p.imageinfo && p.imageinfo[0];
    if (info && Math.max(info.width || 0, info.height || 0) < MIN_PHOTO_PX) return false;
    if (!strictRelevant(p.title, name, hint, located(p))) return false;
    // Reject a file that says it was taken somewhere else. Only checked when
    // both the file and the place carry coordinates; a miss is not a lie.
    const d = km(p);
    if (d !== null && d > MAX_KM) return false;
    return true;
  });
  // Prefer the file whose title says the least beyond the place name: "Lingayen
  // Beach.jpg" beats "Lingayen Beach, Labrador mountain view (...).jpg".
  const known = new Set(tokens(name));
  const extra = p => tokens(p.title).filter(t => !known.has(t)).length;
  relevant.sort((a, b) => extra(a) - extra(b));
  const p = relevant[0];
  if (!p) return null;
  return {
    src: p.thumbnail.source,
    page: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title),
  };
}

async function commons(fetcher, params){
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', prop: 'pageimages', pithumbsize: '600',
    format: 'json', origin: '*', ...params
  });
  const r = await fetcher(url, { headers: { 'User-Agent': 'Lakbai/1.0 (Pangasinan travel MVP; https://lakbai-app.onrender.com)' } });
  if (r.status === 429) { const e = new Error('Wikimedia rate limited (429)'); e.status = 429; throw e; }
  if (!r.ok) return null;
  return r.json();
}

/** Commons file search by place name + town. The query is a name search; the
 *  coordinates and categories only validate a hit that Commons places
 *  somewhere else. */
async function findBySearch(fetcher, name, hint, lat, lng){
  if (namesOnlyTown(name, hint)) return null;
  const byName = await commons(fetcher, {
    generator: 'search', gsrsearch: searchFor(name, hint),
    gsrnamespace: '6', gsrlimit: '10',
    prop: 'pageimages|imageinfo|coordinates|categories',
    iiprop: 'size', clshow: '!hidden', cllimit: '20'
  });
  return byName ? pickStrict(byName, name, hint, { lat, lng }) : null;
}

/** Commons-only lookup with strict title matching (used to build the
 *  committed tourist-spot map). Never calls Google image search. */
async function findCommonsPhoto(name, hint, lng, lat, deps = {}){
  const fetcher = deps.fetch || fetch;
  try {
    return await findBySearch(fetcher, name, hint, lat, lng);
  } catch (e) {
    if (e && e.status === 429) throw e;
    return null;
  }
}

/** Runtime lookup for unphotographed places. Strict matching, name search
 *  only; a miss returns null so the client keeps its map fallback. */
async function findPhoto(name, hint, lng, lat, deps = {}){
  const fetcher = deps.fetch || fetch;
  try {
    return await findBySearch(fetcher, name, hint, lat, lng);
  } catch {
    return null;
  }
}

module.exports = { findPhoto, findCommonsPhoto, strictRelevant, pickStrict, hintFromAddress, photoHint, photoCacheKey };
