/**
 * Separate-domain admin API client. Token is typed in once and kept in
 * localStorage — never baked into the bundle, never logged.
 *
 * Deployed as its own domain (e.g. admin.lakbai.example) in production,
 * so the API base comes from VITE_API_URL. Local dev uses the Vite proxy.
 */
const TOKEN_KEY = 'lakbai.admin.token';
const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(tok) {
  try {
    if (tok) localStorage.setItem(TOKEN_KEY, tok);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private window */ }
}

async function req(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const tok = getToken();
  if (tok) headers['x-admin-token'] = tok;
  const r = await fetch(API_BASE + path, { ...opts, headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(body.error || ('Request failed: ' + r.status));
    e.status = r.status;
    throw e;
  }
  return body;
}

export const api = {
  list: () => req('/api/admin/spots'),
  create: (data) => req('/api/admin/spots', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => req(`/api/admin/spots/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => req(`/api/admin/spots/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  findPhoto: (payload) => req('/api/admin/photos/find', { method: 'POST', body: JSON.stringify(payload) }),
  places: () => req('/api/admin/places'),
  setPhotos: (id, photos) => req(`/api/admin/places/${encodeURIComponent(id)}/photos`, { method: 'PUT', body: JSON.stringify({ photos }) }),
};
