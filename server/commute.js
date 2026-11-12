// Commuting answers (provincial buses to/from Pangasinan) are grounded in one
// committed LTFRB file: terminal list, town KM markers, the
// 5–600 km fare matrix and the published operator rates.
//
// The model never does the arithmetic. `fareFor()` applies the file's own
// formulas and rounds to the nearest ₱0.25, `fareFacts()` picks the rows that
// match the question, and `fareAnswer()` renders a deterministic reply. The
// chat layer may rephrase the facts, but every figure it prints has to come
// from here — same rule the place records follow.
const DATA = require('./data/ltfrb-pangasinan-bus-fares.json');

const META = DATA.dataset_metadata;
const TOWNS = DATA.pangasinan_cities_and_municipalities_km_directory;
const TERMINALS = DATA.luzon_terminals_going_to_pangasinan;
const ROUTES = DATA.precalculated_origin_to_pangasinan_routes;
const SOLID_NORTH = DATA.operator_published_fare_tables.solid_north_transit;

const EFFECTIVE = '28 Sep 2026';
const DISCLAIMER = `Fares are the LTFRB provincial bus guide effective ${EFFECTIVE} (dataset ${META.version}), not live ticket prices — operators may add authorised expressway tolls, and prices can change. Students, senior citizens and PWDs get at least 20% off every day (LTFRB MC 2017-024). Confirm with the conductor or LTFRB hotline 1342.`;

/** Rounded to the nearest 25 centavos, exactly as the file's formulas require. */
const round25 = v => Math.round(v * 4) / 4;

/** LTFRB provincial bus fares for a road distance, new rate. */
function fareFor(distanceKm){
  const km = Math.max(0, Number(distanceKm) || 0);
  const ordinaryRaw = 12 + Math.max(0, km - 5) * 2.2;
  return {
    ordinary: { regular: round25(ordinaryRaw), discounted: round25(ordinaryRaw * 0.8) },
    aircon: { regular: round25(km * 2.45), discounted: round25(km * 1.96) },
    deluxe: { regular: round25(km * 2.6), discounted: round25(km * 2.08) },
  };
}

const COMMUTE_WORDS = /\b(fare|fares|pamasahe|magkano|bus|buses|terminal|terminals|aircon|deluxe|ordinary|sakay|sumakay|biyahe|commute|papunta|pupunta|pwd|senior|student|ticket|tickets|operator|operators|solid north|victory liner|five star|dagupan bus)\b/i;

function isCommuteQuestion(text){
  return COMMUTE_WORDS.test(String(text || ''));
}

const clean = s => String(s || '')
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** "Lingayen (Provincial Capital)" -> "lingayen"; "Dagupan City" -> "dagupan". */
function baseName(name){
  return clean(String(name || '').replace(/\([^)]*\)/g, '').replace(/\b(city|municipality)\b/gi, ''));
}

const nameVariants = name => {
  const base = baseName(name);
  const out = new Set([base, clean(name)]);
  // A traveler types "Sta. Barbara", the file says "Santa Barbara".
  if (/\bsta\b/.test(base)) out.add(base.replace(/\bsta\b/, 'santa'));
  if (/\bsto\b/.test(base)) out.add(base.replace(/\bsto\b/, 'santo'));
  return [...out].filter(Boolean);
};

function townFor(text){
  const t = ' ' + clean(text) + ' ';
  let best = null;
  for (const town of TOWNS){
    for (const variant of nameVariants(town.name)){
      if (!variant) continue;
      if (t.includes(' ' + variant + ' ') || t.includes(' ' + variant + 's ')){
        if (!best || variant.length > best.len) best = { town, len: variant.length };
      }
    }
  }
  return best ? best.town : null;
}

