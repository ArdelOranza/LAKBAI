import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { savePlan } from '../store.js';
import { driveMinutes, haversineKm } from '../geo.js';
import { Chip, PrimaryBtn } from '../ui.jsx';

const CITY = 'Bolinao, Pangasinan';

export default function ItineraryView({ plan, coords, pop, showToast }){
  const { user } = useAuth();
  const p = plan || {};
  const stops = p.schedule || [];
  const favBy = p.favBy || {};
  const [saved, setSaved] = useState(Boolean(p.saved));
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(p.title || 'My Day Trip');
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/weather?lng=${coords.lng}&lat=${coords.lat}`)
      .then(r => (r.ok ? r.json() : null))
      .then(w => { if (alive && w && typeof w.tempC === 'number') setWeather(w); })
      .catch(() => { /* weather is a bonus card; hidden gracefully */ });
    return () => { alive = false; };
  }, [coords]); // eslint-disable-line react-hooks/exhaustive-deps
  async function saveItinerary(){
    const res = await savePlan(user, { id: p.id, title, schedule: stops, starts_at: p.starts_at || null });
    setSaved(true);
    showToast('Itinerary Saved — You can view saved itineraries under Profile Tab named Saved Itineraries', res.queued ? 'ok' : 'ok', res.error);
  }
  return (
    <main style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:20 }}>
        <button data-testid="back-btn" onClick={pop} aria-label="Back" style={{ width:38, height:38, borderRadius:'50%', border:'1px solid var(--border)' }}>←</button>
        <Chip testid="save-plan" active={saved} onClick={saved ? undefined : saveItinerary}>{saved ? '✓ Saved' : 'Save Itinerary'}</Chip>
      </div>
      <div className="pane" style={{ marginTop:10 }}>
        <span className="chip" style={{ fontSize:11 }}>📅 Day 1</span>
        {editing ? (
          <input data-testid="plan-title-input" value={title} autoFocus onChange={e => setTitle(e.target.value)} onBlur={() => setEditing(false)} onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }} style={{ marginTop:8, maxWidth:320 }}/>
        ) : (
          <h1 style={{ margin:'6px 0 0' }} data-testid="plan-title">{title} <button data-testid="edit-title" onClick={() => setEditing(true)} style={{ background:'none', border:'none', padding:4 }} aria-label="Edit title">✏️</button></h1>
        )}
        <p style={{ color:'var(--muted-ink)', fontSize:13, marginTop:4 }}>📍 {CITY} • 1 Day × {stops.length} Stops</p>
        {weather && (
          <div style={{ background:'var(--chip)', borderRadius:16, padding:'10px 14px', marginTop:8, display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:20 }}>⛅</span>
            <span style={{ fontSize:13 }}><b>{weather.tempC}°C</b> · {weather.condition} — a good day for this route.</span>
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
            <article key={s.placeId || s.name || i} data-testid="itin-row" style={{ border:'1px solid var(--border)', borderRadius:18, background:'#fff', overflow:'hidden' }}>
              <div style={{ position:'relative', height:120, background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}>
                {mineFav && mineFav.photo && <img src={mineFav.photo} alt="" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
                <span style={{ position:'absolute', left:10, top:10, background:'rgba(255,255,255,.92)', borderRadius:12, padding:'3px 10px', fontWeight:800 }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ position:'absolute', left:10, bottom:10, display:'flex', gap:6 }}>
                  {!(p.inputNames || []).includes(s.name) && <span className="chip" style={{ fontSize:10, padding:'2px 8px', background:'var(--primary)', color:'#fff', border:'none' }}>✦ AI Added</span>}
                  {s.arrive && s.depart && <span className="chip" style={{ fontSize:10, padding:'2px 8px', background:'var(--primary)', color:'#fff', border:'none' }}>{s.arrive} – {s.depart}</span>}
                </div>
              </div>
              <div style={{ padding:'10px 12px' }}>
                <b>{s.name}</b>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                  {drive && <span className="chip" style={{ fontSize:11, padding:'3px 10px' }}>🚗 {drive} min drive</span>}
                  {s.fees && <span className="chip" style={{ fontSize:11, padding:'3px 10px' }}>🎟 {s.fees}</span>}
                </div>
                {(s.activities || []).length > 0 && <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'6px 0 0' }}>{s.activities.join(' · ')}</p>}
              </div>
            </article>
          );
        })}
        {!stops.length && <p style={{ color:'var(--muted-ink)' }}>No stops in this plan.</p>}
      </div>
      {!saved && (
        <div className="pane" style={{ marginTop:16, paddingBottom:16 }} data-testid="save-footer">
          <PrimaryBtn onClick={saveItinerary}>Save Itinerary</PrimaryBtn>
        </div>
      )}
    </main>
  );
}
