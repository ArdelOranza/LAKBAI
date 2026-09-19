const { chatRecommend } = require('./agent.js');
const { searchPlaces } = require('./places.js');
async function recommend(message, proximity, deps = {}) {
  const chatFn = deps.chatFn || chatRecommend;
  const searchFn = deps.searchFn || searchPlaces;
  const agent = await chatFn(message);
  if (!agent.candidates.length) {
    return { intent: agent.intent, answer: agent.answer, places: [], spotlight: null };
  }
  const seen = new Set();
  const places = [];
  for (const c of agent.candidates.slice(0, 8)) {
    let hits;
    try {
      hits = await searchFn(`${c.name} ${c.hint || ''}`, proximity);
    } catch {
      continue;
    }
    const hit = hits.find(h => !seen.has(h.id));
    if (!hit) continue;
    seen.add(hit.id);
    const grounded = agent.sources && agent.sources.length;
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${hit.lat},${hit.lng}`;
    places.push({ ...hit, reason: c.reason || '', sources: grounded ? agent.sources : [mapLink], sourceKind: grounded ? 'article' : 'map' });
    if (places.length >= 8) break;
  }
  let spotlight = null;
  if (agent.spotlight) {
    spotlight = places.find(p => p.name.toLowerCase().includes(agent.spotlight.name.toLowerCase().split(' ')[0])) || null;
  }
  return { intent: agent.intent, answer: agent.answer, places, spotlight };
}
module.exports = { recommend };
