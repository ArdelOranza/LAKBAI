import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Umbrella, UtensilsCrossed, MapPin, LocateFixed, BedDouble, MapPinPlus, Church, Shapes } from 'lucide-react';
import { sessionGet } from '../sessionCache.js';
import { matches } from '../filters.js';
import { fetchCatalogue } from '../catalogue.js';
import { haversineKm } from '../geo.js';
import { FALLBACK_CENTER } from '../App.jsx';
import { Map, MapMarker, MarkerContent } from '@/components/ui/map';
import { pinPhoto } from '../pinPhoto.js';
import { mergePins } from '../pinDedupe.js';
import { Chip } from '../ui.jsx';
import SpotPopup from './SpotPopup.jsx';
import AddPlace from './AddPlace.jsx';

const RADII = [[1,'1 km'],[5,'Within 5 km'],[10,'10 km']];
const RADIUS_ZOOM = { 1: 13, 5: 11.5, 10: 10.5 };
// Below this zoom the map is a city/region view: 80 name labels turn into a
// wall. Pins stay, names wait until the traveler is close enough to read them.
const PIN_DETAIL_ZOOM = 12.5;
// The far pin is 32 px tall and the marker box is centred on the coordinate, so
// the whole pin is lifted by half its height for the tip to touch the place.
const FAR_PIN_OFFSET = [0, -16];
const easeOut = t => 1 - Math.pow(1 - t, 3);
const FILTERS = [
  ['All', MapPin],
  ['Hotels', BedDouble],
  ['Restaurants', UtensilsCrossed],
  ['Beaches', Umbrella],
  ['Churches', Church],
  ['Others', Shapes],
];

