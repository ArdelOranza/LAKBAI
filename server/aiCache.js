// In-process TTL cache with stale-on-error fallback.
// Purpose: protect the Gemini/DeepSeek quota (Review Focus #2) — when the AI
// provider 429s/503s, serve a slightly stale cached answer instead of burning
// retries. Values are stored newest-at-end; prune keeps the map bounded.
const STORE = new Map(); // key -> { value, at, ttl }
const MAX = 200;

async function cached(key, ttl, loader, opts = {}){
  const hit = STORE.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  try {
    const value = await loader();
    if (STORE.size >= MAX) STORE.delete(STORE.keys().next().value); // oldest first
    STORE.set(key, { value, at: Date.now(), ttl });
    return value;
  } catch (e) {
    if (hit){
      // The provider failed but a stale answer is being served — tell the
      // caller so it can arm the breaker (stale content past its TTL is not
      // the same as a live answer, and the breaker must still engage).
      if (typeof opts.onStale === 'function') opts.onStale(e);
      return hit.value; // stale value beats an outage
    }
    throw e;
  }
}

function clearCache(){ STORE.clear(); }

module.exports = { cached, clearCache };
