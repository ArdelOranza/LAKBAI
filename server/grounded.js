// Dataset-grounded answers.
//
// The AI is still the voice, but it never searches: the verified JSON rows are
// put in front of it as RECORDS, and every candidate it returns is matched back
// to a real row before it reaches the client. A name that is not in the file is
// dropped, so the model cannot add a place, rating, price or review.
//
// agent.js is untouched — this reuses its exported callGeminiForPlan(sys, msg),
// which talks to Gemini without the google_search tool, then DeepSeek.
const { callGeminiForPlan, extractJson } = require('./agent.js');
const {
  datasetInfo, allEntries, search, withCoords, reasonFor, intentOf, NO_MATCH,
} = require('./dataset.js');
const { isAttraction } = require('./attractions.js');
const { parseProximity, nearestTown, haversineKm } = require('./location.js');

const MAX_RECORDS = 8;
const MAX_INDEX = 60;
const MAX_CANDIDATES = 6;

const SYSTEM = `You are LakbAI, a Pangasinan (Philippines) travel guide. Answer ONLY from the RECORDS and INDEX in the user message — that list is the verified, complete truth. Never invent a place, rating, hours, price or review, and never use outside knowledge about a place. Copy every candidate name character-for-character from a RECORDS or INDEX line. If nothing in the list answers the request, return candidates: [] and say so in one short sentence. Respond with JSON only: {"intent":"discover|food|event|nearby|emergency|plan|redirect|refuse","answer":"short markdown","candidates":[{"name":"exact name from the list","reason":"one grounded why, using only facts from the list","peopleSay":"quote from the record, else empty"}],"spotlight":null,"sources":[]}. Max ${MAX_CANDIDATES} candidates, best first.`;

