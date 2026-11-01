import { useEffect, useState } from 'react';
import { Siren, X, Cross, Shield, Phone } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import { postReview, flushOutbox } from './store.js';
import { recommend } from './api.js';

const BASE = import.meta.env.VITE_API_URL || '';

export function NearbyButton({ onResults, onNotice, onFix }){
  function nearby(){
    if (!('geolocation' in navigator)) {
      onNotice('GPS unavailable — showing Pangasinan');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const at = `${pos.coords.longitude},${pos.coords.latitude}`;
        if (onFix) onFix(at);
        recommend('nearby attractions and restaurants', at).then(onResults).catch(e => onNotice(e.message));
      },
      () => onNotice('GPS unavailable — showing Pangasinan'),
      { timeout: 8000 }
    );
  }
  return <button data-testid="nearby-btn" onClick={nearby}>Nearby</button>;
}

function readReviews(key){
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function useReviews(placeId){
  const key = 'lakbai-reviews:' + placeId;
  const [reviews, setReviews] = useState(() => readReviews(key));
  function add(score, text){
    const next = [...reviews, { score, text, at: Date.now() }];
    setReviews(next); localStorage.setItem(key, JSON.stringify(next));
  }
  return { reviews, add };
}

export function Reviews({ place }){
  const { user } = useAuth();
  const { reviews, add } = useReviews(place.id);
  const [score, setScore] = useState(5);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!user) return;
    try { flushOutbox(user).catch(() => {}); } catch {}
    function onOnline(){ try { flushOutbox(user).catch(() => {}); } catch {} }
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user]);
  async function submit(e){
    e.preventDefault();
    add(Number(score), text);
    try { await postReview(user, place, Number(score), text); } catch {}
    setText('');
  }
  return (
    <section>
      <h4>Reviews: {place.name}</h4>
      <form data-testid="review-form" onSubmit={submit}>
        <select value={score} onChange={e => setScore(e.target.value)} aria-label="Score">
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Your experience…" aria-label="Review text" />
        <button type="submit">Post</button>
      </form>
      <ul>{reviews.map((r, i) => <li key={i} data-testid="review-item">{r.score}/5 — {r.text}</li>)}</ul>
    </section>
  );
}

const FALLBACK_HOTLINES = [
  { name: 'Pangasinan PDRRMO', number: '(075) 542-6802' },
  { name: 'National Emergency', number: '911' }
];
export function EmergencyPanel({ proximity, onClose }){
  const [emer, setEmer] = useState(null);
  const [emerError, setEmerError] = useState('');
  const at = proximity || '120.23,16.03';
  useEffect(() => {
    setEmer(null);
    setEmerError('');
    fetch(`${BASE}/api/emergency?proximity=${encodeURIComponent(at)}`)
      .then(r => { if (!r.ok) throw new Error('emergency lookup failed'); return r.json(); })
      .then(setEmer)
      .catch(e => setEmerError(e.message));
  }, [at]);
  const hotlines = (emer && emer.hotlines && emer.hotlines.length) ? emer.hotlines : FALLBACK_HOTLINES;
  const group = (title, Icon, rows) => (
    <div style={{ marginTop:12 }}>
      <div className="label" style={{ margin:'0 0 6px', display:'flex', alignItems:'center', gap:5 }}><Icon size={12}/> {title}</div>
      {rows.length ? (
        <div style={{ display:'grid', gap:6 }}>
          {rows.map(r => (
            <div key={r.id || r.name} style={{ background:'#F7F9FC', border:'1px solid #EDF1F7', borderRadius:12, padding:'9px 12px' }}>
              <b style={{ fontSize:12.5, display:'block' }}>{r.name}</b>
              <span style={{ fontSize:11, color:'var(--muted-ink)' }}>{r.address || r.number || r.n}</span>
            </div>
          ))}
        </div>
      ) : <p style={{ fontSize:11.5, color:'var(--muted-ink)', margin:0 }}>None listed nearby.</p>}
    </div>
  );
  return (
    <aside
      data-testid="emergency-panel"
      role="dialog"
      aria-label="Emergency"
      style={{ position:'fixed', left:'50%', transform:'translateX(-50%)', width:'min(406px, calc(100vw - 24px))', bottom:'calc(96px + var(--safe-bottom))', zIndex:30, background:'#fff', border:'1px solid #FEE2E2', borderRadius:20, padding:16, boxShadow:'0 24px 48px -24px rgba(15,23,42,.45)', maxHeight:'62vh', overflowY:'auto' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:32, height:32, borderRadius:'50%', background:'#FEF2F2', color:'#DC2626', display:'grid', placeItems:'center' }}><Siren size={16}/></span>
        <b style={{ flex:1, fontSize:15, color:'#DC2626' }}>Emergency</b>
        {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={15}/></button>}
      </div>
      {emerError && <p data-testid="notice" style={{ fontSize:11.5, color:'var(--muted-ink)', margin:'8px 0 0' }}>Live lookup unavailable — showing saved hotlines.</p>}
      {group('Hospitals', Cross, (emer && emer.hospitals) || [])}
      {group('Police', Shield, (emer && emer.police) || [])}
      {group('Hotlines', Phone, hotlines)}
    </aside>
  );
}