// Named origins. Longer, more specific names win over the generic ones.
const ORIGINS = [
  { id: 'NCR-PITX', re: /\bpitx\b|para[nñ]aque|integrated terminal exchange/i },
  { id: 'NCR-CUBAO-SOLIDNORTH', re: /\bcubao\b|araneta|ali mall/i },
  { id: 'NCR-PASAY-FIVESTAR-CISCO', re: /\bpasay\b|malibay/i },
  { id: 'NCR-AVENIDA', re: /\bavenida\b|santa cruz|sta\.? cruz|doroteo jose/i },
  { id: 'NCR-SAMPALOC', re: /\bsampaloc\b|espa[nñ]a|earnshaw|lacson/i },
  { id: 'NCR-CALOOCAN-MONUMENTO', re: /\bmonumento\b|\bcaloocan\b/i },
  { id: 'NCR-VALENZUELA-VGC', re: /\bvalenzuela\b|\bvgc\b/i },
  { id: 'LUZ-CLARK-AIRPORT', re: /\bclark\b/i },
  { id: 'LUZ-DAU-MABALACAT', re: /\bdau\b|mabalacat/i },
  { id: 'LUZ-TARLAC-SIESTA', re: /\btarlac\b|siesta/i },
  { id: 'LUZ-CABANATUAN', re: /\bcabanatuan\b/i },
  { id: 'LUZ-BAGUIO-GOVPACK', re: /\bbaguio\b/i },
  { id: 'LUZ-OLONGAPO', re: /\bolongapo\b/i },
  { id: 'LUZ-BATAAN-BALANGA-MARIVELES', re: /\bbataan\b|balanga|mariveles/i },
];
const DEFAULT_ORIGIN = 'NCR-CUBAO-SOLIDNORTH';

const terminalById = id => TERMINALS.find(t => t.terminal_id === id) || null;

function originFor(text){
  const s = String(text || '');
  for (const o of ORIGINS){
    if (o.re.test(s)) return terminalById(o.id);
  }
  return terminalById(DEFAULT_ORIGIN);
}

/** The town's arrival terminals, from the PANG-* rows in the file. */
function terminalsForTown(town){
  const base = baseName(town.name);
  return TERMINALS.filter(t => t.terminal_id.startsWith('PANG-TERM') && clean(t.city_municipality).includes(base));
}

function operatorsFor(town, origin){
  const base = baseName(town.name);
  // Only operators at the terminals of the origin the traveler named — a list
  // of every operator in Luzon is noise, and half of them never reach this town.
  const rows = TERMINALS
    .filter(t => !t.terminal_id.startsWith('PANG-TERM'))
    .filter(t => !origin || clean(t.city_municipality) === clean(origin.city_municipality))
    .filter(t => (t.pangasinan_destinations_served || []).some(d => clean(d).includes(base) || baseName(d) === base));
  const names = [];
  for (const row of rows){
    for (const op of row.bus_operators_to_pangasinan || []){
      // Terminal-name suffixes ("Victory Liner, Inc. (Earnshaw St.)") are the
      // same company; keep one clean entry per operator.
      const label = String(op).replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (label && !names.includes(label)) names.push(label);
    }
  }
  return names.slice(0, 8);
}

function publishedFor(town, origin){
  const base = baseName(town.name);
  const rows = (SOLID_NORTH.routes || []).filter(r => {
    const dest = clean(r.destination);
    if (!dest.includes(base)) return false;
    if (!origin) return true;
    const originName = clean(origin.terminal_name + ' ' + origin.city_municipality);
    const routeOrigin = clean(r.origin);
    if (/cubao/.test(routeOrigin)) return /cubao/.test(originName);
    return routeOrigin.split(' ')[0] && originName.includes(routeOrigin.split(' ')[0]);
  });
  return rows.map(r => ({
    route: r.route,
    regular: r.regular_php,
    standard: r.standard_php,
    luxury: r.luxury_php ?? null,
  }));
}

