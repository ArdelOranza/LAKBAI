import { useEffect, useRef, useState } from 'react';
import { X, Check, MapPin, ImagePlus } from 'lucide-react';
import { Map } from '@/components/ui/map';
import { useAuth } from '../AuthContext.jsx';
import { PrimaryBtn, TextField } from '../ui.jsx';
import {
  CATEGORIES, TOWNS, pointLabel, resolvePoint, continueHint, detailsComplete,
} from '../placeSubmission.js';
import { submitPlace, uploadSubmissionPhoto } from '../store.js';

const PREVIEW_ZOOM = 16;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const photoKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const LABEL = { display:'block', fontSize:12, fontWeight:600, margin:'14px 0 6px' };
const SELECT = { width:'100%', padding:'13px 14px', borderRadius:14, border:'1px solid #EDF1F7', background:'#F7F9FC', fontSize:14, color:'var(--ink)' };
const BLANK_DRAFT = { name:'', category:null, town:'', barangay:'', hours:'', price:'', note:'' };

/**
 * Two-step sheet: put a pin, then say what it is. A submission is only ever a
 * traveller's own proposed place — it stays `pending` until an editor approves
 * it, so nothing here draws a pin on the map or claims the place is live.
 */
export default function AddPlace({ coords, hasFix, pop, showToast, user, onSubmitted }){
  const { user: authUser } = useAuth();
  const u = user || authUser;
  const [step, setStep] = useState('pin');
  const [mode, setMode] = useState('map');
  const [mapCenter, setMapCenter] = useState({ lng: coords.lng, lat: coords.lat });
  const [viewport, setViewport] = useState({ center: [coords.lng, coords.lat], zoom: PREVIEW_ZOOM });
  const [draft, setDraft] = useState(BLANK_DRAFT);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const previewRef = useRef(null);

  // A GPS fix only ever came from the traveller's own device; the Pangasinan
  // fallback centre is a place to look, not a place they are standing.
  const fix = hasFix ? { lng: coords.lng, lat: coords.lat } : null;
  const point = resolvePoint({ mode, mapCenter, fix });
  const hint = continueHint({ mode, mapCenter, fix });
  const complete = detailsComplete(draft);

  // Switching to "use my location" moves the preview onto the fix; without one
  // the map does not move, because there is nothing honest to move it to.
  useEffect(() => {
    if (mode !== 'gps' || !fix) return;
    setMapCenter(fix);
    setViewport(v => ({ ...v, center: [fix.lng, fix.lat] }));
  }, [mode, hasFix]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  function onViewportChange(v){
    setViewport(v);
    setMapCenter({ lng: v.center[0], lat: v.center[1] });
  }

  function pickPhoto(e){
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) { showToast('Photo must be under 5 MB', 'error'); return; }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
    previewRef.current = url;
    setPhotoFile(file);
    setPhotoPreview(url);
  }

  function clearPhoto(){
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  async function send(){
    if (!u) { setError('Sign in to send a place.'); return; }
    if (!complete || !point || busy) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError("You're offline. Try again when you have a signal.");
      return;
    }
    setBusy(true);
    setError(null);
    // The photo goes up first, under the traveller's own key, so the row can be
    // written with its path in one go. A failed upload is not worth the form.
    let photoPath = null;
    if (photoFile){
      const up = await uploadSubmissionPhoto(u, photoKey(), photoFile);
      if (up.error) showToast('Photo could not be uploaded — sending without it', 'error', up.error);
      else photoPath = up.path;
    }
    const res = await submitPlace(u, { ...draft, ...point, photoPath });
    setBusy(false);
    if (res.error){ setError(res.error); return; }
    onSubmitted?.();
    setStep('done');
  }

  return (
    <aside className="spot-sheet" data-testid="add-place" role="dialog" aria-label="Add a missing place">
      <div className="spot-scroll">
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ margin:0, fontSize:20, letterSpacing:'-.02em' }}>Add a missing place</h2>
            {step !== 'done' && (
              <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--muted-ink)' }}>
                {step === 'pin' ? 'Pin where it is, then tell us what it is.' : 'An editor checks it before it goes live.'}
              </p>
            )}
          </div>
          {step !== 'done' && (
            <button type="button" className="icon-btn" data-testid="add-place-close" aria-label="Close" disabled={busy} onClick={pop}><X size={17}/></button>
          )}
        </div>

        {step === 'pin' && (
          <>
            <div className="seg" style={{ marginTop:14, width:'100%' }}>
              <button type="button" data-testid="pin-mode-gps" className={mode === 'gps' ? 'on' : ''} style={{ flex:1, minHeight:44 }} onClick={() => setMode('gps')}>
                {fix ? 'Use my location now' : 'Waiting for GPS...'}
              </button>
              <button type="button" data-testid="pin-mode-map" className={mode === 'map' ? 'on' : ''} style={{ flex:1, minHeight:44 }} onClick={() => setMode('map')}>Choose on map</button>
            </div>

            <div style={{ position:'relative', height:240, marginTop:12, borderRadius:16, overflow:'hidden', background:'#EDF1F7' }}>
              <Map
                viewport={viewport}
                onViewportChange={onViewportChange}
                center={viewport.center}
                zoom={PREVIEW_ZOOM}
                theme="light"
                className="absolute inset-0"
              />
              <span className="pin-target" aria-hidden="true">
                <span className="pin-target-head"/>
                <span className="pin-target-foot"/>
              </span>
            </div>

            <p data-testid="pin-value" style={{ margin:'12px 0 0', fontSize:12.5, letterSpacing:'.02em', fontVariantNumeric:'tabular-nums', color:'var(--muted-ink)' }}>{pointLabel(point)}</p>
            <p style={{ margin:'4px 0 0', fontSize:11.5, color:'var(--muted-ink)' }}>Move the map to place the pin. Pangasinan only for now.</p>
            {hint && <p data-testid="pin-hint" style={{ margin:'6px 0 0', fontSize:12, color:'var(--accent)' }}>{hint}</p>}

            <div style={{ marginTop:16 }}>
              <PrimaryBtn testid="pin-continue" disabled={!point} onClick={() => setStep('details')}>Continue</PrimaryBtn>
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <p style={{ margin:'12px 0 0', display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:'var(--muted-ink)' }}>
              <MapPin size={14} color="var(--accent)"/> {pointLabel(point)}
            </p>

            <label style={LABEL} htmlFor="place-name-input">Place name</label>
            <TextField id="place-name-input" testid="place-name" autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Kapwa Garden Cafe"/>

            <span style={LABEL}>Category</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  data-testid={'category-' + c}
                  className={'chip' + (draft.category === c ? ' active' : '')}
                  aria-pressed={draft.category === c}
                  onClick={() => setDraft(d => ({ ...d, category: c }))}
                >{c}</button>
              ))}
            </div>

            <label style={LABEL} htmlFor="place-town-input">Town</label>
            <select id="place-town-input" data-testid="place-town" style={SELECT} value={draft.town} onChange={e => setDraft(d => ({ ...d, town: e.target.value }))}>
              <option value="">Choose a town</option>
              {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <label style={LABEL} htmlFor="place-barangay-input">Barangay <span style={{ fontWeight:400, color:'var(--muted-ink)' }}>(optional)</span></label>
            <TextField id="place-barangay-input" testid="place-barangay" value={draft.barangay} onChange={e => setDraft(d => ({ ...d, barangay: e.target.value }))} placeholder="e.g. Nancayasan"/>

            <label style={LABEL} htmlFor="place-hours-input">Hours <span style={{ fontWeight:400, color:'var(--muted-ink)' }}>(optional, as you know them)</span></label>
            <TextField id="place-hours-input" testid="place-hours" value={draft.hours} onChange={e => setDraft(d => ({ ...d, hours: e.target.value }))} placeholder="e.g. 10am–9pm daily"/>

            <label style={LABEL} htmlFor="place-price-input">Price range <span style={{ fontWeight:400, color:'var(--muted-ink)' }}>(optional)</span></label>
            <TextField id="place-price-input" testid="place-price" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} placeholder="e.g. ₱150–₱400 per person"/>

            <label style={LABEL} htmlFor="place-note-input">Why should this be on the map?</label>
            <textarea id="place-note-input" data-testid="place-note" rows={3} value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} style={{ ...SELECT, resize:'none', lineHeight:1.5 }} placeholder="A line for the editor reviewing it."/>

            <span style={LABEL}>Photo <span style={{ fontWeight:400, color:'var(--muted-ink)' }}>(optional)</span></span>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <label htmlFor="place-photo-input" className={'photo-tile' + (photoPreview ? ' has-photo' : '')}>
                {photoPreview
                  ? <img src={photoPreview} alt="Selected place"/>
                  : <><ImagePlus size={18}/><span>Add a photo</span></>}
              </label>
              {photoPreview && (
                <button type="button" data-testid="remove-photo" onClick={clearPhoto} style={{ background:'none', border:'none', color:'var(--muted-ink)', fontSize:12.5, fontWeight:600 }}>Remove</button>
              )}
            </div>
            <input id="place-photo-input" data-testid="place-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} style={{ display:'none' }}/>
            <p style={{ margin:'6px 0 0', fontSize:11.5, color:'var(--muted-ink)' }}>Reviewed before it appears.</p>

            {error && <p data-testid="add-place-error" style={{ margin:'12px 0 0', fontSize:12.5, color:'var(--accent)' }}>{error}</p>}

            <div style={{ marginTop:18 }}>
              <PrimaryBtn testid="send-submission" disabled={!complete || busy} onClick={send}>{busy ? 'Sending...' : 'Send for review'}</PrimaryBtn>
            </div>
            <div style={{ textAlign:'center', marginTop:12 }}>
              <button type="button" data-testid="back-to-pin" disabled={busy} onClick={() => setStep('pin')} style={{ background:'none', border:'none', color:'var(--muted-ink)', fontSize:13, fontWeight:600 }}>Back</button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign:'center', padding:'18px 0 4px' }}>
            <span className="done-badge"><Check size={26}/></span>
            <h3 style={{ margin:'14px 0 0', fontSize:19 }}>Sent for review</h3>
            <p style={{ margin:'8px 0 0', fontSize:13, lineHeight:1.55, color:'var(--muted-ink)' }}>
              It appears on the map once an editor approves it. You can follow it in Profile → My submissions.
            </p>
            <div style={{ marginTop:20 }}>
              <PrimaryBtn testid="add-place-done" onClick={pop}>Done</PrimaryBtn>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
