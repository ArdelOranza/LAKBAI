const BASE = import.meta.env.VITE_API_URL || '';
async function readError(r){
  try {
    const body = await r.json();
    return body.error || 'request failed';
  } catch {
    return r.statusText || 'request failed';
  }
}
export async function recommend(message, proximity){
  const r = await fetch(`${BASE}/api/recommend`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message, proximity }) });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
export async function itinerary(places, hours){
  const r = await fetch(`${BASE}/api/itinerary`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ places, hours }) });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}
