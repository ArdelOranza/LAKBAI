require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/ready', (req, res) => {
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const mapbox = Boolean(process.env.VITE_MAPBOX_TOKEN);
  if (!gemini || !mapbox) return res.status(503).json({ gemini, mapbox, error: 'Missing API key(s). Set GEMINI_API_KEY and VITE_MAPBOX_TOKEN in root .env.' });
  res.json({ gemini, mapbox });
});
const HOTLINES = [
  { name: 'Pangasinan PDRRMO', number: '(075) 542-6802' },
  { name: 'National Emergency', number: '911' }
];
app.get('/api/emergency', async (req, res) => {
  try {
    const proximity = req.query.proximity;
    const [hospitals, police] = await Promise.all([
      searchPlaces('hospital', proximity),
      searchPlaces('police station', proximity)
    ]);
    res.json({ hospitals: hospitals.slice(0, 5), police: police.slice(0, 5), hotlines: HOTLINES });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { recommend } = require('./verify.js');
const { cached } = require('./aiCache.js');
const { datasetInfo, localChat, localRecommend } = require('./dataset.js');
const { groundedChat, groundedRecommend } = require('./grounded.js');
const AI_TTL_MS = Number(process.env.AI_TTL_MS) || 15 * 60000;
// LAKBAI_AI=off → answer straight from the dataset with no model call at all.
const USE_AI = String(process.env.LAKBAI_AI || '').toLowerCase() !== 'off';
// When the model quota is out, stop retrying on every message: serve dataset
// answers for a few minutes instead of paying the backoff on each request.
let aiDownUntil = 0;
const AI_COOLDOWN_MS = 5 * 60000;
const aiUsable = () => USE_AI && Date.now() > aiDownUntil;
app.post('/api/recommend', async (req, res) => {
  try {
    const message = req.body.message || '';
    const prefs = Array.isArray(req.body.preferences) ? req.body.preferences
      : Array.isArray(req.body.prefs) ? req.body.prefs : [];
    const proximity = String(req.body.proximity || '');
    const p = proximity.split(',').map(Number);
    const proxKey = p.length === 2 && p.every(Number.isFinite) ? p[0].toFixed(2) + ',' + p[1].toFixed(2) : '';
    const key = `r:${message}|${proxKey}|${prefs.slice().sort().join(',')}`;
    // Installed dataset wins: the AI may only reference those verified rows. If
    // it is unavailable, answer straight from the dataset — and do not cache
    // that fallback, so a transient model hiccup is not served for 15 minutes.
    if (datasetInfo().ready) {
      if (aiUsable()) {
        try { return res.json(await cached(key, AI_TTL_MS, () => groundedRecommend(message, proximity, prefs))); }
        catch (e) { aiDownUntil = Date.now() + AI_COOLDOWN_MS; console.warn('grounded recommend failed:', e.message); }
      }
      return res.json(await localRecommend(message, proximity, prefs));
    }
    res.json(await cached(key, AI_TTL_MS, () => recommend(message, proximity, prefs)));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { chatRecommend } = require('./agent.js');
app.post('/api/chat', async (req, res) => {
  try {
    const message = req.body.message || '';
    const proximity = String(req.body.proximity || '');
    if (datasetInfo().ready) {
      if (aiUsable()) {
        try { return res.json(await cached(`d:${message}|${proximity}`, AI_TTL_MS, () => groundedChat(message, proximity))); }
        catch (e) { aiDownUntil = Date.now() + AI_COOLDOWN_MS; console.warn('grounded chat failed:', e.message); }
      }
      return res.json(await localChat(message, proximity));
    }
    res.json(await cached(`c:${message}`, AI_TTL_MS, () => chatRecommend(message)));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { planDay } = require('./plan.js');
app.post('/api/plan', async (req, res) => {
  try {
    const { message = '', hours = 4, startHour = 9 } = req.body || {};
    const h = Number(hours) || 4, s = Number(startHour) || 9;
    const key = `p:${message}|${h}|${s}`;
    res.json(await cached(key, AI_TTL_MS, () => planDay(message, h, s)));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { searchPlaces } = require('./places.js');
const { SPOTS } = require('./spots.js');
app.get('/api/spots', async (req, res) => {
  try {
    res.json(await cached('spots:all', 24 * 60 * 60 * 1000, async () => ({ spots: SPOTS })));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.get('/api/places', async (req, res) => {
  try {
    const places = await searchPlaces(req.query.q || '', req.query.proximity);
    res.json({ places });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { getWeather } = require('./weather.js');
app.get('/api/weather', async (req, res) => {
  try {
    const lng = Number(req.query.lng), lat = Number(req.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return res.status(400).json({ error: 'lng and lat are required numbers.' });
    res.json(await cached(`wx:${lat.toFixed(3)},${lng.toFixed(3)}`, 10 * 60000, () => getWeather(lng, lat)));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const PORT = process.env.PORT || 3001;
if (require.main === module) app.listen(PORT, () => console.log('Lakbai server on ' + PORT));
module.exports = app;
