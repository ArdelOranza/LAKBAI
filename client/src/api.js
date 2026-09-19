const BASE = import.meta.env.VITE_API_URL || '';
export async function recommend(message, proximity){
  const r = await fetch(`${BASE}/api/recommend`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message, proximity }) });
  if (!r.ok) throw new Error((await r.json()).error || 'request failed');
  return r.json();
}
export async function itinerary(places, hours){
  const r = await fetch(`${BASE}/api/itinerary`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ places, hours }) });
  return r.json();
}
