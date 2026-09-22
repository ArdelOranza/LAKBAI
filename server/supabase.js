let cached = null;
function getService(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { const e = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); e.status = 503; throw e; }
  if (!cached) cached = { url, key };
  return cached;
}
async function getUserFromToken(token){
  const { url, key } = getService();
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  return r.json();
}
module.exports = { getService, getUserFromToken };
