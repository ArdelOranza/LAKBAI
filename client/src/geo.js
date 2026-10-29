const DEG = Math.PI / 180;

export function haversineKm(lng1, lat1, lng2, lat2){
  const xs = [lng1, lat1, lng2, lat2];
  if (xs.some(v => typeof v !== 'number' || !Number.isFinite(v))) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * DEG, dLng = (lng2 - lng1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function driveMinutes(km){
  if (typeof km !== 'number' || !Number.isFinite(km)) return null;
  return Math.max(1, Math.round((km / 40) * 60));
}

export function formatDistance(km){
  if (typeof km !== 'number' || !Number.isFinite(km)) return '';
  return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km';
}

// Low-precision NOAA solar position (good to ~±2 min at this latitude).
export function sunsetUTC(lng, lat, date){
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86400000);
  const g = 2 * Math.PI / 365 * (day - 1 + 0.5);
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g); // radians
  const latR = lat * DEG;
  const cosHA = (Math.cos(90.833 * DEG) - Math.sin(latR) * Math.sin(decl)) / (Math.cos(latR) * Math.cos(decl));
  const ha = Math.acos(Math.max(-1, Math.min(1, cosHA))) / DEG; // degrees
  const noon = 720 - 4 * lng; // solar noon, minutes UTC
  return ((noon + 4 * ha) + 1440) % 1440;
}

export function formatClock(utcMinutes, lng = 0){
  const ms = Date.UTC(2000, 0, 1, Math.floor(utcMinutes / 60), Math.round(utcMinutes % 60)) - lng * 4 * 60000;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function timeHint(category, sunsetStr){
  const c = String(category || '');
  if (/beach|coastal|island/i.test(c)) return 'Optimal sunset: ' + sunsetStr;
  if (/food|dining|restaurant|cafe|grill/i.test(c)) return 'Ideal dinner: 6:30 PM';
  return '';
}
