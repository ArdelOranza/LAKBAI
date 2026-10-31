import { useEffect, useState } from 'react';
import { listMyReviews, updateReview, deleteReview } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { PrimaryBtn } from '../ui.jsx';

export default function MyReviews({ pop, showToast }){
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null); // review id being edited
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
    <main style={{ flex:1, overflowY:'auto', paddingBottom:12 }}>
      <div className="pane" style={{ paddingTop:16, display:'flex', alignItems:'center', gap:10 }}>
        <button data-testid="back-btn" onClick={pop} aria-label="Back" style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)' }}>←</button>
        <div>
          <h1 style={{ margin:0 }}>My Reviews</h1>
          {rows && rows.length > 0 && (
            <span className="chip" data-testid="my-reviews-summary" style={{ fontSize:10, padding:'2px 10px' }}>
              {rows.length} Published Reviews · ★ {avg.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="pane" data-testid="my-reviews-list" style={{ display:'grid', gap:10, marginTop:14 }}>
        {rows && !rows.length && <p style={{ color:'var(--muted-ink)', fontSize:14 }}>No reviews yet.</p>}
        {(rows || []).map(r => (
          <article key={r.id} data-testid="my-review-card" style={{ border:'1px solid var(--border)', borderRadius:16, background:'#fff', padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <b style={{ fontSize:13 }}>{r.place_name}</b>
              <span style={{ fontSize:11, color:'var(--muted-ink)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
            </div>
            {editing === r.id ? (
              <div>
                <select data-testid="edit-score" value={draft.score} onChange={e => setDraft(d => ({ ...d, score:Number(e.target.value) }))} style={{ width:120, marginTop:8 }}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
                </select>
                <textarea data-testid="edit-text" rows={2} value={draft.text} onChange={e => setDraft(d => ({ ...d, text:e.target.value }))} style={{ marginTop:8 }}/>
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <div style={{ flex:1 }}><PrimaryBtn testid="save-review" onClick={() => saveEdit(r.id)}>Save</PrimaryBtn></div>
                  <button className="chip" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:12 }}>{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</div>
                {r.text && <p style={{ fontSize:13, margin:'4px 0' }}>{r.text}</p>}
                <div style={{ display:'flex', gap:8, marginTop:6 }}>
                  <button data-testid="edit-review" className="chip" style={{ fontSize:12 }} onClick={() => startEdit(r)}>✏️ Edit</button>
                  <button data-testid="delete-review" className="chip" style={{ fontSize:12, color:'#DC2626' }} onClick={() => remove(r.id)}>🗑 Delete</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
