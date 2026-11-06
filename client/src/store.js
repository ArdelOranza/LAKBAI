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
function readLocalPlans(){
  try { const v = JSON.parse(localStorage.getItem(PLANS_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function writeLocalPlans(rows){
  try { localStorage.setItem(PLANS_KEY, JSON.stringify(rows)); } catch { /* full storage: cloud row only */ }
}
export async function listPlans(user){
  const local = readLocalPlans();
  if (!supabase || !user) return { data: local };
  const { data, error } = await supabase.from('plans').select('*').order('created_at', { ascending: false });
  if (error) return { data: local, error: error.message };
  // Merge: offline-saved local plans must not vanish when logged in. Dedupe by
  // id so a plan saved to both places appears once (remote wins on conflict).
  const byId = new Map();
  for (const r of local) if (r && r.id) byId.set(r.id, r);
  for (const r of (data || [])) if (r && r.id) byId.set(r.id, r);
  return { data: [...byId.values()] };
}
export async function savePlan(user, plan){
  const id = plan.id || 'local-' + Date.now();
  const localRow = { id, title: plan.title, schedule: plan.schedule, starts_at: plan.starts_at || null, created_at: new Date().toISOString() };
  const existing = readLocalPlans();
  // Dedupe: re-saving the same plan updates its local row instead of
  // prepending a second copy.
  const next = existing.some(r => r && r.id === id)
    ? existing.map(r => (r && r.id === id ? localRow : r))
    : [localRow, ...existing];
  writeLocalPlans(next);
  if (!supabase || !user) return { local: true };
  const { data, error } = await supabase.from('plans').insert({ user_id: user.id, title: plan.title, schedule: plan.schedule, starts_at: plan.starts_at || null }).select().single();
  if (error) return { queued: true, error: error.message, local: true };
  // The cloud id is the canonical one — sync the local row to it so the next
  // save updates instead of duplicating, and listPlans dedupes cleanly.
  if (data && data.id && data.id !== id){
    writeLocalPlans(readLocalPlans().map(r => (r && r.id === id ? { ...localRow, id: data.id } : r)));
  }
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
export async function listMyReviews(user){
  if (!supabase || !user) return [];
  const { data } = await supabase.from('reviews').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return data || [];
}
export async function updateReview(user, id, { score, text }){
  if (!supabase || !user) return { error: 'login required' };
  const { error } = await supabase.from('reviews').update({ score, text }).eq('id', id).eq('user_id', user.id);
  return error ? { error: error.message } : {};
}
export async function deleteReview(user, id){
  if (!supabase || !user) return { error: 'login required' };
  const { error } = await supabase.from('reviews').delete().eq('id', id).eq('user_id', user.id);
  return error ? { error: error.message } : {};
}
export async function saveProfile(user, { display_name, phone }){
  if (!supabase || !user) return { error: 'login required' };
  const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name, phone });
  return error ? { error: error.message } : {};
}
