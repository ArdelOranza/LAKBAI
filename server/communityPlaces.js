// Reviewed community places.
//
// A traveller's submission is a `pending` row in `place_submissions`; it only
// becomes a pin when an admin approves it. The row lives in Supabase because the
// API container has no persistent disk — an approved place written to a file
// would disappear on the next deploy.
//
// Nothing here trusts the client: the status transition is a PATCH guarded by
// `status=eq.pending`, so two admins racing cannot both approve, and a pending
// photo is only reachable through a short-lived signed URL.
//
// The store takes an injected `fetch`, so the exact PostgREST and Storage calls
// are testable without a database.
const TTL_MS = 60 * 1000;
const PRIVATE_BUCKET = 'place-submissions';
const PUBLIC_BUCKET = 'place-photos';
const SIGNED_URL_SECONDS = 60;
const NOTE_MIN = 5;
const NOTE_MAX = 200;

/** Supabase config, or null when the server runs without it (local tests, first boot). */
function envConfig(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: String(url).replace(/\/+$/, ''), key: String(key) };
}

function httpError(status, message){
  const e = new Error(message);
  e.status = status;
  return e;
}

const SAFE_PHOTO = /^([A-Za-z0-9._-]{1,64})\/([A-Za-z0-9._-]{1,128})\.(jpe?g|png|webp)$/i;

/**
 * The row's photo path, only when it names an object inside that submitter's
 * folder. `photo_path` comes from the traveller, and the service key bypasses
 * Storage RLS — without this check an admin preview/approval could sign, copy
 * or delete another user's private file.
 */
function ownedPhotoPath(row){
  const p = String((row && row.photo_path) || '');
  if (!p) return null;
  const m = SAFE_PHOTO.exec(p);
  if (!m) return null;
  if (!row.user_id || m[1] !== String(row.user_id)) return null;
  return p;
}

/** A stored row as the spot shape the map, search and admin already render. */
function toSpot(row){
  const photo = row.photo || null;
  const categories = Array.isArray(row.categories) ? row.categories.slice() : [];
  return {
    id: 'community-' + row.id,
    name: row.name,
    town: row.town,
    barangay: row.barangay || null,
    district: row.barangay || '',
    categories,
    blurb: row.note || '',
    lng: Number(row.lng),
    lat: Number(row.lat),
    photos: photo ? [photo] : [],
    photo,
    photoSource: 'community',
    community: true,
    hours: row.hours || null,
    price: row.price || null,
  };
}

