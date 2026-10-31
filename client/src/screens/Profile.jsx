import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { listPlans, listMyReviews, saveProfile } from '../store.js';
import { loadPrefs } from '../prefs.js';
import { Chip } from '../ui.jsx';

const initialsOf = email => {
  const base = String(email || '').split('@')[0];
  return (base.slice(0, 2) || 'L').toUpperCase();
};

export default function Profile({ push, setTab, user, signOut, showToast }){
  const { user: authUser } = useAuth();
  const u = user || authUser;
  const email = u?.email || '';
  const [plans, setPlans] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [prefs, setPrefs] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listPlans(u).then(r => setPlans(r.data || []));
    listMyReviews(u).then(setReviews);
    loadPrefs(u).then(p => { setPrefs(p.preferences || []); setName(p.display_name || ''); setPhone(p.phone || ''); });
  }, [u?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submitProfile(){
    setBusy(true);
    const res = await saveProfile(u, { display_name: name.trim() || null, phone: phone.trim() || null });
    setBusy(false);
    if (res.error) { showToast(res.error, 'error'); return; }
    setEditing(false);
  }
  return (
    <main style={{ flex:1, overflowY:'auto', paddingBottom:8 }}>
      <div className="pane" style={{ paddingTop:24, textAlign:'center' }}>
        <div style={{ width:74, height:74, margin:'0 auto 10px', borderRadius:'50%', background:'linear-gradient(135deg,#2280E8,#0A3D8F)', color:'#fff', display:'grid', placeItems:'center', fontSize:24, fontWeight:800 }}>{initialsOf(email)}</div>
        {editing ? (
          <div data-testid="profile-edit">
            <input data-testid="profile-name" value={name} onChange={e => setName(e.target.value)} placeholder="Display name" style={{ marginBottom:8 }}/>
            <input data-testid="profile-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 …" style={{ marginBottom:10 }}/>
            <div><button data-testid="profile-save" className="chip active" style={{ padding:'10px 22px', color:'#fff' }} onClick={submitProfile} disabled={busy}>Save</button></div>
          </div>
        ) : (
          <>
            <h1 style={{ margin:0 }}>{name || email.split('@')[0]}</h1>
            <p style={{ color:'var(--muted-ink)', fontSize:13, margin:'2px 0 0' }}>{email}{phone ? ' · 📱 ' + phone : ''}</p>
            <button className="chip" data-testid="profile-edit-btn" onClick={() => setEditing(true)}>✏️ Edit</button>
          </>
        )}
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <div style={{ flex:1, background:'var(--chip)', borderRadius:16, padding:12 }} data-testid="stat-plans">
            <b style={{ fontSize:20, color:'var(--primary)' }}>{plans.length}</b>
            <p style={{ fontSize:11, color:'var(--muted-ink)', margin:0 }}>Trips Planned</p>
          </div>
          <div style={{ flex:1, background:'var(--chip)', borderRadius:16, padding:12 }} data-testid="stat-reviews">
            <b style={{ fontSize:20, color:'var(--primary)' }}>{reviews.length}</b>
            <p style={{ fontSize:11, color:'var(--muted-ink)', margin:0 }}>Reviews Written</p>
          </div>
        </div>
      </div>
      <div className="pane" style={{ display:'grid', gap:8, marginTop:16 }}>
        <button className="chip" data-testid="menu-itineraries" style={{ textAlign:'left' }} onClick={() => push({ name:'itineraries' })}>🗂 Saved Itineraries <span style={{ float:'right', color:'var(--muted-ink)' }}>›</span></button>
        <button className="chip" data-testid="menu-interests" style={{ textAlign:'left' }} onClick={() => push({ name:'prefs-edit' })}>✦ Edit Interests <span style={{ float:'right', color:'var(--muted-ink)' }}>›</span></button>
        <button className="chip" data-testid="menu-reviews" style={{ textAlign:'left' }} onClick={() => push({ name:'myReviews' })}>📝 My Reviews <span style={{ float:'right', color:'var(--muted-ink)' }}>›</span></button>
        <button data-testid="logout-btn" style={{ marginTop:8, background:'#fff', border:'1px solid #FCA5A5', color:'#DC2626', fontWeight:600 }} onClick={async () => { await signOut(); setTab('home'); }}>Log Out</button>
      </div>
      {prefs.length ? (
        <div className="pane" style={{ marginTop:14 }}>
          <p style={{ fontSize:11, letterSpacing:1, color:'var(--muted-ink)' }}>YOUR TRAVEL VIBE</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {prefs.slice(0, 8).map(t => <Chip key={t}>{t}</Chip>)}
          </div>
        </div>
      ) : null}
    </main>
  );
}
