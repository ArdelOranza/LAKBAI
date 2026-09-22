let cached = null;
function getService(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { const e = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); e.status = 503; throw e; }
  if (!cached) cached = { url, key };
  return cached;
}
// Writes are client-direct under RLS; the service client exists for
// future server-side jobs (e.g. history logging).
module.exports = { getService };