function createStore({ fetch = globalThis.fetch, config = envConfig(), now = () => new Date().toISOString(), ttlMs = TTL_MS } = {}){
  let cache = { at: 0, spots: null };
  const emails = new Map();

  function authHeaders(extra){
    return { apikey: config.key, Authorization: 'Bearer ' + config.key, ...extra };
  }

  async function readBody(res){
    try { return await res.json(); } catch { return null; }
  }

  /** A 5xx or an auth failure means the service is unusable, not that the caller was wrong. */
  function fail(status, body){
    const detail = body && (body.message || body.error || body.msg);
    const mapped = status >= 500 || status === 401 || status === 403 ? 503 : status;
    return httpError(mapped, detail || 'Supabase request failed (' + status + ')');
  }

  /** Reads degrade to empty; writes must say why they cannot happen. */
  function requireConfig(){
    if (!config) throw httpError(503, 'Place submissions are not configured on this server');
  }

  async function rest(path, { method = 'GET', body, params, prefer } = {}){
    requireConfig();
    const url = config.url + '/rest/v1/' + path + (params ? '?' + params : '');
    const headers = authHeaders({ 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) });
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await readBody(res);
    if (!res.ok) throw fail(res.status, data);
    return data;
  }

  async function storage(path, { method = 'POST', body } = {}){
    requireConfig();
    const res = await fetch(config.url + '/storage/v1/' + path, {
      method,
      headers: authHeaders(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await readBody(res);
    if (!res.ok) throw fail(res.status, data);
    return data;
  }

  function invalidate(){ cache = { at: 0, spots: null }; }

  async function fetchRow(id){
    const rows = await rest('place_submissions', { params: 'id=eq.' + encodeURIComponent(id) + '&select=*' });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw httpError(404, 'Submission not found: ' + id);
    return row;
  }

  async function patchPending(id, patch){
    // The `status=eq.pending` guard is what makes approval single-shot.
    const rows = await rest('place_submissions', {
      method: 'PATCH',
      params: 'id=eq.' + encodeURIComponent(id) + '&status=eq.pending',
      prefer: 'return=representation',
      body: patch,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw httpError(409, 'This submission was already reviewed');
    return row;
  }

  async function emailFor(userId){
    if (!userId) return null;
    if (emails.has(userId)) return emails.get(userId);
    let email = null;
    try {
      const res = await fetch(config.url + '/auth/v1/admin/users/' + encodeURIComponent(userId), { headers: authHeaders() });
      const data = await readBody(res);
      if (res.ok && data && data.email) email = data.email;
    } catch { /* the queue still lists the row without a name */ }
    emails.set(userId, email);
    return email;
  }

  /** Approved rows, cached briefly so a busy map does not hammer Supabase. */
  async function approvedSpots(){
    if (!config) return [];
    if (cache.spots && Date.now() - cache.at < ttlMs) return cache.spots;
    const rows = await rest('place_submissions', { params: 'select=*&status=eq.approved&order=created_at.desc' });
    const spots = (Array.isArray(rows) ? rows : []).map(toSpot);
    cache = { at: Date.now(), spots };
    return spots;
  }

  /** Pending rows for the admin queue, with the submitter's email when we can read it. */
  async function listQueue(status = 'pending'){
    if (!config) return [];
    const rows = await rest('place_submissions', {
      params: 'select=*&status=eq.' + encodeURIComponent(status) + '&order=created_at.asc',
    });
    return Promise.all((Array.isArray(rows) ? rows : []).map(async row => ({ ...row, email: await emailFor(row.user_id) })));
  }

  async function promotePhoto(row){
    const key = ownedPhotoPath(row);
    if (!key) return null;
    await storage('object/copy', {
      method: 'POST',
      body: {
        bucketId: PRIVATE_BUCKET,
        sourceKey: key,
        destinationBucket: PUBLIC_BUCKET,
        destinationKey: key,
      },
    });
    const publicUrl = config.url + '/storage/v1/object/public/' + PUBLIC_BUCKET + '/' + key;
    await rest('place_submissions', {
      method: 'PATCH',
      params: 'id=eq.' + encodeURIComponent(row.id),
      body: { photo: publicUrl },
    });
    return publicUrl;
  }

  async function dropPhoto(path){
    await storage('object/' + PRIVATE_BUCKET + '/' + path, { method: 'DELETE' });
  }

  /** Approve: flip the status first, then publish the photo. A photo failure
   *  leaves a live place without a picture rather than an approved row in limbo. */
  async function approve(id){
    const row = await fetchRow(id);
    if (row.status !== 'pending') throw httpError(409, 'Nothing to approve: this submission is ' + row.status);
    const updated = await patchPending(id, { status: 'approved', reviewed_at: now(), review_note: null });
    invalidate();
    if (updated.photo_path){
      try { updated.photo = await promotePhoto(updated); }
      catch { updated.photo = null; }
    }
    return updated;
  }

  async function reject(id, note){
    const reason = String(note || '').trim();
    if (reason.length < NOTE_MIN || reason.length > NOTE_MAX){
      throw httpError(400, 'Reject needs a reason (' + NOTE_MIN + '-' + NOTE_MAX + ' characters)');
    }
    const row = await fetchRow(id);
    if (row.status !== 'pending') throw httpError(409, 'Nothing to reject: this submission is ' + row.status);
    const updated = await patchPending(id, { status: 'rejected', review_note: reason, reviewed_at: now() });
    const key = ownedPhotoPath(row);
    if (key) await dropPhoto(key).catch(() => { /* a stray private object is not worth failing the review */ });
    invalidate();
    return updated;
  }

  /** A short-lived link for a photo that is not public yet. */
  async function photoUrl(id){
    const row = await fetchRow(id);
    const key = ownedPhotoPath(row);
    if (!key) throw httpError(404, 'This submission has no usable photo');
    const data = await storage('object/sign/' + PRIVATE_BUCKET + '/' + key, {
      method: 'POST',
      body: { expiresIn: SIGNED_URL_SECONDS },
    });
    const signed = data && data.signedURL;
    if (!signed) throw httpError(503, 'Could not sign the photo URL');
    return signed.startsWith('http') ? signed : config.url + '/storage/v1' + signed;
  }

  return { approvedSpots, listQueue, approve, reject, photoUrl, invalidate, toSpot };
}

// The exported functions read the environment when they are called, not when the
// module loads, so a late DOTENV load or a test setting no config still works.
let singleton = null;
let singletonKey = '';
function defaultStore(){
  const config = envConfig();
  const key = config ? config.url + '|' + config.key : 'unconfigured';
  if (!singleton || singletonKey !== key){
    singleton = createStore({ config });
    singletonKey = key;
  }
  return singleton;
}

module.exports = {
  TTL_MS,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  toSpot,
  createStore,
  approvedSpots: (...args) => defaultStore().approvedSpots(...args),
  listQueue: (...args) => defaultStore().listQueue(...args),
  approve: (...args) => defaultStore().approve(...args),
  reject: (...args) => defaultStore().reject(...args),
  photoUrl: (...args) => defaultStore().photoUrl(...args),
  invalidate: (...args) => defaultStore().invalidate(...args),
};
