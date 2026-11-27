// Per-user offline outbox. Each user's queue lives under its own key so a
// logged-in user never flushes another user's pending rows (privacy) and one
// poisoned entry cannot discard the rest of the queue (peek-then-remove).
const keyFor = user => `lakbai-review-outbox:${user?.id || 'anonymous'}`;
const ALLOW = ['place_id', 'place_name', 'score', 'text'];

/** Stable per-entry id so a flush removes the row it actually wrote. */
function newId(){
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function readRaw(user){
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(user)) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeRaw(user, box){
  try { localStorage.setItem(keyFor(user), JSON.stringify(box)); } catch { /* full storage: keep best effort */ }
}
export function readOutbox(user){
  return readRaw(user);
}
export function peekOutbox(user){
  return [...readRaw(user)];
}
export function removeFirst(user){
  const box = readRaw(user);
  if (!box.length) return undefined;
  const [first, ...rest] = box;
  writeRaw(user, rest);
  return first;
}
/** Remove one specific queued entry; legacy rows without an id fall back to the head. */
export function removeById(user, id){
  const box = readRaw(user);
  if (!box.length) return undefined;
  if (!id) return removeFirst(user);
  const i = box.findIndex(r => r && r.id === id);
  if (i === -1) return removeFirst(user);
  const [gone] = box.splice(i, 1);
  writeRaw(user, box);
  return gone;
}
export function queueReview(user, row){
  const box = readRaw(user);
  const safeRow = {};
  for (const k of ALLOW) if (row && k in row) safeRow[k] = row[k];
  box.push({ ...safeRow, kind:'review', at: Date.now(), id: newId() });
  writeRaw(user, box);
  return box;
}
export function queueFavDelete(user, placeId){
  const box = readRaw(user);
  box.push({ kind:'favdelete', placeId, id: newId() });
  writeRaw(user, box);
  return box;
}
// Back-compat: takeAll(user) returns a copy and clears only that user's queue.
export function takeAll(user){
  const box = readRaw(user);
  try { localStorage.removeItem(keyFor(user)); } catch { /* ignore */ }
  return box;
}
export function requeue(entries, user){
  const box = readRaw(user);
  const next = [...entries, ...box];
  writeRaw(user, next);
  return next;
}
export function stripForInsert(row){
  const out = {};
  for (const k of ALLOW) if (row && k in row) out[k] = row[k];
  return out;
}
