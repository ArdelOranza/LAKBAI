// Admin documents that must survive a redeploy.
//
// Render's free web service has no persistent disk: anything written to the
// container at runtime is gone on the next deploy or restart. Admin edits
// (spots, restaurant photos) and the Wikimedia photo cache are therefore
// stored as rows in Supabase `admin_documents` in production, and in the
// original JSON file for local dev and tests.
//
// Reads stay synchronous: the document is held in memory (Supabase) or read
// from the file. Writes are awaited so an admin save cannot report success
// before it has actually been persisted.
//
// Enable the Supabase backend with LAKBAI_STORE=supabase plus SUPABASE_URL and
// SUPABASE_SERVICE_KEY. Without the flag nothing changes, so a local .env that
// happens to contain the project's Supabase keys does not turn the test suite
// into a network client.
const fs = require('fs');
const path = require('path');

const TABLE = 'admin_documents';

function supabaseConfig(env){
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_KEY || '';
  return url && key ? { url, key } : null;
}

function storeError(status, message){
  const e = new Error(message);
  e.status = status;
  return e;
}

/**
 * @param {object} opts
 * @param {string} opts.name        document name (`admin_documents.name`)
 * @param {string} opts.file        JSON file used without Supabase
 * @param {object|function} [opts.defaults] empty document
 * @param {(doc:any)=>any} [opts.normalize] shape/validate a stored document
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @param {Function} [opts.fetchImpl]
 */
function createJsonStore(opts = {}){
  const env = opts.env || process.env;
  const name = opts.name;
  const file = opts.file;
  const normalize = opts.normalize || (doc => doc);
  const defaults = opts.defaults === undefined ? {} : opts.defaults;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const config = env.LAKBAI_STORE === 'supabase' ? supabaseConfig(env) : null;
  const backend = config ? 'supabase' : 'file';

  let memory = null;
  let hydrated = backend === 'file';
  let hydration = null;
  let pending = Promise.resolve();

  const clone = v => JSON.parse(JSON.stringify(v));
  const blank = () => normalize(typeof defaults === 'function' ? defaults() : clone(defaults));

  function readFileDoc(){
    try { return normalize(JSON.parse(fs.readFileSync(file, 'utf8'))); }
    catch { return blank(); }
  }

  function writeFileDoc(doc){
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    // Write then rename: a crash mid-write leaves the old document intact
    // instead of a truncated JSON file the next boot reads as empty.
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, file);
  }

  function headers(withBody){
    return {
      apikey: config.key,
      Authorization: 'Bearer ' + config.key,
      ...(withBody ? { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
    };
  }

  async function loadRemote(){
    const url = `${config.url}/rest/v1/${TABLE}?name=eq.${encodeURIComponent(name)}&select=doc`;
    const r = await fetchImpl(url, { headers: headers(false) });
    if (!r.ok) throw storeError(503, `Admin store unavailable (HTTP ${r.status}). Has migration 0006 been applied?`);
    const rows = await r.json();
    if (rows && rows[0]) return normalize(rows[0].doc);
    // First boot after switching backends: seed from the JSON file that shipped
    // with this deploy (e.g. the committed photo cache). An admin save then
    // persists it to Supabase like any other write.
    return readFileDoc();
  }

  async function saveRemote(doc){
    const url = `${config.url}/rest/v1/${TABLE}?on_conflict=name`;
    const r = await fetchImpl(url, {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ name, doc }),
    });
    if (!r.ok) throw storeError(503, `Could not save admin changes (HTTP ${r.status}).`);
  }

  /** Load the remote document once. Safe to call from every route. */
  function ready(){
    if (hydrated) return Promise.resolve();
    if (hydration) return hydration;
    hydration = loadRemote()
      .then(doc => {
        memory = doc;
        hydrated = true;
      })
      .catch(err => {
        hydration = null; // let the next call retry (a cold Supabase, a bad boot)
        throw err;
      });
    return hydration;
  }

  function read(){
    // The file backend keeps its old read-per-call behaviour, which is what the
    // tests (and a hand-edited file) rely on.
    if (backend === 'file') return readFileDoc();
    return memory || blank();
  }

  async function write(doc){
    const clean = normalize(doc);
    if (backend === 'file'){
      writeFileDoc(clean);
      return clean;
    }
    // Never overwrite a remote document we have not read: if hydration failed,
    // saving the defaults would destroy the admin's data.
    await ready();
    memory = clean;
    // Serialise writes so two quick saves cannot land out of order.
    const next = pending.catch(() => {}).then(() => saveRemote(clean));
    pending = next;
    await next;
    return clean;
  }

  return {
    name,
    file,
    backend,
    read,
    write,
    ready,
    get hydrated(){ return hydrated; },
  };
}

module.exports = { createJsonStore, TABLE };
