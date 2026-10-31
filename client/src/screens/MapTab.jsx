import { useEffect, useState, useMemo } from 'react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { matches } from '../filters.js';
import { haversineKm, formatDistance } from '../geo.js';
import { Map, MapControls, MapMarker } from '@/components/ui/map';
import { Chip } from '../ui.jsx';

const RADII = [[1,'1 km'],[5,'Within 5 km'],[10,'10 km']];
const FILTERS = ['All','Beaches','Food','Events'];

export default function MapTab({ coords, push, showToast }){
  const [radius, setRadius] = useState(5);
  const [filter, setFilter] = useState('All');
  const [places, setPlaces] = useState(sessionGet('lakbai.rec.nearby:5') || []);
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
        if (ps.length) showToast('Showing ' + ps.length + ' nearby stops');
      })
      .catch(e => showToast('Map data unavailable', 'error', e.message))
      .finally(() => setBusy(false));
  }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => places.filter(p => matches(p, filter)), [places, filter]);

  return (
    <div style={{ position:'relative', flex:1 }}>
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
      </Map>
      <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:5, background:'rgba(255,255,255,.95)', borderRadius:999, padding:'10px 16px', boxShadow:'var(--shadow)', cursor:'pointer' }} onClick={() => push({ name:'search', query:'' })}>
        🔍 <span style={{ color:'var(--muted-ink)', fontSize:14 }}>Search places, food, events…</span>
      </div>
      <div style={{ position:'absolute', top:60, left:12, right:12, zIndex:5, display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
        {RADII.map(([km, label]) => <Chip key={km} active={radius === km} onClick={() => setRadius(km)} testid={'radius-' + km}>{label}</Chip>)}
        {FILTERS.map(f => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === 'Beaches' ? '🏖 ' + f : f}</Chip>)}
      </div>
      {busy && <div style={{ position:'absolute', top:104, left:12, zIndex:5 }}><span className="shimmer chip">Loading nearby…</span></div>}
      {!busy && !filtered.length && <div style={{ position:'absolute', top:104, left:12, right:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>No stops here yet — widen the radius.</span></div>}
    </div>
  );
}
