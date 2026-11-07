const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getWeather } = require('../weather.js');

const MET_BODY = {
  properties: {
    timeseries: [{
      data: {
        instant: { details: { air_temperature: 30.6 } },
        next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } },
      },
    }],
  },
};

const OPEN_BODY = { current: { temperature_2m: 29.4, weather_code: 0 } };

test('maps met.no payload and identifies the app to the provider', async () => {
  const fetchImpl = async (url, init) => {
    assert.match(String(url), /api\.met\.no/);
    assert.match(String(init.headers['User-Agent']), /LakbAI/);
    return { ok: true, json: async () => MET_BODY };
  };
  assert.deepEqual(
    await getWeather(120, 16, { fetch: fetchImpl }),
    { tempC: 31, condition: 'Partly cloudy' },
  );
});

test('falls back to open-meteo when met.no is unavailable', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes('api.met.no')) return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, json: async () => OPEN_BODY };
  };
  assert.deepEqual(
    await getWeather(120, 16, { fetch: fetchImpl }),
    { tempC: 29, condition: 'Clear' },
  );
  assert.ok(calls.some(u => u.includes('api.met.no')));
  assert.ok(calls.some(u => u.includes('open-meteo')));
});

test('falls back when met.no returns no temperature', async () => {
  const fetchImpl = async (url) => (
    String(url).includes('api.met.no')
      ? { ok: true, json: async () => ({ properties: { timeseries: [] } }) }
      : { ok: true, json: async () => OPEN_BODY }
  );
  assert.deepEqual(
    await getWeather(120, 16, { fetch: fetchImpl }),
    { tempC: 29, condition: 'Clear' },
  );
});

test('throws status 502 only when both providers fail', async () => {
  await assert.rejects(
    () => getWeather(120, 16, { fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }) }),
    (e) => e.status === 502,
  );
});
