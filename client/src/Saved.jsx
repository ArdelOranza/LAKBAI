import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { listFavorites, listHistory, postReview } from './store.js';
import Login from './Login.jsx';
export default function Saved(){
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('favorites');
  const [rows, setRows] = useState([]);
  const [sessionBad, setSessionBad] = useState(false);
  useEffect(() => {
    if (!user) return;
    setSessionBad(false);
    if (tab === 'favorites') {
      listFavorites(user).then(({ data, error }) => {
        if (error && String(error.message || error).toLowerCase().includes('session')) setSessionBad(true);
        else setRows(data || []);
      });
    } else if (tab === 'history') {
      listHistory(user).then(setRows);
    } else {
      setRows([]);
    }
  }, [user, tab]);
  if (!loading && !user) return <Login />;
  if (sessionBad) return <p data-testid="notice">Session expired — log in again.</p>;
  async function importLocal(){
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('lakbai-reviews:')) {
        const placeId = k.split(':')[1];
        for (const r of JSON.parse(localStorage.getItem(k))) {
          await postReview(user, { id: placeId, name: placeId }, r.score, r.text);
        }
      }
    }
  }
  return (
    <section>
      <button onClick={() => setTab('favorites')}>Favorites</button>
      <button onClick={() => setTab('reviews')}>Reviews</button>
      <button onClick={() => setTab('history')}>History</button>
      {tab === 'reviews' && <button data-testid="review-import" onClick={importLocal}>Import local reviews</button>}
      {!rows.length
        ? <p data-testid="saved-empty">Nothing saved yet.</p>
        : <ul data-testid="saved-list">{rows.map(r => <li key={r.id || r.query}>{r.name || r.query}</li>)}</ul>}
    </section>
  );
}
