// LOCKED SCOPE: Pangasinan province only (user decision). The redirect
// gate and inBox filter below enforce it — do not remove without approval.
const { chatRecommend } = require('./agent.js');
const { searchPlaces, inBox } = require('./places.js');
const { findPhoto } = require('./photos.js');
async function recommend(message, proximity, deps = {}) {
  const chatFn = deps.chatFn || chatRecommend;
  const searchFn = deps.searchFn || searchPlaces;
  const agent = await chatFn(message);
  if (agent.intent === 'redirect' || agent.intent === 'refuse' || !agent.candidates.length) {
    return { intent: agent.intent, answer: agent.answer, places: [], spotlight: null };
  }
  const seen = new Set();
  const places = [];
  for (const c of agent.candidates.slice(0, 8)) {
    let hits;
    try {
      hits = await searchFn(`${c.name} ${c.hint || ''} Pangasinan`, proximity);
    } catch {
      continue;
    }
    const hit = hits.find(h => inBox(h.lng, h.lat) && !seen.has(h.id));
    if (!hit) continue;
    seen.add(hit.id);
    const grounded = agent.sources && agent.sources.length;
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${hit.lat},${hit.lng}`;
    places.push({ ...hit, hint: c.hint || '', reason: c.reason || '', description: c.description || '', festival: c.festival || '', fees: c.fees || '', sources: grounded ? agent.sources : [mapLink], sourceKind: grounded ? 'article' : 'map' });
    if (places.length >= 8) break;
  }
  let spotlight = null;
  if (agent.spotlight) {
    spotlight = places.find(p => p.name.toLowerCase().includes(agent.spotlight.name.toLowerCase().split(' ')[0])) || null;
  }
  await Promise.all(places.map(async (p) => {
    try {
      const photo = await findPhoto(p.name, p.hint, p.lng, p.lat);
      if (photo) { p.photo = photo.src; p.photoPage = photo.page; }
    } catch { /* no photo beats a wrong photo */ }
  }));
  return { intent: agent.intent, answer: agent.answer, places, spotlight };
}
module.exports = { recommend };
