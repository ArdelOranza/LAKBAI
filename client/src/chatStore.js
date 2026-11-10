/**
 * Chat persistence: one thread per conversation, mirrored locally and synced to
 * Supabase when the traveler is signed in.
 *
 * - Local mirror first: a reload (or a failed network write) never loses the chat.
 * - "New chat" starts a new thread; old threads stay in history instead of being
 *   deleted.
 * - Loading placeholders and full spot payloads are stripped before storing, and
 *   only the newest messages/threads are kept so storage cannot grow forever.
 */
import { supabase } from './supabaseClient.js';

const MAX_THREADS = 12;
const MAX_MESSAGES = 60;
const MAX_TITLE = 60;

function keyFor(user){
  return `lakbai.chat:${user?.id || 'guest'}`;
}

function readLocal(user){
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(user)) || '[]');
    return Array.isArray(v) ? v.filter(t => t && t.id) : [];
  } catch { return []; }
}

function writeLocal(user, threads){
  try { localStorage.setItem(keyFor(user), JSON.stringify(threads.slice(0, MAX_THREADS))); }
  catch { /* full storage: the cloud row is still attempted */ }
}

function newLocalId(){
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function threadTitle(messages = []){
  const first = messages.find(m => m && m.role === 'user' && String(m.text || '').trim());
  const text = first ? String(first.text).replace(/\s+/g, ' ').trim() : 'New chat';
  return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE - 1).trimEnd() + '…' : text;
}

/** Keep only what a restored card can render; never the whole spot record. */
function slimCard(card = {}){
  const out = {};
  for (const key of ['id', 'name', 'hint', 'description', 'rating', 'reviews', 'fees', 'festival', 'tags', 'lng', 'lat', 'photo']){
    if (card[key] !== undefined) out[key] = card[key];
  }
  if (Array.isArray(card.photos)) out.photos = card.photos.slice(0, 3);
  return out;
}

export function cleanMessages(messages = []){
  return messages
    .filter(m => m && !m.loading)
    .map(({ loading, ...m }) => ({
      ...m,
      cards: Array.isArray(m.cards) ? m.cards.map(slimCard) : undefined,
      more: Array.isArray(m.more) ? m.more.slice(0, 6) : undefined,
    }))
    .slice(-MAX_MESSAGES);
}

function sortThreads(rows){
  return [...rows].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

/** Save (and mirror) one conversation. Returns the thread with its canonical id. */
export async function saveThread(user, thread = {}){
  const messages = cleanMessages(thread.messages);
  // A welcome-only screen is not a conversation worth storing.
  if (!messages.some(m => m.role === 'user')) return thread;

  const now = new Date().toISOString();
  const row = {
    id: thread.id || newLocalId(),
    title: threadTitle(messages),
    messages,
    created_at: thread.created_at || now,
    updated_at: now,
  };
  writeLocal(user, [row, ...readLocal(user).filter(t => t.id !== row.id)]);
  if (!supabase || !user) return row;

  const localId = String(row.id).startsWith('local-');
  if (!localId){
    const { error } = await supabase.from('chat_threads').upsert({
      id: row.id, user_id: user.id, title: row.title, messages: row.messages, updated_at: now,
    }, { onConflict: 'id' });
    return error ? { ...row, error: error.message } : row;
  }
  const { data, error } = await supabase.from('chat_threads')
    .insert({ user_id: user.id, title: row.title, messages: row.messages })
    .select().single();
  if (error) return { ...row, error: error.message };
  if (!data || !data.id) return row;
  const canonical = { ...row, id: data.id, created_at: data.created_at || row.created_at };
  writeLocal(user, readLocal(user).map(t => (t.id === row.id ? canonical : t)));
  return canonical;
}

/** Account history merged with the local mirror, newest first. */
export async function listThreads(user){
  const local = readLocal(user);
  if (!supabase || !user || (typeof navigator !== 'undefined' && !navigator.onLine)){
    return sortThreads(local);
  }
  const { data, error } = await supabase.from('chat_threads')
    .select('id,title,messages,created_at,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(MAX_THREADS);
  if (error) return sortThreads(local);
  const byId = new Map();
  for (const t of local) if (t && t.id) byId.set(t.id, t);
  for (const t of (data || [])) if (t && t.id) byId.set(t.id, t); // cloud wins
  return sortThreads([...byId.values()]).slice(0, MAX_THREADS);
}

/**
 * Synchronous snapshot of the local mirror. Screens paint this on their very
 * first frame, so a reload or a tab switch never blanks the conversation while
 * Supabase is still answering.
 */
export function cachedThreads(user){
  return sortThreads(readLocal(user));
}

/** The conversation to reopen after a reload, or null for a fresh start. */
export async function latestThread(user){
  const threads = await listThreads(user);
  return threads.find(t => Array.isArray(t.messages) && t.messages.length) || null;
}