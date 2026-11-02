import { aiBegin, aiEnd } from './aiActivity.js';
import { sessionGet, sessionSet } from './sessionCache.js';

const BASE = import.meta.env.VITE_API_URL || '';
async function readError(r){
  try {
    const body = await r.json();
    return body.error || 'request failed';
  } catch {
    return r.statusText || 'request failed';
  }
}

/** fetch() that marks the request as AI activity for the whole round trip. */
async function aiFetch(url, init){
  aiBegin();
  try {
    return await fetch(url, init);
  } finally {
    aiEnd();
  }
}

export async function recommend(message, proximity, prefs = []){
  const r = await aiFetch(`${BASE}/api/recommend`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message, proximity, preferences: prefs }) });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
export async function chat(message){
  const r = await aiFetch(`${BASE}/api/chat`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message }) });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
export async function itineraryFromSaved(names, hours = 8, startHour = 9){
  const key = 'lakbai.plan:' + names.join('|');
  const hit = sessionGet(key);
  if (hit) return hit;
  const r = await aiFetch(`${BASE}/api/plan`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message: 'A day trip in Pangasinan visiting: ' + names.join(', '), hours, startHour }) });
  if (!r.ok) throw new Error(await readError(r));
  const plan = await r.json();
  sessionSet(key, plan);
  return plan;
}
