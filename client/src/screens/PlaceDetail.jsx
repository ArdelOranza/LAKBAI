import { useEffect, useState } from 'react';
import {
  ArrowLeft, Share2, Heart, Camera, MapPin, Star, Navigation, CirclePlus, CircleCheck,
  Clock, CircleParking, Waves, UtensilsCrossed, Music, Mountain, Landmark, Sparkles, User,
} from 'lucide-react';
import { saveFavorite, removeFavorite, listFavorites, listPlaceReviews } from '../store.js';
import { placeImage, mapboxToken } from '../staticMap.js';
import { useAuth } from '../AuthContext.jsx';
import { dateRange, bannerDate } from '../festival.js';
import { feeLabel } from '../filters.js';
import { haversineKm, formatDistance } from '../geo.js';
import { PhotoPlaceholder } from '../ui.jsx';
import { safeExternalUrl, openExternal } from '../extLinks.js';

const CAT_ICON = [
  [/beach|coast|island|sea|shore/i, Waves],
  [/food|dining|restaurant|cafe|grill|market/i, UtensilsCrossed],
  [/festival|event|fiesta|cultur|music/i, Music],
  [/nature|waterfall|mountain|hike|camp|forest|river/i, Mountain],
  [/histor|heritage|church|museum/i, Landmark],
];
const iconFor = text => (CAT_ICON.find(([re]) => re.test(text)) || [null, Sparkles])[1];
const isFree = fees => fees === 0 || /free|none|no fee|₱?0\b/i.test(String(fees ?? ''));
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function editionText(a, b){
  const left = MONTHS[a.getMonth()] + ' ' + a.getDate();
  if (!b || b.getTime() === a.getTime()) return left;
  return left + ' – ' + MONTHS[b.getMonth()] + ' ' + b.getDate();
}

