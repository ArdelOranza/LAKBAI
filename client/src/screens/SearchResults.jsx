import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, Mic, Star, MapPin, ChevronRight } from 'lucide-react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { filterPlaces, feeLabel } from '../filters.js';
import { haversineKm, formatDistance } from '../geo.js';
import { Chip, PhotoPlaceholder } from '../ui.jsx';
import { placeImage, mapboxToken } from '../staticMap.js';
import { discoverPlaces } from '../discover.js';

// DYNAMIC search: always live. Session cache is only an offline hint —
// never an early return. Dataset + Mapbox discovery are always merged,
// so admin edits and new Mapbox results appear immediately.
const MAX_SESSION_DISCOVERIES = 50;
// Mapbox finds persist for the session so the live map (MapTab) can add their pins.
function rememberDiscoveries(found){
  const prev = sessionGet('lakbai.discovered') || [];
  const seen = new Set(prev.map(p => p.id));
  const next = [...prev, ...found.filter(p => !seen.has(p.id))].slice(0, MAX_SESSION_DISCOVERIES);
  sessionSet('lakbai.discovered', next);
  return next;
}
function normName(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function dedupePlaces(a, b){
  const seen = new Set();
  const out = [];
  for (const p of [...a, ...b]){
    if (!p) continue;
    const key = p.id || (normName(p.name) + '|' + (Number.isFinite(p.lng) ? p.lng.toFixed(3) : '') + ',' + (Number.isFinite(p.lat) ? p.lat.toFixed(3) : ''));
    const nkey = normName(p.name);
    if (seen.has(key) || seen.has('n:' + nkey + p.lng?.toFixed(3))) continue;
    seen.add(key);
    seen.add('n:' + nkey + p.lng?.toFixed(3));
    out.push(p);
  }
  return out;
}

const KINDS = [['All','all'],['Places','places'],['Food','food'],['Events','events']];

export default function SearchResults({ query, coords, push, pop, showToast, user }){
  const [text, setText] = useState(query);
  const [kind, setKind] = useState('all');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const coordsBucket = `${coords.lng.toFixed(3)},${coords.lat.toFixed(3)}`;
  // Dynamic: search as you type (debounced), not just on Enter.
  const [debouncedText, setDebouncedText] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedText(text), 300);
    return () => clearTimeout(id);
  }, [text]);
  useEffect(() => {
    let alive = true;
    const q = String(debouncedText || '').trim();
    if (!q) { setResults([]); setBusy(false); return; }
    const key = 'lakbai.rec:' + q + '|' + coordsBucket;
    setBusy(true);
    // Always fresh: dataset + Mapbox in parallel. Cache only written after.
    Promise.allSettled([
      recommend(q, `${coords.lng},${coords.lat}`, readLocalPrefs(user)).catch(e => { showToast('Search failed', 'error', e.message); return { places: [] }; }),
      discoverPlaces(q, `${coords.lng},${coords.lat}`).catch(() => []),
    ]).then(async ([recRes, discRes]) => {
      if (!alive) return;
      const dsPlaces = (recRes.status === 'fulfilled' && recRes.value && recRes.value.places) || [];
      const found = (discRes.status === 'fulfilled' && discRes.value) || [];
      if (found.length) rememberDiscoveries(found);
      // Dynamic merge: Mapbox always contributes, deduped against dataset.
      const ps = dedupePlaces(dsPlaces, found);
      setResults(ps);
      sessionSet(key, ps);
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [debouncedText, coordsBucket]); // eslint-disable-line react-hooks/exhaustive-deps

  function mic(){
    // A second tap stops an active recognizer instead of spawning another.
    if (listening){ try { recogRef.current?.stop(); } catch { /* ignore */ } return; }
    const S = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!S) { showToast('Voice search not supported here', 'error'); return; }
    const r = new S();
    recogRef.current = r;
    r.lang = 'en-PH';
    r.onresult = e => {
      setListening(false);
      const said = e.results[0][0].transcript;
      setText(said);
      push({ name:'search', query:said });
    };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    r.onend = () => setListening(false); // recognizer ended with no result — don't stick
    setListening(true);
    try { r.start(); }
    catch { setListening(false); showToast('Microphone unavailable', 'error'); }
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
            aria-label="Search places, food, events"
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
          const thumb = placeImage(p, mapboxToken());
          return (
            <article key={p.id} data-testid={p.source === 'mapbox' ? 'discover-row' : 'result-row'} className="result-card" onClick={() => push({ name:'detail', place:p })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'detail', place:p }); } }}>
              <div className="result-thumb">
                {thumb
                  ? <img src={thumb} alt={p.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}/>
                  : <PhotoPlaceholder size={22}/>}
                {p.rating && (
                  <span className="result-rating">
                    <Star size={10} fill="currentColor" strokeWidth={0}/> {p.rating}
                  </span>
                )}
              </div>

              <div className="result-main">
                {p.source === 'mapbox' && <span data-testid="discover-tag" className="result-fee" style={{ background:'#E7F0FE', color:'var(--primary)' }}>Discovered</span>}
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