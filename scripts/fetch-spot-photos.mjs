/**
 * Rebuild server/data/spot-photos.json — Wikimedia Commons photos for the
 * curated tourist spots, strict title match only (no Google image search).
 *
 *   node scripts/fetch-spot-photos.mjs
 *
 * The output is committed and reviewed by hand. A spot with no confident
 * match is simply absent, so the traveller app keeps its map fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { SPOTS } = require('../server/spots.js');
const { findCommonsPhoto, photoCacheKey } = require('../server/photos.js');
const { createPhotoCache } = require('../server/photoCache.js');

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, '..', 'server', 'data', 'spot-photos.json');
const reviewedFile = path.join(root, '..', 'server', 'data', 'spot-photos-reviewed.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Photos a human looked at and confirmed, keyed by spot id. They always win
 *  and are never re-searched: the beach-games banner that used to captain the
 *  Lingayen Baywalk is exactly the kind of hit a search cannot rule out. */
function readReviewed(){
  try {
    const raw = JSON.parse(fs.readFileSync(reviewedFile, 'utf8'));
    return raw && raw.photos && typeof raw.photos === 'object' ? raw.photos : {};
  } catch { return {}; }
}

// One lookup cache shared with the server. `--no-cache` is for a deliberate
// hard re-audit; a normal --refresh rebuilds the map from cached answers and
// never hammers the Commons search API.
const useCache = !process.argv.includes('--no-cache');
const cache = useCache ? createPhotoCache() : null;
const lookupDeps = cache ? { cache } : {};


// What each committed entry is allowed to carry: the thumbnail, the Commons
// page, and the file title that was matched. The title makes a wrong photo
// visible in review instead of hiding behind a hash-named thumbnail.
function entryFor(hit){
  if (!hit || !hit.src) return null;
  const entry = { src: hit.src, page: hit.page };
  if (hit.title) entry.title = hit.title;
  return entry;
}

function readExisting(){
  try {
    const photos = JSON.parse(fs.readFileSync(out, 'utf8')).photos || {};
    // Old entries had no title, so nobody could tell what they showed. Rebuild
    // them the next time the map is generated.
    for (const id of Object.keys(photos)) if (!photos[id].title) delete photos[id];
    return photos;
  } catch { return {}; }
}
const refresh = process.argv.includes('--refresh');
const reviewed = readReviewed();
const photos = refresh ? {} : readExisting();
// A hand-reviewed photo is never looked up again.
for (const [id, entry] of Object.entries(reviewed)) photos[id] = entry;
const pending = SPOTS.filter(s => !photos[s.id]);
console.log(`${Object.keys(photos).length} kept (${Object.keys(reviewed).length} reviewed), ${pending.length} to look up`);

for (const spot of pending) {
  let hit = null;
  const key = photoCacheKey({ name: spot.name, hint: spot.town });
  const cached = cache && cache.get(key) !== undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      hit = await findCommonsPhoto(spot.name, spot.town, lookupDeps);
      break;
    } catch (e) {
      if (e.status !== 429) break;
      const wait = 10000 * (attempt + 1);
      console.log(`  rate limited — waiting ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  if (hit) {
    photos[spot.id] = entryFor(hit);
    console.log('ok   ' + spot.id + '  ' + (hit.title || ''));
  } else {
    console.log('miss ' + spot.id);
  }
  // Only a real network call needs the delay; a cache hit costs Commons nothing.
  if (!cached) await sleep(1200);
}
// A reviewed entry for a spot that is no longer in the catalogue is stale.
const curated = new Set(SPOTS.map(s => s.id));
for (const id of Object.keys(photos)) if (!curated.has(id)) delete photos[id];

const doc = {
  source: 'Wikimedia Commons',
  fetched: new Date().toISOString().slice(0, 10),
  photos,
};
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf8');
console.log(`\n${Object.keys(photos).length}/${SPOTS.length} photos → ${path.relative(process.cwd(), out)}`);