function keyOf(name){
  return String(name || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function recordLine(entry, i){
  const bits = [entry.name];
  if (entry.town) bits.push(entry.town);
  if (entry.categories.length) bits.push(entry.categories.join('/'));
  if (entry.rating) bits.push(`${entry.rating}★${entry.reviews ? ` (${entry.reviews} reviews)` : ''}`);
  if (entry.hours) bits.push(`hours: ${entry.hours}`);
  if (entry.price) bits.push(`price: ${entry.price}`);
  if (entry.phone) bits.push(`phone: ${entry.phone}`);
  let line = `${i + 1}. ${bits.join(' | ')}`;
  if (entry.quotes[0]) line += `\n   review: "${entry.quotes[0]}"`;
  if (entry.description) line += `\n   about: ${entry.description}`;
  return line;
}

function indexLine(entry){
  const bits = [entry.name];
  if (entry.town) bits.push(entry.town);
  if (entry.categories.length) bits.push(entry.categories.join('/'));
  if (entry.rating) bits.push(`${entry.rating}★`);
  return `- ${bits.join(' — ')}`;
}

/** Compact context block: full rows for the likely matches, a name index for the rest. */
function buildContext(message, proximity){
  const hits = search(message, proximity, MAX_RECORDS);
  const here = parseProximity(proximity);
  const all = allEntries();
  const lines = [`User request: ${message}`];
  if (here){
    const town = nearestTown(here.lng, here.lat);
    lines.push(`Traveler is in ${town ? town + ', ' : ''}Pangasinan (${here.lat.toFixed(3)}, ${here.lng.toFixed(3)}). Prefer nearby places unless the request names somewhere else.`);
  }
  if (hits.length) lines.push('', 'RECORDS:', ...hits.map(recordLine));
  const hitKeys = new Set(hits.map(h => h.id));
  const rest = all.filter(e => !hitKeys.has(e.id));
  if (rest.length){
    const ordered = here
      ? rest.slice().sort((a, b) => distance(a, here) - distance(b, here))
      : rest.slice().sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    lines.push('', 'INDEX (more verified rows you may pick from):', ...ordered.slice(0, MAX_INDEX).map(indexLine));
  }
  if (!hits.length) lines.push('', 'No RECORDS matched directly — pick from INDEX by meaning if anything fits, otherwise say you do not have it.');
  return { text: lines.join('\n'), hits };
}

function distance(entry, here){
  if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) return Infinity;
  return haversineKm(here.lng, here.lat, entry.lng, entry.lat);
}

function parseGrounded(raw){
  let obj;
  try { obj = JSON.parse(extractJson(raw)); } catch { throw Object.assign(new Error('Could not parse grounded JSON'), { status: 502 }); }
  if (!obj || typeof obj !== 'object') throw Object.assign(new Error('Could not parse grounded JSON'), { status: 502 });
  return {
    intent: typeof obj.intent === 'string' && obj.intent ? obj.intent : '',
    answer: String(obj.answer || ''),
    candidates: Array.isArray(obj.candidates) ? obj.candidates : [],
    spotlight: obj.spotlight && typeof obj.spotlight === 'object' ? obj.spotlight : null,
    sources: Array.isArray(obj.sources) ? obj.sources.filter(s => typeof s === 'string') : [],
  };
}

/** Keep only candidates whose names really exist in the file. */
function hydrate(candidates, entries){
  const byKey = new Map();
  for (const e of entries) byKey.set(keyOf(e.name), e);
  const picked = [];
  const seen = new Set();
  for (const c of candidates){
    const k = keyOf(c && c.name);
    if (!k) continue;
    const entry = byKey.get(k)
      || entries.find(e => keyOf(e.name).includes(k) || k.includes(keyOf(e.name)));
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    picked.push({
      entry,
      reason: String(c.reason || '').trim() || reasonFor(entry),
      peopleSay: String(c.peopleSay || '').trim(),
    });
    if (picked.length >= MAX_CANDIDATES) break;
  }
  return picked;
}

async function ask(message, proximity, deps = {}){
  const askFn = deps.askFn || callGeminiForPlan;
  const { text } = buildContext(message, proximity);
  const raw = await askFn(SYSTEM, text);
  const parsed = parseGrounded(raw);
  const entries = allEntries();
  const picked = hydrate(parsed.candidates, entries);
  return { parsed, picked };
}

/** Chat-shaped payload for /api/chat. */
async function groundedChat(message, proximity, deps = {}){
  const info = datasetInfo();
  if (!info.ready) throw Object.assign(new Error('No dataset installed'), { status: 503 });
  const { parsed, picked } = await ask(message, proximity, deps);
  const intent = parsed.intent || intentOf(message);
  if (!picked.length){
    // No verified row backs the reply, so the model's prose is not trusted.
    return { intent, answer: NO_MATCH, candidates: [], spotlight: null, sources: [], source: 'dataset+ai' };
  }
  const answer = parsed.answer || `Here is what I found in the Pangasinan list:\n${picked.map(p => `- **${p.entry.name}**`).join('\n')}`;
  const spotName = parsed.spotlight && keyOf(parsed.spotlight.name);
  const spot = (spotName && picked.find(p => keyOf(p.entry.name) === spotName)) || picked[0];
  return {
    intent,
    answer,
    candidates: picked.map(({ entry, reason, peopleSay }) => ({
      name: entry.name,
      hint: entry.town,
      reason,
      // Ratings and counts always come from the file, never from the model.
      rating: entry.rating,
      reviews: entry.reviews,
      peopleSay: peopleSay || entry.quotes[0] || '',
      description: entry.description,
      festival: entry.festival,
      fees: entry.price,
    })),
    spotlight: parsed.spotlight ? { name: spot.entry.name, reason: spot.reason } : null,
    sources: picked.map(p => p.entry.mapsUrl).filter(Boolean),
    source: 'dataset+ai',
  };
}

/** Recommendation-shaped payload for /api/recommend. */
async function groundedRecommend(message, proximity, prefs = [], deps = {}){
  const info = datasetInfo();
  if (!info.ready) throw Object.assign(new Error('No dataset installed'), { status: 503 });
  const { parsed, picked } = await ask([message, ...(prefs || [])].join(' '), proximity, deps);
  const intent = parsed.intent || intentOf(message);
  const entries = (await withCoords(picked.map(p => p.entry), proximity))
    .filter(e => isAttraction({ name: e.name, categories: e.categories }, intent));
  const here = parseProximity(proximity);
  if (here) entries.sort((a, b) => distance(a, here) - distance(b, here));
  if (!entries.length){
    return { intent, answer: NO_MATCH, places: [], spotlight: null, source: 'dataset+ai' };
  }
  const reasons = new Map(picked.map(p => [p.entry.id, p]));
  const places = entries.map(e => {
    const pick = reasons.get(e.id) || { reason: reasonFor(e), peopleSay: '' };
    return {
      id: e.id,
      name: e.name,
      lng: e.lng,
      lat: e.lat,
      address: e.address,
      categories: e.categories,
      hint: e.town,
      reason: pick.reason,
      rating: e.rating,
      reviews: e.reviews,
      peopleSay: pick.peopleSay || e.quotes[0] || '',
      description: e.description,
      festival: e.festival,
      fees: e.price,
      sources: e.mapsUrl ? [e.mapsUrl] : [],
      sourceKind: 'dataset',
    };
  });
  return {
    intent,
    answer: parsed.answer,
    places,
    spotlight: places[0] || null,
    source: 'dataset+ai',
  };
}

module.exports = { groundedChat, groundedRecommend, buildContext, hydrate, parseGrounded, SYSTEM };
