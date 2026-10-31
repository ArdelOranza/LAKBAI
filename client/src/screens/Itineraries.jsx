import { useEffect, useState } from 'react';
import { listPlans } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { planStatus, matchesFilter, STATUS_FILTERS } from '../planStatus.js';
import { sessionGet } from '../sessionCache.js';
import { Chip, PrimaryBtn } from '../ui.jsx';

export default function Itineraries({ pop, push, setTab, showToast }){
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all');
  const wym = sessionGet('lakbai.wx'); // temp chip only when the weather was cached on an itinerary view
  useEffect(() => {
    listPlans(user).then(r => setRows(r.data || [])).catch(() => setRows([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (rows || []).filter(p => matchesFilter(planStatus(p.starts_at), filter));
  return (
    <main style={{ flex:1, overflowY:'auto', paddingBottom:12 }}>
      <div className="pane" style={{ paddingTop:16, display:'flex', alignItems:'center', gap:10 }}>
        <button data-testid="back-btn" onClick={pop} aria-label="Back" style={{ width:36, height:36, borderRadius:'50%', border:'1px solid var(--border)' }}>←</button>
        <div>
          <h1 style={{ margin:0 }}>{rows ? rows.length : '—'} Saved Plans</h1>
          <p style={{ color:'var(--muted-ink)', fontSize:13, margin:0 }}>Your Pangasinan Journeys</p>
        </div>
      </div>
      <div className="pane" style={{ display:'flex', gap:8, marginTop:12 }}>
        {STATUS_FILTERS.map(([label, k]) => <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{label}</Chip>)}
      </div>
      <div className="pane" data-testid="itineraries-list" style={{ display:'grid', gap:10, marginTop:12 }}>
        {rows && !shown.length && <p data-testid="no-plans" style={{ color:'var(--muted-ink)', fontSize:14 }}>No saved plans {filter !== 'all' ? 'in ' + filter : 'yet'}.</p>}
        {shown.map(p => {
          const status = planStatus(p.starts_at);
          return (
            <article key={p.id} data-testid="itinerary-row" onClick={() => push({ name:'itinerary', plan:p })} style={{ display:'flex', gap:12, border:'1px solid var(--border)', borderRadius:18, background:'#fff', padding:12, cursor:'pointer' }}>
              <div style={{ width:64, height:64, flex:'0 0 64px', borderRadius:14, background:'linear-gradient(135deg,#2280E8,#0A3D8F)' }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <b style={{ display:'block' }}>{p.title}</b>
                <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'2px 0' }}>
                  {p.starts_at ? new Date(p.starts_at).toLocaleDateString([], { month:'short', day:'numeric' }) + ' • ' : ''}{(p.schedule || []).length} Stops
                </p>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {status && <span className="chip active" style={{ fontSize:10, padding:'2px 8px', color:'#fff' }}>{status}</span>}
                  {wym && <span className="chip" style={{ fontSize:10, padding:'2px 8px' }}>{wym.tempC}°C {wym.condition}</span>}
                </div>
              </div>
              <span>›</span>
            </article>
          );
        })}
      </div>
      <div className="pane" style={{ marginTop:16 }}>
        <div data-testid="generate-new"><PrimaryBtn onClick={() => setTab('saved')}>✦ Generate New AI Itinerary</PrimaryBtn></div>
        <p data-testid="offline-footer" style={{ fontSize:11, color:'var(--muted-ink)', textAlign:'center', marginTop:8, display:'flex', gap:6, alignItems:'center', justifyContent:'center' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--primary)', display:'inline-block' }}/> All plans synced offline — Available without mobile data on coastal routes
        </p>
      </div>
    </main>
  );
}
