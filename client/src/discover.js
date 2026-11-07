/**
 * U14-B: live Mapbox discovery for places outside the curated dataset —
 * falls, caves, markets, civic spots, anything the Search Box API knows.
 *
 * Every call goes through the server's `/api/places` proxy, which locks
 * results to the Pangasinan bbox and handles the Mapbox token server-side.
 * The client never calls Mapbox directly for forward search.
 */

/** The place card shape used across search rows and map pins. */
function toCard(row, sourceFeed){
  const missing = v => v === null || v === undefined || v === '';
  if (missing(row.lng) || missing(row.lat)) return null;
  const lng = Number(row.lng), lat = Number(row.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const address = row.address || '';
  // Town hint: the segment after the barangay, e.g. "Balingasay, Bolinao, Pangasinan".
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  const hint = parts.length > 2 ? parts[parts.length - 2] : (parts[0] || sourceFeed);
  return {
    id: 'box:' + String(row.id || row.name || lng + ',' + lat),
    name: row.name || address || 'Unnamed place',
    lng, lat,
    address,
    categories: Array.isArray(row.categories) ? row.categories : [],
    photo: row.photo || null,
    photos: Array.isArray(row.photos) ? row.photos : (row.photo ? [row.photo] : []),
    photoSource: row.photoSource || (row.photo ? (String(row.photo).includes('wikimedia') ? 'wikimedia' : 'json') : 'mapbox'),
    hint,
    source: 'mapbox',
  };
}

export async function discoverPlaces(q, proximity, fetchImpl = fetch){
  const query = String(q || '').trim();
  if (!query) return [];
  const params = new URLSearchParams({ q: query });
  if (proximity) params.set('proximity', proximity);
  let res;
  try { res = await fetchImpl('/api/places?' + params); }
  catch { return []; } // offline: search still shows the dataset results
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.places) ? data.places : []);
  const cards = [];
  for (const row of rows){
    const card = toCard(row, 'Discovered');
    if (card) cards.push(card);
  }
  return cards;
}
