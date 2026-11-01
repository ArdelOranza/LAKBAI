import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { listPlans, listMyReviews } from '../store.js';
import { loadPrefs } from '../prefs.js';
import { Route, MessageSquare, Bookmark, SlidersHorizontal, ChevronRight, LogOut } from 'lucide-react';

const initialsOf = (name, email) => {
  const src = String(name || '').trim() || String(email || '').split('@')[0];
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || 'L') + (parts[1]?.[0] || '')).toUpperCase();
};

export default function Profile({ push, setTab, user, signOut }){
  const { user: authUser } = useAuth();
  const u = user || authUser;
  const email = u?.email || '';
  const [plans, setPlans] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => {
    listPlans(u).then(r => setPlans(r.data || []));
    listMyReviews(u).then(setReviews);
    loadPrefs(u).then(p => { setName(p.display_name || ''); setPhone(p.phone || ''); });
  }, [u?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = name || email.split('@')[0] || 'Traveler';

  return (
    <main className="screen" style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:28 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>
          <div aria-hidden="true" style={{ width:86, height:86, minWidth:86, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center', fontSize:26, fontWeight:800, letterSpacing:.5 }}>
            {initialsOf(name, email)}
          </div>
          <div style={{ flex:1, minWidth:0, paddingTop:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <h2 style={{ margin:0, fontSize:19, letterSpacing:'-.2px', fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</h2>
              <button data-testid="profile-edit-btn" onClick={() => push({ name:'profileEdit' })} style={{ flex:'0 0 auto', background:'#EFF6FF', color:'var(--primary)', border:'none', borderRadius:999, padding:'5px 13px', fontSize:12, fontWeight:600 }}>Edit</button>
            </div>
            <p style={{ margin:'3px 0 0', fontSize:13, color:'var(--muted-ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{email}</p>
            <p style={{ margin:'2px 0 0', fontSize:13, color:'var(--muted-ink)' }}>{phone || 'Add a contact number'}</p>
          </div>
        </div>

        <div style={{ display:'flex', gap:12, marginTop:20 }}>
          <div className="stat-card" data-testid="stat-plans">
            <span className="si"><Route size={17}/></span>
            <b>{plans.length}</b>
            <span>Trips Planned</span>
          </div>
          <div className="stat-card" data-testid="stat-reviews">
            <span className="si"><MessageSquare size={17}/></span>
            <b>{reviews.length}</b>
            <span>Reviews Written</span>
          </div>
        </div>

        <div style={{ display:'grid', gap:10, marginTop:22 }}>
          <button className="menu-row" data-testid="menu-itineraries" onClick={() => push({ name:'itineraries' })}>
            <span className="mi"><Bookmark size={18}/></span>
            Saved Itineraries
            <span className="chev"><ChevronRight size={18}/></span>
          </button>
          <button className="menu-row" data-testid="menu-interests" onClick={() => push({ name:'prefs-edit' })}>
            <span className="mi"><SlidersHorizontal size={18}/></span>
            Travel Preferences
            <span className="chev"><ChevronRight size={18}/></span>
          </button>
          <button className="menu-row" data-testid="menu-reviews" onClick={() => push({ name:'myReviews' })}>
            <span className="mi"><MessageSquare size={18}/></span>
            My Reviews
            <span className="chev"><ChevronRight size={18}/></span>
          </button>
        </div>

        <button
          data-testid="logout-btn"
          onClick={async () => { await signOut(); setTab('home'); }}
          style={{ width:'100%', marginTop:22, background:'#FEF2F2', border:'1px solid #FEE2E2', color:'#DC2626', fontWeight:600, fontSize:14, borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
        >
          <LogOut size={17}/>
          Log Out
        </button>
      </div>
    </main>
  );
}
