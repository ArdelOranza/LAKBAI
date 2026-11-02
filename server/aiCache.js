// In-process TTL cache with stale-on-error fallback.
// Purpose: protect the Gemini/DeepSeek quota (Review Focus #2) — when the AI
// provider 429s/503s, serve a slightly stale cached answer instead of burning
// retries. Values are stored newest-at-end; prune keeps the map bounded.
//change ai cache to 300
const STORE = new Map(); // key -> { value, at, ttl }
const MAX = 300;

async function cached(key, ttl, loader){
  const hit = STORE.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  try {
    const value = await loader();
    if (STORE.size >= MAX) STORE.delete(STORE.keys().next().value); // oldest first
    STORE.set(key, { value, at: Date.now(), ttl });
    return value;
  } catch (e) {
    if (hit) return hit.value; // stale value beats an outage
    throw e;
  }
}

function clearCache(){ STORE.clear(); }

module.exports = { cached, clearCache };
