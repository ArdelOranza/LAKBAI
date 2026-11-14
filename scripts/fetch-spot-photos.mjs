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
const { findCommonsPhoto } = require('../server/photos.js');

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, '..', 'server', 'data', 'spot-photos.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function readExisting(){
  try { return JSON.parse(fs.readFileSync(out, 'utf8')).photos || {}; } catch { return {}; }
}
const refresh = process.argv.includes('--refresh');
const photos = refresh ? {} : readExisting();
const pending = SPOTS.filter(s => !photos[s.id]);
console.log(`${Object.keys(photos).length} kept, ${pending.length} to look up`);

for (const spot of pending) {
  let hit = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      hit = await findCommonsPhoto(spot.name, spot.town, spot.lng, spot.lat);
      break;
    } catch (e) {
      if (e.status !== 429) break;
      const wait = 10000 * (attempt + 1);
      console.log(`  rate limited — waiting ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  if (hit) {
    photos[spot.id] = hit;
    console.log('ok   ' + spot.id);
  } else {
    console.log('miss ' + spot.id);
  }
  await sleep(1200); // stay well under Wikimedia's rate limit
}
// Drop entries for spots that no longer exist in the curated catalogue.
const keep = new Set(SPOTS.map(s => s.id));
for (const id of Object.keys(photos)) if (!keep.has(id)) delete photos[id];

const doc = {
  source: 'Wikimedia Commons',
  fetched: new Date().toISOString().slice(0, 10),
  photos,
};
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf8');
console.log(`\n${Object.keys(photos).length}/${SPOTS.length} photos → ${path.relative(process.cwd(), out)}`);
