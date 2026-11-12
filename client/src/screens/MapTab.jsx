import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Umbrella, UtensilsCrossed, Landmark, MapPin, LocateFixed } from 'lucide-react';
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
const RADIUS_ZOOM = { 1: 13, 5: 11.5, 10: 10.5 };
// Below this zoom the map is a city/region view: 80 name labels turn into a
// wall. Pins stay, names wait until the traveler is close enough to read them.
const PIN_DETAIL_ZOOM = 12.5;
const easeOut = t => 1 - Math.pow(1 - t, 3);
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

/** Google-Maps-style teardrop marker (white rim + centre dot). */
function PinDrop(){
  return (
    <span className="pin-drop" aria-hidden="true">
      <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
    </span>
  );
}

/** True when two screen boxes touch (with a little breathing room). */
function overlaps(a, b, pad){
  return !(a.right + pad < b.left || b.right + pad < a.left || a.bottom + pad < b.top || b.bottom + pad < a.top);
}

/**
 * Google-Maps-style declutter, done in screen space after the map settles.
 * Pins that would stack on top of a higher-priority pin step aside; in close
 * view the name underneath a pin also yields when another name already owns
 * that patch of map. Nothing is removed from the data — it fades back in as
 * soon as the traveler pans or zooms to give it room.
 */
