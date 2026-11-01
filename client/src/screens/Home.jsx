import { useEffect, useState } from 'react';
import {
  MapPin, Search, Mic, Umbrella, UtensilsCrossed, Soup, CalendarDays,
  Sparkles, ArrowRight, Plus, Star,
} from 'lucide-react';
import { recommend } from '../api.js';
import { FALLBACK_CENTER } from '../App.jsx';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { haversineKm, formatDistance } from '../geo.js';
import { saveFavorite } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { dateRange } from '../festival.js';
import { upcomingFestivals, FESTIVALS } from '../festivals.js';
import { feeLabel } from '../filters.js';
import { PhotoPlaceholder } from '../ui.jsx';
import PangasinanMap from '../PangasinanMap.jsx';

const QUICK = [
  ['Beaches', Umbrella, { name:'browse', kind:'beaches' }],
  ['Restaurants', UtensilsCrossed, { name:'browse', kind:'dining' }],
  ['Local Food', Soup, { name:'browse', kind:'dining' }],
  ['Events', CalendarDays, { name:'events' }],
];

export default function Home({ coords, push, showToast, setTab }){
  const { user } = useAuth();
  const [place, setPlace] = useState('Pangasinan');
  const [query, setQuery] = useState('');
  const [recs, setRecs] = useState(sessionGet('lakbai.rec.home') || []);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState(null);
  // Fallback banner: the next festival from the curated dataset, so the card is
  // never empty when no recommendation happens to carry a festival string.
  const [upcoming] = useState(() => upcomingFestivals(FESTIVALS, new Date())[0] || null);
  const [listening, setListening] = useState(false);

  useEffect(() => { // reverse geocode the location line; silent failure keeps the fallback
    let alive = true;
    const fallback = coords === FALLBACK_CENTER ? 'Bolinao, Pangasinan' : 'Pangasinan';
    setPlace(fallback);
    (async () => {
      try {
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!token) return;
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?types=place&limit=1&access_token=${token}`);
        if (!r.ok) return;
        const data = await r.json();
        const name = data.features && data.features[0] && data.features[0].text;
        if (alive && name) setPlace(name + ', Pangasinan');
      } catch { /* keep fallback label */ }
    })();
    return () => { alive = false; };
  }, [coords]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cached = sessionGet('lakbai.rec.home');
    if (cached && cached.length) { setRecs(cached); setEvent(cached.find(p => p.festival && dateRange(p.festival)) || null); return; }
    setBusy(true);
    recommend('top attractions, events and hidden gems', `${coords.lng},${coords.lat}`, readLocalPrefs())
      .then(out => {
        const ps = out.places || [];
        setRecs(ps);
        sessionSet('lakbai.rec.home', ps);
        setEvent(ps.find(p => p.festival && dateRange(p.festival)) || null);
      })
      .catch(e => showToast('Could not load recommendations', 'error', e.message))
      .finally(() => setBusy(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function search(text){
    const q = String(text || '').trim();
    if (!q) return;
    push({ name:'search', query:q });
  }
  function mic(){
    const S = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!S) { showToast('Voice search not supported here', 'error'); return; }
    const r = new S();
    r.lang = 'en-PH';
    r.onresult = e => { setListening(false); setQuery(e.results[0][0].transcript); search(e.results[0][0].transcript); };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    setListening(true);
    r.start();
  }
  async function fav(p){
    const res = await saveFavorite(user, p);
    showToast(res.error ? 'Sign in to save' : 'Added to Saved', res.error ? 'error' : 'ok');
  }
  // AI recommendation wins; the curated next festival is the fallback.
  const feature = event || (upcoming ? { ...upcoming, categories:['Festival','Cultural'] } : null);
  const featureKicker = event ? dateRange(event.festival) : (upcoming && upcoming.dateLabel) || '';
  const featureMeta = event ? (event.hint || event.address) : (upcoming && upcoming.town) || '';
  const featurePhoto = event
    ? event.photo
    : ((upcoming && upcoming.photos) || []).find(u => !/seal\.png|Banner_Capitol/i.test(u)) || null;
  return (
    <main className="screen" style={{ flex:1, overflowY:'auto' }}>
      <header className="pane" style={{ paddingTop:18 }}>
        <div className="home-head">
          <PangasinanMap coords={coords}/>
          <div className="home-head-text">
            <h1>Explore Pangasinan</h1>
            <p className="home-place"><MapPin size={13}/> <span>{place}</span></p>
          </div>
          <button className="chip home-emg" data-testid="emergency-pill" onClick={() => push({ name:'emergency' })}>Emergency</button>
        </div>
        <div style={{ display:'flex', gap:8, background:'#fff', border:'1px solid #EDF1F7', borderRadius:999, padding:'6px 6px 6px 16px', alignItems:'center', boxShadow:'0 1px 2px rgba(15,23,42,.04)' }}>
          <Search size={17} color="#94A3B8"/>
          <input data-testid="home-search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(query); }} placeholder="Search places, food, events…" style={{ border:'none', padding:'8px 0', background:'none' }}/>
          <button data-testid="mic-btn" onClick={mic} aria-label="Voice search" style={{ width:36, height:36, flex:'0 0 36px', borderRadius:'50%', background:'#EFF6FF', border:'none', color:'var(--primary)', display:'grid', placeItems:'center', padding:0, opacity: listening ? .5 : 1 }}>
            <Mic size={16}/>
          </button>
        </div>
      </header>

      <div className="pane" style={{ display:'flex', justifyContent:'space-between', margin:'16px 0 4px' }}>
        {QUICK.map(([label, Icon, target]) => (
          <button key={label} data-testid={'quick-' + label.split(' ')[0].toLowerCase()} onClick={() => push(target)} style={{ background:'none', border:'none', display:'grid', justifyItems:'center', fontSize:11, padding:0, fontWeight:600 }}>
            <span style={{ width:56, height:56, borderRadius:'50%', background:'#fff', border:'1px solid #EDF1F7', boxShadow:'0 6px 14px -10px rgba(15,23,42,.45)', display:'grid', placeItems:'center', color:'var(--primary)' }}><Icon size={22}/></span>
            <span style={{ marginTop:7, color:'var(--ink)' }}>{label}</span>
          </button>
        ))}
      </div>

      <div className="pane">
        {busy && !recs.length && <p className="shimmer" style={{ fontSize:14 }}>Finding hidden gems for you…</p>}

        {feature && (
          <article data-testid="event-banner" style={{ position:'relative', borderRadius:20, overflow:'hidden', boxShadow:'0 10px 26px -18px rgba(15,23,42,.5)', cursor:'pointer', marginTop:12 }} onClick={() => push({ name:'detail', place:feature })}>
            {featurePhoto
              ? <img src={featurePhoto} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:190, objectFit:'cover' }}/>
              : <div style={{ height:190 }}><PhotoPlaceholder size={30}/></div>}
            <div style={{ position:'absolute', inset:'auto 0 0 0', background:'linear-gradient(transparent, rgba(10,37,64,.88))', color:'#fff', padding:16 }}>
              <span style={{ fontSize:10.5, letterSpacing:1.1, opacity:.9, fontWeight:700 }}>{featureKicker}</span>
              <h3 style={{ margin:'3px 0', fontSize:18 }}>{feature.name}</h3>
              <p style={{ fontSize:12, opacity:.9, display:'flex', alignItems:'center', gap:4, margin:0 }}>
                <MapPin size={12}/> {featureMeta}
                {event && event.fees != null && ' • ' + (/free/i.test(String(event.fees)) ? 'Free Admission' : feeLabel(event.fees))}
              </p>
            </div>
            <span style={{ position:'absolute', right:14, top:'50%', width:34, height:34, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}><ArrowRight size={17}/></span>
          </article>
        )}

        <div data-testid="plan-cta" onClick={() => setTab('chat')} className="soft-card" style={{ margin:'16px 0', cursor:'pointer', borderRadius:18, padding:14 }}>
          <span style={{ width:40, height:40, minWidth:40, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}><Sparkles size={19}/></span>
          <span style={{ flex:1 }}>
            <b style={{ fontSize:14 }}>Need a personalized plan?</b>
            <p style={{ margin:0, fontSize:12.5, color:'var(--muted-ink)' }}>Let LakbAI orchestrate your day in {place.split(',')[0]}</p>
          </span>
          <span style={{ width:34, height:34, minWidth:34, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}><ArrowRight size={17}/></span>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <h2 style={{ fontSize:18 }}>Recommended for You</h2>
          <button onClick={() => search('best places to visit')} style={{ background:'none', border:'none', padding:0, fontSize:12.5, color:'var(--primary)', fontWeight:600, display:'inline-flex', alignItems:'center', gap:3 }}>See All <ArrowRight size={13}/></button>
        </div>

        <div data-testid="recs" style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, scrollbarWidth:'none' }}>
          {recs.map(p => (
            <article key={p.id} style={{ flex:'0 0 220px', borderRadius:18, background:'#fff', border:'1px solid #EDF1F7', overflow:'hidden', cursor:'pointer', boxShadow:'0 10px 24px -20px rgba(15,23,42,.55)' }} onClick={() => push({ name:'detail', place:p })}>
              <div style={{ position:'relative', height:130 }}>
                {p.photo
                  ? <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <PhotoPlaceholder size={26}/>}
                <span className="chip" style={{ position:'absolute', left:8, top:8, fontSize:10.5, padding:'3px 9px' }}>{(p.categories && p.categories[0]) || 'Pangasinan'}</span>
                <button className="chip" data-testid={'fav-' + p.id} aria-label={'Save ' + p.name} onClick={e => { e.stopPropagation(); fav(p); }} style={{ position:'absolute', right:8, top:8, width:30, height:30, padding:0, borderRadius:'50%', background:'var(--primary)', color:'#fff', border:'none', display:'grid', placeItems:'center' }}><Plus size={15}/></button>
                {haversineKm(coords.lng, coords.lat, p.lng, p.lat) != null && (
                  <span style={{ position:'absolute', left:8, bottom:8, fontSize:10.5, color:'#fff', background:'rgba(15,23,42,.55)', borderRadius:999, padding:'2px 8px', display:'inline-flex', alignItems:'center', gap:3 }}>
                    <MapPin size={11}/> {formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat))}
                  </span>
                )}
              </div>
              <div style={{ padding:'10px 12px 12px' }}>
                <b style={{ fontSize:14, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</b>
                {p.rating && (
                  <p style={{ fontSize:11.5, margin:'5px 0 0', display:'inline-flex', alignItems:'center', gap:4, color:'var(--ink)', fontWeight:600 }}>
                    <Star size={12} fill="var(--accent)" color="var(--accent)"/> {p.rating}{p.reviews ? <span style={{ fontWeight:400, color:'var(--muted-ink)' }}>({p.reviews})</span> : null}
                  </p>
                )}
              </div>
            </article>
          ))}
          {!recs.length && !busy && <p style={{ color:'var(--muted-ink)', fontSize:14 }}>Recommendations will appear here once you search or ask LakbAI.</p>}
        </div>
      </div>
    </main>
  );
}
