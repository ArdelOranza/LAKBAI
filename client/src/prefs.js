import { supabase } from './supabaseClient.js';

export const TAGS = ['Beaches','Food & Dining','History','Nature','Cafés','Hidden Gems','Hiking & Camping','Island Hopping','Local Markets','Photography','Nightlife','Cultural Sites','Budget Travel','Road Trips','Museums','Waterfalls'];

const KEY = 'lakbai.prefs';
const keyFor = user => (user && user.id ? `lakbai.prefs:${user.id}` : KEY);
export function readLocalPrefs(user){
  const keys = user && user.id ? [keyFor(user), KEY] : [KEY];
  for (const k of keys){
    try {
      const raw = localStorage.getItem(k);
      // An explicitly cleared list ([]) is definitive — don't fall through to
      // a stale legacy key that would resurrect the previous account's picks.
      if (raw != null){
        const v = JSON.parse(raw || '[]');
        if (Array.isArray(v)) return v;
      }
    } catch { /* keep looking */ }
  }
  return [];
}
export function writeLocalPrefs(tags, user){
  try {
    localStorage.setItem(keyFor(user), JSON.stringify(tags || []));
    // A signed-in save supersedes the shared legacy key; clear it so another
    // account on this device can't read this user's interests back.
    if (user && user.id) localStorage.removeItem(KEY);
  } catch { /* storage full — best effort */ }
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
      // A profile row is authoritative — even an empty preferences array
      // (cleared remotely) must overwrite the local copy.
      writeLocalPrefs(data.preferences || [], user);
      return data;
    }
  }
  return { preferences: readLocalPrefs(user), display_name: null, phone: null };
}
