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
  'menu', 'tarpaulin',
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

/** Conservative match: the distinctive words of one name segment must all
 *  appear in the file title, at least one feature noun must appear too, a
 *  numbered feature must keep its own number, and an unrelated subject in the
 *  title rejects the file outright. */
function strictRelevant(title, name){
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
    if (have.some(t => JUNK.has(t) && !keys.includes(t))) return false;
    return true;
  });
}

function pickStrict(data, name){
  const pages = (data.query && data.query.pages) || {};
  const relevant = Object.values(pages).filter(p => p.thumbnail && strictRelevant(p.title, name));
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

/** Commons file search by place name + town. The query is the only place
 *  signal: coordinates are accepted for callers' convenience and ignored. */
async function findBySearch(fetcher, name, hint){
  const byName = await commons(fetcher, {
    generator: 'search', gsrsearch: searchFor(name, hint),
    gsrnamespace: '6', gsrlimit: '10'
  });
  return byName ? pickStrict(byName, name) : null;
}

/** Commons-only lookup with strict title matching (used to build the
 *  committed tourist-spot map). Never calls Google image search. */
async function findCommonsPhoto(name, hint, lng, lat, deps = {}){
  const fetcher = deps.fetch || fetch;
  try {
    return await findBySearch(fetcher, name, hint);
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
    return await findBySearch(fetcher, name, hint);
  } catch {
    return null;
  }
}

module.exports = { findPhoto, findCommonsPhoto, strictRelevant, pickStrict };
