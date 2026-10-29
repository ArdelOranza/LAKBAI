import { useEffect, useState } from 'react';
import { recommend } from '../api.js';
import { FALLBACK_CENTER } from '../App.jsx';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { haversineKm, formatDistance } from '../geo.js';
import { saveFavorite } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { EmergencyPanel } from '../Panels.jsx';
import { dateRange } from '../festival.js';
import Logo from '../logo.jsx';

const QUICK = [['Beaches','🏖','beaches worth visiting'],['Restaurants','🍽','good restaurants'],['Local Food','🥘','local Pangasinan food to try'],['Events','📅','events and festivals this month']];

export default function Home({ coords, push, showToast, setTab }){
  const { user } = useAuth();
  const [place, setPlace] = useState('Pangasinan');
  const [query, setQuery] = useState('');
  const [recs, setRecs] = useState(sessionGet('lakbai.rec.home') || []);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState(null);
  const [showEmerg, setShowEmerg] = useState(false);
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
  return (
    <div style={{ paddingBottom:12 }}>
      <header className="pane" style={{ paddingTop:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h1 style={{ margin:0 }}>Explore Pangasinan</h1>
          <button className="chip" style={{ borderColor:'#FED7AA', color:'var(--accent)', fontWeight:600 }} data-testid="emergency-pill" onClick={() => setShowEmerg(s => !s)}>Emergency</button>
        </div>
        <p style={{ color:'var(--muted-ink)', fontSize:14 }}>📍 {place}</p>
        <div style={{ display:'flex', gap:8, background:'#fff', border:'1px solid var(--border)', borderRadius:999, padding:'8px 8px 8px 16px', alignItems:'center' }}>
          <span>🔍</span>
          <input data-testid="home-search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(query); }} placeholder="Search places, food, events…" style={{ border:'none', padding:4, background:'none' }}/>
          <button className="chip" data-testid="mic-btn" onClick={mic} style={{ opacity: listening ? .5 : 1, padding:'8px 10px' }}>🎙</button>
        </div>
      </header>
      <div className="pane" style={{ display:'flex', justifyContent:'space-between', margin:'14px 0' }}>
        {QUICK.map(([label, icon, q]) => (
          <button key={label} data-testid={'quick-' + label.split(' ')[0].toLowerCase()} onClick={() => search(q)} style={{ background:'none', border:'none', display:'grid', justifyItems:'center', fontSize:11, padding:0 }}>
            <span style={{ width:52, height:52, borderRadius:18, background:'var(--chip)', display:'grid', placeItems:'center', fontSize:22, color:'var(--primary)' }}>{icon}</span>
            <span style={{ marginTop:6 }}>{label}</span>
          </button>
        ))}
      </div>
      <div className="pane">
        {busy && !recs.length && <p className="shimmer" style={{ fontSize:14 }}>Finding hidden gems for you…</p>}
        {event && (
          <article data-testid="event-banner" style={{ position:'relative', borderRadius:22, overflow:'hidden', boxShadow:'var(--shadow)', cursor:'pointer' }} onClick={() => push({ name:'detail', place:event })}>
            {event.photo
              ? <img src={event.photo} alt="" style={{ width:'100%', height:200, objectFit:'cover' }}/>
              : <div aria-hidden="true" style={{ width:'100%', height:200, background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}/>}
            <div style={{ position:'absolute', inset:'auto 0 0 0', background:'linear-gradient(transparent, rgba(10,37,64,.85))', color:'#fff', padding:16 }}>
              <span style={{ fontSize:11, letterSpacing:1, opacity:.85 }}>{dateRange(event.festival)}</span>
              <h3 style={{ margin:'2px 0' }}>{event.name}</h3>
              <p style={{ fontSize:12, opacity:.9 }}>📍 {event.hint || event.address}</p>
            </div>
            <span style={{ position:'absolute', right:14, top:'50%', width:34, height:34, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}>→</span>
          </article>
        )}
        <div data-testid="plan-cta" onClick={() => setTab('chat')} style={{ background:'var(--chip)', borderRadius:18, padding:14, margin:'16px 0', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <span style={{ width:40, height:40, borderRadius:14, background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}>✦</span>
          <span style={{ flex:1 }}>
            <b>Need a personalized plan?</b>
            <p style={{ margin:0, fontSize:13, color:'var(--muted-ink)' }}>Let LakbAI orchestrate your day in {place.split(',')[0]}</p>
          </span>
          <span style={{ width:34, height:34, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center' }}>→</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <h2>Recommended for You</h2>
          <a href="#" onClick={e => { e.preventDefault(); search('best places to visit'); }} style={{ fontSize:13 }}>See All →</a>
        </div>
        <div data-testid="recs" style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8 }}>
          {recs.map(p => (
            <article key={p.id} style={{ flex:'0 0 220px', borderRadius:18, background:'#fff', border:'1px solid var(--border)', overflow:'hidden', cursor:'pointer' }} onClick={() => push({ name:'detail', place:p })}>
              <div style={{ position:'relative', height:130, background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}>
                {p.photo && <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
                <span className="chip" style={{ position:'absolute', left:8, top:8, fontSize:11 }}>{(p.categories && p.categories[0]) || 'Pangasinan'}</span>
                <button className="chip" data-testid={'fav-' + p.id} onClick={e => { e.stopPropagation(); fav(p); }} style={{ position:'absolute', right:8, top:8, width:30, height:30, padding:0, borderRadius:'50%', background:'var(--primary)', color:'#fff', border:'none' }}>+</button>
                {haversineKm(coords.lng, coords.lat, p.lng, p.lat) != null && <span style={{ position:'absolute', left:8, bottom:8, fontSize:11, color:'#fff' }}>📍 {formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat))}</span>}
              </div>
              <div style={{ padding:10 }}>
                <b>{p.name}</b>
                <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'2px 0 0' }}>{p.reason}</p>
                {p.rating && <p style={{ fontSize:12 }}>★ {p.rating}{p.reviews ? ` (${p.reviews})` : ''}</p>}
              </div>
            </article>
          ))}
          {!recs.length && !busy && <p style={{ color:'var(--muted-ink)', fontSize:14 }}>Recommendations will appear here once you search or ask LakbAI.</p>}
        </div>
      </div>
      {showEmerg && <EmergencyPanel proximity={`${coords.lng},${coords.lat}`} />}
    </div>
  );
}
