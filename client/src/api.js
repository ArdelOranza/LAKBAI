import { aiBegin, aiEnd } from './aiActivity.js';
import { sessionGet, sessionSet } from './sessionCache.js';
import { apiUrl } from './apiBase.js';
async function readError(r){
  try {
    const body = await r.json();
    return body.error || 'request failed';
  } catch {
    return r.statusText || 'request failed';
  }
}

/** fetch() that marks the request as AI activity for the whole round trip.
 *  `timeoutMs` bounds a hung request so the composer never freezes forever;
 *  pass a signal from the caller for an explicit cancel button. */
async function aiFetch(url, init, { timeoutMs = 60000, signal } = {}){
  aiBegin();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal){
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
    aiEnd();
  }
}

export async function recommend(message, proximity, prefs = []){
  const r = await aiFetch(apiUrl('/api/recommend'), { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message, proximity, preferences: prefs }) });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
export async function chat(message, proximity, signal){
  const r = await aiFetch(apiUrl('/api/chat'), { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message, proximity }) }, { signal });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
export async function itineraryFromSaved(names, hours = 8, startHour = 9){
  const key = 'lakbai.plan:' + names.join('|');
  const hit = sessionGet(key);
  if (hit) return hit;
  const r = await aiFetch(apiUrl('/api/plan'), { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message: 'A day trip in Pangasinan visiting: ' + names.join(', '), hours, startHour }) });
  if (!r.ok) throw new Error(await readError(r));
  const plan = await r.json();
  sessionSet(key, plan);
  return plan;
}
