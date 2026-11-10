/**
 * The chat answer and the result cards describe the same places. When the
 * answer is a structured dump ("Closest to you:" + one bold place per bullet)
 * the cards already carry every line, so the prose is redundant and turns the
 * thread into a wall of text. Keep the lead-in; the list tells the rest.
 */

const BULLET = /^\s*[-*•]\s+/;
const PLACE_BULLET = /^\s*[-*•]\s+\*\*[^*]+\*\*/;

export function answerLead(text, hasCards = false){
  const whole = String(text || '').trim();
  if (!whole || !hasCards) return { lead: whole, kind: 'prose' };

  const lines = whole.split(/\r?\n/);
  const bullets = lines.filter(l => BULLET.test(l));
  const structured = bullets.length > 0 && bullets.every(l => PLACE_BULLET.test(l));
  if (!structured) return { lead: whole, kind: 'prose' };

  const lead = lines.filter(l => !BULLET.test(l)).join('\n').trim();
  const kind = lead.length <= 60 ? 'label' : 'prose';
  return { lead, kind };
}
