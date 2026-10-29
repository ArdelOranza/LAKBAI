import { saveFavorite } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { dateRange } from '../festival.js';
import { feeLabel } from '../filters.js';
import { Chip, PrimaryBtn } from '../ui.jsx';

export default function PlaceDetail({ place, user, pop, showToast }){
  const p = place || {};
  async function save(){
    const res = await saveFavorite(user, p);
    showToast(res.error ? 'Sign in to save' : 'Added to Saved', res.error ? 'error' : 'ok');
  }
  return (
    <div style={{ paddingBottom:12 }}>
      <div style={{ position:'relative', height:260, background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}>
        {p.photo && <img data-testid="hero-photo" src={p.photo} alt="" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
        {p.photo && <span data-testid="photo-count" className="chip" style={{ position:'absolute', right:14, bottom:14 }}>📷 1 Photo</span>}
        <button data-testid="back-btn" onClick={pop} aria-label="Back" style={{ position:'absolute', left:14, top:14, width:38, height:38, borderRadius:'50%', border:'1px solid var(--border)', background:'#fff' }}>←</button>
        {(p.festival && dateRange(p.festival)) && <span className="chip" style={{ position:'absolute', left:14, bottom:14, fontSize:12 }}>📅 {dateRange(p.festival)}</span>}
      </div>
      <div className="pane" style={{ marginTop:14 }}>
        <h1 style={{ margin:0 }}>{p.name}</h1>
        <p style={{ color:'var(--muted-ink)', fontSize:14 }}>📍 {p.address || (p.hint ? p.hint + ', Pangasinan' : 'Pangasinan')}</p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'10px 0 16px' }}>
          {(p.categories || []).slice(0, 4).map(c => <Chip key={c}>{c}</Chip>)}
          {p.rating && <Chip>★ {p.rating}{p.reviews ? ` (${p.reviews})` : ''}</Chip>}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="chip" data-testid="directions-btn" style={{ flex:1, padding:12 }} onClick={() => window.open('https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng)}>🧭 Directions</button>
          <div style={{ flex:1 }}><PrimaryBtn testid="save-trip-btn" onClick={save}>⊕ Save to Trip</PrimaryBtn></div>
        </div>
        <h2>About the Destination</h2>
        <p style={{ fontSize:14 }}>{p.description || p.reason || 'A stop in Pangasinan — details coming from guides and visitor reviews.'}</p>
        {p.festival && <p style={{ fontSize:13, color:'var(--muted-ink)' }}>📅 {dateRange(p.festival) || p.festival}{p.fees ? ' · ' + feeLabel(p.fees) : ''}</p>}
        {p.fees && !p.festival && <p style={{ fontSize:13, color:'var(--muted-ink)' }}>🎟 {feeLabel(p.fees)}</p>}
        {p.peopleSay && <p style={{ fontSize:13, fontStyle:'italic' }}>“{p.peopleSay}”</p>}
        {(p.sources || []).length > 0 && (
          <div style={{ marginTop:10 }}>
            <b style={{ fontSize:12, letterSpacing:1 }}>SOURCES</b>
            <ul style={{ fontSize:12, color:'var(--muted-ink)', margin:'6px 0 0' }}>
              {p.sources.map(s => <li key={s}><a href={s} target="_blank" rel="noreferrer">{s.length > 60 ? s.slice(0, 60) + '…' : s}</a></li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
