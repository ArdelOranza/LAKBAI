const { searchPlaces, inBox } = require('./places.js');
function parsePlan(raw){
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 });
  let obj;
  try { obj = JSON.parse(m[0]); } catch { throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 }); }
  if (!obj.title || !Array.isArray(obj.stops)) throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 });
  return obj;
}
async function planDay(message, hours, startHour = 9, deps = {}){
  const agentFn = deps.agentFn || (async (msg) => {
    const sys = 'You plan a Pangasinan day trip. JSON only: {"title":"...","stops":[{"name":"exact place","hint":"town","arrive":"HH:MM","depart":"HH:MM","activities":["..."]}]}. Real places only, times inside the available window.';
    return parsePlan(await require('./agent.js').callGeminiForPlan(sys, msg));
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
