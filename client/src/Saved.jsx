import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { listFavorites, listHistory, postReview, flushOutbox } from './store.js';
import Login from './Login.jsx';
export default function Saved(){
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState('favorites');
  const [rows, setRows] = useState([]);
  const [authError, setAuthError] = useState('');
  function isAuthError(e){
    return /401|jwt|expired|session|unauthorized/i.test(String((e && e.message) || e || ''));
  }
  useEffect(() => {
    if (!user) return;
    setAuthError('');
    try { flushOutbox(user).catch(() => {}); } catch {}
    function onOnline(){ try { flushOutbox(user).catch(() => {}); } catch {} }
    window.addEventListener('online', onOnline);
    if (tab === 'favorites') {
      listFavorites(user).then(({ data, error }) => {
        if (error && isAuthError(error)) setAuthError('Session expired — log in again.');
        else setRows(data || []);
      });
    } else if (tab === 'history') {
      listHistory(user).then(
        rows => setRows(rows || []),
        err => { if (isAuthError(err)) setAuthError('Session expired — log in again.'); }
      );
    } else {
      setRows([]);
    }
    return () => window.removeEventListener('online', onOnline);
  }, [user, tab]);
  if (!loading && !user) return <Login />;
  if (authError) return <p data-testid="notice">{authError}</p>;
  async function importLocal(){
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('lakbai-reviews:')) continue;
      const placeId = k.split(':')[1];
      if (localStorage.getItem('lakbai-imported:' + placeId)) continue;
      let items = [];
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (Array.isArray(v)) items = v;
      } catch { continue; }
      for (const r of items) {
        await postReview(user, { id: placeId, name: r.placeName || placeId }, r.score, r.text);
      }
      localStorage.setItem('lakbai-imported:' + placeId, '1');
    }
  }
  return (
    <section>
      <p data-testid="saved-user">Signed in as {user.email} <button onClick={signOut}>Sign out</button></p>
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
