import { useEffect, useState } from 'react';
import {
  ArrowLeft, Phone, Cross, Shield, LocateFixed, Info, ChevronRight,
} from 'lucide-react';
import { FALLBACK_CENTER } from '../App.jsx';
import { haversineKm } from '../geo.js';
import { telHref, directionsHref, awayLabel } from '../emergency.js';

const BASE = import.meta.env.VITE_API_URL || '';

// Public national numbers plus the provincial disaster office. Nothing local is
// guessed: nearby stations come from the live lookup.
const HOTLINES = [
  { name: 'Philippine Red Cross', number: '143', note: 'Ambulance and first aid' },
  { name: 'Pangasinan PDRRMO', number: '(075) 542-6802', note: 'Provincial disaster response' },
];

function PlaceRow({ place, icon:Icon }){
  const href = directionsHref(place.lat, place.lng);
  const body = (
    <>
      <Icon size={17} className="emg-place-ico"/>
      <span className="emg-place-main">
        <b>{place.name}</b>
        <span>{place.address || 'Pangasinan'}</span>
        {place.km != null && <span className="emg-place-dist">{awayLabel(place.km)}</span>}
      </span>
      <span className="emg-go"><ChevronRight size={15}/></span>
    </>
  );
  return href
    ? <a className="emg-place" href={href} target="_blank" rel="noreferrer">{body}</a>
    : <div className="emg-place">{body}</div>;
}

export default function Emergency({ coords, pop, showToast }){
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const at = `${coords.lng},${coords.lat}`;
  // Value compare like MapTab: reference equality breaks when the caller
  // passes a fresh fallback object (tests, another screen) — and on a safety
  // screen that would silently share fabricated coordinates.
  const hasFix = coords && !(coords.lng === FALLBACK_CENTER.lng && coords.lat === FALLBACK_CENTER.lat);
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    setFailed(false);
    fetch(`${BASE}/api/emergency?proximity=${encodeURIComponent(at)}`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error('lookup failed'); return r.json(); })
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); };
  }, [at]);

  async function shareLocation(){
    if (!hasFix) { showToast('Turn on location access to share your spot', 'error'); return; }
    const url = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    try {
      if (navigator.share) { await navigator.share({ title:'My location', text:'I need help here.', url }); return; }
      await navigator.clipboard.writeText(url);
      showToast('Location link copied');
    } catch {
      showToast('Could not share your location', 'error');
    }
  }

  // Nearest first — time-critical on a safety screen. Null distances go last.
  const withKm = list => (list || []).map(p => ({
    ...p,
    km: haversineKm(coords.lng, coords.lat, p.lng, p.lat),
  })).sort((a, b) => (a.km == null ? Infinity : a.km) - (b.km == null ? Infinity : b.km));
  const hospitals = withKm(data && data.hospitals);
  const police = withKm(data && data.police);

  return (
    <main data-testid="emergency-page" style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16, paddingBottom:36 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>

        <h1 style={{ margin:'16px 0 0', fontSize:27, letterSpacing:'-.8px' }}>Emergency</h1>
        <p style={{ margin:'2px 0 0', fontSize:12.5, color:'var(--muted-ink)' }}>
          {hasFix ? 'Your live location' : 'Pangasinan'} • 24/7 help
        </p>

        <a className="emg-dial" data-testid="emergency-call" href="tel:911">
          <span className="emg-dial-ico"><Phone size={21}/></span>
          <span className="emg-dial-text">
            <b>Call 911</b>
            <span>National emergency hotline</span>
          </span>
        </a>
        <p className="emg-fine">Free from any phone, day or night.</p>

        <button type="button" className="emg-share" onClick={shareLocation}>
          <LocateFixed size={15}/> Share my location
        </button>
        {!hasFix && <p className="emg-note">Location is off — nearby help is sorted from the province centre.</p>}

        <section>
          <h2 className="emg-h">Hotlines</h2>
          <div className="emg-lines">
            {HOTLINES.map(h => (
              <a key={h.number} className="emg-line" href={telHref(h.number)}>
                <span className="emg-line-main">
                  <b>{h.name}</b>
                  <span>{h.note}</span>
                </span>
                <span className="emg-line-num">{h.number}</span>
              </a>
            ))}
          </div>
        </section>

        <section>
          <h2 className="emg-h">Hospitals near you</h2>
          {!data && !failed && <p className="shimmer" style={{ fontSize:13, margin:0 }}>Finding the closest hospitals...</p>}
          {data && !hospitals.length && <p className="emg-note">No hospitals listed nearby.</p>}
          <div className="emg-places">
            {hospitals.map(h => <PlaceRow key={h.id || h.name} place={h} icon={Cross}/>)}
          </div>
        </section>

        <section>
          <h2 className="emg-h">Police near you</h2>
          {!data && !failed && <p className="shimmer" style={{ fontSize:13, margin:0 }}>Finding the closest stations...</p>}
          {data && !police.length && <p className="emg-note">No police stations listed nearby.</p>}
          <div className="emg-places">
            {police.map(p => <PlaceRow key={p.id || p.name} place={p} icon={Shield}/>)}
          </div>
        </section>

        {failed && (
          <p className="emg-note"><Info size={13}/> Live lookup is unavailable — the hotlines above still work.</p>
        )}
        <p className="emg-note" style={{ marginTop:18 }}>
          Save these before you travel — signal drops along the coast and inside the caves.
        </p>
      </div>
    </main>
  );
}