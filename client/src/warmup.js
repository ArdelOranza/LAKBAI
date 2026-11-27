import { apiUrl } from './apiBase.js';
import { fetchSpots } from './spots.js';
import { fetchCatalogue } from './catalogue.js';

/** The http(s) photo urls a place list carries (admin photos ride on `photo`). */
export function photoUrls(spots){
  return (Array.isArray(spots) ? spots : [])
    .map(s => s && s.photo)
    .filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));
}

/** Pre-load image urls into the browser cache. Returns how many were queued. */
export function preloadPhotos(spots, load){
  const put = load || (typeof Image !== 'undefined' ? (u => { const i = new Image(); i.src = u; }) : null);
  if (!put) return 0;
  const urls = photoUrls(spots).slice(0, 24);
  for (const u of urls){ try { put(u); } catch { /* a dead image is never fatal */ } }
  return urls.length;
}

/**
 * Boot / pull-to-refresh work: wake a sleeping API and pull the latest
 * admin-set photos onto the device. Fire-and-forget; never throws.
 *
 * 1. A Render free instance sleeps after ~15 min idle, and the next request
 *    waits through a ~30-60s cold start — a health ping starts that clock now.
 * 2. Both place lists are network-first and overwrite their offline cache only
 *    on success, so nothing is cleared up front: a cold start with no signal
 *    keeps the last good catalogue instead of wiping it.
 */
export async function warmUp({ fetchImpl, spots = fetchSpots, catalogue = fetchCatalogue, loadImage } = {}){
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  try { await doFetch(apiUrl('/api/health'), { cache: 'no-store' }); } catch { /* offline is fine */ }
  // One list failing must not stop the other, and both are independent.
  const results = await Promise.allSettled([spots(), catalogue()]);
  const all = results.flatMap(r => r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
  preloadPhotos(all, loadImage);
  return all;
}