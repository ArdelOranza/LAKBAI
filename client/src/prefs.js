import { supabase } from './supabaseClient.js';

export const TAGS = ['Beaches','Food & Dining','History','Nature','Cafés','Hidden Gems','Hiking & Camping','Island Hopping','Local Markets','Photography','Nightlife','Cultural Sites','Budget Travel','Road Trips','Museums','Waterfalls'];

const KEY = 'lakbai.prefs';
const keyFor = user => (user && user.id ? `lakbai.prefs:${user.id}` : KEY);
export function readLocalPrefs(user){
  const keys = user && user.id ? [keyFor(user), KEY] : [KEY];
  for (const k of keys){
    try {
      const v = JSON.parse(localStorage.getItem(k) || '[]');
      if (Array.isArray(v) && v.length) return v;
    } catch { /* keep looking */ }
  }
  return [];
}
export function writeLocalPrefs(tags, user){
  try { localStorage.setItem(keyFor(user), JSON.stringify(tags || [])); } catch { /* storage full — best effort */ }
}
export function toggleTag(current, tag){ return current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]; }
export async function savePrefs(user, tags){
  writeLocalPrefs(tags, user);
  if (supabase && user) await supabase.from('profiles').upsert({ id: user.id, preferences: tags });
}
export async function loadPrefs(user){
  if (supabase && user){
    const { data } = await supabase.from('profiles').select('preferences,display_name,phone').eq('id', user.id).maybeSingle();
    if (data){
      writeLocalPrefs(data.preferences || [], user);
      return data;
    }
  }
  return { preferences: readLocalPrefs(user), display_name: null, phone: null };
}
