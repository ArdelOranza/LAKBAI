import { useEffect, useRef, useState } from 'react';
import {
  Waves, UtensilsCrossed, Mountain, Landmark, Sparkles, Car, Camera, Maximize2,
  Star, MapPin, Navigation, CirclePlus, CircleCheck, Send,
} from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { saveFavorite, postReview, flushOutbox, listPlaceReviews, listFavorites, localReviews } from '../store.js';
const _localReviews = localReviews; // kept for offline fallback when supabase absent
import { haversineKm, formatDistance, driveMinutes } from '../geo.js';
import { PrimaryBtn, PhotoPlaceholder } from '../ui.jsx';

const VIBES = [
  [/beach|coast|island|sea|shore/i, 'Coastal Wonder', Waves],
  [/food|dining|restaurant|cafe|grill|market|eat/i, 'Local Flavor', UtensilsCrossed],
  [/festival|event|fiesta/i, 'Festival Pick', Landmark],
  [/nature|waterfall|mountain|hike|camp|forest|river/i, 'Nature Escape', Mountain],
  [/histor|cultur|museum|church|heritage/i, 'Heritage Stop', Landmark],
];
function vibeFor(spot){
  const hay = [spot.name, spot.blurb, ...(spot.categories || [])].join(' ');
  const hit = VIBES.find(([re]) => re.test(hay));
  return hit ? { label: hit[1], Icon: hit[2] } : { label: 'Hidden Gem', Icon: Sparkles };
}

function StarRow({ score }){
  return (
    <span style={{ display:'inline-flex', gap:1.5, color:'var(--primary)' }} aria-label={`${score} out of 5 stars`}>
      {[1,2,3,4,5].map(n => <Star key={n} size={12} fill={n <= score ? 'currentColor' : 'none'} strokeWidth={1.8}/>)}
    </span>
  );
}

