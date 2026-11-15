/**
 * The chat answer and the result cards describe the same places. When the
 * answer is a structured dump ("Closest to you:" + one bold place per bullet)
 * the cards already carry every line, so the prose is redundant and turns the
 * thread into a wall of text. Keep the lead-in; the list tells the rest.
 *
 * A day plan uses the same bullet shape with a time-of-day label
 * ("*   **Morning:** ..."). That is content, not a dump, so a bullet is only
 * dropped when its bold label actually names one of the cards.
 */

const BULLET = /^\s*[-*•]\s+/;
const BOLD_LABEL = /^\s*[-*•]\s+\*\*([^*]+)\*\*/;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

function isPlaceBullet(line, names){
  const m = BOLD_LABEL.exec(line);
  if (!m) return false;
  // Legacy callers pass no names: every bold bullet used to count as a place.
  if (!names.length) return true;
  const label = norm(m[1]);
  if (!label) return false;
  return names.some(n => label === n || label.includes(n));
}

export function answerLead(text, hasCards = false, placeNames = []){
  const whole = String(text || '').trim();
  if (!whole || !hasCards) return { lead: whole, kind: 'prose' };

  const names = (placeNames || []).map(norm).filter(Boolean);
  const lines = whole.split(/\r?\n/);
  const bullets = lines.filter(l => BULLET.test(l));
  if (!bullets.length || !bullets.every(l => isPlaceBullet(l, names))) return { lead: whole, kind: 'prose' };

  const lead = lines.filter(l => !isPlaceBullet(l, names)).join('\n').trim();
  const kind = lead.length <= 60 ? 'label' : 'prose';
  return { lead, kind };
}