/** The file's own answer for a town measured from Luneta (KM 0). */
function fromManilaFor(town){
  const row = town.ltfrb_fare_from_km0_manila;
  if (!row) return null;
  return {
    distanceKm: row.distance_km,
    fares: {
      ordinary: { regular: row.ordinary.new_rate.regular_php, discounted: row.ordinary.new_rate.discounted_php },
      aircon: { regular: row.regular_aircon.new_rate.regular_php, discounted: row.regular_aircon.new_rate.discounted_php },
      deluxe: { regular: row.deluxe.new_rate.regular_php, discounted: row.deluxe.new_rate.discounted_php },
    },
  };
}

/**
 * Everything the answer may say about one trip. Returns null when the file
 * knows the destination but not the road distance (an origin the KM markers
 * cannot describe), and when it doesn't know the town at all.
 */
function fareFacts(message){
  const text = String(message || '');
  // A pure jeepney/tricycle question is a different dataset — the bus file has
  // no answer for it, so say so instead of quoting a provincial bus fare.
  const localOnly = /\b(jeep|jeepney|tricycle|trike|pedicab|multicab|uv express|shuttle)\b/i.test(text)
    && !/\b(bus|buses|aircon|deluxe|terminal|solid north|victory liner|five star|dagupan bus)\b/i.test(text);
  if (localOnly) return null;
  const town = townFor(message);
  if (!town) return null;
  const origin = originFor(message);
  const precalculated = origin && ROUTES.find(r => r.origin_terminal_id === origin.terminal_id && r.destination_id === town.id);

  let distanceKm = null;
  let fares = null;
  let corridor = null;
  if (precalculated){
    distanceKm = precalculated.computed_route_distance_km;
    fares = fareFor(distanceKm);
    corridor = precalculated.highway_corridor;
  } else if (origin && (origin.route_distance_adjustment_to_north_luzon_km || /^NCR/.test(origin.terminal_id))){
    // Radial corridor: the town's KM post plus this terminal's offset.
    const km = town.km_marker_from_manila_km0 + Number(origin.route_distance_adjustment_to_north_luzon_km || 0);
    if (km > 0){ distanceKm = km; fares = fareFor(km); }
  }
  const fromManila = fromManilaFor(town);
  if (!fares && !fromManila) return null;

  const facts = {
    town: {
      id: town.id,
      name: town.name.replace(/\s*\([^)]*\)/g, ''),
      km: town.km_marker_from_manila_km0,
      highway: town.primary_highway || '',
      terminals: terminalsForTown(town).map(t => t.terminal_name),
      landmarks: (town.landmarks || []).slice(0, 4),
    },
    origin: origin
      ? { id: origin.terminal_id, name: (precalculated && precalculated.origin_name) || origin.terminal_name }
      : null,
    distanceKm,
    corridor,
    fares,
    fromManila,
    operators: operatorsFor(town, origin),
    published: publishedFor(town, origin),
  };
  facts.text = factsText(facts);
  return facts;
}

function money(v){
  return Number.isFinite(Number(v)) ? `₱${Number(v).toFixed(2)}` : '';
}

function lineFor(label, f){
  return `${label}: ${money(f.regular)} regular / ${money(f.discounted)} student-senior-PWD`;
}