/** Short label for a map name pill — the full name stays in title/aria. */
function shortName(name){
  const n = String(name || '').replace(/\s*\(.*$/, '').trim();
  return n.length > 22 ? n.slice(0, 21).trimEnd() + '…' : n;
}

/**
 * Google-Maps-style marker, two states on the same map coordinate:
 *  - far zoom: a compact teardrop pin whose tip marks the spot, so 80 of them
 *    stay readable;
 *  - close view: a round photo bubble with the name to the right.
 * Both keep anchor="center" on the marker; the far pin is lifted by half its
 * height instead, so its tip (not its box) lands on the coordinate.
 *
 * No category icon sits on the head: a little umbrella or fork made the map
 * look like a toy and said less than the name pill beside it. A place with a
 * real photo shows the photo; a place without one shows a clean dot.
 */
function PinMark({ photo, bubble }){
  if (bubble){
    return (
      <span className={'pin-bubble' + (photo ? ' has-photo' : '')} aria-hidden="true">
        {!photo && <span className="pin-core"/>}
        {photo && (
          <img
            className="pin-photo"
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}
      </span>
    );
  }
  return (
    <span className={'pin-dot' + (photo ? ' has-photo' : '')} aria-hidden="true">
      <svg className="pin-shape" viewBox="0 0 24 32" focusable="false">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 8 12 20 12 20s12-12 12-20C24 5.373 18.627 0 12 0Z"/>
      </svg>
      <span className="pin-face">
        {!photo && <span className="pin-core"/>}
        {photo && (
          <img
            className="pin-photo"
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}
      </span>
    </span>
  );
}

/** True when two screen boxes touch (with a little breathing room). */
function overlaps(a, b, pad){
  return !(a.right + pad < b.left || b.right + pad < a.left || a.bottom + pad < b.top || b.bottom + pad < a.top);
}

/**
 * Google-Maps-style declutter, done in screen space after the map settles.
 * Pins that would stack on top of a higher-priority pin step aside, and a name
 * label yields only when another label already owns that patch of map. Names
 * are laid out at every zoom, so the map is readable without tapping each pin.
 * Nothing is removed from the data — it fades back in as soon as the traveller
 * pans or zooms to give it room.
 */
function declutterPins(root){
  if (!root) return;
  const pins = Array.from(root.querySelectorAll('button.spot-pin'));
  if (!pins.length) return;
  pins.forEach(p => p.classList.remove('is-hidden', 'label-hidden', 'label-right'));
  const priority = p => p.classList.contains('active') ? 0 : p.dataset.pin === 'spot' ? 1 : p.dataset.pin === 'discover' ? 3 : 2;
  const ordered = pins
    .map((p, i) => ({ p, i, r: priority(p) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.p);
  const mapBox = root.getBoundingClientRect();
  const keptPins = [];
  const keptNames = [];
  for (const pin of ordered){
    const box = pin.getBoundingClientRect();
    if (!box.width || !box.height) continue; // hidden tab / not laid out yet
    if (keptPins.some(b => overlaps(box, b, 1))){ pin.classList.add('is-hidden'); continue; }
    keptPins.push(box);
    const name = pin.querySelector('.pin-name');
    if (!name) continue;
    // Labels sit to the left of the pin; flip one that would run off the left
    // edge, then measure where it actually landed before deciding collisions.
    pin.classList.remove('label-right');
    if (name.getBoundingClientRect().left < mapBox.left + 6) pin.classList.add('label-right');
    const label = name.getBoundingClientRect();
    if (!label.width) continue;
    // Only another name can hide a name. A neighbouring pin sits beside the
    // text in Google Maps too, and blanking the label there loses the place.
    if (keptNames.some(b => overlaps(label, b, 1))) pin.classList.add('label-hidden');
    else keptNames.push(label);
  }
}


export default function MapTab({ coords, push, showToast, user, setTab, openDirections }){
  const [radius, setRadius] = useState(5);
  const [filter, setFilter] = useState('All');
  // The one shared catalogue (curated + community + dataset), not a per-query
  // recommendation: every pin here is also a row in the Dining/Beaches lists.
  const [places, setPlaces] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
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
  // The close-view flag also decides whether pins may carry a photo, so it is
  // real state (one render per threshold crossing), not only a CSS class.
  const [detailed, setDetailed] = useState(false);
  const viewRef = useRef(viewport);
  const mapRef = useRef(null);
  const shellRef = useRef(null);
  const declutterTimer = useRef(0);

  function markDetail(on){
    if (detailedRef.current === on) return;
    detailedRef.current = on;
    setDetailed(on);
    shellRef.current?.classList.toggle('pins-far', !on);
  }

  function scheduleDeclutter(){
    clearTimeout(declutterTimer.current);
    declutterTimer.current = setTimeout(() => declutterPins(shellRef.current), 90);
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

  // Google-Maps behaviour: tapping a pin eases the map so the pin sits above
  // the bottom sheet instead of behind it. No zoom jump — only the padding.
  function selectSpot(spot){
    setSelectedSpot(spot);
    const map = mapRef.current;
    if (!map || typeof map.easeTo !== 'function') return;
    const bottom = Math.min(Math.round((window.innerHeight || 700) * 0.34), 280);
    map.easeTo({ center: [spot.lng, spot.lat], padding: { top: 0, bottom, left: 0, right: 0 }, duration: 520, easing: easeOut });
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
    let alive = true;
    setBusy(true);
    fetchCatalogue()
      .then(list => { if (alive) setPlaces(list || []); })
      .catch(e => { if (alive) showToast('Offline — places load when the app has been opened online once', 'error', e.message); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A filter or radius change must close a popup that no longer belongs to the
  // visible set (GPS moving the spot out of radius does too, via coords).
  useEffect(() => { setSelectedSpot(null); }, [filter, radius, coords.lng, coords.lat]);

  const withinRadius = place => !hasFix || !Number.isFinite(place.lng) || !Number.isFinite(place.lat)
    || haversineKm(coords.lng, coords.lat, place.lng, place.lat) <= radius;
  // Places without coordinates can't be pinned — drop them, never render an
  // invalid marker.
  const filtered = useMemo(() => places.filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat) && matches(p, filter) && withinRadius(p)), [places, filter, radius, hasFix, coords.lng, coords.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  // U14-B: Mapbox-discovered places (from SearchResults) join the live map,
  // visibly distinct, under the same radius and chip filters.
  const discovered = useMemo(() => {
    const list = sessionGet('lakbai.discovered');
    return Array.isArray(list) ? list : [];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — session snapshot per mount
  const filteredDiscover = useMemo(() =>
    discovered.filter(p => Number.isFinite(p.lng) && Number.isFinite(p.lat) && matches(p, filter) && withinRadius(p)),
  [discovered, filter, radius, hasFix, coords.lng, coords.lat]); // eslint-disable-line react-hooks/exhaustive-deps

  // One pin per place. The catalogue already reconciles the curated spots with
  // the dataset (that is the whole point of the union), but a Mapbox discovery
  // can still be a place the catalogue pins, so the discovery layer yields.
  // Mall tenants never merge: proximity alone cannot tell one business from
  // the next.
  const shown = useMemo(
    () => mergePins({ spots: filtered, discover: filteredDiscover }),
    [filtered, filteredDiscover],
  );

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
        {shown.spots.map(s => {
          const active = selectedSpot && selectedSpot.id === s.id;
          return (
            <MapMarker key={'spot-' + s.id} longitude={s.lng} latitude={s.lat} anchor="center" offset={detailed ? undefined : FAR_PIN_OFFSET} onClick={() => selectSpot(s)}>
              <MarkerContent>
                <button className={'spot-pin' + (detailed ? ' bubble' : '') + (active ? ' active' : '')} data-pin="spot" title={s.name} aria-label={s.name}>
                  <PinMark photo={pinPhoto(s, detailed)} bubble={detailed}/>
                  <span className="pin-name">{active ? s.name : shortName(s.name)}</span>
                </button>
              </MarkerContent>
            </MapMarker>
          );
        })}
        {shown.discover.map(p => (
          <MapMarker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center" offset={detailed ? undefined : FAR_PIN_OFFSET} onClick={() => push({ name:'detail', place:p })}>
            <MarkerContent>
              <button type="button" className={'spot-pin discover' + (detailed ? ' bubble' : '')} data-pin="discover" title={p.name + ' — discovered via Mapbox'} aria-label={p.name}>
                <PinMark photo={pinPhoto(p, detailed)} bubble={detailed}/>
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
      {!busy && !shown.spots.length && !shown.discover.length && (
        <div style={{ position:'absolute', top:110, left:12, right:12, zIndex:5, display:'grid', gap:6, justifyItems:'start' }}>
          <span className="chip" style={{ background:'#fff' }}>No stops here yet — widen the radius.</span>
          <button type="button" data-testid="add-place-link" onClick={() => setAddOpen(true)} style={{ background:'none', border:'none', padding:'2px 4px', fontSize:12.5, fontWeight:600, color:'var(--primary)' }}>
            Can't find it? Add a missing place
          </button>
        </div>
      )}
      {!busy && shown.spots.length > 0 && !shown.discover.length && <div style={{ position:'absolute', top:110, left:12, zIndex:5 }}><span className="chip" style={{ background:'#fff' }}>{shown.spots.length} place{shown.spots.length === 1 ? '' : 's'}{filter === 'All' ? '' : ' · ' + filter.toLowerCase()}</span></div>}

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

      <button
        type="button"
        data-testid="add-place-fab"
        aria-label="Add a missing place"
        title="Add a missing place"
        onClick={() => { setSelectedSpot(null); setAddOpen(true); }}
        style={{ position:'absolute', right:12, bottom:'calc(134px + var(--safe-bottom))', zIndex:6, width:48, height:48, borderRadius:'50%', border:'1px solid #EDF1F7', background:'#fff', color:'var(--primary)', display:'grid', placeItems:'center', boxShadow:'0 10px 24px -12px rgba(10,37,64,.28)', padding:0 }}
      >
        <MapPinPlus size={22}/>
      </button>

      {selectedSpot && <SpotPopup spot={selectedSpot} coords={coords} pop={() => setSelectedSpot(null)} push={push} setTab={setTab} showToast={showToast} user={user} openDirections={openDirections} />}
      {addOpen && <AddPlace coords={coords} hasFix={hasFix} pop={() => setAddOpen(false)} showToast={showToast} user={user} />}
    </div>
  );
}
