import { useEffect, useMemo, useState } from 'react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { matches } from '../filters.js';
import { fetchSpots } from '../spots.js';
import { Map, MapControls, MapMarker } from '@/components/ui/map';
import { Chip } from '../ui.jsx';
import SpotPopup from './SpotPopup.jsx';

const RADII = [[1,'1 km'],[5,'Within 5 km'],[10,'10 km']];
const FILTERS = ['All','Beaches','Food','Events'];
const EMOJI = { Beaches:'🏖', Food:'🍽', Events:'📅' };

export default function MapTab({ coords, push, showToast, setTab, user, pop }){
  const [radius, setRadius] = useState(5);
  const [filter, setFilter] = useState('All');
  const [places, setPlaces] = useState(sessionGet('lakbai.rec.nearby:5') || []);
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const key = 'lakbai.rec.nearby:' + radius;
    const hit = sessionGet(key);
    if (hit) { setPlaces(hit); return; }
    setBusy(true);
    recommend(`nearby Pangasinan attractions restaurants events within ${radius} km`, `${coords.lng},${coords.lat}`, readLocalPrefs())
      .then(out => {
        const ps = out.places || [];
        setPlaces(ps);
        sessionSet(key, ps);
      })
      .catch(e => showToast('Map data unavailable', 'error', e.message))
      .finally(() => setBusy(false));
  }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSpots().then(setSpots).catch(() => showToast('Offline — curated pins load when the app has been opened online once', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => places.filter(p => matches(p, filter)), [places, filter]);
  const catFor = f => f === 'Food' ? 'Food' : f === 'Events' ? 'Events' : 'Beaches';
  const filteredSpots = useMemo(() => {
    if (filter === 'All') return spots.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat));
    return spots.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat) && s.categories.some(c => matches({ name:s.name, categories:s.categories }, catFor(filter))));
  }, [spots, filter]);

  return (
    <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column' }}>
      <Map
        center={[coords.lng, coords.lat]}
        zoom={radius === 1 ? 13 : radius === 5 ? 11.5 : 10.5}
        className="absolute inset-0"
      >
        <MapControls showLocate />
        <MapMarker longitude={coords.lng} latitude={coords.lat}>
          <div className="userdot" title="You are here"/>
        </MapMarker>
        {filtered.map(p => (
          <MapMarker key={p.id} longitude={p.lng} latitude={p.lat} onClick={() => push({ name:'detail', place:p })}>
            <div className="pin" title={p.name}/>
          </MapMarker>
        ))}
        {filteredSpots.map(s => (
          <MapMarker key={'spot-' + s.id} longitude={s.lng} latitude={s.lat} onClick={() => setSelectedSpot(s)}>
            <button className={'spot-pin' + (selectedSpot && selectedSpot.id === s.id ? ' active' : '')} title={s.name} aria-label={s.name}>
              <span aria-hidden="true">{s.categories.includes('Food') ? '🍽' : s.categories.includes('Beach') ? '🏖' : '📍'}</span>
            </button>
          </MapMarker>
        ))}
      </Map>
      <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:5, background:'rgba(255,255,255,.95)', borderRadius:999, padding:'10px 16px', boxShadow:'var(--shadow)', cursor:'pointer' }} onClick={() => push({ name:'search', query:'' })}>
        🔍 <span style={{ color:'var(--muted-ink)', fontSize:14 }}>Search places, food, events…</span>
      </div>
      <div style={{ position:'absolute', top:60, left:12, right:12, zIndex:5, display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
        {RADII.map(([km, label]) => <Chip key={km} active={radius === km} onClick={() => setRadius(km)} testid={'radius-' + km}>{label}</Chip>)}
        {FILTERS.map(f => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{EMOJI[f] ? EMOJI[f] + ' ' + f : f}</Chip>)}
      </div>
      {busy && <div style={{ position:'absolute', top:104, left:12, zIndex:5 }}><span className="shimmer chip">Loading nearby…</span></div>}
      {!busy && !filtered.length && !filteredSpots.length && <div style={{ position:'absolute', top:104, left:12, right:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>No stops here yet — widen the radius.</span></div>}
      {!busy && !filtered.length && filteredSpots.length && <div style={{ position:'absolute', top:104, left:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>{filteredSpots.length} curated{filter === 'All' ? '' : ' ' + filter.toLowerCase()} pins</span></div>}
      {selectedSpot && <SpotPopup spot={selectedSpot} coords={coords} pop={() => setSelectedSpot(null)} showToast={showToast} user={user} />}
    </div>
  );
}
