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
// wedding, a selfie. Only rejected when the place itself is not that thing.
const JUNK = new Set([
  'house', 'home', 'residence', 'mansion', 'apartment', 'dwelling',
  'interior', 'altar', 'wedding', 'reception', 'selfie', 'portrait',
  'screenshot', 'logo', 'seal', 'diagram', 'certificate', 'poster', 'banner'
]);

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

/** Terms for Commons search. Full-text search ranks barangay photo dumps
 *  ("2657Poblacion, Lingayen...") above the beach itself; intitle:<word>
 *  only returns files actually named after the place. */
function searchFor(name, hint){
  const terms = searchWords(name).map(w => 'intitle:' + w);
  const town = String(hint || '').trim();
  if (!terms.length) return town;
  return [...terms, town].filter(Boolean).join(' ');
}

/** Conservative match: every name token must appear in the file title, a
 *  numbered feature must keep its own number, and an unrelated subject in the
 *  title rejects the file outright. */
function strictRelevant(title, name){
  const keys = tokens(name);
  if (!keys.length) return false;
  const have = tokens(title);
  const haveSet = new Set(have);
  if (!keys.every(k => haveSet.has(k))) return false;
  if (have.some(t => JUNK.has(t) && !keys.includes(t))) return false;
  const want = new Set(String(name || '').match(/\d+/g) || []);
  // Parenthetical numbers are sequence labels ("(2).jpg"), not the feature's
  // own number, so they cannot prove "Bolinao Falls 2" is the right falls.
  const got = new Set(String(title || '').replace(/\([^)]*\)/g, ' ').match(/\d+/g) || []);
  // A numbered feature must carry its number: an unnumbered "Bolinao Falls"
  // file cannot prove it is Falls 1 rather than Falls 2.
  if (want.size) {
    for (const n of want) if (!got.has(n)) return false;
  }
  return true;
}

function pickStrict(data, name){
  const pages = (data.query && data.query.pages) || {};
  for (const p of Object.values(pages)){
    if (p.thumbnail && strictRelevant(p.title, name)) {
      return {
        src: p.thumbnail.source,
        page: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title)
      };
    }
  }
  return null;
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
