/**
 * Terminals that go to Pangasinan (Metro Manila districts + Luzon regional
 * hubs), joined with curated coordinates so answers can be ranked by where the
 * traveler actually is. The source file has no coordinates — see
 * data/terminal-coords.json for how each point was compiled and how precise it
 * is.
 *
 * Fares stay in commute.js: this module never quotes a price, so the LTFRB
 * matrix remains the only source of fares.
 */
const { haversineKm, parseProximity } = require('./location.js');
const { figuresIn, unitFigures } = require('./figures.js');

const DIRECTORY = require('./data/terminals-to-pangasinan.json');
const COORDS = require('./data/terminal-coords.json');
const LTFRB = require('./data/ltfrb-pangasinan-bus-fares.json');

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const norm = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const METRO_AREAS = {
  cubao_quezon_city: { label: 'Cubao, Quezon City', re: /\bcubao\b|araneta/i },
  pasay_city: { label: 'Pasay City', re: /\bpasay\b|malibay/i },
  paranaque_pitx: { label: 'PITX, Parañaque', re: /\bpitx\b|para[nñ]aque/i },
  makati_one_ayala: { label: 'One Ayala, Makati', re: /\bone ayala\b|\bmakati\b/i },
  avenida_santa_cruz_manila: { label: 'Avenida, Manila', re: /\bavenida\b|doroteo jose|santa cruz|sta\.? cruz|oquieta/i },
  sampaloc_manila: { label: 'Sampaloc, Manila', re: /\bsampaloc\b|espa[nñ]a|earnshaw/i },
  caloocan_monumento: { label: 'Monumento, Caloocan', re: /\bcaloocan\b|monumento|grace park/i },
};

const REGIONAL_AREAS = {
  'baguio-gov-pack-terminals': { label: 'Baguio City, Benguet', re: /\bbaguio\b/i },
  'dau-mabalacat-terminal': { label: 'Dau, Mabalacat (Clark), Pampanga', re: /\bdau\b|mabalacat|\bclark\b/i },
  'victory-liner-olongapo': { label: 'Olongapo City, Zambales', re: /\bolongapo\b/i },
  'cabanatuan-central-terminal': { label: 'Cabanatuan City, Nueva Ecija', re: /\bcabanatuan\b/i },
};

const AREA_LIST = [
  ...Object.entries(METRO_AREAS).map(([key, a]) => ({ key, ...a })),
  ...Object.entries(REGIONAL_AREAS).map(([key, a]) => ({ key, ...a })),
];

const coordById = new Map(COORDS.points.map(p => [p.terminal_id, p]));

function operatorsOf(operatorName){
  return String(operatorName || '')
    .split(/&|\//)
    .map(s => clean(s))
    .filter(Boolean);
}

const TERMINALS = [];

for (const [key, rows] of Object.entries(DIRECTORY.metro_manila_terminals_by_district)){
  for (const t of rows){
    const c = coordById.get(t.terminal_id);
    if (!c) continue;
    TERMINALS.push({
      id: t.terminal_id,
      name: t.terminal_name,
      areaKey: key,
      area: (METRO_AREAS[key] || { label: key }).label,
      side: 'origin',
      operators: operatorsOf(t.operator_name),
      destinations: t.pangasinan_destinations || [],
      address: clean(t.address),
      phone: clean(t.contact_phone),
      rating: t.google_rating || null,
      schedule: clean(t.schedule_summary),
      lat: c.lat,
      lng: c.lng,
      precision: c.precision,
    });
  }
}

for (const t of DIRECTORY.regional_luzon_terminals_to_pangasinan){
  const c = coordById.get(t.terminal_id);
  if (!c) continue;
  TERMINALS.push({
    id: t.terminal_id,
    name: t.terminal_name,
    areaKey: t.terminal_id,
    area: (REGIONAL_AREAS[t.terminal_id] || { label: clean(t.hub_city) }).label,
    side: 'origin',
    operators: (t.operators || []).map(clean),
    destinations: t.pangasinan_destinations || [],
    address: clean(t.address),
    phone: clean(t.contact_phone),
    rating: t.google_rating || null,
    schedule: clean(t.schedule_summary),
    lat: c.lat,
    lng: c.lng,
    precision: c.precision,
  });
}

// The Pangasinan side: the departure hubs a traveler standing in Dagupan,
// Lingayen, etc. actually walks to. Details come from the LTFRB file.
for (const row of LTFRB.luzon_terminals_going_to_pangasinan){
  if (!row.terminal_id.startsWith('PANG-TERM')) continue;
  const c = coordById.get(row.terminal_id);
  if (!c) continue;
  TERMINALS.push({
    id: row.terminal_id,
    name: row.terminal_name,
    areaKey: 'pangasinan',
    area: clean(row.city_municipality),
    side: 'pangasinan',
    operators: (row.bus_operators_to_pangasinan || []).map(clean),
    destinations: [],
    address: clean(row.address),
    phone: '',
    rating: null,
    schedule: clean(row.operating_hours),
    lat: c.lat,
    lng: c.lng,
    precision: c.precision,
  });
}

const DEST_NAMES = [...new Set(
  TERMINALS.flatMap(t => t.destinations)
    .map(d => clean(d).replace(/\s*\([^)]*\)/g, ''))
    .filter(d => d.length > 2 && !/^all /i.test(d)),
)].sort((a, b) => b.length - a.length);

