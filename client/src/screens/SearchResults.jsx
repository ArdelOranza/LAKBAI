import { useEffect, useState } from 'react';
import { ArrowLeft, Search, Star, MapPin, ChevronRight } from 'lucide-react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { filterPlaces, feeLabel } from '../filters.js';
import { haversineKm, formatDistance } from '../geo.js';
import { Chip, PhotoPlaceholder } from '../ui.jsx';

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
    <div style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ position:'sticky', top:0, zIndex:10, background:'rgba(255,255,255,.96)', backdropFilter:'blur(8px)', paddingTop:14, paddingBottom:10, borderBottom:'1px solid #EDF1F7' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
          <div style={{ flex:1, display:'flex', gap:8, background:'#F7F9FC', border:'1px solid #EDF1F7', borderRadius:999, padding:'8px 14px', alignItems:'center' }}>
            <Search size={16} color="#94A3B8"/>
            <input data-testid="search-bar" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') push({ name:'search', query:text }); }} style={{ border:'none', padding:'4px 0', background:'none' }}/>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none' }}>
          {KINDS.map(([label, k]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}
        </div>
      </div>

      <div style={{ display:'grid', gap:10, padding:'14px 20px 24px' }}>
        {busy && !shown.length && <p className="shimmer" style={{ fontSize:14 }}>Searching…</p>}
        {!busy && !shown.length && <p data-testid="search-empty" style={{ color:'var(--muted-ink)', fontSize:14 }}>Nothing found — try another search.</p>}
        {shown.map(p => {
          const dist = formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat));
          return (
            <article key={p.id} data-testid="result-row" onClick={() => push({ name:'detail', place:p })} style={{ display:'flex', gap:12, padding:12, border:'1px solid #EDF1F7', borderRadius:16, background:'#fff', cursor:'pointer', alignItems:'center' }}>
              <div style={{ position:'relative', width:96, height:96, flex:'0 0 96px', borderRadius:14, overflow:'hidden' }}>
                {p.photo
                  ? <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <PhotoPlaceholder size={24}/>}
                {p.rating && (
                  <span className="chip" style={{ position:'absolute', left:6, top:6, fontSize:10, padding:'2px 7px', display:'inline-flex', alignItems:'center', gap:3 }}>
                    <Star size={10} fill="var(--primary)" color="var(--primary)"/> {p.rating}
                  </span>
                )}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:10.5, color:'var(--muted-ink)', letterSpacing:.3 }}>{feeLabel(p.fees)}</span>
                <b style={{ display:'block', fontSize:14.5, lineHeight:1.3 }}>{p.name}</b>
                <p style={{ fontSize:11.5, color:'var(--muted-ink)', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.address || (p.hint ? p.hint + ', Pangasinan' : 'Pangasinan')}</p>
                {dist && <p style={{ fontSize:11.5, margin:'5px 0 0', display:'inline-flex', alignItems:'center', gap:4 }}><MapPin size={12} color="var(--primary)"/> {dist} away</p>}
              </div>
              <ChevronRight size={18} color="#94A3B8"/>
            </article>
          );
        })}
      </div>
    </div>
  );
}
