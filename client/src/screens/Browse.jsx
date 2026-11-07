import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, Plus, MapPin, Star, Check } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { fetchSpots } from '../spots.js';
import { saveFavorite } from '../store.js';
import { browseRows, townsFor, nearestTown } from '../browse.js';
import { formatDistance } from '../geo.js';
import { placeImage, mapboxToken } from '../staticMap.js';
import { PhotoPlaceholder } from '../ui.jsx';

const DINING_FACETS = ['All', 'Seafood', 'Filipino', 'Cafés', 'More'];
const BEACH_FACETS = ['All', 'Near', 'Within 5km', 'Within 10km'];
const COPY = {
  dining: { verb: 'Dining', sub: 'Authentic coastal & regional cuisines', empty: 'No dining spots match this filter yet.' },
  beaches: { verb: 'Beaches', sub: 'Coastal sands and beauties', empty: 'No beaches match this filter yet.' },
};

export default function Browse({ kind = 'beaches', coords, push, pop, showToast }){
  const { user } = useAuth();
  const copy = COPY[kind] || COPY.beaches;
  const facets = kind === 'dining' ? DINING_FACETS : BEACH_FACETS;
  const [spots, setSpots] = useState([]);
  const [town, setTown] = useState(null);
  const [facet, setFacet] = useState('All');
  const [busy, setBusy] = useState(true);
  const [townOpen, setTownOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSpots()
      .then(list => {
        if (!alive) return;
        setSpots(list || []);
        setTown(nearestTown(list, coords, kind));
      })
      .catch(() => { if (alive) setSpots([]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const towns = townsFor(spots, kind);
  const rows = town ? browseRows(spots, { kind, town, facet, coords }) : [];

  async function add(p, e){
    e.stopPropagation();
    const res = await saveFavorite(user, p);
    showToast(res.error ? 'Sign in to save' : 'Added to Saved', res.error ? 'error' : 'ok');
  }

  return (
    <div style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>

        <div className="town-wrap">
          <button
            type="button"
            className="town-trigger"
            data-testid="browse-town"
            aria-haspopup="listbox"
            aria-expanded={townOpen}
            onClick={() => setTownOpen(o => !o)}
          >
            <span>{copy.verb} in {town || 'Pangasinan'}</span>
            <ChevronDown size={18} className={townOpen ? 'up' : ''}/>
          </button>

          {townOpen && (
            <>
              <button type="button" className="town-scrim" aria-label="Close town list" onClick={() => setTownOpen(false)}/>
              <div className="town-pop" role="listbox" aria-label="Choose a town">
                {towns.map(t => (
                  <button
                    key={t}
                    type="button"
                    role="option"
                    aria-selected={t === town}
                    className={'town-opt' + (t === town ? ' on' : '')}
                    onClick={() => { setTown(t); setFacet('All'); setTownOpen(false); }}
                  >
                    <span>{t}</span>
                    {t === town && <Check size={15}/>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <p style={{ margin:'2px 0 0', fontSize:12.5, color:'var(--muted-ink)' }}>{copy.sub}</p>

        <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', margin:'14px 0 4px' }}>
          {facets.map(f => (
            <button
              key={f}
              data-testid={'browse-chip-' + f.toLowerCase().replace(/\s+/g, '-')}
              className={'chip' + (facet === f ? ' active' : '')}
              onClick={() => setFacet(f)}
              style={{ whiteSpace:'nowrap' }}
            >{f}</button>
          ))}
        </div>
      </div>

      <div data-testid="browse-list" style={{ display:'grid', gap:10, padding:'12px 20px 24px' }}>
        {busy && <p className="shimmer" style={{ fontSize:14, margin:0 }}>Loading {copy.verb.toLowerCase()} spots…</p>}
        {!busy && !rows.length && <p data-testid="browse-empty" style={{ fontSize:13.5, color:'var(--muted-ink)', margin:0 }}>{copy.empty}</p>}
        {rows.map(p => (
          <article
            key={p.id}
            data-testid="browse-row"
            onClick={() => push({ name:'detail', place:p })}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'detail', place:p }); } }}
            style={{ display:'flex', gap:12, alignItems:'center', padding:10, border:'1px solid #EDF1F7', borderRadius:16, background:'#fff', cursor:'pointer', boxShadow:'0 1px 2px rgba(15,23,42,.04)' }}
          >
            <div style={{ position:'relative', width:88, height:88, flex:'0 0 88px', borderRadius:12, overflow:'hidden' }}>
              {placeImage(p, mapboxToken())
                ? <img src={placeImage(p, mapboxToken())} alt={p.name} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <PhotoPlaceholder size={22}/>}
              {typeof p.rating === 'number' && (
                <span style={{ position:'absolute', left:6, top:6, display:'inline-flex', alignItems:'center', gap:3, background:'#fff', borderRadius:999, padding:'2px 7px', fontSize:10, fontWeight:700 }}>
                  <Star size={10} fill="var(--primary)" color="var(--primary)"/> {p.rating.toFixed(1)}
                </span>
              )}
            </div>

            <div style={{ flex:1, minWidth:0 }}>
              {p.fees != null && <span style={{ display:'block', fontSize:10.5, color:'var(--muted-ink)' }}>{String(p.fees)}</span>}
              <b style={{ display:'block', fontSize:14.5, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</b>
              <p style={{ margin:'4px 0 0', fontSize:11.5, color:'var(--muted-ink)', display:'flex', alignItems:'center', gap:4, overflow:'hidden' }}>
                <MapPin size={11} color="var(--primary)"/>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {p.km != null ? formatDistance(p.km) : 'Pangasinan'}{p.town ? ' • ' + p.town : ''}
                </span>
              </p>
            </div>

            <button
              data-testid="browse-add"
              aria-label={'Save ' + p.name}
              onClick={e => add(p, e)}
              style={{ width:34, height:34, minWidth:34, borderRadius:'50%', border:'none', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center', padding:0 }}
            ><Plus size={17}/></button>
          </article>
        ))}
      </div>
    </div>
  );
}
