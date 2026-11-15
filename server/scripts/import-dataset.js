#!/usr/bin/env node
/**
 * Import a hand-made place file into the shape server/dataset.js reads.
 *
 *   node scripts/import-dataset.js <input.json> [--out-dir server/data] [--dry]
 *
 * Why a script instead of pasting JSON: the same three defects keep coming back
 * in scraped files, and each one has burned us in the app.
 *
 *   1. `images` holds gallery junk, not this place's photo. One file had 16
 *      distinct URLs across 200 entries (a Kuya J photo on 103 of them). Those
 *      URLs would outrank the real photo hierarchy, so they are dropped.
 *   2. `reviews` holds scraped third-party quotes ("Google Maps Verified
 *      Reviewer #1") — not our reviews, so only the rating and count survive.
 *   3. The Google Maps place id lives inside the address text and used to render
 *      under the place name, so it is stripped here as well as in normalize().
 *
 * Coordinates are required: an entry outside the Pangasinan box or missing a
 * point is reported and skipped rather than pinned at a guess.
 */
const fs = require('fs');
const path = require('path');

const BBOX = { minLng: 119.7, minLat: 15.7, maxLng: 120.7, maxLat: 16.5 };
const STAY_RE = /\b(hotels?|resorts?|inns?|staycations?|transient|lodges?|hostels?|villas?|pension)\b/i;
const PLACE_ID_RE = /\s*[(,\[]?\s*(?:google\s+maps\s+)?place\s*id\s*[:#-]?\s*[A-Za-z0-9_-]{8,}\s*[)\]]?/gi;

function clean(value){
  return String(value == null ? '' : value)
    .replace(PLACE_ID_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/[,\s]+$/, '')
    .trim();
}

function inBox(lng, lat){
  return lng >= BBOX.minLng && lng <= BBOX.maxLng && lat >= BBOX.minLat && lat <= BBOX.maxLat;
}

/** The list inside any of the shapes these files arrive in. */
function pickList(raw){
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  for (const key of ['entries', 'tourist_spots', 'places', 'restaurants', 'stays', 'spots']){
    if (Array.isArray(raw[key])) return raw[key];
  }
  return Object.values(raw).find(Array.isArray) || [];
}

function haversineKm(a, b, c, d){
  const R = 6371, p = Math.PI / 180;
  const dLat = (c - a) * p, dLng = (d - b) * p;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const normalizeName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Keep only the fields the app reads, with this place's own numbers. */
function convert(entry){
  const name = clean(entry.name || entry.title || entry.place_name || '');
  const town = clean(entry.municipality_or_city || entry.municipality || entry.town || entry.city || '');
  const lat = Number(entry.lat ?? entry.latitude ?? (entry.coordinates && entry.coordinates.lat));
  const lng = Number(entry.lng ?? entry.lon ?? entry.longitude ?? (entry.coordinates && entry.coordinates.lng));
  const category = clean(entry.category || '');
  const reviews = Number(entry.total_review_count ?? entry.review_count ?? 0);
  return {
    id: String(entry.id || '').trim() || undefined,
    name,
    municipality_or_city: town,
    region: clean(entry.region || ''),
    category,
    location: clean(entry.location || entry.address || ''),
    has_fee: entry.has_fee === true,
    fee_in_venue: clean(entry.fee_in_venue || ''),
    description: clean(entry.description || ''),
    what_to_do: Array.isArray(entry.what_to_do) ? entry.what_to_do.map(clean).filter(Boolean) : [],
    rating: Number.isFinite(Number(entry.rating)) ? Number(entry.rating) : undefined,
    total_review_count: Number.isFinite(reviews) && reviews > 0 ? reviews : undefined,
    verified_sources: Array.isArray(entry.verified_sources) ? entry.verified_sources : undefined,
    lat,
    lng,
  };
}

function main(){
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out-dir' && args[args.indexOf(a) - 1] !== '--label');
  const dry = args.includes('--dry');
  const outIdx = args.indexOf('--out-dir');
  const outDir = outIdx > -1 ? args[outIdx + 1] : path.join(__dirname, '..', 'data');
  const labelIdx = args.indexOf('--label');
  if (!input){
    console.error('usage: node scripts/import-dataset.js <input.json> [--label NAME] [--out-dir DIR] [--dry]');
    process.exit(2);
  }

  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  const list = pickList(raw);
  const label = labelIdx > -1 && args[labelIdx + 1]
    ? String(args[labelIdx + 1])
    : path.basename(input, path.extname(input)).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');

  const kept = [], skipped = [];
  for (const entry of list){
    const row = convert(entry);
    if (!row.name || !row.municipality_or_city){ skipped.push(row.name || '(unnamed) — no name/town'); continue; }
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)){ skipped.push(row.name + ' — no coordinates'); continue; }
    if (!inBox(row.lng, row.lat)){ skipped.push(row.name + ' — outside Pangasinan (' + row.lat + ', ' + row.lng + ')'); continue; }
    kept.push(row);
  }

  // Overlap with what is already in the catalogue. dataset.js dedupes by name,
  // first file wins, so re-importing an existing place would silently re-label it
  // with a new id — and any photo an admin attached to the old id would be lost.
  // The incumbent therefore wins: exact duplicates are dropped here, and merely
  // nearby places are reported for a human to eyeball.
  const existing = require('../dataset.js').allEntries();
  const byName = new Map();
  for (const e of existing) {
    const key = normalizeName(e.name);
    if (!byName.has(key)) byName.set(key, e);
  }
  const duplicates = [], nearby = [];
  const fresh = [];
  for (const row of kept){
    const mine = normalizeName(row.name);
    const incumbent = byName.get(mine);
    if (incumbent){
      duplicates.push(row.name + ' (' + row.municipality_or_city + ') — already in ' + (incumbent.source || 'the catalogue'));
      continue;
    }
    // The same place under a longer official name ("URESHII KOI" vs "URESHII
    // KOI Japanese Restaurant") sits on the same pin, so the shorter name is the
    // same place, not a second card.
    const near = existing.find(e => e.lat != null
      && normalizeName(e.town) === normalizeName(row.municipality_or_city)
      && haversineKm(e.lat, e.lng, row.lat, row.lng) < 0.06);
    if (near){
      const other = normalizeName(near.name);
      if (other.includes(mine) || mine.includes(other)){
        duplicates.push(row.name + ' — same pin as ' + near.name);
        continue;
      }
      nearby.push(row.name + ' — within 60 m of ' + near.name + ' (different name, kept)');
    }
    fresh.push(row);
  }
  const stays = fresh.filter(r => STAY_RE.test(r.category));
  const food = fresh.filter(r => !STAY_RE.test(r.category));

  const wrap = (key, rows, kind) => ({
    dataset_title: label + ' — ' + kind,
    province: raw.province || 'Pangasinan',
    region_admin: raw.region_admin || '',
    last_verified: raw.last_verified || new Date().toISOString().slice(0, 10),
    source_note: 'Imported by scripts/import-dataset.js from ' + label + '. Gallery images and third-party review quotes were removed on import.',
    total_entries: rows.length,
    ai_category_taxonomy: Array.isArray(raw.ai_category_taxonomy) ? raw.ai_category_taxonomy : undefined,
    [key]: rows,
  });

  const files = [
    { name: label + '-food.json', key: 'restaurants', rows: food },
    { name: label + '-stays.json', key: 'tourist_spots', rows: stays },
  ];

  console.log('read      ' + list.length + ' entries from ' + label);
  console.log('kept      ' + kept.length + ' (' + food.length + ' food, ' + stays.length + ' stays)');
  console.log('skipped   ' + skipped.length);
  skipped.slice(0, 20).forEach(s => console.log('   - ' + s));
  console.log('duplicates ' + duplicates.length + ' (already in the catalogue, not imported)');
  duplicates.slice(0, 20).forEach(s => console.log('   = ' + s));
  console.log('nearby    ' + nearby.length + ' (kept, worth a look)');
  nearby.slice(0, 20).forEach(s => console.log('   * ' + s));

  if (dry){ console.log('dry run: nothing written'); return; }
  for (const file of files){
    if (!file.rows.length) continue;
    const target = path.join(outDir, file.name);
    fs.writeFileSync(target, JSON.stringify(wrap(file.key, file.rows, file.key), null, 2) + '\n', 'utf8');
    console.log('wrote     ' + target + ' (' + file.rows.length + ' as "' + file.key + '")');
  }
}

if (require.main === module) main();
module.exports = { clean, convert, pickList, inBox };
