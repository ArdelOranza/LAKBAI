// Admin-managed spots store (separate admin app reads/writes through this).
//
// Base catalogue lives in spots.js (hard-coded official list). This module
// layers a small persisted patch file on top so admins can edit names,
// coords, categories, blurbs and REAL photo URLs without editing code.
// File layout: { patches: { [baseId]: patchFields }, added: [fullSpot], deleted: [baseId] }
const fs = require('fs');
const path = require('path');
const { SPOTS } = require('./spots.js');
const { photoFor } = require('./spotPhotos.js');

function dataFile(){
  return process.env.LAKBAI_ADMIN_FILE || path.join(__dirname, 'data', 'admin-spots.json');
}

function readDoc(){
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    return {
      patches: (raw && raw.patches && typeof raw.patches === 'object') ? raw.patches : {},
      added: Array.isArray(raw.added) ? raw.added : [],
      deleted: Array.isArray(raw.deleted) ? raw.deleted : [],
    };
  } catch { return { patches: {}, added: [], deleted: [] }; }
}

function writeDoc(doc){
  const f = dataFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(doc, null, 2), 'utf8');
}

const BBOX = { lngMin: 119.7, lngMax: 120.7, latMin: 15.7, latMax: 16.5 };
const inBox = (lng, lat) => lng >= BBOX.lngMin && lng <= BBOX.lngMax && lat >= BBOX.latMin && lat <= BBOX.latMax;

const isHttpUrl = v => {
  try {
    const u = new URL(String(v));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
};

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function validateSpot(data, partial = false){
  const errors = [];
  if (!partial || data.name !== undefined){
    const name = String(data.name ?? '').trim();
    if (!name) errors.push('name is required');
    else if (name.length > 140) errors.push('name too long (max 140 chars)');
    else data.name = name;
  }
  if (!partial || data.town !== undefined){
    const town = String(data.town ?? '').trim();
    if (!town) errors.push('town is required');
    else if (town.length > 80) errors.push('town too long (max 80 chars)');
    else data.town = town;
  }
  if (data.district !== undefined && data.district !== null && data.district !== ''){
    if (!['1','2','3','4','5','6'].includes(String(data.district))) errors.push('district must be 1..6');
    else data.district = String(data.district);
  }
  if ((data.lng !== undefined && data.lng !== null) || (data.lat !== undefined && data.lat !== null)){
    const lng = data.lng === null || data.lng === '' ? null : Number(data.lng);
    const lat = data.lat === null || data.lat === '' ? null : Number(data.lat);
    if ((lng === null) !== (lat === null)) errors.push('lng and lat must be set together');
    else if (lng !== null){
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) errors.push('lng and lat must be numbers');
      else if (!inBox(lng, lat)) errors.push('coordinates outside Pangasinan bbox — must stay in 119.7..120.7, 15.7..16.5');
    }
    data.lng = lng; data.lat = lat;
  }
  if (data.categories !== undefined){
    if (!Array.isArray(data.categories)) errors.push('categories must be an array');
    else data.categories = data.categories.map(c => String(c).trim()).filter(Boolean).slice(0, 8);
  }
  if (data.blurb !== undefined){
    data.blurb = String(data.blurb ?? '').slice(0, 2000);
  }
  if (data.photos !== undefined){
    if (!Array.isArray(data.photos)) errors.push('photos must be an array of URLs');
    else {
      data.photos = data.photos.map(p => String(p).trim()).filter(Boolean).slice(0, 20);
      const bad = data.photos.find(p => !isHttpUrl(p));
      if (bad) errors.push('photo URLs must be http(s) — got: ' + bad);
    }
  }
  if (errors.length) {
    const e = new Error(errors.join('; '));
    e.status = 400;
    throw e;
  }
  return data;
}

function mergeOne(base, patch){
  const photos = patch.photos ?? base.photos ?? [];
  return {
    ...base,
    ...patch,
    id: patch.id || base.id,
    photos,
    categories: patch.categories ?? base.categories ?? [],
    // hierarchy: admin/curated photos are JSON (1st), else Mapbox fallback
    photoSource: (photos && photos[0]) ? 'json' : 'mapbox',
    photo: (photos && photos[0]) || null,
  };
}

function listSpots(){
  const doc = readDoc();
  const deleted = new Set(doc.deleted);
  const tagged = s => ({
    ...s,
    photos: s.photos || [],
    categories: s.categories || [],
    photoSource: s.photos && s.photos[0] ? 'json' : 'mapbox',
    photo: (s.photos && s.photos[0]) || null,
  });
  const patched = SPOTS
    .filter(s => !deleted.has(s.id))
    .map(s => doc.patches[s.id] ? mergeOne(s, doc.patches[s.id]) : tagged(s));
  const added = doc.added
    .filter(s => s && s.id && !deleted.has(s.id))
    .map(tagged);
  return [...patched, ...added].map(withWikimedia);
}

/** Wikimedia fills only empty spots: a curated/admin photo always wins, and a
 *  spot with no photo mapping keeps the Mapbox fallback (client-side). */