// A bare town name ("Dagupan") must reach its directory name ("Dagupan City").
// Each destination is matched by its full name and, when it ends in "City", by
// the bare town name; the full name is what the matcher returns so narrowing
// still uses the directory's own spelling.
const DEST_MATCHERS = DEST_NAMES.map(name => {
  const base = name.replace(/\s+City$/i, '').trim();
  const variants = base && base !== name ? [name, base] : [name];
  return { name, re: new RegExp('\\b(?:' + variants.map(escapeRe).join('|') + ')\\b', 'i') };
}).sort((a, b) => b.name.length - a.name.length);

const STRONG_TERMINAL = /\b(terminal|terminals|bus station|sakayan|sasakay)\b/i;
const SOFT_TERMINAL = /\b(contact|phone|hotline|address|schedule|timetable|departures?|depart|operating hours|what time|first trip|last trip|how often do (?:the )?bus(?:es)?|bus(?:es)? (?:leave|run|depart))\b/i;
// A town name appears in lots of questions ("what time is the festival in
// Dagupan"), so a destination-only match also needs bus/trip wording.
const BUS_CONTEXT = /\b(bus|buses|terminal|terminals|sakayan|sasakay|trip|trips|biyahe|depart|departure|schedule|timetable|coach)\b/i;
const OPERATOR_WORDS = /\b(victory liner|five star|solid north|dagupan bus|partas|cisco|viron|genesis|joybus|philippine rabbit|maria de leon|gv florida|bataan transit|saulog)\b/i;

function destinationIn(text){
  const s = String(text || '');
  const hit = DEST_MATCHERS.find(m => m.re.test(s));
  return hit ? hit.name : '';
}

function isTerminalQuestion(text){
  const t = String(text || '');
  if (!t.trim()) return false;
  if (STRONG_TERMINAL.test(t)) return true;
  const area = AREA_LIST.some(a => a.re.test(t));
  const operator = OPERATOR_WORDS.test(t);
  const dest = destinationIn(t);
  if (!SOFT_TERMINAL.test(t) || !(area || operator || dest)) return false;
  // Destination-only matches must be about buses, not any town question.
  if (!area && !operator && !BUS_CONTEXT.test(t)) return false;
  return true;
}

function nearestHubKm(here){
  if (!here) return Infinity;
  let best = Infinity;
  for (const t of TERMINALS){
    if (t.side !== 'pangasinan') continue;
    best = Math.min(best, haversineKm(here.lng, here.lat, t.lng, t.lat));
  }
  return best;
}

/**
 * Rows that answer this message, nearest first when a fix is available.
 * A traveler already in Pangasinan (< 30 km from a hub) gets their local hub,
 * never a Manila terminal 200 km away.
 */
