const { searchPlaces, inBox } = require('./places.js');
const { extractJson } = require('./agent.js');
function parsePlan(raw){
  let obj;
  try { obj = JSON.parse(extractJson(raw)); } catch { throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 }); }
  if (!obj.title || !Array.isArray(obj.stops)) throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 });
  return obj;
}
async function planDay(message, hours, startHour = 9, deps = {}){
  const agentFn = deps.agentFn || (async (msg, h, s) => {
    const sys = `You plan a Pangasinan day trip of ${h} hours starting ${s}:00. JSON only: {"title":"...","stops":[{"name":"exact place","hint":"town","arrive":"HH:MM","depart":"HH:MM","activities":["..."]}]}. Real places only, all times inside the ${h}-hour window starting ${s}:00.`;
    let raw;
    try { raw = await require('./agent.js').callGeminiForPlan(sys, msg); }
    catch { raw = await require('./groq.js').callGroq(sys, msg); }
    return parsePlan(raw);
  });
  const searchFn = deps.searchFn || searchPlaces;
  const plan = await agentFn(message, hours, startHour);
  const seen = new Set();
  const schedule = [];
  for (const s of plan.stops) {
    let hits;
    try { hits = await searchFn(`${s.name} ${s.hint || ''} Pangasinan`); }
    catch { continue; }
    const hit = hits.find(h => inBox(h.lng, h.lat) && !seen.has(h.id));
    if (!hit) continue;
    seen.add(hit.id);
    schedule.push({ placeId: hit.id, name: hit.name, arrive: s.arrive, depart: s.depart, activities: Array.isArray(s.activities) ? s.activities : [] });
  }
  return { title: plan.title, schedule };
}
module.exports = { planDay, parsePlan };