function declutterPins(root, detailed){
  if (!root) return;
  const pins = Array.from(root.querySelectorAll('button.spot-pin'));
  if (!pins.length) return;
  pins.forEach(p => p.classList.remove('is-hidden', 'label-hidden'));
  const priority = p => p.classList.contains('active') ? 0 : p.dataset.pin === 'spot' ? 1 : p.dataset.pin === 'discover' ? 3 : 2;
  const ordered = pins
    .map((p, i) => ({ p, i, r: priority(p) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.p);
  const keptPins = [];
  const keptNames = [];
  for (const pin of ordered){
    const box = pin.getBoundingClientRect();
    if (!box.width || !box.height) continue; // hidden tab / not laid out yet
    if (keptPins.some(b => overlaps(box, b, 1))){ pin.classList.add('is-hidden'); continue; }
    keptPins.push(box);
    if (!detailed) continue;
    const name = pin.querySelector('.pin-name');
    if (!name) continue;
    const label = name.getBoundingClientRect();
    if (!label.width) continue;
    if (keptNames.some(b => overlaps(label, b, 1)) || keptPins.some(b => b !== box && overlaps(label, b, 0))) pin.classList.add('label-hidden');
    else keptNames.push(label);
  }
}


export default function MapTab({ coords, push, showToast, user, setTab, openDirections }){
  const [radius, setRadius] = useState(5);
  const [filter, setFilter] = useState('All');
  // Seed from the same coords-keyed lookup the effect writes, not a legacy
  // unkeyed key that could be pins from a previous location/radius.
  const keyFor = (r, c) => `lakbai.rec.nearby:${r}:${c.lng.toFixed(3)},${c.lat.toFixed(3)}`;
  const coordsBucket = `${coords.lng.toFixed(3)},${coords.lat.toFixed(3)}`;
  const [places, setPlaces] = useState(() => sessionGet(keyFor(radius, coords)) || []);
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [busy, setBusy] = useState(false);
  // A real GPS fix has arrived — until then coords are the Pangasinan fallback,
  // which must not be shown as "You are here" or used to filter pins.
  const hasFix = !(coords.lng === FALLBACK_CENTER.lng && coords.lat === FALLBACK_CENTER.lat);
  const [viewport, setViewport] = useState({ center: [coords.lng, coords.lat], zoom: RADIUS_ZOOM[5] });
  const [centeredOnFix, setCenteredOnFix] = useState(false);
  const [following, setFollowing] = useState(false);
  // While the traveler pans, the map is the source of truth: only crossing the
  // detail threshold touches the DOM, so 80 markers are never re-rendered on
  // an animation frame (that is what made zooming feel heavy).
  const detailedRef = useRef(false);
  const viewRef = useRef(viewport);
  const mapRef = useRef(null);
  const shellRef = useRef(null);
  const declutterTimer = useRef(0);

  function markDetail(on){
    if (detailedRef.current === on) return;
    detailedRef.current = on;
    shellRef.current?.classList.toggle('pins-far', !on);
  }

  function scheduleDeclutter(){
    clearTimeout(declutterTimer.current);
    declutterTimer.current = setTimeout(() => declutterPins(shellRef.current, detailedRef.current), 90);
  }

  function onViewChange(v){
    viewRef.current = v;
    const detail = v.zoom >= PIN_DETAIL_ZOOM;
    if (detail !== detailedRef.current) markDetail(detail);
    scheduleDeclutter();
  }

  function moveTo(center, zoom){
    const map = mapRef.current;
    if (map && typeof map.easeTo === 'function'){
      map.easeTo({ center, ...(zoom != null ? { zoom } : {}), duration: 560, easing: easeOut });
      return;
    }
    const next = { ...viewRef.current, center, ...(zoom != null ? { zoom } : {}) };
    viewRef.current = next;
    setViewport(next);
  }

  function pickRadius(km){
    setRadius(km);
    const zoom = RADIUS_ZOOM[km];
    markDetail(zoom >= PIN_DETAIL_ZOOM);
    moveTo(viewRef.current.center, zoom);
  }

  // First real GPS fix re-centres. Later fixes only move the view when the
  // user is in "following" mode (tapped Locate) — otherwise the map feels
  // drunk on every GPS jitter step.
  useEffect(() => {
    if (!hasFix || centeredOnFix) return;
    moveTo([coords.lng, coords.lat], viewRef.current.zoom);
    setCenteredOnFix(true);
  }, [hasFix, centeredOnFix, coords.lng, coords.lat]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasFix || !following) return;
    moveTo([coords.lng, coords.lat], viewRef.current.zoom);
  }, [coords.lng, coords.lat, hasFix, following]); // eslint-disable-line react-hooks/exhaustive-deps

  function locateMe(){
    if (!hasFix) { showToast('Waiting for GPS fix — enable location to see yourself', 'error'); return; }
    markDetail(14 >= PIN_DETAIL_ZOOM);
    moveTo([coords.lng, coords.lat], 14);
    setCenteredOnFix(true);
    setFollowing(true);
  }

  useEffect(() => () => clearTimeout(declutterTimer.current), []);

  // Any render that changes pins re-runs the declutter; the work itself is
  // debounced and only touches classes, never React state.
  useEffect(() => { scheduleDeclutter(); });

  useEffect(() => {
    const key = keyFor(radius, coords);
    const hit = sessionGet(key);
    if (hit) setPlaces(hit); // instant paint, then live revalidation below
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
  }, [radius, coordsBucket]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSpots().then(setSpots).catch(() => showToast('Offline — curated pins load when the app has been opened online once', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A filter or radius change must close a popup that no longer belongs to the
  // visible set (GPS moving the spot out of radius does too, via coords).
  useEffect(() => { setSelectedSpot(null); }, [filter, radius, coords.lng, coords.lat]);

  const withinRadius = place => !hasFix || !Number.isFinite(place.lng) || !Number.isFinite(place.lat)
    || haversineKm(coords.lng, coords.lat, place.lng, place.lat) <= radius;
  // Places without coordinates can't be pinned — drop them, never render an
  // invalid marker.
  const filtered = useMemo(() => places.filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat) && matches(p, filter) && withinRadius(p)), [places, filter, radius, hasFix, coords.lng, coords.lat]); // eslint-disable-line react-hooks/exhaustive-deps
  const catFor = f => f === 'Food' ? 'Food' : f === 'Events' ? 'Events' : 'Beaches';
  const filteredSpots = useMemo(() => {
    const base = filter === 'All'
      ? spots.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat))
      // Guard: a malformed record without categories must never throw.
      : spots.filter(s => Number.isFinite(s.lng) && Number.isFinite(s.lat) && (s.categories || []).some(c => matches({ name:s.name, categories:s.categories }, catFor(filter))));
    return base.filter(s => withinRadius(s));
  }, [spots, filter, radius, hasFix, coords.lng, coords.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  // U14-B: Mapbox-discovered places (from SearchResults) join the live map,
  // visibly distinct, under the same radius and chip filters.
  const discovered = useMemo(() => {
    const list = sessionGet('lakbai.discovered');
    return Array.isArray(list) ? list : [];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — session snapshot per mount
  const filteredDiscover = useMemo(() =>
    discovered.filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat) && matches(p, filter) && withinRadius(p)),
  [discovered, filter, radius, hasFix, coords.lng, coords.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={shellRef} className="pins-far" style={{ position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
      <Map
        ref={mapRef}
        viewport={viewport}
        onViewportChange={onViewChange}
        center={[coords.lng, coords.lat]}
        zoom={RADIUS_ZOOM[radius]}
        theme="light"
        className="absolute inset-0"
      >
        {hasFix && (
          <MapMarker longitude={coords.lng} latitude={coords.lat}>
            <MarkerContent>
              <span
                data-testid="you-marker"
                role="img"
                aria-label="Your location"
                title="You are here"
                style={{
                  display:'inline-flex', alignItems:'center', gap:6,
                  background:'var(--primary)', color:'#fff',
                  border:'2px solid #fff', borderRadius:999,
                  padding:'4px 10px 4px 5px',
                  fontSize:11, fontWeight:800, letterSpacing:.3,
                  boxShadow:'0 8px 20px rgba(15,23,42,.35)',
                  whiteSpace:'nowrap',
                }}
              >
                <span className="userdot" style={{ width:12, height:12, flex:'0 0 12px' }} />
                You{coords.accuracy != null ? ` ±${Math.round(coords.accuracy)}m` : ''}
              </span>
            </MarkerContent>
          </MapMarker>
        )}
        {filtered.map(p => (
          <MapMarker key={p.id} longitude={p.lng} latitude={p.lat} onClick={() => push({ name:'detail', place:p })}>
            <MarkerContent>
              <button type="button" className="spot-pin" data-pin="rec" title={p.name} aria-label={p.name}>
                <PinDrop/>
                <span className="pin-name">{shortName(p.name)}</span>
              </button>
            </MarkerContent>
          </MapMarker>
        ))}
        {filteredSpots.map(s => {
          const active = selectedSpot && selectedSpot.id === s.id;
          return (
            <MapMarker key={'spot-' + s.id} longitude={s.lng} latitude={s.lat} onClick={() => setSelectedSpot(s)}>
              <MarkerContent>
                <button className={'spot-pin' + (active ? ' active' : '')} data-pin="spot" title={s.name} aria-label={s.name}>
                  <PinDrop/>
                  <span className="pin-name">{shortName(s.name)}</span>
                </button>
              </MarkerContent>
            </MapMarker>
          );
        })}
        {filteredDiscover.map(p => (
          <MapMarker key={p.id} longitude={p.lng} latitude={p.lat} onClick={() => push({ name:'detail', place:p })}>
            <MarkerContent>
              <button type="button" className="spot-pin discover" data-pin="discover" title={p.name + ' — discovered via Mapbox'} aria-label={p.name}>
                <PinDrop/>
                <span className="pin-name">{shortName(p.name)}</span>
              </button>
            </MarkerContent>
          </MapMarker>
        ))}
      </Map>

      <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:5, background:'rgba(255,255,255,.97)', borderRadius:999, padding:'11px 16px', boxShadow:'0 10px 24px -14px rgba(15,23,42,.3)', display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} onClick={() => push({ name:'search', query:'' })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'search', query:'' }); } }}>
        <Search size={17} color="var(--muted-ink)"/>
        <span style={{ color:'var(--muted-ink)', fontSize:14 }}>Search places, food, events…</span>
      </div>

      <div className="map-chips">
        {RADII.map(([km, label]) => <Chip key={km} active={radius === km} onClick={() => pickRadius(km)} testid={'radius-' + km}>{label}</Chip>)}
        {FILTERS.map(([f, Icon]) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Icon size={14}/>{f}</span>
          </Chip>
        ))}
      </div>

      {busy && <div style={{ position:'absolute', top:110, left:12, zIndex:5 }}><span className="shimmer chip" style={{ background:'#fff' }}>Loading nearby…</span></div>}
      {!busy && !filtered.length && !filteredSpots.length && !filteredDiscover.length && <div style={{ position:'absolute', top:110, left:12, right:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>No stops here yet — widen the radius.</span></div>}
      {!busy && !filtered.length && !filteredDiscover.length && filteredSpots.length > 0 && <div style={{ position:'absolute', top:110, left:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>{filteredSpots.length} curated{filter === 'All' ? '' : ' ' + filter.toLowerCase()} spots</span></div>}

      <button
        type="button"
        data-testid="locate-me"
        aria-label="Locate me"
        title={hasFix ? 'Centre on my location' : 'Waiting for GPS…'}
        onClick={locateMe}
        style={{ position:'absolute', right:12, bottom:78, zIndex:6, width:46, height:46, borderRadius:'50%', border:'1px solid #EDF1F7', background:'#fff', color:'var(--primary)', display:'grid', placeItems:'center', boxShadow:'0 10px 24px -12px rgba(15,23,42,.45)', padding:0 }}
      >
        <LocateFixed size={20}/>
      </button>

      {selectedSpot && <SpotPopup spot={selectedSpot} coords={coords} pop={() => setSelectedSpot(null)} push={push} setTab={setTab} showToast={showToast} user={user} openDirections={openDirections} />}
    </div>
  );
}