function factsText(facts){
  const lines = [`FARE FACTS (LTFRB provincial bus guide effective ${EFFECTIVE}, dataset ${META.version}):`];
  lines.push(`Destination: ${facts.town.name}, Pangasinan — KM ${facts.town.km} from Luneta (KM 0, Manila)${facts.town.highway ? ` via ${facts.town.highway}` : ''}.`);
  if (facts.town.terminals.length) lines.push(`Arrival terminals: ${facts.town.terminals.join('; ')}.`);
  if (facts.origin) lines.push(`Origin used: ${facts.origin.name}.`);
  if (facts.distanceKm && facts.fares){
    lines.push(`Road distance from ${facts.origin ? facts.origin.name : 'Manila'}${facts.corridor ? ` (${facts.corridor})` : ''}: ${facts.distanceKm} km.`);
    lines.push('LTFRB fares for that distance:');
    lines.push(`- ${lineFor('Ordinary', facts.fares.ordinary)}`);
    lines.push(`- ${lineFor('Regular aircon', facts.fares.aircon)}`);
    lines.push(`- ${lineFor('Deluxe', facts.fares.deluxe)}`);
  } else {
    lines.push('No reliable road distance from that origin is in the file, so quote only the Manila (KM 0) fares below.');
  }
  if (facts.fromManila){
    lines.push(`From Manila (KM 0, ${facts.fromManila.distanceKm} km):`);
    lines.push(`- ${lineFor('Ordinary', facts.fromManila.fares.ordinary)}`);
    lines.push(`- ${lineFor('Regular aircon', facts.fromManila.fares.aircon)}`);
    lines.push(`- ${lineFor('Deluxe', facts.fromManila.fares.deluxe)}`);
  }
  if (facts.operators.length) lines.push(`Operators serving this town: ${facts.operators.join('; ')}.`);
  for (const p of facts.published){
    const bits = [`${money(p.regular)} regular`];
    if (Number.isFinite(p.standard)) bits.push(`${money(p.standard)} standard deluxe`);
    if (Number.isFinite(p.luxury)) bits.push(`${money(p.luxury)} luxury`);
    lines.push(`Published operator rate — ${p.route}: ${bits.join(', ')}.`);
  }
  lines.push(`Do not invent any other figure, travel time or terminal. Local jeepney/tricycle/UV Express fares are NOT in this file.`);
  return lines.join('\n');
}

/** Deterministic reply, used when the model is unavailable or unverifiable. */
function fareAnswer(facts){
  if (!facts) return localRidesNote();
  const out = [];
  out.push(`${facts.town.name} is at KM ${facts.town.km} from Luneta (KM 0, Manila)${facts.origin ? `, about ${facts.distanceKm} km from ${facts.origin.name}` : ''}.`);
  if (facts.fares){
    out.push('', `**LTFRB fares from ${facts.origin ? facts.origin.name : 'Manila'}**`);
    out.push(`- Ordinary — ${money(facts.fares.ordinary.regular)} regular / ${money(facts.fares.ordinary.discounted)} student, senior, PWD`);
    out.push(`- Regular aircon — ${money(facts.fares.aircon.regular)} / ${money(facts.fares.aircon.discounted)}`);
    out.push(`- Deluxe — ${money(facts.fares.deluxe.regular)} / ${money(facts.fares.deluxe.discounted)}`);
  }
  if (facts.fromManila){
    out.push('', `**From Manila (KM 0, ${facts.fromManila.distanceKm} km)**`);
    out.push(`- Ordinary — ${money(facts.fromManila.fares.ordinary.regular)} / ${money(facts.fromManila.fares.ordinary.discounted)}`);
    out.push(`- Regular aircon — ${money(facts.fromManila.fares.aircon.regular)} / ${money(facts.fromManila.fares.aircon.discounted)}`);
    out.push(`- Deluxe — ${money(facts.fromManila.fares.deluxe.regular)} / ${money(facts.fromManila.fares.deluxe.discounted)}`);
  }
  for (const p of facts.published){
    const bits = [`${money(p.regular)} regular`];
    if (Number.isFinite(p.standard)) bits.push(`${money(p.standard)} standard deluxe`);
    if (Number.isFinite(p.luxury)) bits.push(`${money(p.luxury)} luxury`);
    out.push('', `**Published operator rate — ${p.route}**: ${bits.join(', ')}.`);
  }
  if (facts.operators.length) out.push('', `You can ride with ${facts.operators.join(', ')}.`);
  if (facts.town.terminals.length) out.push(`Terminal: ${facts.town.terminals.join('; ')}.`);
  out.push('', DISCLAIMER);
  return out.join('\n');
}

function localRidesNote(){
  return `Jeepney, tricycle and UV Express fares are not in this verified file, so I can't quote them — ask a local operator or confirm with LTFRB hotline 1342. For provincial buses, just tell me your origin and destination town.`;
}

