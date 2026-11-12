import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ArrowUp, CornerUpLeft, CornerUpRight, RotateCcw, RotateCw, Merge, Flag,
} from 'lucide-react';
import { Map, MapMarker, MarkerContent, MapRoute } from '@/components/ui/map';
import { mapboxToken } from '../staticMap.js';
import { fetchRoute, routeDistanceLabel, routeDurationLabel } from '../directions.js';
import { routeProgress } from '../nav.js';

/** Turn arrow for a Mapbox maneuver. */
function ManeuverIcon({ step, size = 26 }){
  const key = `${step.maneuver} ${step.modifier || ''}`;
  if (/arrive|destination/i.test(key)) return <Flag size={size}/>;
  if (/uturn/i.test(step.maneuver || '')) return <RotateCcw size={size}/>;
  if (/roundabout|rotary/i.test(step.maneuver || '')) return <RotateCw size={size}/>;
  if (/merge/i.test(step.maneuver || '')) return <Merge size={size}/>;
  if (/left/i.test(key)) return <CornerUpLeft size={size}/>;
  if (/right/i.test(key)) return <CornerUpRight size={size}/>;
  return <ArrowUp size={size}/>;
}

/** Centre and zoom that keep the whole route on screen, before the first fix. */
function frameRoute(coordinates){
  const lngs = coordinates.map(c => c[0]);
  const lats = coordinates.map(c => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const span = Math.max(maxLng - minLng, maxLat - minLat);
  const zoom = span > 0 ? Math.max(6.5, Math.min(15, Math.log2(180 / span))) : 13;
  return { center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2], zoom };
}

const NAV_ZOOM = 16;
const PLACE_ZOOM = 13;