export default function SpotPopup({ spot, coords, pop, push, showToast, user, setTab }){
  const { user: authUser } = useAuth();
  const u = user || authUser;
  const [slide, setSlide] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [score, setScore] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const trackRef = useRef(null);
  const photos = (spot.photos && spot.photos.length) ? spot.photos : null;
  const count = photos ? photos.length : 3; // reserved placeholder dots
  const km = haversineKm(coords.lng, coords.lat, spot.lng, spot.lat);
  const minutes = driveMinutes(km);
  const vibe = vibeFor(spot);

  useEffect(() => {
    listPlaceReviews(spot.name)
      .then(setReviews)
      .catch(() => setReviews(_localReviews(spot.id)));
  }, [spot.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    listFavorites(u).then(r => { if (alive) setSaved((r.data || []).some(f => f.place_id === spot.id)); });
    return () => { alive = false; };
  }, [spot.id, u?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.score, 0) / reviews.length : null;
  const rating = typeof spot.rating === 'number' ? spot.rating : avg;
  const reviewCount = typeof spot.reviews === 'number' ? spot.reviews : reviews.length;

  function goTo(i){
    setSlide(i);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior:'smooth' });
  }
  async function saveTrip(){
    const res = await saveFavorite(u, spot);
    if (res.error) { showToast('Sign in to save', 'error'); return; }
    setSaved(true);
    showToast('Added to Trip');
  }
  async function submitReview(){
    if (!text.trim()) return;
    setBusy(true);
    const res = await postReview(u, spot, score, text.trim());
    if (res.queued) {
      setReviews(r => [{ id:'local-' + Date.now(), score, text:text.trim(), created_at:new Date().toISOString() }, ...r]); // optimistic, syncs via outbox later
      showToast('Review saved on device — syncs when online');
    } else {
      showToast('Thanks for reviewing!');
      flushOutbox(u).catch(() => {});
    }
    setText('');
    setBusy(false);
  }

  return (
    <aside className="spot-sheet" data-testid="spot-sheet" role="dialog" aria-label={spot.name}>
      <button className="grab-btn" data-testid="close-spot" onClick={pop} aria-label="Close sheet"/>

      <div className="spot-scroll">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'#E7F0FE', color:'var(--primary)', borderRadius:999, padding:'5px 11px', fontSize:9.5, fontWeight:800, letterSpacing:.9, textTransform:'uppercase' }}>
            <vibe.Icon size={11}/> {vibe.label}
          </span>
          {km != null && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--ink)', fontWeight:600 }}>
              <Car size={14} color="var(--muted-ink)"/> {formatDistance(km)} • {minutes} min
            </span>
          )}
        </div>

        <div style={{ position:'relative', borderRadius:16, overflow:'hidden', background:'#EDF1F7' }}>
          <div ref={trackRef} onScroll={e => { const i = Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)); if (i !== slide) setSlide(i); }} style={{ display:'flex', overflowX:'auto', scrollSnapType:'x mandatory', height:158, scrollbarWidth:'none' }}>
            {(photos || [0, 1, 2]).map((src, i) => (
              <div key={i} style={{ flex:'0 0 100%', scrollSnapAlign:'center', position:'relative' }}>
                {photos
                  ? <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <PhotoPlaceholder size={30}/>}
              </div>
            ))}
          </div>

          {photos && (
            <span data-testid="photo-count" style={{ position:'absolute', left:10, bottom:10, display:'inline-flex', alignItems:'center', gap:5, background:'rgba(10,37,64,.62)', color:'#fff', borderRadius:8, padding:'4px 9px', fontSize:10.5, fontWeight:600 }}>
              <Camera size={11}/> {photos.length} Photos
            </span>
          )}

          <button
            aria-label="Open full details"
            onClick={() => { pop(); push({ name:'detail', place: spot }); }}
            style={{ position:'absolute', right:10, bottom:10, width:34, height:34, borderRadius:'50%', background:'#fff', border:'none', color:'var(--ink)', display:'grid', placeItems:'center', padding:0, boxShadow:'0 4px 10px rgba(10,37,64,.18)' }}
          >
            <Maximize2 size={15}/>
          </button>

          {count > 1 && (
            <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:8, display:'flex', gap:5 }}>
              {Array.from({ length: count }, (_, i) => <button key={i} aria-label={'Slide ' + (i + 1)} onClick={() => goTo(i)} style={{ width:6, height:6, borderRadius:'50%', border:'none', background:i === slide ? '#fff' : 'rgba(255,255,255,.5)', padding:0 }}/>)}
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginTop:12 }}>
          <h3 style={{ margin:0, flex:1, minWidth:0, fontSize:20, fontWeight:800, letterSpacing:'-.5px', lineHeight:1.25 }}>{spot.name}</h3>
          {rating != null && (
            <div style={{ textAlign:'right', flex:'0 0 auto', paddingTop:2 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#F7F9FC', border:'1px solid #EDF1F7', borderRadius:999, padding:'3px 9px', fontSize:12.5, fontWeight:700 }}>
                <Star size={12} fill="var(--accent)" color="var(--accent)"/> {Number(rating).toFixed(1)}
              </span>
              {reviewCount > 0 && <div style={{ fontSize:10, color:'var(--muted-ink)', marginTop:3 }}>{reviewCount.toLocaleString()} reviews</div>}
            </div>
          )}
        </div>

        <p style={{ margin:'5px 0 0', fontSize:12.5, display:'flex', alignItems:'center', gap:5 }}>
          <MapPin size={13} color="var(--accent)"/>
          <span>{spot.address || [spot.town, 'Pangasinan'].filter(Boolean).join(', ')}</span>
        </p>

        <p style={{ margin:'9px 0 0', fontSize:13, lineHeight:1.55, color:'#475569' }}>
          {spot.blurb || `A curated ${(spot.categories || ['local'])[0].toLowerCase()} stop in ${spot.town || 'Pangasinan'} — save it and let LakbAI sequence your day around it.`}
        </p>

        <div style={{ margin:'14px 0 4px' }}>
          {saved ? (
            <div style={{ display:'grid', gap:8 }}>
              <button className="primary-btn" data-testid="spot-save" disabled style={{ background:'var(--primary)', opacity:1 }}>
                <CircleCheck size={18}/> Added to Trip
              </button>
              <button
                className="secondary-btn"
                onClick={() => { pop(); setTab && setTab('chat'); }}
              >
                Ask LakbAI
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <button
                className="round-action"
                data-testid="spot-directions"
                aria-label="Directions"
                onClick={() => window.open('https://www.google.com/maps/dir/?api=1&destination=' + spot.lat + ',' + spot.lng)}
              >
                <Navigation size={17}/>
              </button>
              <div style={{ flex:1 }}>
                <PrimaryBtn testid="spot-save" onClick={saveTrip}><CirclePlus size={18}/> Save to Trip</PrimaryBtn>
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:6, flexWrap:'wrap', margin:'12px 0 2px' }}>
          {(spot.categories || []).map(c => <span key={c} className="tag">{c}</span>)}
        </div>

        <div style={{ borderTop:'1px solid #EDF1F7', margin:'14px 0 0', paddingTop:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <b style={{ fontSize:13.5 }}>Reviews</b>
            {reviews.length > 0 && <span style={{ fontSize:11, color:'var(--muted-ink)' }}>{reviews.length} from travelers</span>}
          </div>

          <div style={{ display:'grid', gap:8 }}>
            {reviews.length ? reviews.map(r => (
              <div key={r.id} style={{ background:'#F7F9FC', border:'1px solid #EDF1F7', borderRadius:12, padding:'9px 11px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                  <StarRow score={r.score}/>
                  <span style={{ color:'var(--muted-ink)', fontSize:10.5 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : 'just now'}</span>
                </div>
                {r.text && <p style={{ fontSize:12.5, margin:'5px 0 0', color:'#475569' }}>{r.text}</p>}
              </div>
            )) : <p style={{ fontSize:12.5, color:'var(--muted-ink)', margin:0 }}>No reviews yet — be the first!</p>}
          </div>

          <div data-testid="review-form" style={{ marginTop:10, border:'1px solid #EDF1F7', borderRadius:14, padding:11 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <label style={{ fontSize:11.5, fontWeight:600, color:'var(--muted-ink)' }}>Your score</label>
              <select data-testid="review-score" value={score} onChange={e => setScore(Number(e.target.value))} style={{ width:96, padding:'7px 9px', borderRadius:10, fontSize:12.5 }}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <textarea data-testid="review-text" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Share what it was like…" style={{ marginTop:8, fontSize:13 }}/>
            <button data-testid="review-send" className="primary-btn" disabled={busy || !text.trim()} onClick={submitReview} style={{ marginTop:8, minHeight:40, fontSize:13 }}>
              <Send size={14}/> {busy ? 'Posting…' : 'Post Review'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
