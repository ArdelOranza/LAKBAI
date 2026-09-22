const STOP = new Set([
  'beach', 'resort', 'hotel', 'church', 'park', 'island', 'islands',
  'falls', 'point', 'pangasinan', 'philippines', 'file', 'jpg', 'jpeg',
  'png', 'panoramio', 'philippine', 'city', 'town', 'barangay', 'saint',
  'santa', 'santo', 'san', 'the', 'and', 'with', 'view', 'garden'
]);
function words(s){
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w));
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
  const r = await fetcher(url, { headers: { 'User-Agent': 'Lakbai/1.0 (Pangasinan travel MVP; contact: lakbai-app)' } });
  if (!r.ok) return null;
  return r.json();
}
async function findPhoto(name, hint, lng, lat, deps = {}){
  const fetcher = deps.fetch || fetch;
  const query = `${name} ${hint || ''} Pangasinan`.trim();
  try {
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
module.exports = { findPhoto, relevant, pickPhoto };