function withWikimedia(s){
  if ((s.photos || []).length) return s;
  const p = photoFor(s.id);
  if (!p) return s;
  return { ...s, photos: [p.src], photo: p.src, photoSource: 'wikimedia', photoPage: p.page };
}

function getSpot(id){
  return listSpots().find(s => s.id === id) || null;
}

function nextCustomId(name, town){
  const doc = readDoc();
  const base = 'custom-' + (slug(name + '-' + town) || 'spot') ;
  const taken = new Set([...SPOTS.map(s => s.id), ...doc.added.map(s => s.id)]);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(base + '-' + n)) n++;
  return base + '-' + n;
}

function createSpot(data){
  const clean = validateSpot({ ...(data || {}) });
  const id = clean.id ? slug(clean.id) : nextCustomId(clean.name, clean.town);
  const spot = {
    id,
    name: clean.name,
    town: clean.town,
    district: clean.district ? String(clean.district) : '1',
    categories: clean.categories || ['Heritage','Cultural'],
    blurb: clean.blurb || '',
    photos: clean.photos || [],
    photo: (clean.photos && clean.photos[0]) || null,
    photoSource: (clean.photos && clean.photos[0]) ? 'json' : 'mapbox',
    lng: clean.lng ?? null,
    lat: clean.lat ?? null,
  };
  const doc = readDoc();
  // revive from deleted if id collides with a deleted base id
  doc.deleted = doc.deleted.filter(d => d !== id);
  doc.added.push(spot);
  writeDoc(doc);
  return spot;
}

function updateSpot(id, patchData){
  const doc = readDoc();
  const base = SPOTS.find(s => s.id === id);
  const addedIdx = doc.added.findIndex(s => s.id === id);
  if (!base && addedIdx === -1){
    const e = new Error('Spot not found: ' + id);
    e.status = 404;
    throw e;
  }
  const clean = validateSpot({ ...(patchData || {}) }, true);
  delete clean.id; // id is immutable via patch (would orphan links)
  // undel when patching (editing a deleted base un-deletes it via patch path)
  doc.deleted = doc.deleted.filter(d => d !== id);
  if (addedIdx !== -1){
    doc.added[addedIdx] = { ...doc.added[addedIdx], ...clean, id };
    writeDoc(doc);
    return doc.added[addedIdx];
  }
  doc.patches[id] = { ...(doc.patches[id] || {}), ...clean };
  writeDoc(doc);
  return mergeOne(base, { ...doc.patches[id] });
}

function deleteSpot(id){
  const doc = readDoc();
  const base = SPOTS.find(s => s.id === id);
  const addedIdx = doc.added.findIndex(s => s.id === id);
  if (!base && addedIdx === -1){
    const e = new Error('Spot not found: ' + id);
    e.status = 404;
    throw e;
  }
  if (addedIdx !== -1) doc.added.splice(addedIdx, 1);
  else if (!doc.deleted.includes(id)) doc.deleted.push(id);
  writeDoc(doc);
  return { id, deleted: true };
}

const crypto = require('crypto');
// Hashed admin auth: ADMIN_TOKEN (plain, in .env) is hashed once at
// first use with scrypt + random salt and never kept as plain afterwards.
// Set ADMIN_TOKEN_HASH=scrypt$saltHex$hashHex to persist a precomputed hash.
let cachedHash = null;
let cachedPlain = null;
let cachedPre = null;
function tokenHash(){
  const plain = process.env.ADMIN_TOKEN || '';
  const pre = process.env.ADMIN_TOKEN_HASH || '';
  if (cachedHash && cachedPlain === plain && cachedPre === pre) return cachedHash;
  cachedPlain = plain; cachedPre = pre;
  if (pre.startsWith('scrypt$')){
    const [, saltHex, hashHex] = pre.split('$');
    cachedHash = { salt: Buffer.from(saltHex, 'hex'), hash: Buffer.from(hashHex, 'hex') };
    return cachedHash;
  }
  if (!plain) { cachedHash = null; return null; }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, 64);
  cachedHash = { salt, hash };
  return cachedHash;
}
function matchesToken(presented){
  const entry = tokenHash();
  if (!entry) return false;
  const presentedHash = crypto.scryptSync(String(presented || ''), entry.salt, 64);
  return presentedHash.length === entry.hash.length && crypto.timingSafeEqual(presentedHash, entry.hash);
}
function requireAdmin(req, res, next){
  if (!tokenHash()){
    return res.status(503).json({ error: 'Admin disabled: set ADMIN_TOKEN or ADMIN_TOKEN_HASH on the server.' });
  }
  const got = (req.headers && (req.headers['x-admin-token'] || req.headers['X-Admin-Token'])) || '';
  if (!matchesToken(got)){
    return res.status(401).json({ error: 'Unauthorized — admin token required.' });
  }
  return next();
}

module.exports = { listSpots, getSpot, createSpot, updateSpot, deleteSpot, validateSpot, requireAdmin, inBox, _file: dataFile };