function matchTerminals(message, proximity, limit = 5){
  const text = String(message || '');
  const here = parseProximity(proximity);
  const areas = AREA_LIST.filter(a => a.re.test(text));

  let rows = TERMINALS;
  if (areas.length){
    rows = rows.filter(r => areas.some(a => r.areaKey === a.key));
  } else if (here && nearestHubKm(here) <= 30){
    rows = rows.filter(r => r.side === 'pangasinan');
  }

  const dest = destinationIn(text);
  if (dest){
    const want = norm(dest);
    const wantBase = norm(dest.replace(/\s+City$/i, ''));
    const serving = rows.filter(r => r.destinations.some(d => {
      const key = norm(d);
      return key.includes(want) || (wantBase.length > 2 && key.includes(wantBase));
    }));
    // Only narrow when the destination actually matches; otherwise keep the
    // area/nearest set instead of returning nothing.
    if (serving.length) rows = serving;
  }

  if (here){
    rows = rows.map(r => ({ ...r, distanceKm: haversineKm(here.lng, here.lat, r.lng, r.lat) }));
    rows.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  return rows.slice(0, limit);
}

function ratingText(r){
  return r.rating && Number.isFinite(Number(r.rating.score))
    ? `${r.rating.score}★ (${r.rating.review_count})`
    : '';
}

function rowLine(r){
  const bits = [r.area];
  if (r.distanceKm != null) bits.push(`~${r.distanceKm.toFixed(1)} km straight-line`);
  if (ratingText(r)) bits.push(ratingText(r));
  const parts = [
    `- ${r.name} | ${bits.join(' | ')}`,
    `  address: ${r.address}`,
  ];
  if (r.phone) parts.push(`  phone: ${r.phone}`);
  if (r.operators.length) parts.push(`  operators: ${r.operators.slice(0, 6).join('; ')}`);
  if (r.destinations.length) parts.push(`  serves: ${r.destinations.slice(0, 6).join(', ')}`);
  if (r.schedule) parts.push(`  schedule: ${r.schedule}`);
  return parts.join('\n');
}

function terminalFacts(message, proximity, hasFix = true){
  // With no fix the client sends its province fallback point, which must never
  // be ranked as "where the traveler is" — drop it before matching.
  const fix = hasFix === false ? '' : proximity;
  const rows = matchTerminals(message, fix);
  if (!rows.length) return null;
  const hasDistance = rows.some(r => r.distanceKm != null);
  const text = [
    hasDistance
      ? 'TERMINAL FACTS (committed terminal directory; distances are straight-line, not travel time):'
      : 'TERMINAL FACTS (committed terminal directory; no location fix, so do not claim any distance):',
    ...rows.map(rowLine),
    'Quote only phone numbers, ratings and distances from these rows. Never claim walking distance, live departure times or a fare.',
  ].join('\n');
  return { rows, text };
}

/** Deterministic answer used when the model is down or its reply is ungrounded. */
function terminalAnswer(facts){
  if (!facts || !facts.rows.length) return 'No terminal in the directory matches that.';
  const hasDistance = facts.rows.some(r => r.distanceKm != null);
  const out = [hasDistance ? 'Closest terminals to you (straight-line):' : 'Terminals in the directory:'];
  for (const r of facts.rows){
    const bits = [r.area];
    if (r.distanceKm != null) bits.push(`≈ ${r.distanceKm.toFixed(1)} km`);
    if (ratingText(r)) bits.push(ratingText(r));
    out.push('', `**${r.name}** — ${bits.join(' · ')}`, r.address);
    if (r.phone) out.push(r.phone);
    if (r.operators.length) out.push(`Operators: ${r.operators.slice(0, 4).join(', ')}`);
    if (r.schedule) out.push(r.schedule);
  }
  out.push(
    '',
    hasDistance
      ? 'Distances are straight-line, not travel time. Confirm schedules and contact numbers with the operator or LTFRB 1342.'
      : 'Confirm schedules and contact numbers with the operator or LTFRB 1342.',
  );
  return out.join('\n');
}

function digits(s){
  let d = String(s).replace(/\D/g, '');
  if (d.startsWith('63')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
}

function extractPhones(text){
  return (String(text).match(/\+?63[\d\s().-]{8,}\d|\(?0\d{1,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/g) || [])
    .filter(p => p.replace(/\D/g, '').length >= 9);
}

function extractMoney(text){
  return (String(text).match(/₱\s?[\d,]+(?:\.\d{2})?/g) || []).map(m => m.replace(/[^\d.]/g, ''));
}

function extractKm(text){
  return [...String(text).matchAll(/(\d+(?:\.\d+)?)\s*km\b/gi)].map(m => Number(m[1]));
}

function boldNames(text){
  return [...String(text).matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1]);
}

/**
 * Keep the model's phrasing only when every concrete figure and bolded name is
 * present in the rows. Anything else is rebuilt from the rows.
 */
function groundTerminalAnswer(answer, facts){
  const text = String(answer || '').trim();
  if (!text) return { answer: terminalAnswer(facts), grounded: false };

  const allowed = facts.text + '\n' + terminalAnswer(facts);
  const allowedDigits = digits(allowed);
  const allowedMoney = new Set(extractMoney(allowed));
  const allowedKm = new Set(extractKm(allowed).map(n => n.toFixed(1)));
  const allowedFigures = figuresIn(allowed);

  const badPhone = extractPhones(text).some(p => !allowedDigits.includes(digits(p)));
  const badMoney = extractMoney(text).some(m => !allowedMoney.has(m));
  const badKm = extractKm(text).some(n => !allowedKm.has(n.toFixed(1)));
  // A rating or any unit-bound figure must come from the rows too: the old
  // checks covered phone, price and km, so an invented "4.9 stars" slipped in.
  const badFigure = unitFigures(text).some(n => !allowedFigures.some(a => Math.abs(a - n) < 0.001));
  const badName = boldNames(text).some(n => {
    const key = norm(n);
    return !facts.rows.some(r => norm(r.name).includes(key) || norm(r.area).includes(key));
  });

  if (badPhone || badMoney || badKm || badFigure || badName){
    return { answer: terminalAnswer(facts), grounded: false };
  }
  return { answer: text, grounded: true };
}

function terminalsVersion(){
  return String(DIRECTORY.dataset_metadata?.last_verified || 'unknown');
}

module.exports = {
  TERMINALS, matchTerminals, terminalFacts, terminalAnswer,
  groundTerminalAnswer, isTerminalQuestion, terminalsVersion,
};