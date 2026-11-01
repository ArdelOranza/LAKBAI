import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus, Sparkles, Sun, Cloud, Info, Mountain } from 'lucide-react';
import { listPlans } from '../store.js';
import { useAuth } from '../AuthContext.jsx';
import { planStatus, matchesFilter, STATUS_FILTERS } from '../planStatus.js';
import { sessionGet } from '../sessionCache.js';

const STATUS_STYLE = {
  Upcoming: { background:'#E7F0FE', color:'#1667D9' },
  Active: { background:'#E7F0FE', color:'#1667D9' },
  Completed: { background:'#E8F7EE', color:'#15803D' },
};

export default function Itineraries({ pop, push, setTab }){
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all');
  const wx = sessionGet('lakbai.wx'); // temp chip only when the weather was cached on an itinerary view
  useEffect(() => {
    listPlans(user).then(r => setRows(r.data || [])).catch(() => setRows([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (rows || []).filter(p => matchesFilter(planStatus(p.starts_at), filter));

  return (
    <main style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
        <h1 style={{ marginTop:20, fontSize:27, letterSpacing:'-.8px' }}>Saved Itineraries</h1>

        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, marginTop:10 }}>
          <div>
            <p style={{ margin:0, fontSize:12, color:'var(--muted-ink)' }}>{rows ? rows.length : '—'} Saved Plans</p>
            <b style={{ fontSize:14 }}>Your Pangasinan Journeys</b>
          </div>
          <div className="seg">
            {STATUS_FILTERS.map(([label, k]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
        </div>

        <div data-testid="itineraries-list" style={{ display:'grid', gap:10, marginTop:16 }}>
          {rows && !shown.length && <p data-testid="no-plans" style={{ color:'var(--muted-ink)', fontSize:14 }}>No saved plans {filter !== 'all' ? 'in ' + filter : 'yet'}.</p>}
          {shown.map(p => {
            const status = planStatus(p.starts_at);
            const stops = (p.schedule || []).length;
            return (
              <article key={p.id} data-testid="itinerary-row" onClick={() => push({ name:'itinerary', plan:p })} style={{ display:'flex', gap:12, alignItems:'center', border:'1px solid #EDF1F7', borderRadius:16, background:'#fff', padding:12, cursor:'pointer' }}>
                <div className="thumb" style={{ width:58, height:58, minWidth:58 }}>
                  {p.photo ? <img src={p.photo} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Mountain size={22}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <b style={{ display:'block', fontSize:15 }}>{p.title}</b>
                  <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'2px 0 0' }}>
                    {p.starts_at ? new Date(p.starts_at).toLocaleDateString([], { month:'short', day:'numeric' }) + ' • ' : ''}{stops} Stops
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                    {wx && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, color:'var(--muted-ink)' }}><Sun size={13}/> {wx.tempC}°C</span>}
                    {status && <span style={{ fontSize:10.5, fontWeight:600, padding:'2px 9px', borderRadius:999, ...(STATUS_STYLE[status] || STATUS_STYLE.Upcoming) }}>{status}</span>}
                  </div>
                </div>
                <ChevronRight size={18} color="#94A3B8"/>
              </article>
            );
          })}
        </div>

        <div data-testid="generate-new" className="soft-card" style={{ marginTop:12, cursor:'pointer' }} onClick={() => setTab('saved')}>
          <span style={{ width:28, height:28, minWidth:28, borderRadius:'50%', background:'#fff', color:'var(--primary)', display:'grid', placeItems:'center' }}>
            <Plus size={16}/>
          </span>
          <b style={{ flex:1, color:'var(--primary)', fontSize:13.5 }}>Generate New AI Itinerary</b>
          <Sparkles size={17} color="var(--primary)"/>
        </div>

        <div data-testid="offline-footer" style={{ marginTop:'auto', display:'flex', alignItems:'center', gap:10, background:'#F1F5F9', borderRadius:14, padding:'12px 14px', margin:'24px 0 24px' }}>
          <Cloud size={18} color="var(--primary)"/>
          <span style={{ flex:1 }}>
            <b style={{ display:'block', fontSize:12 }}>All plans synced offline</b>
            <span style={{ fontSize:11, color:'var(--muted-ink)' }}>Available without mobile data on coastal routes</span>
          </span>
          <Info size={15} color="#94A3B8"/>
        </div>
      </div>
    </main>
  );
}
