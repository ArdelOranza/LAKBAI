import { useEffect, useState } from 'react';
import { ArrowLeft, Star, BookOpen, Mountain, Pencil, Trash2 } from 'lucide-react';
import { listMyReviews, updateReview, deleteReview } from '../store.js';
import { useAuth } from '../AuthContext.jsx';

function Stars({ score }){
  return (
    <span style={{ display:'inline-flex', gap:1.5, color:'var(--primary)' }} aria-label={`${score} out of 5 stars`}>
      {[1,2,3,4,5].map(n => <Star key={n} size={12.5} fill={n <= score ? 'currentColor' : 'none'} strokeWidth={1.8}/>)}
    </span>
  );
}

export default function MyReviews({ pop, showToast }){
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ score:5, text:'' });
  useEffect(() => {
    listMyReviews(user).then(setRows).catch(() => setRows([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const avg = rows && rows.length ? rows.reduce((a, r) => a + r.score, 0) / rows.length : null;
  function startEdit(r){ setEditing(r.id); setDraft({ score:r.score, text:r.text || '' }); }
  async function saveEdit(id){
    const res = await updateReview(user, id, draft);
    if (res.error) { showToast('Could not update review', 'error', res.error); return; }
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...draft } : r));
    setEditing(null);
    showToast('Review updated');
  }
  async function remove(id){
    const res = await deleteReview(user, id);
    if (res.error) { showToast('Could not delete review', 'error', res.error); return; }
    setRows(rs => rs.filter(r => r.id !== id));
    showToast('Review deleted');
  }
  return (
    <main style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
        <h1 style={{ marginTop:20, fontSize:27, letterSpacing:'-.8px' }}>My Reviews</h1>

        {rows && rows.length > 0 && (
          <div data-testid="my-reviews-summary" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:12, paddingBottom:14, borderBottom:'1px solid #EDF1F7' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:12, color:'var(--muted-ink)' }}>
              <BookOpen size={14} color="var(--primary)"/> {rows.length} Published Reviews
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600 }}>
              <Star size={13} fill="var(--primary)" color="var(--primary)"/> {avg.toFixed(1)} Avg Rating
            </span>
          </div>
        )}

        <div data-testid="my-reviews-list" style={{ display:'grid', gap:12, marginTop:14 }}>
          {rows && !rows.length && <p style={{ color:'var(--muted-ink)', fontSize:14 }}>No reviews yet.</p>}
          {(rows || []).map(r => (
            <article key={r.id} data-testid="my-review-card" style={{ display:'flex', gap:12, border:'1px solid #EDF1F7', borderRadius:16, background:'#fff', padding:12 }}>
              <div className="thumb" style={{ width:64, height:64, minWidth:64 }}>
                {r.photo ? <img src={r.photo} alt={r.place_name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Mountain size={22}/>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                  <b style={{ fontSize:14 }}>{r.place_name}</b>
                  <span style={{ fontSize:11, color:'var(--muted-ink)', whiteSpace:'nowrap' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) : ''}</span>
                </div>
                {editing === r.id ? (
                  <div style={{ marginTop:8 }}>
                    <select data-testid="edit-score" value={draft.score} onChange={e => setDraft(d => ({ ...d, score:Number(e.target.value) }))} style={{ width:110, padding:'8px 10px' }}>
                      {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
                    </select>
                    <textarea data-testid="edit-text" rows={2} value={draft.text} onChange={e => setDraft(d => ({ ...d, text:e.target.value }))} style={{ marginTop:8 }}/>
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button data-testid="save-review" className="primary-btn" style={{ minHeight:38, fontSize:13, width:'auto', padding:'0 18px' }} onClick={() => saveEdit(r.id)}>Save</button>
                      <button className="chip" style={{ fontSize:12, padding:'8px 14px' }} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop:3 }}><Stars score={r.score}/></div>
                    {r.text && <p style={{ fontSize:12.5, margin:'5px 0 0', color:'var(--ink)', lineHeight:1.5 }}>{r.text}</p>}
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
                      <button data-testid="edit-review" onClick={() => startEdit(r)} style={{ background:'none', border:'none', padding:0, fontSize:11.5, color:'var(--muted-ink)', display:'inline-flex', alignItems:'center', gap:4 }}><Pencil size={12}/> Edit</button>
                      <span style={{ color:'#CBD5E1' }}>|</span>
                      <button data-testid="delete-review" onClick={() => remove(r.id)} style={{ background:'none', border:'none', padding:0, fontSize:11.5, color:'var(--muted-ink)', display:'inline-flex', alignItems:'center', gap:4 }}><Trash2 size={12}/> Delete</button>
                    </div>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