/** Honest reply for a commuting question the file cannot answer. */
function outOfScopeNote(message){
  const local = /\b(jeep|jeepney|tricycle|trike|pedicab|multicab|uv express|shuttle)\b/i.test(String(message || ''));
  if (local) return localRidesNote();
  return `That route isn't in the LTFRB file I have, so I can't quote a verified fare. The file covers provincial buses between Luzon terminals and Pangasinan towns — name the Pangasinan town you're heading to, or confirm with LTFRB hotline 1342.`;
}

// --- the prose is checked too ---------------------------------------------
const PLACE_WORD = /\b(beach(es)?|falls?|park|island|cove|bay|river|lake|mount(ain)?|hills?|resort|hotel|inn|church|parish|shrine|basilica|museum|plaza|market|mall|cafe|restaurant|garden|farm|springs?|zipline|trail|deck|viewpoint|point|sanctuary|pavilion|stadium|airport|terminal|bridge|caves?|pools?|dam)\b/i;
const CITY_WORD = /\b(city|municipality|province)\b/i;
const numbersIn = text => [...String(text || '').matchAll(/\d[\d,]*(?:\.\d+)?/g)]
  .map(m => Number(m[0].replace(/,/g, '')))
  .filter(n => Number.isFinite(n));
const capitalizedRuns = text => [...String(text || '').matchAll(/\b([A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*)+)/g)]
  .map(m => m[1].trim());
const keyOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const withDisclaimer = text => (text.includes('LTFRB hotline 1342') ? text : `${text}\n\n${DISCLAIMER}`);

/**
 * Keep the model's phrasing only while every figure and name in it is written
 * in the facts block; otherwise show the deterministic fare answer instead.
 * The disclaimer is always attached here, never trusted to the model.
 */
function groundCommuteAnswer(answer, facts){
  const fail = () => ({ answer: withDisclaimer(fareAnswer(facts)), grounded: false });
  if (!facts) return { answer: localRidesNote(), grounded: false };
  const text = String(answer || '').trim();
  if (!text) return fail();
  const factsText = String(facts.text || '');
  const factsKey = keyOf(factsText);
  const factsNumbers = numbersIn(factsText);

  for (const n of numbersIn(text)){
    if (n < 10) continue; // list markers, "5 km walks" and small counts
    if (!factsNumbers.some(f => Math.abs(f - n) < 0.001)) return fail();
  }
  const money = [...text.matchAll(/₱\s*([\d,]+(?:\.\d+)?)/g)].map(m => Number(m[1].replace(/,/g, '')));
  for (const a of money){
    if (Number.isFinite(a) && !factsNumbers.some(f => Math.abs(f - a) < 0.001)) return fail();
  }
  // The file has no departure times, so any clock time is an invention.
  if (/\d{1,2}(?::\d{2})?\s*(?:AM|PM)/i.test(text)) return fail();
  for (const run of capitalizedRuns(text)){
    if (!PLACE_WORD.test(run) && !CITY_WORD.test(run)) continue;
    const k = keyOf(run);
    if (k && !factsKey.includes(k)) return fail();
  }
  return { answer: withDisclaimer(text), grounded: true };
}

/** Bumped into the AI cache key so editing the file can never serve old fares. */
function commuteVersion(){
  return `${META.version}|${META.effective_date_ltfrb}|${TOWNS.length}`;
}

// A question that explicitly asks a price keeps the LTFRB fare path even when it
// also names a terminal ("how much is the fare from the Cubao terminal?").
const FARE_QUESTION = /\b(fare|fares|pamasahe|magkano|magkanu|mag kano|how much|price|presyo)\b/i;
function isFareQuestion(text){
  return FARE_QUESTION.test(String(text || ''));
}

module.exports = {
  isCommuteQuestion, isFareQuestion, fareFacts, fareAnswer, fareFor, localRidesNote,
  outOfScopeNote, groundCommuteAnswer, commuteVersion, DISCLAIMER,
};
