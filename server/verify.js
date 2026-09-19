const { chatRecommend } = require('./agent.js');
const { searchPlaces, inBox } = require('./places.js');
async function recommend(message, proximity, deps = {}) {
  const chatFn = deps.chatFn || chatRecommend;
  const searchFn = deps.searchFn || searchPlaces;
  const agent = await chatFn(message);
  if (agent.intent === 'redirect' || !agent.candidates.length) {
    return { intent: agent.intent, answer: agent.answer, places: [], spotlight: null };
  }
  const seen = new Set();
  const places = [];
  for (const c of agent.candidates.slice(0, 8)) {
    const hits = await searchFn(`${c.name} ${c.hint || ''} Pangasinan`, proximity);
    const hit = hits.find(h => inBox(h.lng, h.lat) && !seen.has(h.id));
    if (!hit) continue;
    seen.add(hit.id);
    places.push({ ...hit, reason: c.reason || '', sources: agent.sources || [] });
    if (places.length >= 8) break;
  }
  let spotlight = null;
  if (agent.spotlight) {
    spotlight = places.find(p => p.name.toLowerCase().includes(agent.spotlight.name.toLowerCase().split(' ')[0])) || null;
  }
  return { intent: agent.intent, answer: agent.answer, places, spotlight };
}
module.exports = { recommend };
