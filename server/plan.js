const { searchPlaces, inBox } = require('./places.js');
const { extractJson } = require('./agent.js');
const { datasetInfo, allEntries } = require('./dataset.js');
const { haversineKm, parseProximity, nearestTown } = require('./location.js');

// A day trip must stay walkable/drivable from where the traveler actually is.
// Beyond this the app would be inventing a destination instead of using the fix.
const MAX_PLAN_KM = 50;
const NO_FIX = 'Turn on location so the route can stay within 50 km of you.';
const NOTHING_NEAR = 'No verified places within 50 km of your location.';

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

/** Only rows whose real coordinates are inside the radius. A row without
 *  coordinates cannot be proven nearby, so it is excluded. */
function withinRadius(rows, traveler){
  return rows.filter(e => {
    const lng = Number(e.lng), lat = Number(e.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    return haversineKm(traveler.lng, traveler.lat, lng, lat) <= MAX_PLAN_KM;
  });
}

function placeList(entries){
  return entries.map(e => `- ${e.name}${e.town ? ` — ${e.town}` : ''}${e.price ? ` — ${e.price}` : ''}`).join('\n');
}

function radiusLine(traveler){
  const town = nearestTown(traveler.lng, traveler.lat);
  const where = town
    ? `near ${town} (${traveler.lat.toFixed(3)}, ${traveler.lng.toFixed(3)})`
    : `at ${traveler.lat.toFixed(3)}, ${traveler.lng.toFixed(3)}`;
  return `The traveler is ${where}. Every stop MUST be within 50 km of that point — never guess a destination or send them across the province.`;
}

async function planDay(message, hours, startHour = 9, deps = {}){
  const traveler = parseProximity(deps.proximity);
  if (!traveler) throw Object.assign(new Error(NO_FIX), { status: 422 });

  const sourceRows = referenceRows(deps);
  const rows = sourceRows.length ? withinRadius(sourceRows, traveler) : [];
  if (sourceRows.length && !rows.length) throw Object.assign(new Error(NOTHING_NEAR), { status: 422 });

  const where = radiusLine(traveler);
  const agentFn = deps.agentFn || (async (msg, h, s) => {
    const sys = rows.length
      ? `You plan a Pangasinan day trip of ${h} hours starting ${s}:00. ${where} Use ONLY the places in this list and copy every name exactly as written — do not add a place that is not here:\n${placeList(rows)}\nJSON only: {"title":"...","stops":[{"name":"exact name from the list","hint":"town","arrive":"HH:MM","depart":"HH:MM","activities":["..."]}]}. All times inside the ${h}-hour window starting ${s}:00.`
      : `You plan a Pangasinan day trip of ${h} hours starting ${s}:00. ${where} JSON only: {"title":"...","stops":[{"name":"exact place","hint":"town","arrive":"HH:MM","depart":"HH:MM","activities":["..."]}]}. Real places within 50 km only, all times inside the ${h}-hour window starting ${s}:00.`;
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

  // Non-dataset branch: same time validation as the dataset branch above.
  // Model-provided times are never trusted blindly, and hits outside the
  // traveler's radius are dropped instead of being scheduled.
  for (const s of plan.stops) {
    const t = v => (typeof v === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim())) ? v.trim() : null;
    const arrive = t(s.arrive), depart = t(s.depart);
    const mins = v => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
    const start = startHour * 60, end = start + hours * 60;
    if (!arrive || !depart || mins(arrive) < start || mins(depart) > end || mins(depart) <= mins(arrive)) continue;
    let hits;
    try { hits = await searchFn(`${s.name} ${s.hint || ''} Pangasinan`); }
    catch { continue; }
    const hit = hits.find(h => inBox(h.lng, h.lat) && !seen.has(h.id)
      && haversineKm(traveler.lng, traveler.lat, Number(h.lng), Number(h.lat)) <= MAX_PLAN_KM);
    if (!hit) continue;
    seen.add(hit.id);
    schedule.push({ placeId: hit.id, name: hit.name, arrive, depart, activities: Array.isArray(s.activities) ? s.activities : [] });
  }
  return { title: plan.title, schedule };
}
module.exports = { planDay, parsePlan, MAX_PLAN_KM };