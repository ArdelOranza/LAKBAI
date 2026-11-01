import { useEffect, useState } from 'react';
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
