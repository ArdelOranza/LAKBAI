import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, MapPin, Radio } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { saveFavorite } from '../store.js';
import { upcomingFestivals, monthOrNextFestivals, FESTIVALS } from '../festivals.js';
import { haversineKm, formatDistance } from '../geo.js';
import { PhotoPlaceholder } from '../ui.jsx';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = 24 * 60 * 60 * 1000;

function happeningSoon(f, now){
  return f.starts - now <= 30 * DAY && f.ends >= now;
}

export default function Events({ coords, hasFix = true, push, pop, showToast }){
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [scope, setScope] = useState('All');

  const all = useMemo(() => upcomingFestivals(FESTIVALS, now), [now]);
  const month = useMemo(() => monthOrNextFestivals(FESTIVALS, now), [now]);
  const rows = scope === 'This Month' ? month.rows : all;
  const featured = rows[0] || null;
  const soon = featured ? happeningSoon(featured, now) : false;
  // Skip town seals and the generic provincial banner — they read as logos, not festival photos.
  const bannerPhoto = ((featured && featured.photos) || []).find(u => !/seal\.png|Banner_Capitol/i.test(u)) || null;

  async function add(f, e){
    e.stopPropagation();
    const res = await saveFavorite(user, { id: f.id, name: f.name, lng: f.lng, lat: f.lat, photo: null });
    showToast(res.error ? 'Sign in to save' : 'Added to Saved', res.error ? 'error' : 'ok');
  }

  function open(f){
    push({ name:'detail', place:{ ...f, categories:['Festival','Cultural'] } });
  }
  // Keyboard parity for the two kinds of tappable card: Enter/Space behave like click.
  const keyOpen = f => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(f); } };

  return (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
        <h1 style={{ margin:'14px 0 0', fontSize:24, letterSpacing:'-.6px' }}>Events &amp; Festivals</h1>
        <p style={{ margin:'2px 0 0', fontSize:12.5, color:'var(--muted-ink)' }}>Celebrate Pangasinan traditions</p>

        {featured && (
          <article
            data-testid="event-feature"
            onClick={() => open(featured)}
            role="button"
            tabIndex={0}
            onKeyDown={keyOpen(featured)}
            style={{ position:'relative', marginTop:14, borderRadius:18, overflow:'hidden', cursor:'pointer', boxShadow:'0 10px 26px -18px rgba(15,23,42,.5)' }}
          >
            <div style={{ position:'relative', height:168, background:'#EDF1F7' }}>
              <PhotoPlaceholder size={30}/>
              {bannerPhoto && (
                <img
                  src={bannerPhoto}
                  alt={featured.name}
                  loading="lazy"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
                />
              )}
            </div>
            {soon && (
              <span style={{ position:'absolute', left:12, top:12, display:'inline-flex', alignItems:'center', gap:5, background:'#fff', color:'#DC2626', borderRadius:999, padding:'4px 10px', fontSize:10, fontWeight:800, letterSpacing:.6 }}>
                <Radio size={10}/> HAPPENING SOON
              </span>
            )}
            <div style={{ position:'absolute', inset:'auto 0 0 0', background:'linear-gradient(transparent, rgba(10,37,64,.88))', color:'#fff', padding:14 }}>
              <span style={{ fontSize:10, letterSpacing:1.2, opacity:.9, fontWeight:700 }}>{String(featured.venue || featured.town).toUpperCase()}</span>
              <h3 style={{ margin:'2px 0 0', fontSize:19, letterSpacing:'-.4px' }}>{featured.name}</h3>
            </div>
          </article>
        )}

        <div style={{ display:'flex', gap:8, margin:'14px 0 4px' }}>
          {['All', 'This Month'].map(s => (
            <button
              key={s}
              data-testid={'events-' + s.toLowerCase().replace(/\s+/g, '-')}
              className={'chip' + (scope === s ? ' active' : '')}
              onClick={() => setScope(s)}
            >{s}</button>
          ))}
        </div>

        {scope === 'This Month' && month.fallback && featured && (
          <p data-testid="events-month-note" style={{ margin:'8px 0 0', fontSize:11.5, lineHeight:1.5, color:'var(--muted-ink)' }}>
            No festival in {MONTH_NAMES[now.getMonth()]} — showing the next one.
          </p>
        )}
      </div>

      <div data-testid="events-list" style={{ display:'grid', gap:10, padding:'12px 20px 24px' }}>
        {!rows.length && (
          <p data-testid="events-empty" style={{ fontSize:13.5, color:'var(--muted-ink)', margin:0 }}>
            No festivals to show right now.
          </p>
        )}
        {rows.map(f => {
          const km = hasFix ? haversineKm(coords.lng, coords.lat, f.lng, f.lat) : null;
          return (
            <article
              key={f.id + f.starts.toISOString()}
              data-testid="event-row"
              onClick={() => open(f)}
              role="button"
              tabIndex={0}
              onKeyDown={keyOpen(f)}
              style={{ display:'flex', gap:12, alignItems:'center', padding:10, border:'1px solid #EDF1F7', borderRadius:16, background:'#fff', cursor:'pointer', boxShadow:'0 1px 2px rgba(15,23,42,.04)' }}
            >
              <div style={{ width:52, height:52, minWidth:52, borderRadius:12, background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center', alignContent:'center', lineHeight:1 }}>
                <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:.8 }}>{MONTHS[f.starts.getMonth()]}</span>
                {!f.vague && <b style={{ fontSize:19, fontWeight:650, marginTop:2 }}>{f.starts.getDate()}</b>}
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                <b style={{ display:'block', fontSize:14.5, lineHeight:1.3 }}>{f.name}</b>
                <p style={{ margin:'4px 0 0', fontSize:11.5, color:'var(--muted-ink)', display:'flex', alignItems:'center', gap:4 }}>
                  <MapPin size={11} color="var(--accent)"/>
                  {f.town}{km != null ? ' • ' + formatDistance(km) : ''}
                </p>
              </div>

              <button
                data-testid="event-add"
                aria-label={'Save ' + f.name}
                onClick={e => add(f, e)}
                style={{ width:34, height:34, minWidth:34, borderRadius:'50%', border:'none', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center', padding:0 }}
              ><Plus size={17}/></button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