function arriveClock(seconds){
  if (!(seconds > 0)) return '';
  try {
    return new Date(Date.now() + seconds * 1000)
      .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * In-app driving guidance. The Mapbox route is drawn on the app's own map and
 * the camera stays on the live fix, so the blue dot never leaves the viewport:
 * a floating card names the next maneuver, the sheet counts down time and
 * distance, and the trip ends on "You have arrived".
 */
export default function RouteSheet({ place, coords, hasFix = true, onClose }){
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const aliveRef = useRef(true);

  const name = place?.name || 'This place';
  const dest = place && Number.isFinite(Number(place.lng)) && Number.isFinite(Number(place.lat))
    ? { lng: Number(place.lng), lat: Number(place.lat) }
    : null;

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!hasFix || !dest) return undefined;
    const ctrl = new AbortController();
    setRoute(null);
    setError(null);
    fetchRoute({ from: coords, to: dest, token: mapboxToken(), signal: ctrl.signal })
      .then(r => { if (aliveRef.current && !ctrl.signal.aborted) setRoute(r); })
      .catch(e => {
        if (ctrl.signal.aborted || e?.name === 'AbortError') return;
        if (aliveRef.current) setError(String(e?.message || e));
      });
    return () => ctrl.abort();
  }, [dest?.lng, dest?.lat, hasFix, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = useMemo(
    () => (route ? routeProgress({ ...route, here: coords }) : null),
    [route, coords?.lng, coords?.lat], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const preview = useMemo(() => (route && !nav ? frameRoute(route.coordinates) : null), [route, nav]);

  // The camera follows the live fix, so the blue dot never drifts out of view.
  // Before a route exists the place itself is on screen, never a blank panel.
  const camera = nav
    ? { center: [coords.lng, coords.lat], zoom: NAV_ZOOM }
    : preview
      || (dest ? { center: [dest.lng, dest.lat], zoom: PLACE_ZOOM } : null)
      || (coords ? { center: [coords.lng, coords.lat], zoom: PLACE_ZOOM } : null);

  const steps = route ? (nav ? route.steps.slice(nav.stepIndex) : route.steps) : [];
  // Mapbox snaps the destination to the nearest road, so the pin belongs on the
  // route's last point — otherwise it drifts off-screen from where the drive ends.
  const endPoint = route?.coordinates?.length
    ? { lng: route.coordinates[route.coordinates.length - 1][0], lat: route.coordinates[route.coordinates.length - 1][1] }
    : dest;
  const arrive = nav && !nav.arrived ? arriveClock(nav.remainingS) : '';
  const loading = hasFix && dest && !route && !error;

  const headTitle = nav
    ? (nav.arrived ? 'Arrived' : routeDurationLabel(nav.remainingS))
    : hasFix ? 'Directions' : 'Location is off';
  const headSub = nav
    ? (nav.arrived ? name : `${routeDistanceLabel(nav.remainingM)}${arrive ? ` · ${arrive} arrival` : ''}`)
    : `to ${name}`;

  return (
    <section className="route-sheet" role="dialog" aria-modal="true" aria-label={`Directions to ${name}`}>
      <div className="nav-map">
        {camera && (
          <Map
            theme="light"
            viewport={camera}
            onViewportChange={() => {}}
            className="absolute inset-0"
            attributionControl
          >
            {route && (
              <>
                <MapRoute
                  id="lakbai-route-casing"
                  coordinates={route.coordinates}
                  color="#FFFFFF"
                  width={10}
                  opacity={0.92}
                />
                <MapRoute
                  id="lakbai-directions"
                  coordinates={route.coordinates}
                  color="#0066FF"
                  width={6}
                  opacity={0.95}
                />
              </>
            )}
            {hasFix && coords && (
              <MapMarker longitude={coords.lng} latitude={coords.lat}>
                <MarkerContent>
                  <span className="route-start" aria-label="Your location"/>
                </MarkerContent>
              </MapMarker>
            )}
            {endPoint && (
              <MapMarker longitude={endPoint.lng} latitude={endPoint.lat} anchor="bottom" offset={[0, 2]}>
                <MarkerContent>
                  <svg className="route-end" viewBox="0 0 24 33" width="25" height="34" role="img" aria-label={name}>
                    <path
                      d="M12 1.4C6.1 1.4 1.4 6.1 1.4 12c0 8 10.6 19.6 10.6 19.6S22.6 20 22.6 12C22.6 6.1 17.9 1.4 12 1.4Z"
                      fill="#0066FF"
                      stroke="#fff"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="4.1" fill="#fff"/>
                  </svg>
                </MarkerContent>
              </MapMarker>
            )}
          </Map>
        )}

        {nav && (
          <div className="nav-top">
            {nav.arrived ? (
              <div className="nav-card is-done" data-testid="nav-arrived">
                <span className="nav-card-ico"><Flag size={34}/></span>
                <div className="nav-card-text">
                  <span className="nav-card-hint">You have arrived</span>
                  <b>{name}</b>
                </div>
              </div>
            ) : (
              <div className="nav-card" data-testid="nav-turn" aria-live="polite">
                <span className="nav-card-ico">
                  <ManeuverIcon
                    step={{ maneuver: nav.nextManeuver, modifier: nav.nextModifier }}
                    size={34}
                  />
                </span>
                <div className="nav-card-text">
                  <span className="nav-card-hint">in {routeDistanceLabel(nav.toStepM)}</span>
                  <b>{nav.nextInstruction}</b>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="nav-sheet">
        {loading && <span className="nav-progress" aria-hidden="true"/>}

        <header className="nav-sheet-head">
          <div className="nav-eta" data-testid="route-summary">
            <b>{headTitle}</b>
            <span>{headSub}</span>
          </div>
          <button
            type="button"
            className="nav-close"
            data-testid="route-close"
            aria-label="Close directions"
            onClick={onClose}
          >
            <X size={18}/>
          </button>
        </header>

        {!hasFix && (
          <p className="nav-copy" data-testid="route-needs-fix">
            Turn on location to get directions from where you are — we won't guess a starting
            point from the middle of Pangasinan.
          </p>
        )}

        {hasFix && !dest && (
          <p className="nav-copy" data-testid="route-error">This place has no map coordinates yet.</p>
        )}

        {hasFix && dest && error && (
          <div data-testid="route-error">
            <p className="nav-copy">{error}</p>
            <button type="button" className="nav-link" data-testid="route-retry" onClick={() => setAttempt(n => n + 1)}>
              Try again
            </button>
          </div>
        )}

        {loading && <p className="nav-copy" data-testid="route-loading">Finding the best route…</p>}

        {steps.length > 0 && !nav?.arrived && (
          <div className="nav-sheet-body">
            <ol className="route-steps">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className={'route-step' + (i === 0 && nav ? ' is-next' : '')}
                  data-testid="route-step"
                >
                  <span className="route-turn"><ManeuverIcon step={step} size={19}/></span>
                  <span className="route-step-text">{step.instruction}</span>
                  <span className="route-step-km">{routeDistanceLabel(step.distanceM)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
