import { useEffect, useState } from 'react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { filterPlaces, feeLabel } from '../filters.js';
import { haversineKm, formatDistance } from '../geo.js';
import { Chip } from '../ui.jsx';

const KINDS = [['All','all'],['Places','places'],['Food','food'],['Events','events']];

export default function SearchResults({ query, coords, push, pop, showToast }){
  const [text, setText] = useState(query);
  const [kind, setKind] = useState('all');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const key = 'lakbai.rec:' + query;
    const hit = sessionGet(key);
    if (hit) { setResults(hit); return; }
    setBusy(true);
    recommend(query, `${coords.lng},${coords.lat}`, readLocalPrefs())
      .then(out => {
        const ps = out.places || [];
        setResults(ps);
        sessionSet(key, ps);
      })
      .catch(e => showToast('Search failed', 'error', e.message))
      .finally(() => setBusy(false));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = filterPlaces(results, kind);
  return (
    <div style={{ paddingBottom:12 }}>
      <div className="pane" style={{ position:'sticky', top:0, zIndex:10, background:'rgba(255,255,255,.95)', backdropFilter:'blur(8px)', paddingTop:14, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          <button data-testid="back-btn" onClick={pop} aria-label="Back" style={{ flex:'0 0 36px', width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)', background:'#fff' }}>←</button>
          <div style={{ flex:1, display:'flex', gap:8, background:'#fff', border:'1px solid var(--border)', borderRadius:999, padding:'8px 14px', alignItems:'center' }}>
            <span>🔍</span>
            <input data-testid="search-bar" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') push({ name:'search', query:text }); }} style={{ border:'none', padding:2, background:'none' }}/>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, overflowX:'auto' }}>
          {KINDS.map(([label, k]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}
        </div>
      </div>
      <div style={{ display:'grid', gap:10, padding:'14px 20px' }}>
        {busy && !shown.length && <p className="shimmer" style={{ fontSize:14 }}>Searching…</p>}
        {!busy && !shown.length && <p data-testid="search-empty" style={{ color:'var(--muted-ink)', fontSize:14 }}>Nothing found — try another search.</p>}
        {shown.map(p => {
          const dist = formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat));
          return (
            <article key={p.id} data-testid="result-row" onClick={() => push({ name:'detail', place:p })} style={{ display:'flex', gap:12, padding:12, border:'1px solid var(--border)', borderRadius:18, background:'#fff', cursor:'pointer' }}>
              <div style={{ position:'relative', width:104, height:104, flex:'0 0 104px', borderRadius:14, overflow:'hidden', background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}>
                {p.photo && <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
                {p.rating && <span className="chip" style={{ position:'absolute', left:6, top:6, fontSize:10 }}>★ {p.rating}</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:11, color:'var(--muted-ink)' }}>{feeLabel(p.fees)}</span>
                <b style={{ display:'block' }}>{p.name}</b>
                <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'2px 0' }}>{p.address || (p.hint ? p.hint + ', Pangasinan' : 'Pangasinan')}</p>
                {dist && <p style={{ fontSize:12 }}>📍 {dist} away</p>}
              </div>
              <span>›</span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
