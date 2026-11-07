/**
 * DYNAMIC spots: admin controls the app live. Always hit the network
 * (which merges server/data/admin-spots.json) — localStorage is only an
 * offline fallback, never a stale early return.
 */
import { apiUrl } from './apiBase.js';

export async function fetchSpots(){
  let local = [];
  try { local = JSON.parse(localStorage.getItem('lakbai.spots') || '[]'); } catch { local = []; }
  try {
    const r = await fetch(apiUrl('/api/spots'));
    if (!r.ok) throw new Error('spots unavailable');
    const { spots } = await r.json();
    try { localStorage.setItem('lakbai.spots', JSON.stringify(spots)); } catch { /* full storage */ }
    return spots;
  } catch (e) {
    // Offline: serve the last good catalogue if we have one.
    if (local.length) return local;
    throw e;
  }
}

/** Invalidate the offline cache so the next fetch is guaranteed fresh (admin save, etc.). */
export function bustSpotsCache(){
  try { localStorage.removeItem('lakbai.spots'); } catch { /* ignore */ }
}
