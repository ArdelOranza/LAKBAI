import { supabase } from './supabaseClient.js';
import outbox from './outbox.cjs';
const { readOutbox, queueReview, takeAll, stripForInsert } = outbox;
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
    queueReview(row);
    return { queued: true };
  }
  const { error } = await supabase.from('reviews').insert({ ...row, user_id: user.id });
  if (error) {
    queueReview(row);
    return { queued: true, error: error.message };
  }
  try { await flushOutbox(user); } catch { /* keep queue */ }
  return { queued: false };
}
export async function flushOutbox(user){
  if (!supabase || !user) return;
  const box = takeAll();
  for (const r of box) {
    const { error } = await supabase.from('reviews').insert({ ...stripForInsert(r), user_id: user.id });
    if (error) { queueReview(stripForInsert(r)); return; }
  }
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
