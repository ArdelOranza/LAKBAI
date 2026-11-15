import { useEffect, useState } from 'react';
import { ArrowLeft, Check, MapPin } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { listMySubmissions, withdrawSubmission } from '../store.js';
import { statusLabel, canWithdraw } from '../placeSubmission.js';

const PILL = {
  pending: { background:'#EFF6FF', color:'var(--primary)' },
  live: { background:'#fff', color:'var(--ink)', border:'1px solid #EDF1F7' },
  rejected: { background:'#fff', color:'var(--muted-ink)', border:'1px solid #EDF1F7' },
};

function when(value){
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' });
}

/** What the traveller has sent us, and what happened to it. */
export default function MySubmissions({ pop, showToast }){
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    listMySubmissions(user).then(setRows).catch(() => setRows([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function withdraw(id){
    setConfirmId(null);
    setBusyId(id);
    const res = await withdrawSubmission(user, id);
    setBusyId(null);
    if (res.error) { showToast('Could not withdraw', 'error', res.error); return; }
    setRows(rs => (rs || []).filter(r => r.id !== id));
    showToast('Submission withdrawn');
  }

  return (
    <main style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
        <h1 style={{ marginTop:20, fontSize:27, letterSpacing:'-.8px' }}>My submissions</h1>
        <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--muted-ink)' }}>Places you suggested. An editor reviews each one before it appears on the map.</p>

        <div data-testid="my-submissions-list" style={{ display:'grid', gap:12, marginTop:16 }}>
          {rows && !rows.length && (
            <p data-testid="my-submissions-empty" style={{ color:'var(--muted-ink)', fontSize:14, lineHeight:1.55 }}>
              Nothing submitted yet. Spotted a place we're missing? Add it from the map.
            </p>
          )}
          {(rows || []).map(r => {
            const s = statusLabel(r.status);
            return (
              <article key={r.id} data-testid="submission-row" style={{ border:'1px solid #EDF1F7', borderRadius:16, background:'#fff', padding:13 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <b style={{ flex:1, minWidth:0, fontSize:14.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</b>
                  <span data-testid="submission-status" style={{ ...PILL[s.tone], borderRadius:999, padding:'3px 10px', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}>
                    {s.tone === 'live' && <Check size={11}/>}{s.text}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:5, fontSize:12, color:'var(--muted-ink)' }}>
                  <MapPin size={12}/>{r.town}{when(r.created_at) ? ` · ${when(r.created_at)}` : ''}
                </div>
                {r.status === 'rejected' && r.review_note && (
                  <p data-testid="submission-reason" style={{ margin:'8px 0 0', fontSize:12.5, color:'#475569', lineHeight:1.5 }}>{r.review_note}</p>
                )}
                {canWithdraw(r.status) && (
                  <div style={{ marginTop:9 }}>
                    {confirmId === r.id ? (
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <button type="button" data-testid="confirm-withdraw" disabled={busyId === r.id} onClick={() => withdraw(r.id)} style={{ background:'none', border:'none', padding:0, fontSize:12, fontWeight:700, color:'var(--accent)' }}>Confirm withdraw</button>
                        <button type="button" data-testid="cancel-withdraw" onClick={() => setConfirmId(null)} style={{ background:'none', border:'none', padding:0, fontSize:12, color:'var(--muted-ink)' }}>Cancel</button>
                      </div>
                    ) : (
                      <button type="button" data-testid="withdraw-submission" onClick={() => setConfirmId(r.id)} style={{ background:'none', border:'none', padding:0, fontSize:12, fontWeight:600, color:'var(--muted-ink)' }}>Withdraw</button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
