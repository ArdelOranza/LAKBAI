import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CalendarDays, Pencil, MapPin, CloudSun, Sparkles, Car, Ticket } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { savePlan } from '../store.js';
import { sessionSet } from '../sessionCache.js';
import { driveMinutes, haversineKm } from '../geo.js';
import { Chip, PrimaryBtn, PhotoPlaceholder } from '../ui.jsx';

  // (CITY was a hardcoded 'Bolinao, Pangasinan' — now derived from the stops.)
  // Empty or unknown cases fall back to a province label, never to a wrong town.

export default function ItineraryView({ plan, coords, pop, showToast }){
  const { user } = useAuth();
  const p = plan || {};
  const stops = p.schedule || [];
  const favBy = p.favBy || {};
  const [saved, setSaved] = useState(Boolean(p.saved));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(p.title || 'My Day Trip');
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/weather?lng=${coords.lng}&lat=${coords.lat}`)
      .then(r => (r.ok ? r.json() : null))
      .then(w => {
        if (alive && w && typeof w.tempC === 'number') {
          setWeather(w);
          sessionSet('lakbai.wx', w); // Itineraries list shows a temp chip only when this is cached
        }
      })
      .catch(() => { /* weather is a bonus card; hidden gracefully */ });
    return () => { alive = false; };
  }, [coords]); // eslint-disable-line react-hooks/exhaustive-deps
  // Derive the header town from the stops — a Bayambang plan must not read
  // "Bolinao, Pangasinan" whatever the model called it.
  const cityLabel = (() => {
    const counts = {};
    for (const s of stops){
      const town = (favBy[s.name] && favBy[s.name].town) || s.hint || s.town;
      if (town) counts[String(town).replace(/,.*$/, '').trim()] = (counts[String(town).replace(/,.*$/, '').trim()] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top && top[0] ? `${top[0]}, Pangasinan` : 'Pangasinan';
  })();
  async function saveItinerary(){
    // In-flight guard: a double-tap on a slow network used to insert twice.
    if (saving || saved) return;
    setSaving(true);
    let res;
    try { res = await savePlan(user, { id: p.id, title, schedule: stops, starts_at: p.starts_at || null }); }
    catch (e) { res = { error: String(e?.message || e) }; }
    finally { setSaving(false); }
    // A signed-in cloud failure is not a save — keep the button enabled so the
    // traveler can retry instead of being locked out with a false "Saved".
    if (res.error && user){
      showToast('Could not save — try again', 'error', res.error);
      return;
    }
    setSaved(true);
    showToast(res.queued ? 'Saved on this device — it will sync when you sign in' : 'Itinerary Saved — You can view saved itineraries under Profile Tab named Saved Itineraries', 'ok', res.error);
  }
  return (
    <main style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
        <Chip testid="save-plan" active={saved} onClick={saved ? undefined : saveItinerary}>
          {saved ? <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><Check size={14}/> Saved</span> : 'Save Itinerary'}
        </Chip>
      </div>

      <div className="pane" style={{ marginTop:14 }}>
        <span className="chip" style={{ fontSize:10.5, padding:'3px 10px', display:'inline-flex', alignItems:'center', gap:5 }}>
          <CalendarDays size={12}/> Day 1
        </span>
        {editing ? (
          <input data-testid="plan-title-input" value={title} autoFocus onChange={e => setTitle(e.target.value)} onBlur={() => setEditing(false)} onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }} style={{ marginTop:8, maxWidth:320 }}/>
        ) : (
          <h1 style={{ margin:'8px 0 0', fontSize:25, letterSpacing:'-.7px', display:'flex', alignItems:'center', gap:6 }} data-testid="plan-title">
            {title}
            <button data-testid="edit-title" onClick={() => setEditing(true)} aria-label="Edit title" style={{ background:'none', border:'none', padding:4, color:'var(--muted-ink)', display:'grid', placeItems:'center' }}><Pencil size={15}/></button>
          </h1>
        )}
        <p style={{ color:'var(--muted-ink)', fontSize:12.5, marginTop:4, display:'flex', alignItems:'center', gap:5 }}>
          <MapPin size={13}/> {cityLabel} · 1 Day × {stops.length} Stops
        </p>
        {weather && (
          <div className="soft-card" style={{ marginTop:10, borderRadius:14 }}>
            <span style={{ width:34, height:34, minWidth:34, borderRadius:11, background:'#fff', color:'var(--primary)', display:'grid', placeItems:'center' }}><CloudSun size={18}/></span>
            <span style={{ fontSize:12.5 }}><b>{weather.tempC}°C</b> · {weather.condition} — a good day for this route.</span>
          </div>
        )}
      </div>

      <div className="pane" style={{ display:'grid', gap:12, marginTop:16 }}>
        {stops.map((s, i) => {
          const prev = stops[i - 1];
          const prevFav = prev && favBy[prev.name];
          const mineFav = favBy[s.name];
          const km = prevFav && prevFav.lng != null && mineFav && mineFav.lng != null ? haversineKm(prevFav.lng, prevFav.lat, mineFav.lng, mineFav.lat) : null;
          const drive = km != null ? driveMinutes(km) : null;
          return (
            <article key={s.placeId || s.name || i} data-testid="itin-row" style={{ border:'1px solid #EDF1F7', borderRadius:18, background:'#fff', overflow:'hidden' }}>
              <div style={{ position:'relative', height:120 }}>
                {mineFav && mineFav.photo
                  ? <img src={mineFav.photo} alt={s.name} onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <PhotoPlaceholder size={26}/>}
                <span style={{ position:'absolute', left:10, top:10, background:'rgba(255,255,255,.94)', borderRadius:10, padding:'3px 10px', fontWeight:800, fontSize:12, color:'var(--ink)' }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ position:'absolute', left:10, bottom:10, display:'flex', gap:6 }}>
                  {!(p.inputNames || []).includes(s.name) && (
                    <span className="chip" style={{ fontSize:10, padding:'3px 9px', background:'var(--primary)', color:'#fff', border:'none', display:'inline-flex', alignItems:'center', gap:4 }}><Sparkles size={11}/> AI Added</span>
                  )}
                  {s.arrive && s.depart && <span className="chip" style={{ fontSize:10, padding:'3px 9px', background:'rgba(15,23,42,.7)', color:'#fff', border:'none' }}>{s.arrive} – {s.depart}</span>}
                </div>
              </div>
              <div style={{ padding:'10px 12px 12px' }}>
                <b style={{ fontSize:14 }}>{s.name}</b>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:5 }}>
                  {drive && <span className="chip" style={{ fontSize:11, padding:'3px 10px', display:'inline-flex', alignItems:'center', gap:4 }}><Car size={12}/> {drive} min drive</span>}
                  {s.fees && <span className="chip" style={{ fontSize:11, padding:'3px 10px', display:'inline-flex', alignItems:'center', gap:4 }}><Ticket size={12}/> {s.fees}</span>}
                </div>
                {(s.activities || []).length > 0 && <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'7px 0 0' }}>{s.activities.join(' · ')}</p>}
              </div>
            </article>
          );
        })}
        {!stops.length && <p style={{ color:'var(--muted-ink)' }}>No stops in this plan.</p>}
      </div>

      {!saved && (
        <div className="pane" style={{ marginTop:16, paddingBottom:24 }} data-testid="save-footer">
          <PrimaryBtn onClick={saveItinerary}>Save Itinerary</PrimaryBtn>
        </div>
      )}
    </main>
  );
}
