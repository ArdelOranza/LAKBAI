const DEFAULT_CENTER = [120.23, 16.03];
async function searchPlaces(q, proximity){
  const token = process.env.VITE_MAPBOX_TOKEN;
  if (!token) { const e = new Error('Missing VITE_MAPBOX_TOKEN'); e.status = 503; throw e; }
  const params = new URLSearchParams({
    q, language: 'en', limit: '8',
    proximity: proximity || DEFAULT_CENTER.join(','),
    access_token: token
  });
  const r = await fetch('https://api.mapbox.com/search/searchbox/v1/forward?' + params);
  if (!r.ok) { const e = new Error('Mapbox error ' + r.status); e.status = 502; throw e; }
  const data = await r.json();
  const seen = new Set();
  const places = [];
  for (const f of (data.features || [])){
    const id = f.properties && f.properties.mapbox_id;
    const [lng, lat] = (f.geometry && f.geometry.coordinates) || [];
    if (!id || lng === undefined || lat === undefined || seen.has(id)) continue;
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
module.exports = { DEFAULT_CENTER, searchPlaces };
