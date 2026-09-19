import { useEffect, useState } from 'react';
import { itinerary, recommend } from './api.js';

const BASE = import.meta.env.VITE_API_URL || '';

export function ItineraryPanel({ selected }){
  const [hours, setHours] = useState(4);
  const [schedule, setSchedule] = useState([]);
  async function buildPlan(){
    const out = await itinerary(selected, Number(hours) || 4);
    setSchedule(out.schedule);
  }
  return (
    <section>
      <h2>Itinerary ({selected.length} stops)</h2>
      <input data-testid="hours-input" value={hours} onChange={e => setHours(e.target.value)} inputMode="numeric" aria-label="Available hours" />
      <button data-testid="itinerary-build" onClick={buildPlan}>Build</button>
      <ol>{schedule.map(s => <li key={s.placeId} data-testid="itinerary-item">{s.name} {s.arrive}–{s.depart}</li>)}</ol>
    </section>
  );
}

export function NearbyButton({ onResults, onNotice }){
  function nearby(){
    navigator.geolocation.getCurrentPosition(
      pos => recommend('nearby attractions and restaurants', `${pos.coords.longitude},${pos.coords.latitude}`).then(onResults).catch(e => onNotice(e.message)),
      () => onNotice('GPS unavailable — showing Pangasinan')
    );
  }
  return <button data-testid="nearby-btn" onClick={nearby}>Nearby</button>;
}

export function useReviews(placeId){
  const key = 'lakbai-reviews:' + placeId;
  const [reviews, setReviews] = useState(() => JSON.parse(localStorage.getItem(key) || '[]'));
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

export function EmergencyPanel(){
  const [emer, setEmer] = useState(null);
  useEffect(() => { fetch(`${BASE}/api/emergency?proximity=120.23,16.03`).then(r => r.json()).then(setEmer); }, []);
  if (!emer) return null;
  return (
    <section data-testid="emergency-panel">
      <h2>Emergency</h2>
      <h3>Hospitals</h3>
      <ul>{(emer.hospitals || []).map(h => <li key={h.id}>{h.name} — {h.address}</li>)}</ul>
      <h3>Police</h3>
      <ul>{(emer.police || []).map(p => <li key={p.id}>{p.name} — {p.address}</li>)}</ul>
      <h3>Hotlines</h3>
      <ul>{(emer.hotlines || []).map(h => <li key={h.name}>{h.name}: {h.number}</li>)}</ul>
    </section>
  );
}
