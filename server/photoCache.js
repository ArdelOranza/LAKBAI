// Persistent cache for Wikimedia Commons photo lookups.
//
// The Commons search API is rate limited and slow. Without a cache every API
// restart re-searched every unphotographed place, which is how audits hit
// HTTP 429 and how a waking API returned a map full of fallbacks. This stores
// each lookup — including a "no confident photo" miss — on disk so a place is
// searched once per TTL and the answer survives deployments.
//
// Layout: { version: 1, photos: { [name|town]: { value, at } } }
// `value` is the same { src, page, title } the lookup returns, or null for a
// miss. A miss expires sooner than a hit so a newly uploaded Commons photo can
// still be picked up.
const path = require('path');
const { createJsonStore } = require('./jsonStore.js');

const DAY = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;

function defaultFile(){
  return process.env.LAKBAI_PHOTO_CACHE_FILE
    || path.join(__dirname, 'data', 'photo-cache.json');
}

function normalizeDoc(raw){
  return {
    version: 1,
    photos: (raw && raw.photos && typeof raw.photos === 'object' && !Array.isArray(raw.photos)) ? raw.photos : {},
  };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.file] on-disk cache file
 * @param {number} [opts.hitTtl] how long a found photo is reused
 * @param {number} [opts.missTtl] how long a "not found" answer is reused
 * @param {() => number} [opts.now] clock, injectable for tests
 * @param {object} [opts.env] environment, injectable for tests
 * @param {Function} [opts.fetchImpl] Supabase fetch, injectable for tests
 */
function createPhotoCache(opts = {}){
  const file = opts.file || defaultFile();
  const hitTtl = opts.hitTtl === undefined ? 90 * DAY : opts.hitTtl;
  const missTtl = opts.missTtl === undefined ? 14 * DAY : opts.missTtl;
  const now = opts.now || Date.now;

  // The cache is best-effort: a failed save must never break a photo lookup.
  // The document is a row in Supabase in production and the JSON file locally.
  const store = createJsonStore({
    name: 'photo-cache',
    file,
    defaults: () => ({ version: 1, photos: {} }),
    normalize: normalizeDoc,
    env: opts.env,
    fetchImpl: opts.fetchImpl,
  });

  let loaded = false;
  const entries = new Map(); // key -> { value, at }

  function applyDoc(doc){
    const src = doc && doc.photos && typeof doc.photos === 'object' ? doc.photos : {};
    for (const [key, entry] of Object.entries(src)){
      if (!entry || typeof entry.at !== 'number') continue;
      // Only keep values this module can serve, so a hand-edited or corrupt
      // row cannot become a broken image in the app.
      const value = entry.value && typeof entry.value === 'object' && entry.value.src
        ? { src: String(entry.value.src), page: String(entry.value.page || ''), title: String(entry.value.title || '') }
        : null;
      entries.set(key, { value, at: entry.at });
    }
  }

  function load(){
    if (loaded) return;
    loaded = true;
    applyDoc(store.read());
  }

  /** Load the remote document (no-op for the file backend). */
  async function ready(){
    await store.ready();
    if (!loaded){ loaded = true; applyDoc(store.read()); }
  }

  function save(){
    // Fire-and-forget: the in-memory entry is already correct, and losing one
    // cache write only costs a Commons lookup next boot.
    store.write({
      version: 1,
      photos: Object.fromEntries(entries),
    }).catch(() => { /* best effort */ });
  }

  function prune(){
    if (entries.size <= MAX_ENTRIES) return;
    const oldest = [...entries.entries()].sort((a, b) => a[1].at - b[1].at);
    for (let i = 0; i < oldest.length - MAX_ENTRIES; i++) entries.delete(oldest[i][0]);
  }

  return {
    file,
    backend: store.backend,
    ready,
    /** Cached answer, or undefined when the place has never been looked up. */
    get(key){
      load();
      const hit = entries.get(key);
      if (!hit) return undefined;
      const ttl = hit.value ? hitTtl : missTtl;
      if (now() - hit.at > ttl){
        entries.delete(key);
        return undefined;
      }
      return { value: hit.value };
    },
    /** Store a hit or a miss. A miss is null, not undefined. */
    set(key, value){
      load();
      entries.set(key, { value: value || null, at: now() });
      prune();
      save();
    },
    clear(){
      entries.clear();
      loaded = true;
      save();
    },
    get size(){ load(); return entries.size; },
  };
}

module.exports = { createPhotoCache, defaultFile, MAX_ENTRIES };
