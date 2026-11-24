import { apiUrl } from './apiBase.js';
import { fetchSpots, bustSpotsCache } from './spots.js';
import { fetchCatalogue, bustCatalogueCache } from './catalogue.js';

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
 * 2. Both place lists are refreshed past their offline caches: the shared
 *    catalogue (map + Dining) and the curated spots (chat cards). Their photos
 *    are where an admin's freshly saved picture rides.
 */
export async function warmUp({ fetchImpl, spots = fetchSpots, catalogue = fetchCatalogue, bust = bustSpotsCache, bustCatalogue = bustCatalogueCache, loadImage } = {}){
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  try { await doFetch(apiUrl('/api/health'), { cache: 'no-store' }); } catch { /* offline is fine */ }
  const all = [];
  for (const [load, clear] of [[spots, bust], [catalogue, bustCatalogue]]){
    try {
      clear();
      const list = await load();
      if (Array.isArray(list)) all.push(...list);
    } catch { /* one list failing must not stop the other */ }
  }
  preloadPhotos(all, loadImage);
  return all;
}