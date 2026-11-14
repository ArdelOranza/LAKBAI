const STOP = new Set([
  'beach', 'resort', 'hotel', 'church', 'park', 'island', 'islands',
  'falls', 'point', 'pangasinan', 'philippines', 'file', 'jpg', 'jpeg',
  'png', 'panoramio', 'philippine', 'city', 'town', 'barangay', 'saint',
  'santa', 'santo', 'san', 'the', 'and', 'with', 'view', 'garden'
]);
function words(s){
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w));
}
// Strict tokens keep feature nouns ("falls", "beach", "park") and drop only
// file/place boilerplate, so "Bolinao Falls 1" cannot accept a Falls 2 photo.
const STRICT_STOP = new Set([
  'the', 'and', 'with', 'of', 'in', 'de', 'la', 'el', 'file', 'image',
  'photo', 'jpg', 'jpeg', 'png', 'webp', 'commons', 'wikimedia',
  'pangasinan', 'philippines', 'philippine'
]);
function strictTokens(s){
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter(w => w.length > 1 && !STRICT_STOP.has(w))
    .map(w => w.replace(/s$/, ''));
}
/** Conservative match for the curated tourist-spot photo map: every name
 *  token must appear in the file title, and a numbered feature must keep its
 *  own number. Near-miss titles are rejected (the map fallback stays). */
function strictRelevant(title, name){
  const keys = strictTokens(name);
  if (!keys.length) return false;
  const have = new Set(strictTokens(title));
  if (!keys.every(k => have.has(k))) return false;
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
function relevant(title, name, hint){
  const t = String(title || '').toLowerCase();
  const nameKeys = words(name);
  const keys = nameKeys.length ? nameKeys : words(hint);
  if (!keys.length) return false;
  return keys.some(k => t.includes(k));
}
function pickPhoto(data, name, hint){
  const pages = (data.query && data.query.pages) || {};
  for (const p of Object.values(pages)){
    if (p.thumbnail && relevant(p.title, name, hint)) {
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
async function csePhoto(fetcher, name, hint){
  const key = process.env.GEMINI_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return null;
  const url = 'https://www.googleapis.com/customsearch/v1?' + new URLSearchParams({
    key, cx, q: `${name} ${hint || ''} Pangasinan`.trim(),
    searchType: 'image', num: '3', safe: 'active'
  });
  const r = await fetcher(url);
  if (!r.ok) return null;
  const data = await r.json();
  const item = (data.items || [])[0];
  if (!item || !item.link) return null;
  return { src: item.link, page: (item.image && item.image.contextLink) || item.link };
}
/** Commons-only lookup with strict title matching (used to build the
 *  committed tourist-spot map). Never calls Google image search. */
async function findCommonsPhoto(name, hint, lng, lat, deps = {}){
  const fetcher = deps.fetch || fetch;
  const query = `${name} ${hint || ''} Pangasinan`.trim();
  try {
    const byName = await commons(fetcher, {
      generator: 'search', gsrsearch: query,
      gsrnamespace: '6', gsrlimit: '10'
    });
    const hit = byName && pickStrict(byName, name);
    if (hit) return hit;
    if (lng !== undefined && lng !== null && lat !== undefined && lat !== null) {
      const geo = await commons(fetcher, {
        generator: 'geosearch', ggscoord: `${lat}|${lng}`,
        ggsradius: '10000', ggslimit: '20', ggsnamespace: '6'
      });
      if (geo) return pickStrict(geo, name);
    }
    return null;
  } catch (e) {
    if (e && e.status === 429) throw e;
    return null;
  }
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
async function findPhoto(name, hint, lng, lat, deps = {}){
  const fetcher = deps.fetch || fetch;
  const query = `${name} ${hint || ''} Pangasinan`.trim();
  try {
    const cse = await csePhoto(fetcher, name, hint);
    if (cse) return cse;
    const byName = await commons(fetcher, {
      generator: 'search', gsrsearch: query,
      gsrnamespace: '6', gsrlimit: '5'
    });
    if (byName) {
      const hit = pickPhoto(byName, name, hint);
      if (hit) return hit;
    }
    if (lng !== undefined && lat !== undefined) {
      const geo = await commons(fetcher, {
        generator: 'geosearch', ggscoord: `${lat}|${lng}`,
        ggsradius: '10000', ggslimit: '10', ggsnamespace: '6'
      });
      if (geo) return pickPhoto(geo, name, hint);
    }
    return null;
  } catch {
    return null;
  }
}
module.exports = { findPhoto, findCommonsPhoto, relevant, strictRelevant, pickPhoto };
