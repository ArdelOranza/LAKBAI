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
      <div className="search-head">
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
        <div className="search-pill">
          <Search size={17} color="#64748B"/>
          <input
            data-testid="search-bar"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') push({ name:'search', query:text }); }}
            placeholder="Search places, food, events..."
            className="search-input"
          />
          <button className="search-mic" data-testid="mic-btn" onClick={mic} aria-label="Voice search" style={{ opacity: listening ? .5 : 1 }}>
            <Mic size={16}/>
          </button>
        </div>
      </div>

      <div className="kind-row">
        {KINDS.map(([label, k]) => <Chip key={k} flat active={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}
      </div>

      <div className="result-list">
        {busy && !shown.length && <p className="shimmer" style={{ fontSize:14, margin:0 }}>Searching...</p>}
        {!busy && !shown.length && <p data-testid="search-empty" style={{ color:'var(--muted-ink)', fontSize:14 }}>Nothing found — try another search.</p>}
        {shown.map(p => {
          const dist = formatDistance(haversineKm(coords.lng, coords.lat, p.lng, p.lat));
          return (
            <article key={p.id} data-testid="result-row" className="result-card" onClick={() => push({ name:'detail', place:p })}>
              <div className="result-thumb">
                {p.photo
                  ? <img src={p.photo} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}/>
                  : <PhotoPlaceholder size={22}/>}
                {p.rating && (
                  <span className="result-rating">
                    <Star size={10} fill="currentColor" strokeWidth={0}/> {p.rating}
                  </span>
                )}
              </div>

              <div className="result-main">
                {p.fees != null && <span className="result-fee">{feeLabel(p.fees)}</span>}
                <b className="result-name">{p.name}</b>
                <p className="result-addr">{p.address || (p.hint ? p.hint + ', Pangasinan' : 'Pangasinan')}</p>
                {dist && (
                  <p className="result-dist">
                    <MapPin size={12}/> {dist} away
                  </p>
                )}
              </div>

              <span className="result-go"><ChevronRight size={16}/></span>
            </article>
          );
        })}
      </div>
    </div>
  );
}