export default function PlaceDetail({ place, coords, user, pop, showToast }){
  const { user: authUser } = useAuth();
  const u = user || authUser;
  const p = place || {};
  const [saved, setSaved] = useState(false);
  const [reviews, setReviews] = useState([]);
  const km = haversineKm(coords.lng, coords.lat, p.lng, p.lat);
  const photos = (p.photos && p.photos.length) ? p.photos : (p.photo ? [p.photo] : null);
  // U14-A: a place that only has a location still gets a real image — its static map.
  const heroPhoto = placeImage(p, mapboxToken(), { width: 600, height: 340 });
  const when = bannerDate(p)
    || (p.festival ? dateRange(p.festival) : null)
    || (p.starts instanceof Date ? editionText(p.starts, p.ends) : null);

  useEffect(() => {
    let alive = true;
    listFavorites(u).then(r => { if (alive) setSaved((r.data || []).some(f => f.place_id === p.id)); });
    listPlaceReviews(p.name).then(rs => { if (alive) setReviews(rs || []); }).catch(() => {});
    return () => { alive = false; };
  }, [p.id, u?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewCount = typeof p.reviews === 'number' ? p.reviews : reviews.length;
  const rating = typeof p.rating === 'number' ? p.rating
    : (reviews.length ? reviews.reduce((a, r) => a + r.score, 0) / reviews.length : null);
  const distribution = [5, 4, 3, 2, 1].map(n => {
    const n_ = reviews.filter(r => Math.round(r.score) === n).length;
    return { n, pct: reviews.length ? Math.round((n_ / reviews.length) * 100) : 0 };
  });
  const topTag = rating != null && rating >= 4.5 && (p.categories || [])[0]
    ? 'Top Rated ' + String(p.categories[0]).replace(/\s*&\s*.*$/, '')
    : null;

  async function toggleSave(){
    const res = saved ? await removeFavorite(u, p.id) : await saveFavorite(u, p);
    if (res.error) { showToast('Sign in to save', 'error'); return; }
    setSaved(s => !s);
    showToast(saved ? 'Removed from Trip' : 'Added to Trip');
  }
  async function share(){
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: p.name, url }); return; }
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    } catch { /* user cancelled the share sheet */ }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', background:'#fff' }}>
      <div style={{ position:'relative', height:250 }}>
        {heroPhoto
          ? <img data-testid="hero-photo" src={heroPhoto} alt={p.name} onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <PhotoPlaceholder size={34} label="Photo coming soon"/>}

        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back" style={{ position:'absolute', left:14, top:14, background:'#fff' }}><ArrowLeft size={18}/></button>
        <div style={{ position:'absolute', right:14, top:14, display:'flex', gap:8 }}>
          <button className="icon-btn" onClick={share} aria-label="Share" style={{ background:'#fff' }}><Share2 size={16}/></button>
          <button className="icon-btn" onClick={toggleSave} aria-label={saved ? 'Remove from trip' : 'Save to trip'} style={{ background:'#fff', color:saved ? '#DC2626' : 'var(--ink)' }}>
            <Heart size={16} fill={saved ? 'currentColor' : 'none'}/>
          </button>
        </div>

        {photos && (
          <span data-testid="photo-count" style={{ position:'absolute', left:14, bottom:14, display:'inline-flex', alignItems:'center', gap:5, background:'rgba(10,37,64,.62)', color:'#fff', borderRadius:8, padding:'4px 9px', fontSize:10.5, fontWeight:600 }}>
            <Camera size={11}/> {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
          </span>
        )}
      </div>

      <div className="pane" style={{ marginTop:14, paddingBottom:28 }}>
        {when && (
          <span style={{ display:'inline-flex', alignItems:'center', background:'#E7F0FE', color:'var(--primary)', borderRadius:999, padding:'4px 11px', fontSize:10.5, fontWeight:800, letterSpacing:.6, textTransform:'uppercase', marginBottom:7 }}>
            {when}
          </span>
        )}

        <h1 style={{ margin:0, fontSize:24, letterSpacing:'-.7px', lineHeight:1.2 }}>{p.name}</h1>

        <p style={{ margin:'5px 0 0', fontSize:12.5, color:'var(--ink)', display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
          <MapPin size={13} color="var(--accent)"/>
          <span>{p.address || (p.hint ? p.hint + ', Pangasinan' : [p.town, 'Pangasinan'].filter(Boolean).join(', '))}</span>
          {km != null && <span style={{ color:'var(--muted-ink)' }}>• {formatDistance(km)} away</span>}
        </p>

        {(rating != null || topTag) && (
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginTop:9 }}>
            {rating != null && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12.5, fontWeight:700 }}>
                <Star size={13} fill="var(--accent)" color="var(--accent)"/>
                {Number(rating).toFixed(1)}
                {reviewCount > 0 && <span style={{ fontWeight:500, color:'var(--muted-ink)', fontSize:11.5 }}>({reviewCount.toLocaleString()} reviews)</span>}
              </span>
            )}
            {topTag && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#E7F0FE', color:'var(--primary)', borderRadius:999, padding:'4px 10px', fontSize:10.5, fontWeight:700 }}>
                <Sparkles size={10}/> {topTag}
              </span>
            )}
          </div>
        )}

        <div style={{ display:'flex', gap:10, marginTop:14 }}>
          <button
            className="chip"
            data-testid="directions-btn"
            style={{ flex:1, padding:12, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, fontWeight:600 }}
            onClick={() => openExternal('https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng)}
          >
            <Navigation size={15}/> Directions
          </button>
          <button
            data-testid="save-trip-btn"
            onClick={toggleSave}
            style={{ flex:1, minHeight:46, borderRadius:999, border:'none', background:saved ? 'var(--primary-strong)' : 'var(--primary)', color:'#fff', fontWeight:600, fontSize:14, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, boxShadow:'0 8px 20px -10px rgba(22,103,217,.6)' }}
          >
            {saved ? <CircleCheck size={17}/> : <CirclePlus size={17}/>} {saved ? 'Added to Trip' : 'Save to Trip'}
          </button>
        </div>

        <section style={{ marginTop:16, border:'1px solid #EDF1F7', borderRadius:16, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <b style={{ fontSize:14.5 }}>About the Destination</b>
            {p.fees != null && (
              <span style={{ fontSize:10, fontWeight:800, letterSpacing:.7, color: isFree(p.fees) ? 'var(--primary)' : 'var(--muted-ink)', textTransform:'uppercase' }}>
                {isFree(p.fees) ? 'Free Entry' : feeLabel(p.fees)}
              </span>
            )}
          </div>
          <p style={{ margin:'9px 0 0', fontSize:13, lineHeight:1.6, color:'#475569' }}>
            {p.blurb || p.description || p.reason || p.peopleSay || `A stop in Pangasinan — details coming from guides and visitor reviews.`}
          </p>
          {(p.fees != null || when || p.dateLabel) && (
            <div style={{ display:'flex', gap:16, marginTop:12, flexWrap:'wrap' }}>
              {p.fees != null && !isFree(p.fees) && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--muted-ink)' }}>
                  <CircleParking size={13}/> {feeLabel(p.fees)}
                </span>
              )}
              {(p.dateLabel || when) && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--muted-ink)' }}>
                  <Clock size={13}/> {when || p.dateLabel}
                </span>
              )}
            </div>
          )}
        </section>

        {(p.whatToDo || []).length > 0 && (
          <section style={{ marginTop:16, border:'1px solid #EDF1F7', borderRadius:16, padding:14 }}>
            <b style={{ fontSize:14.5 }}>What to Do</b>
            <ul style={{ margin:'9px 0 0', paddingLeft:0, listStyle:'none', display:'grid', gap:8 }}>
              {p.whatToDo.map(item => (
                <li key={item} style={{ display:'flex', gap:8, fontSize:12.5, lineHeight:1.55, color:'#475569' }}>
                  <CircleCheck size={14} style={{ flex:'0 0 14px', marginTop:2, color:'var(--primary)' }}/>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(p.categories || []).length > 0 && (
          <section style={{ marginTop:16 }}>
            <b style={{ fontSize:14.5 }}>What to Expect</b>
            <div style={{ display:'flex', gap:10, marginTop:10, overflowX:'auto', scrollbarWidth:'none' }}>
              {(p.categories || []).slice(0, 3).map(c => {
                const Icon = iconFor(c);
                return (
                  <div key={c} style={{ flex:'0 0 104px', border:'1px solid #EDF1F7', borderRadius:14, padding:'14px 8px', display:'grid', placeItems:'center', gap:7, background:'#fff' }}>
                    <span style={{ width:34, height:34, borderRadius:'50%', background:'#EFF6FF', color:'var(--primary)', display:'grid', placeItems:'center' }}><Icon size={16}/></span>
                    <span style={{ fontSize:10.5, fontWeight:600, textAlign:'center', lineHeight:1.25 }}>{c}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {reviews.length > 0 && (
          <section style={{ marginTop:16, border:'1px solid #EDF1F7', borderRadius:16, padding:14 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
              <div>
                <b style={{ fontSize:14.5 }}>Guest Ratings</b>
                <p style={{ margin:'3px 0 0', fontSize:11, color:'var(--muted-ink)' }}>Based on {reviews.length} verified {reviews.length === 1 ? 'visit' : 'visits'}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:24, fontWeight:800, lineHeight:1, color:'var(--primary)' }}>{rating != null ? Number(rating).toFixed(1) : '—'}</div>
                <div style={{ display:'inline-flex', gap:1.5, marginTop:4, color:'var(--accent)' }}>
                  {[1,2,3,4,5].map(n => <Star key={n} size={11} fill={rating != null && n <= Math.round(rating) ? 'currentColor' : 'none'} strokeWidth={1.8}/>)}
                </div>
              </div>
            </div>
            <div style={{ display:'grid', gap:5, marginTop:12 }}>
              {distribution.map(d => (
                <div key={d.n} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10.5, color:'var(--muted-ink)', width:8 }}>{d.n}</span>
                  <span style={{ flex:1, height:6, borderRadius:999, background:'#EFF2F7', overflow:'hidden' }}>
                    <span style={{ display:'block', height:'100%', width:d.pct + '%', background:'var(--primary)', borderRadius:999 }}/>
                  </span>
                  <span style={{ fontSize:10, color:'var(--muted-ink)', width:30, textAlign:'right' }}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginTop:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <b style={{ fontSize:14.5 }}>Reviews {reviews.length ? `(${reviews.length})` : ''}</b>
          </div>
          <div style={{ display:'grid', gap:10, marginTop:10 }}>
            {reviews.length ? reviews.slice(0, 8).map(r => (
              <article key={r.id} style={{ border:'1px solid #EDF1F7', borderRadius:14, padding:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <span style={{ width:32, height:32, minWidth:32, borderRadius:'50%', background:'#EFF2F7', color:'#94A3B8', display:'grid', placeItems:'center' }}><User size={15}/></span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <b style={{ fontSize:12.5, display:'block' }}>Traveler</b>
                    <span style={{ fontSize:10.5, color:'var(--muted-ink)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) : 'just now'}</span>
                  </div>
                  <span style={{ display:'inline-flex', gap:1.5, color:'var(--accent)' }}>
                    {[1,2,3,4,5].map(n => <Star key={n} size={11} fill={n <= r.score ? 'currentColor' : 'none'} strokeWidth={1.8}/>)}
                  </span>
                </div>
                {r.text && <p style={{ margin:'8px 0 0', fontSize:12.5, lineHeight:1.55, color:'#475569' }}>{r.text}</p>}
              </article>
            )) : <p style={{ fontSize:12.5, color:'var(--muted-ink)', margin:0 }}>No reviews yet — be the first to share what it was like.</p>}
          </div>
        </section>

        {(p.sources || []).length > 0 && (
          <section style={{ marginTop:16 }}>
            <div className="label" style={{ margin:'0 0 6px' }}>Sources</div>
            <ul style={{ fontSize:11.5, color:'var(--muted-ink)', margin:0, paddingLeft:18 }}>
              {p.sources.map(s => {
                const href = safeExternalUrl(s);
                const label = s.length > 60 ? s.slice(0, 60) + '…' : s;
                return (
                  <li key={s}>
                    {href
                      ? <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
                      : <span data-testid="source-inert">{label}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
