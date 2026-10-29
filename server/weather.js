// Open-Meteo current weather (no API key needed).
// Kept server-side so the client caches one aggregated payload and the
// upstream provider sees a single caller per location.
const LABELS = new Map([
  [0, 'Clear'], [1, 'Mostly clear'], [2, 'Partly cloudy'], [3, 'Cloudy'],
  [45, 'Fog'], [48, 'Fog'],
  [51, 'Drizzle'], [53, 'Drizzle'], [55, 'Drizzle'], [56, 'Drizzle'], [57, 'Drizzle'],
  [61, 'Rain'], [63, 'Rain'], [65, 'Rain'], [66, 'Rain'], [67, 'Rain'],
  [71, 'Snow'], [73, 'Snow'], [75, 'Snow'], [77, 'Snow'],
  [80, 'Showers'], [81, 'Showers'], [82, 'Showers'], [85, 'Snow showers'], [86, 'Snow showers'],
  [95, 'Thunderstorm'], [96, 'Thunderstorm'], [99, 'Thunderstorm']
]);

async function getWeather(lng, lat, deps = {}){
  const doFetch = deps.fetch || fetch;
  const r = await doFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`);
  if (!r.ok) { const e = new Error('Open-Meteo error ' + r.status); e.status = r.status || 502; throw e; }
  const data = await r.json();
  const cur = data.current || {};
  return { tempC: Math.round(Number(cur.temperature_2m)), condition: LABELS.get(Number(cur.weather_code)) || 'Clear' };
}

module.exports = { getWeather };
