import { useEffect, useRef, useState } from 'react';
import {
  Waves, UtensilsCrossed, Mountain, Landmark, Sparkles, Car, Camera, Maximize2,
  Star, MapPin, Navigation, CirclePlus, CircleCheck, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { saveFavorite, listFavorites } from '../store.js';
import { haversineKm, formatDistance, driveMinutes } from '../geo.js';
import { dragOffset, shouldDismiss } from '../sheetDrag.js';
import { FALLBACK_CENTER } from '../App.jsx';
import { directionsHref } from '../emergency.js';
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

export default function SpotPopup({ spot, coords, pop, push, showToast, user, setTab }){
  const { user: authUser } = useAuth();
  const u = user || authUser;
  const [slide, setSlide] = useState(0);
  const [saved, setSaved] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const dragYRef = useRef(0);
  const trackRef = useRef(null);
  const photos = (spot.photos && spot.photos.length) ? spot.photos : null;
  const count = photos ? photos.length : 3; // reserved placeholder dots
  // Distance is only meaningful with a real fix — measuring from the fallback
  // centre fabricates drive times when location permission is off.
  const hasFix = coords && !(coords.lng === FALLBACK_CENTER.lng && coords.lat === FALLBACK_CENTER.lat);
  const km = hasFix ? haversineKm(coords.lng, coords.lat, spot.lng, spot.lat) : null;
  const minutes = driveMinutes(km);
  const vibe = vibeFor(spot);

  useEffect(() => {
    let alive = true;
    listFavorites(u).then(r => { if (alive) setSaved((r.data || []).some(f => f.place_id === spot.id)); });
    return () => { alive = false; };
  }, [spot.id, u?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rating = typeof spot.rating === 'number' ? spot.rating : null;
  const reviewCount = typeof spot.reviews === 'number' ? spot.reviews : 0;

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
  function setDrag(v){
    dragYRef.current = v;
    setDragY(v);
  }
  function grabDown(e){
    dragStart.current = e.clientY;
    setDragging(true);
    setDrag(0);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* older Safari */ }
  }
  function grabMove(e){
    if (dragStart.current == null) return;
    setDrag(dragOffset(dragStart.current, e.clientY));
  }
  function grabEnd(){
    if (dragStart.current == null) return;
    const dy = dragYRef.current;
    dragStart.current = null;
    setDragging(false);
    if (shouldDismiss(dy)) { pop(); return; }
    setDrag(0);
    if (dy < 5) pop(); // a tap on the handle still closes the sheet
  }
  return (
    <aside
      className="spot-sheet"
      data-testid="spot-sheet"
      role="dialog"
      aria-label={spot.name}
      style={{
        transform:`translate(-50%, ${dragY}px)`,
        transition: dragging ? 'none' : 'transform .22s ease',
      }}
    >
      <button
        className="grab-btn"
        data-testid="close-spot"
        aria-label="Close sheet"
        onPointerDown={grabDown}
        onPointerMove={grabMove}
        onPointerUp={grabEnd}
        onPointerCancel={grabEnd}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pop(); } }}
        style={{ touchAction:'none', cursor:'grab' }}
      />

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
          <div ref={trackRef} onScroll={e => { const i = Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)); if (i !== slide) setSlide(i); }} style={{ display:'flex', overflowX:'auto', scrollSnapType:'x mandatory', height:112, scrollbarWidth:'none' }}>
            {(photos || [0, 1, 2]).map((src, i) => (
              <div key={i} style={{ flex:'0 0 100%', scrollSnapAlign:'center', position:'relative' }}>
                {photos
                  ? <img src={src} alt={spot.name} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
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

        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginTop:8 }}>
          <h3 style={{ margin:0, flex:1, minWidth:0, fontSize:18, fontWeight:800, letterSpacing:'-.5px', lineHeight:1.25 }}>{spot.name}</h3>
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

        <p style={{ margin:'6px 0 0', fontSize:12.5, lineHeight:1.5, color:'#475569', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {spot.blurb || `A curated ${String((spot.categories && spot.categories.length) ? spot.categories[0] : 'local').toLowerCase()} stop in ${spot.town || 'Pangasinan'} — save it and let LakbAI sequence your day around it.`}
        </p>

        <div style={{ margin:'10px 0 2px' }}>
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
                disabled={!directionsHref(spot.lat, spot.lng)}
                onClick={() => { const href = directionsHref(spot.lat, spot.lng); if (href) window.open(href); }}
              >
                <Navigation size={17}/>
              </button>
              <div style={{ flex:1 }}>
                <PrimaryBtn testid="spot-save" onClick={saveTrip}><CirclePlus size={18}/> Save to Trip</PrimaryBtn>
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:6, flexWrap:'wrap', margin:'8px 0 0' }}>
          {(spot.categories || []).map(c => <span key={c} className="tag">{c}</span>)}
        </div>

        <button
          data-testid="spot-details"
          onClick={() => { pop(); push({ name: 'detail', place: spot }); }}
          style={{ marginTop:10, width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, background:'#F7F9FC', border:'1px solid #EDF1F7', borderRadius:12, padding:'11px 13px', fontSize:12.5, fontWeight:600, color:'var(--ink)' }}
        >
          <span>Reviews, hours &amp; full details</span>
          <ArrowRight size={15} color="var(--primary)"/>
        </button>
      </div>
    </aside>
  );
}
