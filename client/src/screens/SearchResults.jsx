import { useEffect, useState } from 'react';
import { ArrowLeft, Search, Mic, Star, MapPin, ChevronRight } from 'lucide-react';
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
  const [listening, setListening] = useState(false);
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

  function mic(){
    const S = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!S) { showToast('Voice search not supported here', 'error'); return; }
    const r = new S();
    r.lang = 'en-PH';
    r.onresult = e => {
      setListening(false);
      const said = e.results[0][0].transcript;
      setText(said);
      push({ name:'search', query:said });
    };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    setListening(true);
    r.start();
  }

  const shown = filterPlaces(results, kind);
  return (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ position:'sticky', top:0, zIndex:10, background:'rgba(255,255,255,.96)', backdropFilter:'blur(8px)', paddingTop:14, paddingBottom:10, borderBottom:'1px solid #EDF1F7' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
          <div style={{ flex:1, display:'flex', gap:8, background:'#F7F9FC', border:'1px solid #EDF1F7', borderRadius:999, padding:'6px 6px 6px 14px', alignItems:'center' }}>
            <Search size={16} color="#94A3B8"/>
            <input data-testid="search-bar" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') push({ name:'search', query:text }); }} style={{ border:'none', padding:'4px 0', background:'none' }}/>
            <button data-testid="mic-btn" onClick={mic} aria-label="Voice search" style={{ width:32, height:32, flex:'0 0 32px', borderRadius:'50%', background:'#fff', border:'none', color:'var(--primary)', display:'grid', placeItems:'center', padding:0, opacity: listening ? .5 : 1 }}>
              <Mic size={15}/>
            </button>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none' }}>
          {KINDS.map(([label, k]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}
        </div>
      </div>

      <div style={{ display:'grid', gap:10, padding:'14px 20px 24px' }}>
        {busy && !shown.length && <p className="shimmer" style={{ fontSize:14, margin:0 }}>Searching…</p>}
        {!busy && !shown.length && <p data-testid="search-empty" style={{ color:'var(--muted-ink)', fontSize:14 }}>Nothing found — try another search.</p>}
        {shown.map(p => {
          const dist = formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat));
          return (
            <article key={p.id} data-testid="result-row" onClick={() => push({ name:'detail', place:p })} style={{ display:'flex', gap:12, padding:10, border:'1px solid #EDF1F7', borderRadius:18, background:'#fff', cursor:'pointer', alignItems:'center', boxShadow:'0 1px 2px rgba(15,23,42,.04)' }}>
              <div style={{ position:'relative', width:88, height:88, flex:'0 0 88px', borderRadius:12, overflow:'hidden' }}>
                {p.photo
                  ? <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <PhotoPlaceholder size={22}/>}
                {p.rating && (
                  <span style={{ position:'absolute', left:6, top:6, display:'inline-flex', alignItems:'center', gap:3, background:'#fff', borderRadius:999, padding:'2px 7px', fontSize:10, fontWeight:700 }}>
                    <Star size={10} fill="var(--accent)" color="var(--accent)"/> {p.rating}
                  </span>
                )}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                {p.fees != null && <span style={{ display:'block', fontSize:10.5, color:'var(--muted-ink)' }}>{feeLabel(p.fees)}</span>}
                <b style={{ display:'block', fontSize:14.5, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</b>
                <p style={{ fontSize:11.5, color:'var(--muted-ink)', margin:'3px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.address || (p.hint ? p.hint + ', Pangasinan' : 'Pangasinan')}</p>
                {dist && (
                  <p style={{ fontSize:11.5, margin:'6px 0 0', display:'inline-flex', alignItems:'center', gap:4, color:'var(--ink)' }}>
                    <MapPin size={11} color="var(--primary)"/> {dist} away
                  </p>
                )}
              </div>
              <span style={{ width:30, height:30, minWidth:30, borderRadius:'50%', background:'#F1F5F9', color:'#94A3B8', display:'grid', placeItems:'center' }}><ChevronRight size={16}/></span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
