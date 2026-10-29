export function dateRange(text){
  const m = String(text || '').match(/([A-Z][a-z]{2,8})\s+(\d{1,2})(?:\s*[–—-]\s*(?:([A-Z][a-z]{2,8})\s+)?(\d{1,2}))?/);
  if (!m) return null;
  const a = m[1].toUpperCase() + ' ' + m[2];
  return m[4] ? a + ' – ' + (m[3] || m[1]).toUpperCase() + ' ' + m[4] : a;
}
