require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ ok: true }));
const MESSAGE_MAX = 500;
function boundedMessage(req){
  const m = String((req.body && req.body.message) || '');
  return m.length > MESSAGE_MAX ? null : m;
}
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
    // Partial results are fine: static hotlines always ship, and whichever
    // lookup succeeded is still useful. One flaky upstream must not drop them.
    const [hospitals, police] = await Promise.all([
      searchPlaces('hospital', proximity).catch(() => []),
      searchPlaces('police station', proximity).catch(() => []),
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
    const message = boundedMessage(req);
    if (message === null) return res.status(400).json({ error: 'Message too long.' });
    const prefs = Array.isArray(req.body.preferences) ? req.body.preferences
      : Array.isArray(req.body.prefs) ? req.body.prefs : [];
    const proximity = String(req.body.proximity || '');
    const p = proximity.split(',').map(Number);
    const proxKey = p.length === 2 && p.every(Number.isFinite) ? p[0].toFixed(2) + ',' + p[1].toFixed(2) : '';
    const info = datasetInfo();
    // The key carries the dataset signature so editing a data file (or switching
    // dataset<->AI modes) can't serve a stale answer from the previous world.
    const sig = info.ready ? `${info.file}|${info.count}` : 'nodataset';
    const key = `r:${sig}:${message}|${proxKey}|${prefs.slice().sort().join(',')}`;
    const tripBreaker = () => { aiDownUntil = Date.now() + AI_COOLDOWN_MS; };
    // Installed dataset wins: the AI may only reference those verified rows. If
    // it is unavailable, answer straight from the dataset — and do not cache
    // that fallback, so a transient model hiccup is not served for 15 minutes.
    if (info.ready) {
      if (aiUsable()) {
        try { return res.json(await cached(key, AI_TTL_MS, () => groundedRecommend(message, proximity, prefs), { onStale: tripBreaker })); }
        catch (e) { tripBreaker(); console.warn('grounded recommend failed:', e.message); }
      }
      return res.json(await localRecommend(message, proximity, prefs));
    }
    if (!aiUsable()) return res.status(503).json({ error: 'AI unavailable' });
    res.json(await cached(key, AI_TTL_MS, () => recommend(message, proximity, prefs), { onStale: tripBreaker }));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { chatRecommend } = require('./agent.js');
app.post('/api/chat', async (req, res) => {
  try {
    const message = boundedMessage(req);
    if (message === null) return res.status(400).json({ error: 'Message too long.' });
    const proximity = String(req.body.proximity || '');
    const p = proximity.split(',').map(Number);
    const proxKey = p.length === 2 && p.every(Number.isFinite) ? p[0].toFixed(2) + ',' + p[1].toFixed(2) : '';
    const info = datasetInfo();
    const sig = info.ready ? `${info.file}|${info.count}` : 'nodataset';
    const key = `d:${sig}:${message}|${proxKey}`;
    const tripBreaker = () => { aiDownUntil = Date.now() + AI_COOLDOWN_MS; };
    if (info.ready) {
      if (aiUsable()) {
        try { return res.json(await cached(key, AI_TTL_MS, () => groundedChat(message, proximity), { onStale: tripBreaker })); }
        catch (e) { tripBreaker(); console.warn('grounded chat failed:', e.message); }
      }
      return res.json(await localChat(message, proximity));
    }
    if (!aiUsable()) return res.status(503).json({ error: 'AI unavailable' });
    res.json(await cached(key, AI_TTL_MS, () => chatRecommend(message), { onStale: tripBreaker }));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { planDay } = require('./plan.js');
app.post('/api/plan', async (req, res) => {
  try {
    const { message = '', hours = 4, startHour = 9 } = req.body || {};
    if (String(message).length > MESSAGE_MAX) return res.status(400).json({ error: 'Message too long.' });
    const h = Number(hours) || 4, s = Number(startHour) || 9;
    const info = datasetInfo();
    const sig = info.ready ? `${info.file}|${info.count}` : 'nodataset';
    const key = `p:${sig}:${message}|${h}|${s}`;
    // The plan path has no local fallback, so the breaker/off-switch must
    // apply here too — honest 503 beats burning quota during an outage.
    if (!aiUsable()) return res.status(503).json({ error: 'AI unavailable' });
    const tripBreaker = () => { aiDownUntil = Date.now() + AI_COOLDOWN_MS; };
    res.json(await cached(key, AI_TTL_MS, () => planDay(message, h, s), { onStale: tripBreaker }));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { searchPlaces } = require('./places.js');
const { SPOTS } = require('./spots.js');
const adminStore = require('./adminSpots.js');
const { findPhoto } = require('./photos.js');

// --- real-photo hierarchy: 1 JSON → 2 Wikimedia → 3 Mapbox (client fallback)
// JSON = curated dataset / admin-verified URL (wins). Wikimedia = real photo
// found via commons search (secondary). Mapbox = static map (client-only last resort).
const photoCache = new Map(); // key -> { value, at }
const PHOTO_TTL = 60 * 60 * 1000;
function hintFromAddress(address){
  const parts = String(address || '').split(',').map(s => s.trim()).filter(Boolean);
  return parts.length > 2 ? parts[parts.length - 2] : (parts[0] || '');
}
function isJsonPhoto(url){ return url && !/wikimedia\.org|upload\.wikimedia/i.test(String(url)); }
async function enrichWithPhoto(place){
  // Hierarchy 1: JSON wins — never overwrite a curated/admin photo with Wikimedia.
  const existingPhotos = Array.isArray(place.photos) ? place.photos.filter(Boolean) : [];
  const existingBare = place.photo || (existingPhotos[0] || null);
  if (existingBare && isJsonPhoto(existingBare)){
    return { ...place, photo: existingBare, photos: existingPhotos.length ? existingPhotos : [existingBare], photoSource: 'json' };
  }
  // Hierarchy 2: Wikimedia real photo
  const key = String(place.name || '').toLowerCase() + '|' + hintFromAddress(place.address);
  const hit = photoCache.get(key);
  if (hit && Date.now() - hit.at < PHOTO_TTL){
    return hit.value
      ? { ...place, photo: hit.value.src, photos: [hit.value.src], photoSource: 'wikimedia' }
      : { ...place, photo: null, photos: [], photoSource: 'mapbox' };
  }
  try {
    const found = await findPhoto(place.name || '', hintFromAddress(place.address), place.lng, place.lat);
    photoCache.set(key, { value: found, at: Date.now() });
    return found
      ? { ...place, photo: found.src, photos: [found.src], photoSource: 'wikimedia' }
      : { ...place, photo: null, photos: [], photoSource: 'mapbox' };
  } catch { return { ...place, photo: null, photos: [], photoSource: 'mapbox' }; }
}
async function enrichPlaces(places){
  if (!places || !places.length) return places;
  // cap concurrency: all at once is 8, which is fine for this endpoint
  return Promise.all(places.map(enrichWithPhoto));
}
app.get('/api/spots', async (req, res) => {
  try {
    // Cheap: listSpots() re-reads the file each time so admin edits show up immediately.
    res.json({ spots: adminStore.listSpots() });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.get('/api/places', async (req, res) => {
  try {
    const places = await searchPlaces(req.query.q || '', req.query.proximity);
    // photos=0 skips the (slower) Wikimedia enrichment for emergency lookups
    const withPhotos = req.query.photos === '0' ? places : await enrichPlaces(places);
    res.json({ places: withPhotos });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// --- separate admin API (see admin/ app). Token-guarded, token lives in ADMIN_TOKEN.
app.get('/api/admin/spots', adminStore.requireAdmin, (req, res) => {
  try { res.json({ spots: adminStore.listSpots() }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.post('/api/admin/spots', adminStore.requireAdmin, (req, res) => {
  try { res.status(201).json({ spot: adminStore.createSpot(req.body || {}) }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.put('/api/admin/spots/:id', adminStore.requireAdmin, (req, res) => {
  try { res.json({ spot: adminStore.updateSpot(req.params.id, req.body || {}) }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.delete('/api/admin/spots/:id', adminStore.requireAdmin, (req, res) => {
  try { res.json(adminStore.deleteSpot(req.params.id)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.post('/api/admin/photos/find', adminStore.requireAdmin, async (req, res) => {
  try {
    const { name = '', town = '', lng, lat } = req.body || {};
    if (!String(name).trim()) return res.status(400).json({ error: 'name is required' });
    const found = await findPhoto(String(name), String(town), lng, lat);
    if (!found) return res.status(404).json({ error: 'No real photo found for this place yet — add a photo URL manually.' });
    res.json({ photo: found });
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
