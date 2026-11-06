const { searchPlaces, inBox } = require('./places.js');
const { extractJson } = require('./agent.js');
const { datasetInfo, allEntries } = require('./dataset.js');

const keyOf = name => String(name || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function parsePlan(raw){
  let obj;
  try { obj = JSON.parse(extractJson(raw)); } catch { throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 }); }
  if (!obj.title || !Array.isArray(obj.stops)) throw Object.assign(new Error('Could not parse plan JSON'), { status: 502 });
  return obj;
}

/** The rows the planner may use: the provided files, never anything else. */
function referenceRows(deps){
  if (deps.entries !== undefined) return deps.entries;
  return datasetInfo().ready ? allEntries() : [];
}

function placeList(entries){
  return entries.map(e => `- ${e.name}${e.town ? ` — ${e.town}` : ''}${e.price ? ` — ${e.price}` : ''}`).join('\n');
}

async function planDay(message, hours, startHour = 9, deps = {}){
  const rows = referenceRows(deps);
  const agentFn = deps.agentFn || (async (msg, h, s) => {
    const sys = rows.length
      ? `You plan a Pangasinan day trip of ${h} hours starting ${s}:00. Use ONLY the places in this list and copy every name exactly as written — do not add a place that is not here:\n${placeList(rows)}\nJSON only: {"title":"...","stops":[{"name":"exact name from the list","hint":"town","arrive":"HH:MM","depart":"HH:MM","activities":["..."]}]}. All times inside the ${h}-hour window starting ${s}:00.`
      : `You plan a Pangasinan day trip of ${h} hours starting ${s}:00. JSON only: {"title":"...","stops":[{"name":"exact place","hint":"town","arrive":"HH:MM","depart":"HH:MM","activities":["..."]}]}. Real places only, all times inside the ${h}-hour window starting ${s}:00.`;
    let raw;
    try { raw = await require('./agent.js').callGeminiForPlan(sys, msg); }
    catch { raw = await require('./groq.js').callGroq(sys, msg); }
    return parsePlan(raw);
  });
  const searchFn = deps.searchFn || searchPlaces;
  const plan = await agentFn(message, hours, startHour);
  const seen = new Set();
  const schedule = [];

  // With the dataset installed, a stop is verified by name against the rows.
  // A name that is not there is dropped, exactly like the chat candidates.
  if (rows.length){
    for (const s of plan.stops){
      const k = keyOf(s && s.name);
      if (!k) continue;
      const entry = rows.find(e => keyOf(e.name) === k)
        || rows.find(e => {
          const ek = keyOf(e.name);
          // Same boundary-aware rule as grounded.js hydrate(): a short model
          // name ("Cove") must not hydrate to an unrelated "... Cove Beach".
          if (ek.length < 8 && k.length < 8) return false;
          return ek.includes(k) || k.includes(ek);
        });
      if (!entry || seen.has(entry.id)) continue;
      // Validate times: HH:MM 24h, inside the requested window, depart after
      // arrive. Anything else is dropped rather than shown as a real time.
      const t = v => (typeof v === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim())) ? v.trim() : null;
      const arrive = t(s.arrive), depart = t(s.depart);
      const mins = v => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
      const start = startHour * 60, end = start + hours * 60;
      if (!arrive || !depart || mins(arrive) < start || mins(depart) > end || mins(depart) <= mins(arrive)) continue;
      seen.add(entry.id);
      schedule.push({
        placeId: entry.id,
        name: entry.name,
        arrive,
        depart,
        activities: Array.isArray(s.activities) ? s.activities : [],
        fees: entry.price || '',
      });
    }
    // Empty schedule is a real signal, not a success: the caller must not
    // present a title-only plan as if stops had been found.
    return { title: plan.title, schedule };
  }

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
