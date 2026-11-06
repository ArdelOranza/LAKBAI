// LOCKED SCOPE: Pangasinan province only (user decision). Do not remove
// the bbox lock, inBox filter, or redirect gate without explicit user approval.
const PANGASINAN_BBOX = '119.7,15.7,120.7,16.5';
const DEFAULT_CENTER = [120.23, 16.03];
function inBox(lng, lat){
  return lng >= 119.7 && lng <= 120.7 && lat >= 15.7 && lat <= 16.5;
}
async function searchPlaces(q, proximity){
  const token = process.env.VITE_MAPBOX_TOKEN;
  if (!token) { const e = new Error('Missing VITE_MAPBOX_TOKEN'); e.status = 503; throw e; }
  const params = new URLSearchParams({
    q, language: 'en', limit: '8',
    bbox: PANGASINAN_BBOX,
    country: 'PH',
    proximity: proximity || DEFAULT_CENTER.join(','),
    access_token: token
  });
  const r = await fetch('https://api.mapbox.com/search/searchbox/v1/forward?' + params, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) { const e = new Error('Mapbox error ' + r.status); e.status = 502; throw e; }
  const data = await r.json();
  const seen = new Set();
  const places = [];
  for (const f of (data.features || [])){
    const id = f.properties && f.properties.mapbox_id;
    const [lng, lat] = (f.geometry && f.geometry.coordinates) || [];
    if (!id || lng === undefined || !inBox(lng, lat) || seen.has(id)) continue;
    seen.add(id);
    places.push({
      id, lng, lat,
      name: f.properties.name,
      address: f.properties.full_address || f.properties.address || '',
      categories: (f.properties.poi_category || []).concat(f.properties.category || []).filter(Boolean)
    });
  }
  return places;
}
module.exports = { PANGASINAN_BBOX, DEFAULT_CENTER, inBox, searchPlaces };
