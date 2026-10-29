const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getWeather } = require('../weather.js');

test('maps open-meteo payload (no live fetch)', async () => {
  const out = await getWeather(120, 16, { fetch: async () => ({ ok: true, json: async () => ({ current: { temperature_2m: 29.4, weather_code: 0 } }) }) });
  assert.deepEqual(out, { tempC: 29, condition: 'Clear' });
});

test('throws status 502 on bad response', async () => {
  await assert.rejects(() => getWeather(120, 16, { fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }) }), /Open-Meteo error 500/);
});
