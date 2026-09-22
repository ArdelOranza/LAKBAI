import { supabase } from './supabaseClient.js';
const outboxKey = 'lakbai-review-outbox';
function readOutbox(){ try { const v = JSON.parse(localStorage.getItem(outboxKey) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
export async function saveFavorite(user, place){
  if (!supabase || !user) return { error: 'login required' };
  return supabase.from('favorites').upsert({ user_id: user.id, place_id: place.id, name: place.name, lng: place.lng, lat: place.lat, photo: place.photo || null }, { onConflict: 'user_id,place_id' });
}
export async function listFavorites(user){
  if (!supabase || !user) return { data: [], error: 'login required' };
  return supabase.from('favorites').select('*').order('created_at', { ascending: false });
}
export async function postReview(user, place, score, text){
  const row = { place_id: place.id, place_name: place.name, score, text };
  if (!supabase || !user || !navigator.onLine) {
    const box = readOutbox(); box.push({ ...row, at: Date.now() });
    localStorage.setItem(outboxKey, JSON.stringify(box));
    return { queued: true };
  }
  const { error } = await supabase.from('reviews').insert({ ...row, user_id: user.id });
  if (error) {
    const box = readOutbox(); box.push({ ...row, at: Date.now() });
    localStorage.setItem(outboxKey, JSON.stringify(box));
    return { queued: true, error: error.message };
  }
  try { await flushOutbox(user); } catch { /* keep queue */ }
  return { queued: false };
}
export async function flushOutbox(user){
  if (!supabase || !user) return;
  const box = readOutbox();
  for (const r of box) {
    const { error } = await supabase.from('reviews').insert({ ...r, user_id: user.id });
    if (error) return;
  }
  localStorage.removeItem(outboxKey);
}
export async function logSearch(user, query){
  if (!supabase || !user || !query) return;
  await supabase.from('searches').insert({ user_id: user.id, query });
}
export async function listHistory(user){
  if (!supabase || !user) return [];
  const { data } = await supabase.from('searches').select('query,created_at').order('created_at', { ascending: false }).limit(20);
  return data || [];
}
export function localReviews(placeId){
  try { const v = JSON.parse(localStorage.getItem('lakbai-reviews:' + placeId) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
