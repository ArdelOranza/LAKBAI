import { useEffect, useRef, useState } from 'react';
import {
  MapPin, Search, Mic, Umbrella, UtensilsCrossed, Soup, CalendarDays,
  Compass, ArrowRight, Plus, Star,
} from 'lucide-react';
import { recommend } from '../api.js';
import { reverseGeocode } from '../geocode.js';
import { FALLBACK_CENTER } from '../App.jsx';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { haversineKm, formatDistance } from '../geo.js';
import { saveFavorite } from '../store.js';
// User comes from the shell via props (App.jsx screenProps) — single source, no context shadow.
import { dateRange, bannerDate } from '../festival.js';
import { upcomingFestivals, FESTIVALS } from '../festivals.js';
import { feeLabel } from '../filters.js';
import { PhotoPlaceholder } from '../ui.jsx';
import { placeImage, mapboxToken } from '../staticMap.js';
// import PangasinanMap from '../PangasinanMap.jsx'; // parked with the map header

const QUICK = [
  ['Beaches', Umbrella, { name:'browse', kind:'beaches' }],
  ['Restaurants', UtensilsCrossed, { name:'browse', kind:'dining' }],
  ['Local Food', Soup, { name:'browse', kind:'dining' }],
  ['Events', CalendarDays, { name:'events' }],
];

// v2: the recommendation set now depends on where the traveler is.
const REC_KEY = 'lakbai.rec.home.v2';
const REC_AT_KEY = 'lakbai.rec.homeAt.v2';

