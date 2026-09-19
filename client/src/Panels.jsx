import { useEffect, useState } from 'react';
import { recommend } from './api.js';

const BASE = import.meta.env.VITE_API_URL || '';

export function NearbyButton({ onResults, onNotice }){
  function nearby(){
    if (!('geolocation' in navigator)) {
      onNotice('GPS unavailable — showing Pangasinan');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => recommend('nearby attractions and restaurants', `${pos.coords.longitude},${pos.coords.latitude}`).then(onResults).catch(e => onNotice(e.message)),
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
  const { reviews, add } = useReviews(place.id);
  const [score, setScore] = useState(5);
  const [text, setText] = useState('');
  return (
    <section>
      <h4>Reviews: {place.name}</h4>
      <form data-testid="review-form" onSubmit={e => { e.preventDefault(); add(Number(score), text); setText(''); }}>
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
export function EmergencyPanel(){
  const [emer, setEmer] = useState(null);
  const [emerError, setEmerError] = useState('');
  useEffect(() => {
    fetch(`${BASE}/api/emergency?proximity=120.23,16.03`)
      .then(r => { if (!r.ok) throw new Error('emergency lookup failed'); return r.json(); })
      .then(setEmer)
      .catch(e => setEmerError(e.message));
  }, []);
  const hotlines = (emer && emer.hotlines && emer.hotlines.length) ? emer.hotlines : FALLBACK_HOTLINES;
  return (
    <section data-testid="emergency-panel">
      <h2>Emergency</h2>
      {emerError && <p data-testid="notice">{emerError} — showing hotlines.</p>}
      <h3>Hospitals</h3>
      <ul>{((emer && emer.hospitals) || []).map(h => <li key={h.id}>{h.name} — {h.address}</li>)}</ul>
      <h3>Police</h3>
      <ul>{((emer && emer.police) || []).map(p => <li key={p.id}>{p.name} — {p.address}</li>)}</ul>
      <h3>Hotlines</h3>
      <ul>{hotlines.map(h => <li key={h.name}>{h.name}: {h.number}</li>)}</ul>
    </section>
  );
}
