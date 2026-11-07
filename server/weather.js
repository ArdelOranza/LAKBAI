// Weather with two no-key providers:
//   1. Met Norway — primary. Open-Meteo rate-limits the shared Render egress
//      IP (429), so it can't be the only source.
//   2. Open-Meteo — fallback for when Met Norway is unreachable.
// Kept server-side so the client caches one aggregated payload and upstream
// providers see a single caller per location.
const MET_USER_AGENT = 'LakbAI/1.0 (https://lakbai-app.onrender.com)';

const WMO_LABELS = new Map([
  [0, 'Clear'], [1, 'Mostly clear'], [2, 'Partly cloudy'], [3, 'Cloudy'],
  [45, 'Fog'], [48, 'Fog'],
  [51, 'Drizzle'], [53, 'Drizzle'], [55, 'Drizzle'], [56, 'Drizzle'], [57, 'Drizzle'],
  [61, 'Rain'], [63, 'Rain'], [65, 'Rain'], [66, 'Rain'], [67, 'Rain'],
  [71, 'Snow'], [73, 'Snow'], [75, 'Snow'], [77, 'Snow'],
  [80, 'Showers'], [81, 'Showers'], [82, 'Showers'], [85, 'Snow showers'], [86, 'Snow showers'],
  [95, 'Thunderstorm'], [96, 'Thunderstorm'], [99, 'Thunderstorm']
]);

/** Met Norway symbol_code → the short label the itinerary card renders. */
function metCondition(code){
  const c = String(code || '');
  if (c.includes('thunder')) return 'Thunderstorm';
  if (c.includes('snowshowers')) return 'Snow showers';
  if (c.includes('snow')) return 'Snow';
  if (c.includes('sleet')) return 'Sleet';
  if (c.includes('showers')) return 'Showers';
  if (c === 'lightrain' || c.includes('drizzle')) return 'Drizzle';
  if (c.includes('rain')) return 'Rain';
  if (c.includes('fog')) return 'Fog';
  if (c.startsWith('cloudy')) return 'Cloudy';
  if (c.startsWith('partlycloudy')) return 'Partly cloudy';
  if (c.startsWith('fair')) return 'Mostly clear';
  return 'Clear';
}

async function fromMetNo(lng, lat, doFetch){
  const r = await doFetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`,
    { headers: { 'User-Agent': MET_USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) },
  );
  if (!r.ok) { const e = new Error('Met.no error ' + r.status); e.status = r.status || 502; throw e; }
  const data = await r.json();
  const first = data?.properties?.timeseries?.[0];
  const temp = Number(first?.data?.instant?.details?.air_temperature);
  // A payload with no reading is an upstream failure, not "0°C".
  if (!Number.isFinite(temp)) { const e = new Error('Met.no returned no temperature'); e.status = 502; throw e; }
  const symbol = first?.data?.next_1_hours?.summary?.symbol_code
    || first?.data?.next_6_hours?.summary?.symbol_code || '';
  return { tempC: Math.round(temp), condition: metCondition(symbol) };
}

async function fromOpenMeteo(lng, lat, doFetch){
  const r = await doFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) { const e = new Error('Open-Meteo error ' + r.status); e.status = r.status || 502; throw e; }
  const data = await r.json();
  const cur = data.current || {};
  const temp = Number(cur.temperature_2m);
  if (!Number.isFinite(temp)) { const e = new Error('Open-Meteo returned no temperature'); e.status = 502; throw e; }
  return { tempC: Math.round(temp), condition: WMO_LABELS.get(Number(cur.weather_code)) || 'Clear' };
}

async function getWeather(lng, lat, deps = {}){
  const doFetch = deps.fetch || fetch;
  try {
    return await fromMetNo(lng, lat, doFetch);
  } catch { /* fall through to Open-Meteo */ }
  try {
    return await fromOpenMeteo(lng, lat, doFetch);
  } catch (e) {
    const err = new Error('Weather unavailable: ' + (e.message || 'upstream failure'));
    err.status = 502;
    throw err;
  }
}

module.exports = { getWeather, metCondition };
