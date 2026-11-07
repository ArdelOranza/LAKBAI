/**
 * One source of truth for the API origin.
 *
 * Dev: VITE_API_URL is unset, so requests stay relative and Vite's `/api`
 * proxy forwards them to the local server.
 * Production: VITE_API_URL points at the deployed API service. Without this,
 * `/api/*` hits the static app host (Render returns 502) — see discover.js
 * and spots.js.
 */
export function apiUrl(path){
  const base = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  return base + path;
}
