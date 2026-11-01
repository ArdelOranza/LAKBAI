/** Phone and map links for the emergency screen. Pure string work so it can be tested. */

/** Normalise a Philippine number into a tel: URI (+63 for local landlines/mobiles). */
export function telHref(number){
  const raw = String(number ?? '').trim();
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return 'tel:' + digits;
  if (digits.length <= 3) return 'tel:' + digits;      // 911, 143
  if (digits.startsWith('0')) return 'tel:+63' + digits.slice(1);
  return 'tel:' + digits;
}

/** Google Maps directions to a point, or null when we have no coordinates. */
export function directionsHref(lat, lng){
  if (lat == null || lng == null) return null;
  return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
}

/** Human "1.2 km away" / "400 m away". */
export function awayLabel(km){
  if (typeof km !== 'number' || !Number.isFinite(km)) return '';
  return km < 1 ? Math.round(km * 1000) + ' m away' : km.toFixed(1) + ' km away';
}