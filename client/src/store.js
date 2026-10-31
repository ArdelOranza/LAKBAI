import { supabase } from './supabaseClient.js';
import { readOutbox, queueReview, queueFavDelete, takeAll, requeue, stripForInsert } from './outbox.js';
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
export async function removeFavorite(user, placeId){
  if (!supabase || !user || !navigator.onLine) {
    queueFavDelete(placeId);
    return { queued: true };
  }
  const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('place_id', placeId);
  if (error) {
    queueFavDelete(placeId);
    return { queued: true, error: error.message };
  }
  try { await flushOutbox(user); } catch { /* keep queue */ }
  return { queued: false };
}
export async function flushOutbox(user){
  if (!supabase || !user) return;
  const box = takeAll();
  for (const r of box) {
    let error;
    if (r.kind === 'favdelete') {
      ({ error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('place_id', r.placeId));
    } else {
      ({ error } = await supabase.from('reviews').insert({ ...stripForInsert(r), user_id: user.id }));
    }
    if (error) {
      requeue([r]); // back at the front, order preserved
      return;
    }
  }
}
const PLANS_KEY = 'lakbai-plans';
export async function listPlans(user){
  if (!supabase || !user) {
    try { const v = JSON.parse(localStorage.getItem(PLANS_KEY) || '[]'); return { data: Array.isArray(v) ? v : [] }; } catch { return { data: [] }; }
  }
  const { data, error } = await supabase.from('plans').select('*').order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}
export async function savePlan(user, plan){
  const localRow = { id: plan.id || 'local-' + Date.now(), title: plan.title, schedule: plan.schedule, starts_at: plan.starts_at || null, created_at: new Date().toISOString() };
  try {
    const v = JSON.parse(localStorage.getItem(PLANS_KEY) || '[]');
    const next = [localRow, ...(Array.isArray(v) ? v.map(r => r.id === localRow.id ? localRow : r) : [])];
    localStorage.setItem(PLANS_KEY, JSON.stringify(next));
  } catch { /* full storage: cloud row only */ }
  if (!supabase || !user) return { local: true };
  const { data, error } = await supabase.from('plans').insert({ user_id: user.id, title: plan.title, schedule: plan.schedule, starts_at: plan.starts_at || null }).select().single();
  if (error) return { queued: true, error: error.message, local: true };
  return { data, local: false };
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
export async function listPlaceReviews(name){
  if (!supabase) return [];
  const { data } = await supabase.from('reviews').select('*').eq('place_name', name).order('created_at', { ascending: false });
  return data || [];
}
