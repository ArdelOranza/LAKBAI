import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { postReview, flushOutbox } from './store.js';
import { recommend } from './api.js';

export function NearbyButton({ onResults, onNotice, onFix }){
  const [busy, setBusy] = useState(false);
  function nearby(){
    // 'geolocation' in navigator is true even when geolocation is null in some
    // environments — the method must exist and be callable.
    if (typeof navigator.geolocation?.getCurrentPosition !== 'function') {
      onNotice('GPS unavailable — showing Pangasinan');
      return;
    }
    if (busy) return; // one locate at a time: re-taps must not stack
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const at = `${pos.coords.longitude},${pos.coords.latitude}`;
        if (onFix) onFix(at);
        recommend('nearby attractions and restaurants', at)
          .then(out => { if (onResults) onResults(out); })
          .catch(e => onNotice(e.message))
          .finally(() => setBusy(false));
      },
      () => { setBusy(false); onNotice('GPS unavailable — showing Pangasinan'); },
      { timeout: 8000 }
    );
  }
  return (
    <button type="button" data-testid="nearby-btn" aria-busy={busy} disabled={busy} onClick={nearby}>
      {busy ? 'Locating…' : 'Nearby'}
    </button>
  );
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
  const [reviews, setReviews] = useState(() => (placeId ? readReviews(key) : []));
  useEffect(() => {
    setReviews(placeId ? readReviews('lakbai-reviews:' + placeId) : []);
  }, [placeId]);
  function add(score, text){
    if (!placeId) return;
    setReviews(prev => {
      const next = [...prev, { score: Number(score), text: String(text ?? ''), at: Date.now() }];
      try { localStorage.setItem('lakbai-reviews:' + placeId, JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
  }
  return { reviews, add };
}

export function Reviews({ place }){
  const { user } = useAuth();
  const placeId = place?.id ?? null;
  const { reviews, add } = useReviews(placeId);
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
  if (!place?.id) return null;
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
      {reviews.length === 0 ? <p>No reviews yet — be the first.</p> : <ul>{reviews.map((r, i) => <li key={i} data-testid="review-item">{r.score}/5 — {r.text}</li>)}</ul>}
    </section>
  );
}
