const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const two = n => String(n).padStart(2, '0');

export function dateRange(text){
  const m = String(text || '').match(/([A-Z][a-z]{2,8})\s+(\d{1,2})(?:\s*[–—-]\s*(?:([A-Z][a-z]{2,8})\s+)?(\d{1,2}))?/);
  if (!m) return null;
  const a = m[1].toUpperCase() + ' ' + m[2];
  return m[4] ? a + ' – ' + (m[3] || m[1]).toUpperCase() + ' ' + m[4] : a;
}

/** "DEC 01 – DEC 09" from structured month/day fields; null when unknown. */
export function shortDate(month, day, endMonth, endDay){
  if (!month || !day || !MONTHS[month - 1]) return null;
  const start = MONTHS[month - 1] + ' ' + two(day);
  if (!endDay) return start;
  const end = MONTHS[(endMonth || month) - 1] + ' ' + two(endDay);
  return end === start ? start : start + ' – ' + end;
}

/** Banner-friendly date for a festival object (month/day), not its prose label. */
export function bannerDate(festival){
  if (!festival) return null;
  return shortDate(festival.month, festival.day, festival.endMonth, festival.endDay);
}