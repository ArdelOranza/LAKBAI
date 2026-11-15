import { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const EMPTY = { name: '', town: '', district: '1', categories: 'Beach, Nature', blurb: '', lng: '', lat: '', photos: [] };

function toForm(spot) {
  if (!spot) return { ...EMPTY, photos: [] };
  return {
    name: spot.name || '',
    town: spot.town || '',
    district: String(spot.district || '1'),
    categories: (spot.categories || []).join(', '),
    blurb: spot.blurb || '',
    lng: spot.lng == null ? '' : String(spot.lng),
    lat: spot.lat == null ? '' : String(spot.lat),
    photos: (spot.photos || []).slice(),
  };
}

const isHttp = v => /^https?:\/\/\S+$/i.test(String(v || '').trim());

// --- reviewing a community submission -------------------------------------
const NOTE_MIN = 5;
const NOTE_MAX = 200;
const SAME_PIN_M = 50;
const CHECK_M = 120;
const AREA_M = 400;
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

/** Straight-line metres between two pins (haversine; the admin has no geo module). */
function metresBetween(aLng, aLat, bLng, bLat){
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const nameWords = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Could these names be the same place? One contains the other, or they lead with the same word. */
function namesAlike(a, b){
  const na = nameWords(a), nb = nameWords(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  return na.split(' ')[0] === nb.split(' ')[0];
}

/**
 * Would approving this submission put a second pin on a place that is already
 * there?
 *
 * - on the same spot (50 m) with an alike name: a duplicate, approval blocked;
 * - within 120 m: ask the admin to look;
 * - within 400 m: only a note about what else is nearby.
 * The catalogue has mall tenants on one coordinate, so distance alone never
 * decides — a name signal is required before calling two pins the same place.
 */
function duplicateGuard(submission, spots){
  if (!submission) return null;
  const lng = Number(submission.lng), lat = Number(submission.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  let best = null;
  for (const spot of spots || []){
    const sLng = Number(spot.lng), sLat = Number(spot.lat);
    if (!Number.isFinite(sLng) || !Number.isFinite(sLat)) continue;
    const metres = metresBetween(lng, lat, sLng, sLat);
    if (!best || metres < best.metres) best = { spot, metres, alike: namesAlike(submission.name, spot.name) };
  }
  if (!best || best.metres > AREA_M) return null;
  if (best.metres <= SAME_PIN_M && best.alike) return { ...best, level: 'duplicate' };
  if (best.metres <= CHECK_M) return { ...best, level: 'check' };
  return { ...best, level: 'near' };
}

const fmtMetres = m => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km');
const fmtDate = stamp => {
  const d = new Date(stamp);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

/** Repeatable photo rows: one URL input per photo, live preview, remove/add.
 *  Replaces the old "one URL per line" textarea so multiple photos are edited
 *  as separate fields. */
function PhotoFields({ photos, onChange }) {
  function update(i, value) {
    onChange(photos.map((p, j) => (j === i ? value : p)));
  }
  function remove(i) {
    onChange(photos.filter((_, j) => j !== i));
  }
  return (
    <>
      <div className="photo-rows" data-testid="photo-fields">
        {photos.map((url, i) => (
          <div className="photo-row" key={i}>
            {isHttp(url) && (
              <img
                className="photo-thumb"
                src={url}
                alt=""
                loading="lazy"
                onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
              />
            )}
            <input
              className="input"
              aria-label={`Photo URL ${i + 1}`}
              data-testid={`f-photo-${i}`}
              value={url}
              placeholder="https://upload.wikimedia.org/…"
              onChange={e => update(i, e.target.value)}
            />
            <button
              type="button"
              className="btn secondary"
              data-testid={`remove-photo-${i}`}
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => remove(i)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn secondary" data-testid="add-photo" onClick={() => onChange([...photos, ''])}>
        + Add photo
      </button>
    </>
  );
}

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [spots, setSpots] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [mode, setMode] = useState('spots');
  const [places, setPlaces] = useState([]);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const [placeId, setPlaceId] = useState(null);
  const [placePhotos, setPlacePhotos] = useState([]);
  // Community submissions queue.
  const [subs, setSubs] = useState([]);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [subStatus, setSubStatus] = useState('pending');
  const [subId, setSubId] = useState(null);
  const [subNote, setSubNote] = useState('');
  const [subPhoto, setSubPhoto] = useState(null);
  const [subBusy, setSubBusy] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const selected = spots.find(s => s.id === selectedId) || null;
  const selectedPlace = places.find(p => p.id === placeId) || null;
  const selectedSub = subs.find(s => s.id === subId) || null;
  const dup = useMemo(() => duplicateGuard(selectedSub, spots), [selectedSub, spots]);
  const rows = mode === 'spots' ? spots : mode === 'restos' ? places : subs;

  const stats = useMemo(() => ({
    total: rows.length,
    withPhotos: rows.filter(s => (s.photos || []).length).length,
    missing: rows.filter(s => !(s.photos || []).length).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(s => {
      if (onlyMissing && (s.photos || []).length) return false;
      if (!term) return true;
      return [s.name, s.town, s.address, s.district, ...(s.categories || [])].join(' ').toLowerCase().includes(term);
    }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [rows, q, onlyMissing]);

  async function load() {
    setErr('');
    try {
      const { spots: list } = await api.list();
      setSpots(list);
      setAuthed(true);
      await loadPendingCount();
    } catch (e) {
      setAuthed(false);
      setErr(e.message || 'Could not load spots');
    }
  }

  /** The badge on the Submissions tab; a queue that is not configured stays 0. */
  async function loadPendingCount(){
    try {
      const { submissions } = await api.listSubmissions('pending');
      setPendingCount((submissions || []).length);
    } catch { /* the tab itself explains an unavailable queue */ }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPlaces() {
    setErr('');
    try {
      const { places: list } = await api.places();
      setPlaces(list);
      setPlacesLoaded(true);
    } catch (e) { setErr(e.message || 'Could not load restaurants'); }
  }

  function saveToken() {
    const t = token.trim();
    setToken(t);
    setTokenState(t);
    if (t) load();
  }

  function showSpots() { setMode('spots'); }

  function showRestos() {
    setMode('restos');
    if (!placesLoaded) loadPlaces();
  }

  function showSubs(){
    setMode('subs');
    setSubId(null);
    setSubPhoto(null);
    setSubNote('');
    setNoteError('');
    setNotice('');
    loadSubs(subStatus);
  }

  async function loadSubs(status = subStatus){
    setErr('');
    setSubBusy(true);
    try {
      const { submissions } = await api.listSubmissions(status);
      setSubs(submissions || []);
      setSubsLoaded(true);
      if (status === 'pending') setPendingCount((submissions || []).length);
    } catch (e) { setErr(e.message || 'Could not load submissions'); }
    finally { setSubBusy(false); }
  }

  function selectSub(sub){
    setSubId(sub.id);
    setSubNote('');
    setNoteError('');
    setNotice('');
    setSubPhoto(null);
    if (sub.photo_path){
      api.submissionPhoto(sub.id)
        .then(r => setSubPhoto(r.url || null))
        .catch(() => setSubPhoto(null));
    }
  }

  async function approveSub(){
    const sub = selectedSub;
    if (!sub || dup?.level === 'duplicate') return;
    setErr('');
    setNotice('');
    setSubBusy(true);
    try {
      await api.approveSubmission(sub.id);
      setNotice(`Approved “${sub.name}” — it is a pin on the map now.`);
      setSubId(null);
      setSubPhoto(null);
      setSubNote('');
      setNoteError('');
      await loadSubs(subStatus);
    } catch (e) { setErr(e.message); }
    finally { setSubBusy(false); }
  }

  async function rejectSub(){
    const sub = selectedSub;
    if (!sub) return;
    const note = subNote.trim();
    if (note.length < NOTE_MIN || note.length > NOTE_MAX){
      setNoteError(`Write ${NOTE_MIN}-${NOTE_MAX} characters so the traveller knows why.`);
      return;
    }
    setNoteError('');
    setErr('');
    setNotice('');
    setSubBusy(true);
    try {
      await api.rejectSubmission(sub.id, note);
      setNotice(`Rejected “${sub.name}”. The traveller will see your reason.`);
      setSubId(null);
      setSubPhoto(null);
      setSubNote('');
      await loadSubs(subStatus);
    } catch (e) { setErr(e.message); }
    finally { setSubBusy(false); }
  }

  function edit(spot) {
    setSelectedId(spot.id);
    setIsNew(false);
    setForm(toForm(spot));
  }

  function createNew() {
    setSelectedId(null);
    setIsNew(true);
    setForm({ ...EMPTY, photos: [] });
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function buildPayload() {
    const lng = form.lng === '' ? null : Number(form.lng);
    const lat = form.lat === '' ? null : Number(form.lat);
    return {
      name: form.name.trim(),
      town: form.town.trim(),
      district: form.district,
      categories: form.categories.split(',').map(s => s.trim()).filter(Boolean),
      blurb: form.blurb.trim(),
      lng,
      lat,
      photos: form.photos.map(s => s.trim()).filter(Boolean),
    };
  }

  async function save() {
    setErr('');
    setBusy(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const { spot } = await api.create(payload);
        setSpots(s => [...s, spot]);
        setSelectedId(spot.id);
        setIsNew(false);
      } else {
        const { spot } = await api.update(selectedId, payload);
        setSpots(s => s.map(x => x.id === spot.id ? spot : x));
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!selected || !confirm(`Delete “${selected.name}” from the catalogue?`)) return;
    setErr('');
    try {
      await api.remove(selected.id);
      setSpots(s => s.filter(x => x.id !== selected.id));
      setSelectedId(null);
      setIsNew(false);
      setForm({ ...EMPTY, photos: [] });
    } catch (e) { setErr(e.message); }
  }

  async function findRealPhoto() {
    setErr('');
    setPhotoBusy(true);
    try {
      const { photo } = await api.findPhoto({
        name: form.name, town: form.town,
        lng: form.lng === '' ? undefined : Number(form.lng),
        lat: form.lat === '' ? undefined : Number(form.lat),
      });
      if (photo?.src && !form.photos.includes(photo.src)) {
        setForm(f => ({ ...f, photos: [...f.photos, photo.src] }));
      }
    } catch (e) { setErr(e.message); }
    finally { setPhotoBusy(false); }
  }

  function editPlace(place) {
    setPlaceId(place.id);
    setPlacePhotos((place.photos || []).slice());
  }

  async function savePlacePhotos() {
    setErr('');
    setBusy(true);
    try {
      const photos = placePhotos.map(s => s.trim()).filter(Boolean);
      const { place } = await api.setPhotos(placeId, photos);
      setPlaces(list => list.map(p => (p.id === place.id ? { ...p, photos: place.photos } : p)));
      setPlacePhotos((place.photos || []).slice());
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="admin-shell">
      <div className="admin-top">
        <div className="admin-title">Lakbai Admin</div>
        <div className="admin-sub">Spots, restaurants and real photos. Separate site — the traveller app never links here.</div>
        <div className="stats">
          {mode === 'subs' ? (
            <>
              <span className="stat">Pending <b>{pendingCount}</b></span>
              <span className="stat">{STATUS_LABEL[subStatus]} listed <b>{subs.length}</b></span>
            </>
          ) : (
            <>
              <span className="stat">{mode === 'spots' ? 'Spots' : 'Restaurants'} <b>{stats.total}</b></span>
              <span className="stat">With photos <b>{stats.withPhotos}</b></span>
              <span className="stat">Missing photos <b>{stats.missing}</b></span>
            </>
          )}
          <span className={`status ${authed ? 'ok' : 'bad'}`}>{authed ? 'Connected' : 'Not connected'}</span>
        </div>
      </div>

      <div className="auth">
        <div className="auth-row">
          <label htmlFor="token">Password</label>
          <input id="token" type="password" placeholder="Admin password" value={token} onChange={e => setTokenState(e.target.value)} data-testid="token" autoComplete="current-password" />
          <button className="btn" onClick={saveToken} data-testid="token-save">Sign in</button>
        </div>
        <div className="hint">Your password is stored only on the server as a scrypt hash. It is sent once per request and kept in this browser only.</div>
      </div>

      {err && <p role="alert" data-testid="error" className="error">{err}</p>}
      {notice && <p className="hint" data-testid="notice" role="status">{notice}</p>}

      <div className="admin-bar">
        <div className="seg" role="tablist" aria-label="Catalogue">
          <button className={mode === 'spots' ? 'on' : ''} onClick={showSpots} data-testid="tab-spots">Tourist spots</button>
          <button className={mode === 'restos' ? 'on' : ''} onClick={showRestos} data-testid="tab-restos">Restaurants</button>
          <button className={mode === 'subs' ? 'on' : ''} onClick={showSubs} data-testid="tab-subs">Submissions{pendingCount ? ` (${pendingCount})` : ''}</button>
        </div>
        {mode !== 'subs' && (
          <div className="field">
            <input placeholder={mode === 'spots' ? 'Search spots' : 'Search restaurants'} value={q} onChange={e => setQ(e.target.value)} aria-label="Search" data-testid="search" />
          </div>
        )}
        {mode === 'subs' ? (
          <div className="seg" role="tablist" aria-label="Submission status">
            {['pending', 'approved', 'rejected'].map(st => (
              <button
                key={st}
                className={subStatus === st ? 'on' : ''}
                data-testid={'sub-status-' + st}
                onClick={() => { setSubStatus(st); setSubId(null); setSubPhoto(null); setNotice(''); loadSubs(st); }}
              >
                {STATUS_LABEL[st]}
              </button>
            ))}
          </div>
        ) : (
          <div className="seg" role="tablist" aria-label="Photo filter">
            <button className={!onlyMissing ? 'on' : ''} onClick={() => setOnlyMissing(false)}>All</button>
            <button className={onlyMissing ? 'on' : ''} onClick={() => setOnlyMissing(true)} data-testid="missing-filter">Missing photos</button>
          </div>
        )}
        {mode === 'spots' && <button className="btn" onClick={createNew} data-testid="create">New site</button>}
        <button className="btn secondary" onClick={mode === 'spots' ? load : mode === 'restos' ? loadPlaces : () => loadSubs()} data-testid="refresh">Refresh</button>
      </div>

      {mode === 'subs' && (
        <div className="workspace">
          <div data-testid="sub-list" className="list">
            {subs.map(s => (
              <button
                key={s.id}
                data-testid="sub-row"
                onClick={() => selectSub(s)}
                className={`row ${subId === s.id ? 'on' : ''}`}
                style={{ textAlign: 'left', cursor: 'pointer' }}
              >
                <span className="row-title">{s.name}</span>
                <span className="row-meta">
                  {[s.town, s.barangay, s.email].filter(Boolean).join(' · ')}
                </span>
                <span className={`row-badge ${s.status === 'pending' ? 'miss' : 'ok'}`}>
                  {STATUS_LABEL[s.status] || s.status}{s.created_at ? ' · ' + fmtDate(s.created_at) : ''}
                </span>
              </button>
            ))}
            {!subs.length && (
              <div className="empty">
                {subBusy ? 'Loading submissions...'
                  : subStatus === 'pending' ? 'Nothing waiting for review.'
                  : subStatus === 'approved' ? 'No approved submissions yet.'
                  : 'No rejected submissions yet.'}
              </div>
            )}
          </div>

          <div data-testid="sub-editor" className="editor">
            {!selectedSub ? (
              <div className="empty">
                {subsLoaded ? 'Select a submission on the left to review it.' : 'Open the queue to start reviewing.'}
              </div>
            ) : (
              <>
                <h2>{selectedSub.name}</h2>
                <div className="hint">
                  {[selectedSub.town, selectedSub.barangay, selectedSub.email ? 'submitted by ' + selectedSub.email : '', selectedSub.created_at ? fmtDate(selectedSub.created_at) : ''].filter(Boolean).join(' · ')}
                </div>

                {subPhoto && (
                  <img className="photo-thumb" data-testid="sub-photo" src={subPhoto} alt={`Photo of ${selectedSub.name}`} style={{ width: '100%', height: 180, marginTop: 12 }} />
                )}
                {selectedSub.photo_path && !subPhoto && <div className="hint">The photo is private until approval; its signed link did not load.</div>}

                <div className="hint" style={{ marginTop: 12 }}>
                  {[
                    (selectedSub.categories || []).join(', '),
                    selectedSub.hours ? 'Hours: ' + selectedSub.hours : '',
                    selectedSub.price ? 'Price: ' + selectedSub.price : '',
                    selectedSub.note ? 'Note: ' + selectedSub.note : '',
                  ].filter(Boolean).join(' · ')}
                </div>
                <div className="hint">Pin: {Number(selectedSub.lng).toFixed(5)}, {Number(selectedSub.lat).toFixed(5)}</div>

                {dup && (
                  <p
                    className={dup.level === 'duplicate' ? 'error' : 'hint'}
                    role={dup.level === 'duplicate' ? 'alert' : undefined}
                    data-testid={dup.level === 'duplicate' ? 'sub-duplicate' : 'sub-nearby'}
                    style={{ marginTop: 12 }}
                  >
                    {dup.level === 'duplicate'
                      ? `Same place as “${dup.spot.name}” (${fmtMetres(dup.metres)} away). Reject this submission instead of approving a second pin.`
                      : dup.level === 'check'
                        ? `“${dup.spot.name}” is ${fmtMetres(dup.metres)} away — check this is not the same place.`
                        : `Also near “${dup.spot.name}” (${fmtMetres(dup.metres)}).`}
                  </p>
                )}

                {selectedSub.status === 'pending' ? (
                  <>
                    <label className="input-label" htmlFor="sub-note">Reason (only needed to reject)</label>
                    <textarea id="sub-note" className="input" rows={3} data-testid="sub-note" value={subNote} onChange={e => setSubNote(e.target.value)} placeholder="What should the traveller know?" />
                    <div className="hint">{subNote.trim().length}/{NOTE_MAX} characters — a rejection needs {NOTE_MIN}-{NOTE_MAX}.</div>
                    {noteError && <p className="error" role="alert" data-testid="sub-note-error">{noteError}</p>}

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        data-testid="sub-approve"
                        onClick={approveSub}
                        disabled={subBusy || dup?.level === 'duplicate'}
                      >
                        {subBusy ? 'Working' : 'Approve and pin'}
                      </button>
                      <button className="btn secondary" data-testid="sub-reject" onClick={rejectSub} disabled={subBusy}>Reject</button>
                    </div>
                  </>
                ) : (
                  <div className="hint" style={{ marginTop: 14 }}>
                    {STATUS_LABEL[selectedSub.status] || selectedSub.status}
                    {selectedSub.reviewed_at ? ' on ' + fmtDate(selectedSub.reviewed_at) : ''}
                    {selectedSub.review_note ? ': ' + selectedSub.review_note : ''}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {mode !== 'subs' && (<div className="workspace">
        <div data-testid="list" className="list">
          {filtered.map(s => (
            <button
              key={s.id}
              data-testid="row"
              onClick={() => (mode === 'spots' ? edit(s) : editPlace(s))}
              className={`row ${(mode === 'spots' ? selectedId : placeId) === s.id ? 'on' : ''}`}
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="row-title">{s.name}</span>
              <span className="row-meta">
                {mode === 'spots'
                  ? `${s.town} · District ${s.district} · ${(s.categories || []).join(', ')}`
                  : `${s.town}${s.address ? ' · ' + s.address : ''}`}
              </span>
              <span className={`row-badge ${(s.photos || []).length ? 'ok' : 'miss'}`}>
                {(s.photos || []).length ? `${s.photos.length} photo${s.photos.length === 1 ? '' : 's'}` : 'No photo yet'}
              </span>
            </button>
          ))}
          {!filtered.length && <div className="empty">{mode === 'spots' ? 'No spots match.' : (placesLoaded ? 'No restaurants match.' : 'Loading restaurants…')}</div>}
        </div>

        <div data-testid="editor" className="editor">
          {mode === 'restos' ? (
            !selectedPlace ? (
              <div className="empty">Select a restaurant on the left to add photos.</div>
            ) : (
              <>
                <h2>{selectedPlace.name}</h2>
                <div className="hint">{selectedPlace.town}{selectedPlace.address ? ' · ' + selectedPlace.address : ''} · dataset record (read-only)</div>

                <label className="input-label">Photos</label>
                <PhotoFields photos={placePhotos} onChange={setPlacePhotos} />
                <div className="hint">One URL per photo. Previews load live; invalid or blocked images stay blank in the traveller app.</div>

                <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={savePlacePhotos} disabled={busy} data-testid="save-photos">{busy ? 'Saving' : 'Save photos'}</button>
                </div>
              </>
            )
          ) : ((!isNew && !selected) ? (
            <div className="empty">Select a spot on the left, or create a new one.</div>
          ) : (
            <>
              <h2>{isNew ? 'New site' : selected.name}</h2>
              <div className="hint">{selectedId || 'new'} · Edits go live to the traveller app immediately.</div>

              <label className="input-label" htmlFor="f-name">Name</label>
              <input id="f-name" className="input" value={form.name} onChange={e => set('name', e.target.value)} data-testid="f-name" />

              <label className="input-label" htmlFor="f-town">Town</label>
              <input id="f-town" className="input" value={form.town} onChange={e => set('town', e.target.value)} data-testid="f-town" />

              <label className="input-label" htmlFor="f-district">District</label>
              <input id="f-district" className="input" value={form.district} onChange={e => set('district', e.target.value)} data-testid="f-district" />

              <label className="input-label" htmlFor="f-categories">Categories</label>
              <input id="f-categories" className="input" value={form.categories} onChange={e => set('categories', e.target.value)} data-testid="f-categories" placeholder="Beach, Nature" />

              <label className="input-label" htmlFor="f-blurb">Blurb</label>
              <textarea id="f-blurb" className="input" rows={3} value={form.blurb} onChange={e => set('blurb', e.target.value)} data-testid="f-blurb" />

              <div className="two">
                <div>
                  <label className="input-label" htmlFor="f-lng">Longitude</label>
                  <input id="f-lng" className="input" value={form.lng} onChange={e => set('lng', e.target.value)} data-testid="f-lng" placeholder="120.23" />
                </div>
                <div>
                  <label className="input-label" htmlFor="f-lat">Latitude</label>
                  <input id="f-lat" className="input" value={form.lat} onChange={e => set('lat', e.target.value)} data-testid="f-lat" placeholder="16.03" />
                </div>
              </div>

              <label className="input-label">Photos</label>
              <PhotoFields photos={form.photos} onChange={v => set('photos', v)} />

              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn" onClick={save} disabled={busy} data-testid="save">{busy ? 'Saving' : 'Save changes'}</button>
                <button className="btn secondary" onClick={findRealPhoto} disabled={photoBusy} data-testid="find-photo">{photoBusy ? 'Searching' : 'Find real photo'}</button>
                {!isNew && <button className="btn danger" onClick={remove} data-testid="delete">Delete</button>}
              </div>
            </>
          ))}
        </div>
      </div>)}
    </div>
  );
}
