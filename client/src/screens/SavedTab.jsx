import { useEffect, useState } from 'react';
import { MapPin, Sparkles, Plus, X, Image as ImageIcon } from 'lucide-react';
import { listFavorites, removeFavorite, saveFavorite } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { recommend, itineraryFromSaved } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { haversineKm, formatDistance, timeHint } from '../geo.js';
import { PrimaryBtn } from '../ui.jsx';

export default function SavedTab({ coords, push, showToast }){
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [suggs, setSuggs] = useState(sessionGet('lakbai.rec.sugg') || []);
  const [busyGen, setBusyGen] = useState(false);
  useEffect(() => {
    let alive = true;
    listFavorites(user).then(res => { if (alive) setRows(res.data || []); });
    if (!suggs.length) {
      recommend('hidden gems attractions near me', `${coords.lng},${coords.lat}`, readLocalPrefs())
        .then(out => { const ps = (out.places || []).slice(0, 4); setSuggs(ps); sessionSet('lakbai.rec.sugg', ps); })
        .catch(() => { /* suggestions are optional */ });
    }
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function remove(row){
    setRows(r => r.filter(x => x.place_id !== row.place_id)); // optimistic
    const res = await removeFavorite(user, row.place_id);
    if (res.queued) showToast('Removed (will sync when online)');
    else if (res.error) { showToast('Could not remove — retrying later', 'error', res.error); queueRestore(row); }
    else showToast('Removed from Saved');
  }
  function queueRestore(row){ setRows(r => [row, ...r]); }
  function suggestionLabels(row){ // hint pill from category + sunset clock (no festival data on favorites)
    const cat = (row.categories || [])[0] || 'Place';
    // No sunset string is available here — don't render a dangling "Optimal
    // sunset: " chip. Only the category-based dinner hint is shown.
    if (/beach|coastal|island/i.test(cat)) return 'Best at sunset';
    return timeHint(cat, '');
  }
  async function generate(){
    if (!rows.length) { showToast('Save a few places first', 'error'); return; }
    setBusyGen(true);
    try {
      const names = rows.map(r => r.name);
      const plan = await itineraryFromSaved(names);
      plan.inputNames = names;
      plan.favBy = Object.fromEntries(rows.filter(r => r.lng != null || r.photo).map(r => [r.name, { lng:r.lng, lat:r.lat, photo:r.photo || null }]));
      push({ name:'itinerary', plan });
    } catch (e) {
      showToast('Could not generate itinerary', 'error', e.message);
    } finally { setBusyGen(false); }
  }
  return (
    <main className="screen" style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:20 }}>
        <h1 style={{ margin:0 }}>Saved Trips</h1>
        <p style={{ color:'var(--muted-ink)', fontSize:14, marginTop:0 }}>Your bookmarked places, ready to build into a day.</p>
      </div>
      <div className="pane" data-testid="saved-list" style={{ display:'grid', gap:10, marginTop:10 }}>
        {!rows.length && <p style={{ color:'var(--muted-ink)', fontSize:14 }}>Nothing saved yet — tap the bookmark on any place.</p>}
        {rows.map(row => (
          <article key={row.place_id} data-testid="saved-row" style={{ display:'flex', gap:12, padding:12, border:'1px solid #EDF1F7', borderRadius:16, background:'#fff', cursor:'pointer', alignItems:'center' }} onClick={() => push({ name:'detail', place:row })}>
            <div className="thumb" style={{ width:72, height:72, minWidth:72 }}>
              {row.photo ? <img src={row.photo} alt={row.name} loading="lazy" onError={e => { e.currentTarget.style.display='none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <ImageIcon size={22}/>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <b style={{ display:'block' }}>{row.name}</b>
              <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'2px 0 0' }}>{(row.categories || [])[0] || 'Pangasinan'}</p>
              <div style={{ display:'flex', gap:6, marginTop:5, flexWrap:'wrap' }}>
                {haversineKm(coords.lng, coords.lat, row.lng, row.lat) != null && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, color:'var(--muted-ink)' }}><MapPin size={12}/> {formatDistance(haversineKm(coords.lng, coords.lat, row.lng, row.lat))}</span>}
                {suggestionLabels(row) && row.name && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, color:'var(--primary)' }}><Sparkles size={12}/> {suggestionLabels(row)}</span>}
              </div>
            </div>
            <button data-testid="remove-fav" aria-label="Remove" onClick={e => { e.stopPropagation(); remove(row); }} style={{ flex:'0 0 34px', width:34, height:34, borderRadius:'50%', border:'1px solid #EDF1F7', background:'#fff', display:'grid', placeItems:'center', padding:0, color:'var(--muted-ink)' }}><X size={15}/></button>
          </article>
        ))}
      </div>
      {suggs.length > 0 && (
        <div className="pane" style={{ marginTop:18 }}>
          <h2 style={{ margin:'0 0 8px' }}>LakbAI Suggestions</h2>
          <div data-testid="suggestions" style={{ display:'grid', gap:8 }}>
            {suggs.filter(s => !rows.some(r => r.place_id === s.id)).map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, border:'1px solid #EDF1F7', borderRadius:14, padding:'10px 12px', background:'#F7F9FC' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <b style={{ fontSize:13 }}>{s.name}</b>
                  <p style={{ fontSize:11, color:'var(--muted-ink)', margin:0 }}>{s.hint || 'Pangasinan'}</p>
                </div>
                <button data-testid="add-sugg" className="chip" style={{ fontSize:12, padding:'6px 12px', display:'inline-flex', alignItems:'center', gap:4 }} onClick={async () => { await saveToSaved(s); }}><Plus size={13}/> Add</button>
              </div>
            ))}
            <button data-testid="add-all-sugg" className="chip" style={{ justifySelf:'start', fontSize:12, padding:'6px 12px', display:'inline-flex', alignItems:'center', gap:4 }} onClick={async () => { for (const s of suggs.filter(x => !rows.some(r => r.place_id === x.id))) await saveToSaved(s); }}><Plus size={13}/> Add All</button>
          </div>
        </div>
      )}
      <div className="pane" style={{ marginTop:18 }}>
        <div data-testid="generate-itinerary"><PrimaryBtn disabled={busyGen} onClick={generate}><Sparkles size={17}/> {busyGen ? 'Sequencing stops…' : 'Generate Smart Itinerary'}</PrimaryBtn></div>
        <p style={{ fontSize:11, color:'var(--muted-ink)', textAlign:'center', marginTop:8 }}>LakbAI will automatically sequence stops by distance and sunset timing.</p>
      </div>
    </main>
  );
  async function saveToSaved(place){
    const res = await saveFavorite(user, place);
    if (res.error) { showToast('Sign in to save', 'error'); return; }
    setRows(r => r.some(x => x.place_id === place.id) ? r : [
      { place_id:place.id, name:place.name, lng:place.lng, lat:place.lat, photo:place.photo || null, categories:place.categories || [] },
      ...r,
    ]);
    showToast('Added to Saved');
  }
}
