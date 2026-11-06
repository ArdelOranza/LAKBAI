import { useEffect, useMemo, useState } from 'react';
import { Search, Umbrella, UtensilsCrossed, Landmark, MapPin } from 'lucide-react';
import { recommend } from '../api.js';
import { readLocalPrefs } from '../prefs.js';
import { sessionGet, sessionSet } from '../sessionCache.js';
import { matches } from '../filters.js';
import { fetchSpots } from '../spots.js';
import { haversineKm } from '../geo.js';
import { FALLBACK_CENTER } from '../App.jsx';
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

/** Short label for a map name pill — the full name stays in title/aria. */
function shortName(name){
  const n = String(name || '').replace(/\s*\(.*$/, '').trim();
  return n.length > 22 ? n.slice(0, 21).trimEnd() + '…' : n;
}

export default function MapTab({ coords, push, showToast, user, setTab }){
  const [radius, setRadius] = useState(5);
  const [filter, setFilter] = useState('All');
  const [places, setPlaces] = useState(sessionGet('lakbai.rec.nearby:5') || []);
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [busy, setBusy] = useState(false);
  // A real GPS fix has arrived — until then coords are the Pangasinan fallback,
  // which must not be shown as "You are here" or used to filter pins.
  const hasFix = !(coords.lng === FALLBACK_CENTER.lng && coords.lat === FALLBACK_CENTER.lat);
  const [viewport, setViewport] = useState({ center: [coords.lng, coords.lat], zoom: 11.5 });
  const [centeredOnFix, setCenteredOnFix] = useState(false);

  // Keep the controlled viewport in sync: radius chips change zoom, and the
  // first real GPS fix re-centres the map.
  useEffect(() => {
    setViewport(v => ({ ...v, zoom: radius === 1 ? 13 : radius === 5 ? 11.5 : 10.5 }));
  }, [radius]);
  useEffect(() => {
    if (hasFix && !centeredOnFix){
      setViewport(v => ({ ...v, center: [coords.lng, coords.lat] }));
      setCenteredOnFix(true);
    }
  }, [hasFix, centeredOnFix, coords.lng, coords.lat]);

  useEffect(() => {
    const key = `lakbai.rec.nearby:${radius}:${coords.lng.toFixed(3)},${coords.lat.toFixed(3)}`;
    const hit = sessionGet(key);
    if (hit) { setPlaces(hit); return; }
    let alive = true;
    setBusy(true);
    recommend(`nearby Pangasinan attractions restaurants events within ${radius} km`, `${coords.lng},${coords.lat}`, readLocalPrefs(user))
      .then(out => {
        if (!alive) return;
        const ps = out.places || [];
        setPlaces(ps);
        sessionSet(key, ps);
      })
      .catch(e => { if (alive) showToast('Map data unavailable', 'error', e.message); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [radius, coords.lng, coords.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSpots().then(setSpots).catch(() => showToast('Offline — curated pins load when the app has been opened online once', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A filter change must close a popup that no longer belongs to the visible set.
  useEffect(() => { setSelectedSpot(null); }, [filter]);

  const withinRadius = place => !hasFix || !Number.isFinite(place.lng) || !Number.isFinite(place.lat)
    || haversineKm(coords.lng, coords.lat, place.lng, place.lat) <= radius;
  const filtered = useMemo(() => places.filter(p => matches(p, filter) && withinRadius(p)), [places, filter, radius, hasFix]); // eslint-disable-line react-hooks/exhaustive-deps
  const catFor = f => f === 'Food' ? 'Food' : f === 'Events' ? 'Events' : 'Beaches';
  const filteredSpots = useMemo(() => {
    const base = filter === 'All'
      ? spots.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat))
      : spots.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat) && s.categories.some(c => matches({ name:s.name, categories:s.categories }, catFor(filter))));
    return base.filter(s => withinRadius(s));
  }, [spots, filter, radius, hasFix]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
      <Map
        viewport={viewport}
        onViewportChange={setViewport}
        center={[coords.lng, coords.lat]}
        zoom={radius === 1 ? 13 : radius === 5 ? 11.5 : 10.5}
        theme="light"
        className="absolute inset-0"
      >
        {hasFix && (
          <MapMarker longitude={coords.lng} latitude={coords.lat}>
            <MarkerContent><div className="userdot" title="You are here"/></MarkerContent>
          </MapMarker>
        )}
        {filtered.map(p => (
          <MapMarker key={p.id} longitude={p.lng} latitude={p.lat} onClick={() => push({ name:'detail', place:p })}>
            <MarkerContent>
              <div className="spot-pin" title={p.name}><span>{shortName(p.name)}</span></div>
            </MarkerContent>
          </MapMarker>
        ))}
        {filteredSpots.map(s => {
          const active = selectedSpot && selectedSpot.id === s.id;
          return (
            <MapMarker key={'spot-' + s.id} longitude={s.lng} latitude={s.lat} onClick={() => setSelectedSpot(s)}>
              <MarkerContent>
                <button className={'spot-pin' + (active ? ' active' : '')} title={s.name} aria-label={s.name}>
                  <span>{shortName(s.name)}</span>
                </button>
              </MarkerContent>
            </MapMarker>
          );
        })}
      </Map>

      <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:5, background:'rgba(255,255,255,.97)', borderRadius:999, padding:'11px 16px', boxShadow:'0 10px 24px -14px rgba(15,23,42,.3)', display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} onClick={() => push({ name:'search', query:'' })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'search', query:'' }); } }}>
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
