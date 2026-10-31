import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { saveFavorite, postReview, flushOutbox, listPlaceReviews, localReviews } from '../store.js';
const _localReviews = localReviews; // kept for offline fallback when supabase absent
import { haversineKm, formatDistance } from '../geo.js';
import { Chip, PrimaryBtn } from '../ui.jsx';

export default function SpotPopup({ spot, coords, pop, showToast, user }){
  const [slide, setSlide] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [score, setScore] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const trackRef = useRef(null);
  const photos = (spot.photos && spot.photos.length) ? spot.photos : null;
  const count = photos ? photos.length : 3; // reserved placeholder dots
  const km = haversineKm(coords.lng, coords.lat, spot.lng, spot.lat);

  useEffect(() => {
    listPlaceReviews(spot.name)
      .then(setReviews)
      .catch(() => setReviews(_localReviews(spot.id)));
  }, [spot.name]); // eslint-disable-line react-hooks/exhaustive-deps
  function goTo(i){
    setSlide(i);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior:'smooth' });
  }
  async function submitReview(){
    if (!text.trim()) return;
    setBusy(true);
    const res = await postReview(user, spot, score, text.trim());
    if (res.queued) {
      setReviews(r => [{ id:'local-' + Date.now(), score, text:text.trim(), created_at:new Date().toISOString() }, ...r]); // optimistic, syncs via outbox later
      showToast('Review saved on device — syncs when online');
    } else {
      showToast('Thanks for reviewing!');
      flushOutbox(user).catch(() => {});
    }
    setText('');
    setBusy(false);
  }
  function stars(n){ return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)); }
  return (
    <aside className="spot-sheet" data-testid="spot-sheet" role="dialog" aria-label={spot.name}>
      <div className="grab-handle" aria-hidden="true"/>
      <button data-testid="close-spot" onClick={pop} aria-label="Close" style={{ position:'absolute', right:14, top:16, width:32, height:32, borderRadius:'50%', border:'1px solid var(--border)', background:'#fff', zIndex:2 }}>✕</button>
      <div style={{ position:'relative', height:210 }}>
        <div ref={trackRef} onScroll={e => { const i = Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)); if (i !== slide) setSlide(i); }} style={{ display:'flex', overflowX:'auto', scrollSnapType:'x mandatory', height:'100%', scrollbarWidth:'none' }}>
          {(photos || [0, 1, 2]).map((src, i) => (
            <div key={i} style={{ flex:'0 0 100%', scrollSnapAlign:'center', position:'relative' }}>
              {photos
                ? <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <PlaceholderTile/>}
            </div>
          ))}
        </div>
        <span data-testid="photo-count" className="chip" style={{ position:'absolute', right:12, bottom:12, fontSize:11 }}>📷 {photos ? photos.length : 0} Photos</span>
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:8, display:'flex', gap:5 }}>
          {Array.from({ length: count }, (_, i) => <button key={i} aria-label={'Slide ' + (i + 1)} onClick={() => goTo(i)} style={{ width:7, height:7, borderRadius:'50%', border:'none', background:i === slide ? '#fff' : 'rgba(255,255,255,.45)', padding:0 }}/>)}
        </div>
      </div>
      {photos && photos.length > 1 && (
        <div style={{ display:'flex', gap:6, padding:'10px 16px 0', overflowX:'auto' }}>
          {photos.map((src, i) => (
            <button key={i} onClick={() => goTo(i)} style={{ flex:'0 0 56px', height:44, borderRadius:10, border:'2px solid ' + (i === slide ? 'var(--primary)' : 'transparent'), padding:0, overflow:'hidden', background:'var(--chip)' }}>
              <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            </button>
          ))}
        </div>
      )}
      <div style={{ padding:'10px 16px' }}>
        <h3 style={{ margin:'0 0 2px' }}>{spot.name}</h3>
        <p style={{ fontSize:13, color:'var(--muted-ink)', margin:0 }}>📍 {spot.town}, District {spot.district}{km != null ? ' · ' + formatDistance(km) : ''}</p>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', margin:'8px 0 12px' }}>
          {(spot.categories || []).map(c => <Chip key={c}>{c}</Chip>)}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="chip" data-testid="spot-directions" style={{ flex:1, padding:12 }} onClick={() => window.open('https://www.google.com/maps/dir/?api=1&destination=' + spot.lat + ',' + spot.lng)}>🧭 Directions</button>
          <div style={{ flex:1 }}><PrimaryBtn testid="spot-save" onClick={async () => {
            const res = await saveFavorite(user, spot);
            showToast(res.error ? 'Sign in to save' : 'Added to Saved', res.error ? 'error' : 'ok');
          }}>⊕ Save to Trip</PrimaryBtn></div>
        </div>
        {spot.blurb && <p style={{ fontSize:13, marginTop:10 }}>{spot.blurb}</p>}
        <h4 style={{ margin:'14px 0 8px' }}>Reviews</h4>
        <div style={{ display:'grid', gap:8, marginBottom:12 }}>
          {reviews.length ? reviews.map(r => (
            <div key={r.id} style={{ border:'1px solid var(--border)', borderRadius:14, padding:'10px 12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <b>{stars(r.score)}</b>
                <span style={{ color:'var(--muted-ink)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : 'just now'}</span>
              </div>
              {r.text && <p style={{ fontSize:13, margin:'4px 0 0' }}>{r.text}</p>}
            </div>
          )) : <p style={{ fontSize:13, color:'var(--muted-ink)' }}>No reviews yet — be the first!</p>}
        </div>
        <div data-testid="review-form" style={{ border:'1px solid var(--border)', borderRadius:16, padding:12 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ fontSize:12, fontWeight:600 }}>Score</label>
            <select data-testid="review-score" value={score} onChange={e => setScore(Number(e.target.value))} style={{ width:120 }}>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </div>
          <textarea data-testid="review-text" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Share what it was like…" style={{ marginTop:8 }}/>
          <div style={{ marginTop:8 }}><PrimaryBtn testid="review-send" disabled={busy || !text.trim()} onClick={submitReview}>{busy ? 'Posting…' : 'Post Review'}</PrimaryBtn></div>
        </div>
      </div>
    </aside>
  );
}

function PlaceholderTile(){
  return (
    <div aria-hidden="true" style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#2280E8,#0A3D8F)', display:'grid', placeItems:'center', textAlign:'center' }}>
      <div style={{ color:'#fff' }}>
        <div style={{ fontSize:30 }}>🏔</div>
        <div style={{ fontSize:12, opacity:.9, marginTop:4 }}>Photo coming soon</div>
      </div>
    </div>
  );
}
