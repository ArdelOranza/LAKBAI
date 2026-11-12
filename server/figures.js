// Figures the model must not invent.
//
// A bare small integer ("2 beaches", "3 options") is usually a list marker or a
// count, so the grounding guards leave it alone. A number bound to a unit or a
// rating is a concrete claim at any size — "5 minute walk", "2 hours",
// "rated 4.9" — and these are the numbers compared against the fact block.
const UNITS = [
  'kilometers?', 'kms?', 'meters?', 'minutes?', 'mins?', 'hours?', 'hrs?',
  'days?', 'weeks?', 'months?', 'years?', 'percent', 'php', 'pesos?',
  'km', 'm', '%', '₱', '★', 'stars?',
].join('|');
const UNIT_NUMBER = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${UNITS})`, 'gi');
// "rated 4.9", "rating: 4.9", "★ 4.9" — a rating context also names a figure.
const RATED = /(?:rated|rating|score|stars?|★)\s*[:;]?\s*(\d(?:\.\d+)?)/gi;
const NUM = /\d[\d,]*(?:\.\d+)?/g;

const toNum = s => Number(String(s).replace(/,/g, ''));

/** Every number in the text. */
function figuresIn(text){
  return [...String(text || '').matchAll(NUM)].map(m => toNum(m[0])).filter(Number.isFinite);
}

/** Numbers a reader would read as a claim: unit-bound or rating-bound. */
function unitFigures(text){
  const s = String(text || '');
  const out = [];
  for (const m of s.matchAll(UNIT_NUMBER)){ const n = toNum(m[1]); if (Number.isFinite(n)) out.push(n); }
  for (const m of s.matchAll(RATED)){ const n = toNum(m[1]); if (Number.isFinite(n)) out.push(n); }
  return out;
}

module.exports = { figuresIn, unitFigures };
