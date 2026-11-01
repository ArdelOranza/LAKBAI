import { useEffect, useMemo, useState } from 'react';
import { Search, Umbrella, UtensilsCrossed, Landmark, MapPin } from 'lucide-react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { matches } from '../filters.js';
import { fetchSpots } from '../spots.js';
import { Map, MapMarker, MarkerContent } from '@/components/ui/map';
import { Chip } from '../ui.jsx';
import SpotPopup from './SpotPopup.jsx';

const RADII = [[1,'1 km'],[5,'Within 5 km'],[10,'10 km']];
const FILTERS = [
  ['All', MapPin],
  ['Beaches', Umbrella],
  ['Food', UtensilsCrossed],
  ['Events', Landmark],
];

function iconFor(spot){
  if (spot.categories.includes('Food')) return UtensilsCrossed;
  if (spot.categories.includes('Beach')) return Umbrella;
  return Landmark;
}

export default function MapTab({ coords, push, showToast, user, setTab }){
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
    <div style={{ position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
      <Map
        center={[coords.lng, coords.lat]}
        zoom={radius === 1 ? 13 : radius === 5 ? 11.5 : 10.5}
        theme="light"
        className="absolute inset-0"
      >
        <MapMarker longitude={coords.lng} latitude={coords.lat}>
          <MarkerContent><div className="userdot" title="You are here"/></MarkerContent>
        </MapMarker>
        {filtered.map(p => (
          <MapMarker key={p.id} longitude={p.lng} latitude={p.lat} onClick={() => push({ name:'detail', place:p })}>
            <MarkerContent>
              <div className="spot-pin" title={p.name}><MapPin size={16}/></div>
            </MarkerContent>
          </MapMarker>
        ))}
        {filteredSpots.map(s => {
          const Icon = iconFor(s);
          const active = selectedSpot && selectedSpot.id === s.id;
          return (
            <MapMarker key={'spot-' + s.id} longitude={s.lng} latitude={s.lat} onClick={() => setSelectedSpot(s)}>
              <MarkerContent>
                <button className={'spot-pin' + (active ? ' active' : '')} title={s.name} aria-label={s.name}>
                  <Icon size={16}/>
                </button>
              </MarkerContent>
            </MapMarker>
          );
        })}
      </Map>

      <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:5, background:'rgba(255,255,255,.97)', borderRadius:999, padding:'11px 16px', boxShadow:'0 10px 24px -14px rgba(15,23,42,.3)', display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} onClick={() => push({ name:'search', query:'' })}>
        <Search size={17} color="var(--muted-ink)"/>
        <span style={{ color:'var(--muted-ink)', fontSize:14 }}>Search places, food, events…</span>
      </div>

      <div className="map-chips">
        {RADII.map(([km, label]) => <Chip key={km} active={radius === km} onClick={() => setRadius(km)} testid={'radius-' + km}>{label}</Chip>)}
        {FILTERS.map(([f, Icon]) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon size={14}/>{f}</span>
          </Chip>
        ))}
      </div>

      {busy && <div style={{ position:'absolute', top:110, left:12, zIndex:5 }}><span className="shimmer chip" style={{ background:'#fff' }}>Loading nearby…</span></div>}
      {!busy && !filtered.length && !filteredSpots.length && <div style={{ position:'absolute', top:110, left:12, right:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>No stops here yet — widen the radius.</span></div>}
      {!busy && !filtered.length && filteredSpots.length > 0 && <div style={{ position:'absolute', top:110, left:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>{filteredSpots.length} curated{filter === 'All' ? '' : ' ' + filter.toLowerCase()} spots</span></div>}

      {selectedSpot && <SpotPopup spot={selectedSpot} coords={coords} pop={() => setSelectedSpot(null)} push={push} setTab={setTab} showToast={showToast} user={user} />}
    </div>
  );
}
