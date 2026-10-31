// usage: node scripts/geocode-spots.mjs [--dry-run]   (run from server/)
// One-time coordinate resolution against Mapbox Searchbox, locked-bbox filtered.
import { writeFileSync } from 'node:fs';
const { SPOTS } = await import('../spots.js');
const KEY = process.env.VITE_MAPBOX_TOKEN;
if (!KEY) { console.error('VITE_MAPBOX_TOKEN missing'); process.exit(1); }
const inBox = (lng, lat) => lng >= 119.7 && lng <= 120.7 && lat >= 15.7 && lat <= 16.5;
for (const s of SPOTS.filter(s => !Number.isFinite(s.lng))){
  const u = 'https://api.mapbox.com/search/searchbox/v1/forward?' + new URLSearchParams({
    q: `${s.name} ${s.town} Pangasinan`, language: 'en', limit: '1',
    bbox: '119.7,15.7,120.7,16.5', country: 'PH', access_token: KEY });
  const r = await fetch(u);
  if (!r.ok) { console.log('FAIL', s.name, r.status); continue; }
  const d = await r.json();
  const [lng, lat] = d.features?.[0]?.geometry?.coordinates || [];
  if (Number.isFinite(lng) && inBox(lng, lat)) { s.lng = Math.round(lng*1000)/1000; s.lat = Math.round(lat*1000)/1000; console.log('OK  ', s.name, '→', s.lng, s.lat); }
  else console.log('MISS', s.name, s.town); // stays null → not pinned; fine
}
if (process.argv.includes('--dry-run')) process.exit(0);
writeFileSync(new URL('../spots-coords.json', import.meta.url), JSON.stringify(Object.fromEntries(SPOTS.map(s => [s.id, [s.lng, s.lat]])), null, 2));
console.log('written spots-coords.json');
