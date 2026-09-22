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
app.post('/api/recommend', async (req, res) => {
  try {
    res.json(await recommend(req.body.message || '', req.body.proximity));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { chatRecommend } = require('./agent.js');
app.post('/api/chat', async (req, res) => {
  try {
    res.json(await chatRecommend(req.body.message || ''));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { planDay } = require('./plan.js');
app.post('/api/plan', async (req, res) => {
  try {
    const { message = '', hours = 4, startHour = 9 } = req.body || {};
    res.json(await planDay(message, Number(hours) || 4, Number(startHour) || 9));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const { searchPlaces } = require('./places.js');
app.get('/api/places', async (req, res) => {
  try {
    const places = await searchPlaces(req.query.q || '', req.query.proximity);
    res.json({ places });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const PORT = process.env.PORT || 3001;
if (require.main === module) app.listen(PORT, () => console.log('Lakbai server on ' + PORT));
module.exports = app;
