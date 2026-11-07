import { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const EMPTY = { name: '', town: '', district: '1', categories: 'Beach, Nature', blurb: '', lng: '', lat: '', photos: '' };

function toForm(spot) {
  if (!spot) return { ...EMPTY };
  return {
    name: spot.name || '',
    town: spot.town || '',
    district: String(spot.district || '1'),
    categories: (spot.categories || []).join(', '),
    blurb: spot.blurb || '',
    lng: spot.lng == null ? '' : String(spot.lng),
    lat: spot.lat == null ? '' : String(spot.lat),
    photos: (spot.photos || []).join('\n'),
  };
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

  const selected = spots.find(s => s.id === selectedId) || null;

  const stats = useMemo(() => ({
    total: spots.length,
    withPhotos: spots.filter(s => (s.photos || []).length).length,
    missing: spots.filter(s => !(s.photos || []).length).length,
  }), [spots]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return spots.filter(s => {
      if (onlyMissing && (s.photos || []).length) return false;
      if (!term) return true;
      return [s.name, s.town, s.district, ...(s.categories || [])].join(' ').toLowerCase().includes(term);
    }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [spots, q, onlyMissing]);

  async function load() {
    setErr('');
    try {
      const { spots: list } = await api.list();
      setSpots(list);
      setAuthed(true);
    } catch (e) {
      setAuthed(false);
      setErr(e.message || 'Could not load spots');
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function saveToken() {
    const t = token.trim();
    setToken(t);
    setTokenState(t);
    if (t) load();
  }

  function edit(spot) {
    setSelectedId(spot.id);
    setIsNew(false);
    setForm(toForm(spot));
  }

  function createNew() {
    setSelectedId(null);
    setIsNew(true);
    setForm({ ...EMPTY });
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
      photos: form.photos.split('\n').map(s => s.trim()).filter(Boolean),
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
      setForm({ ...EMPTY });
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
      if (photo?.src) {
        const next = form.photos.split('\n').map(s => s.trim()).filter(Boolean);
        if (!next.includes(photo.src)) {
          setForm(f => ({ ...f, photos: [...next, photo.src].join('\n') }));
        }
      }
    } catch (e) { setErr(e.message); }
    finally { setPhotoBusy(false); }
  }

  return (
    <div className="admin-shell">
      <div className="admin-top">
        <div className="admin-title">Lakbai Admin</div>
        <div className="admin-sub">Spots and real photos. Separate site — the traveller app never links here.</div>
        <div className="stats">
          <span className="stat">Spots <b>{stats.total}</b></span>
          <span className="stat">With photos <b>{stats.withPhotos}</b></span>
          <span className="stat">Missing photos <b>{stats.missing}</b></span>
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

      <div className="admin-bar">
        <div className="field">
          <input placeholder="Search spots" value={q} onChange={e => setQ(e.target.value)} aria-label="Search spots" data-testid="search" />
        </div>
        <div className="seg" role="tablist" aria-label="Photo filter">
          <button className={!onlyMissing ? 'on' : ''} onClick={() => setOnlyMissing(false)}>All</button>
          <button className={onlyMissing ? 'on' : ''} onClick={() => setOnlyMissing(true)} data-testid="missing-filter">Missing photos</button>
        </div>
        <button className="btn" onClick={createNew} data-testid="create">New site</button>
        <button className="btn secondary" onClick={load}>Refresh</button>
      </div>

      <div className="workspace">
        <div data-testid="list" className="list">
          {filtered.map(s => (
            <button
              key={s.id}
              data-testid="row"
              onClick={() => edit(s)}
              className={`row ${selectedId === s.id ? 'on' : ''}`}
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="row-title">{s.name}</span>
              <span className="row-meta">{s.town} · District {s.district} · {(s.categories || []).join(', ')}</span>
              <span className={`row-badge ${(s.photos || []).length ? 'ok' : 'miss'}`}>
                {(s.photos || []).length ? `${s.photos.length} photo${s.photos.length === 1 ? '' : 's'}` : 'No photo yet'}
              </span>
            </button>
          ))}
          {!filtered.length && <div className="empty">No spots match.</div>}
        </div>

        <div data-testid="editor" className="editor">
          {(!isNew && !selected) ? (
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

              <label className="input-label" htmlFor="f-photos">Photo URLs (one per line)</label>
              <textarea id="f-photos" className="input" rows={4} value={form.photos} onChange={e => set('photos', e.target.value)} data-testid="f-photos" placeholder={'https://upload.wikimedia.org/wikipedia/commons/…/Patar_Beach.jpg'} />
              <div className="photo-links">
                {form.photos.split('\n').filter(Boolean).map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer noopener">Photo {i + 1}</a>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn" onClick={save} disabled={busy} data-testid="save">{busy ? 'Saving' : 'Save changes'}</button>
                <button className="btn secondary" onClick={findRealPhoto} disabled={photoBusy} data-testid="find-photo">{photoBusy ? 'Searching' : 'Find real photo'}</button>
                {!isNew && <button className="btn danger" onClick={remove} data-testid="delete">Delete</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