export default function Home({ coords, push, showToast, setTab, user }){
  const [place, setPlace] = useState('Pangasinan');
  const [query, setQuery] = useState('');
  const [recs, setRecs] = useState(sessionGet(REC_KEY) || []);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState(null);
  // Fallback banner: the next festival from the curated dataset, so the card is
  // never empty when no recommendation happens to carry a festival string.
  const [upcoming] = useState(() => upcomingFestivals(FESTIVALS, new Date())[0] || null);
  const [listening, setListening] = useState(false);
  // Last resolved label + the fix it belongs to. Keeping these out of state is
  // what stops the location line blinking back to "Pangasinan" on every GPS tick.
  const placeRef = useRef({ key: '', label: '' });
  const recogRef = useRef(null);

  useEffect(() => { // reverse geocode; never blank the label mid-lookup
    // No real fix yet: show the province, never a fabricated town (a fallback
    // centre is a guess, and claiming a specific town it isn't is worse).
    if (coords === FALLBACK_CENTER) { setPlace('Pangasinan'); return undefined; }
    let alive = true;
    reverseGeocode(coords.lng, coords.lat).then(label => {
      if (!alive || !label) return; // offline/no token: keep the last good label
      if (placeRef.current.label === label) return;
      placeRef.current.label = label;
      setPlace(label);
    });
    return () => { alive = false; };
  }, [coords.lng.toFixed(3), coords.lat.toFixed(3)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ~1 km bucket: a jittering GPS fix does not refetch, a real move does.
  const locKey = coords === FALLBACK_CENTER ? 'fallback' : coords.lng.toFixed(2) + ',' + coords.lat.toFixed(2);

  useEffect(() => {
    const cached = sessionGet(REC_KEY);
    const at = sessionGet(REC_AT_KEY);
    const far = !at || haversineKm(at.lng, at.lat, coords.lng, coords.lat) > 8;
    if (cached && cached.length && !far) {
      setRecs(cached);
      setEvent(cached.find(p => p.festival && dateRange(p.festival)) || null);
      setBusy(false);
      return undefined;
    }
    let alive = true;
    // Give the first real GPS fix a moment, so the plan is built for where the
    // user actually is instead of the province fallback centre.
    const wait = coords === FALLBACK_CENTER ? 2500 : 0;
    // No usable cache for this spot (first visit, or the traveler moved): drop
    // the previous town's picks straight away so they cannot read as this
    // town's recommendations while the new request is in flight.
    setRecs([]);
    setEvent(null);
    setBusy(true);
    const timer = setTimeout(() => {
      setBusy(true);
      recommend('top attractions, events and hidden gems', `${coords.lng},${coords.lat}`, readLocalPrefs(user))
        .then(out => {
          if (!alive) return;
          const ps = out.places || [];
          setRecs(ps);
          sessionSet(REC_KEY, ps);
          sessionSet(REC_AT_KEY, { lng: coords.lng, lat: coords.lat });
          setEvent(ps.find(p => p.festival && dateRange(p.festival)) || null);
        })
        .catch(e => { if (alive) showToast('Could not load recommendations', 'error', e.message); })
        .finally(() => { if (alive) setBusy(false); });
    }, wait);
    return () => { alive = false; clearTimeout(timer); };
  }, [locKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function search(text){
    const q = String(text || '').trim();
    if (!q) return;
    push({ name:'search', query:q });
  }
  function mic(){
    // A second tap stops an active recognizer instead of spawning another.
    if (listening){ try { recogRef.current?.stop(); } catch { /* ignore */ } return; }
    const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) { showToast('Voice search not supported here', 'error'); return; }
    const r = new SpeechCtor();
    recogRef.current = r;
    r.lang = 'en-PH';
    r.onresult = e => {
      setListening(false);
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (!transcript) return;
      setQuery(transcript); search(transcript);
    };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    r.onend = () => setListening(false); // recognizer ended with no result — don't stick
    setListening(true);
    try { r.start(); }
    catch { setListening(false); showToast('Microphone unavailable', 'error'); }
  }
  async function fav(p){
    const res = await saveFavorite(user, p);
    showToast(res.error ? 'Sign in to save' : 'Added to Saved', res.error ? 'error' : 'ok');
  }
  // AI recommendation wins; the curated next festival is the fallback.
  const feature = event || (upcoming ? { ...upcoming, categories:['Festival','Cultural'] } : null);
  const featureKicker = event ? dateRange(event.festival) : (bannerDate(upcoming) || (upcoming && upcoming.dateLabel) || '');
  const featureMeta = event ? (event.hint || event.address) : (upcoming && upcoming.town) || '';
  const featurePhoto = event
    ? event.photo
    : ((upcoming && upcoming.photos) || []).find(u => !/seal\.png|Banner_Capitol/i.test(u)) || null;
  return (
    <main className="screen" style={{ flex:1, overflowY:'auto' }}>
      <header className="pane" style={{ paddingTop:20 }}>
        {/* Map header (Pangasinan outline beside the title) — parked while the
            home screen goes back to the plain header. Code kept for later.
        <div className="home-head">
          <PangasinanMap coords={coords}/>
          <div className="home-head-text">
            <h1>Explore Pangasinan</h1>
            <p className="home-place"><MapPin size={13}/> <span>{place}</span></p>
          </div>
          <button className="chip home-emg" data-testid="emergency-pill" onClick={() => push({ name:'emergency' })}>Emergency</button>
        </div>
        */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h1 style={{ margin:0, fontSize:24 }}>Explore Pangasinan</h1>
          <button className="chip" style={{ borderColor:'#FED7AA', color:'var(--accent)', fontWeight:600 }} data-testid="emergency-pill" onClick={() => push({ name:'emergency' })}>Emergency</button>
        </div>
        <p style={{ color:'var(--muted-ink)', fontSize:13.5, display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
          <MapPin size={14}/> {place}
        </p>
        <div style={{ display:'flex', gap:8, background:'#fff', border:'1px solid #EDF1F7', borderRadius:999, padding:'6px 6px 6px 16px', alignItems:'center', boxShadow:'0 1px 2px rgba(15,23,42,.04)' }}>
          <Search size={17} color="#94A3B8"/>
          <input data-testid="home-search" aria-label="Search places, food, events" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(query); }} placeholder="Search places, food, events…" style={{ border:'none', padding:'8px 0', background:'none' }}/>
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
          <article className="event-hero" data-testid="event-banner" onClick={() => push({ name:'detail', place:feature })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'detail', place:feature }); } }}>
            <div className="event-hero-photo">
              {featurePhoto
                ? <img src={featurePhoto} alt={feature.name} loading="lazy" onError={e => { e.currentTarget.style.display='none'; }}/>
                : <PhotoPlaceholder size={30}/>}
            </div>
            <div className="event-hero-shade"/>
            <div className="event-hero-body">
              <span className="event-hero-kicker">{featureKicker}</span>
              <h3 className="event-hero-title">{feature.name}</h3>
              <p className="event-hero-meta">
                <MapPin size={14}/> <span>{featureMeta}{event && event.fees != null ? ' • ' + (/free/i.test(String(event.fees)) ? 'Free Admission' : feeLabel(event.fees)) : ''}</span>
              </p>
            </div>
            <span className="event-hero-go"><ArrowRight size={18}/></span>
          </article>
        )}

        <div data-testid="plan-cta" onClick={() => setTab('chat')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab('chat'); } }} role="button" tabIndex={0} className="soft-card" style={{ margin:'16px 0', cursor:'pointer', borderRadius:18, padding:14 }}>
          <span style={{ width:40, height:40, minWidth:40, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}><Compass size={19}/></span>
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
          {recs.map(p => { const cardImg = placeImage(p, mapboxToken()); return (
            <article key={p.id} style={{ flex:'0 0 220px', borderRadius:18, background:'#fff', border:'1px solid #EDF1F7', overflow:'hidden', cursor:'pointer', boxShadow:'0 10px 24px -20px rgba(15,23,42,.55)' }} onClick={() => push({ name:'detail', place:p })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'detail', place:p }); } }}>
              <div style={{ position:'relative', height:130 }}>
                {cardImg
                  ? <img src={cardImg} alt={p.name} loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
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
          ); })}
          {!recs.length && !busy && <p style={{ color:'var(--muted-ink)', fontSize:14 }}>Recommendations will appear here once you search or ask LakbAI.</p>}
        </div>
      </div>
    </main>
  );
}
