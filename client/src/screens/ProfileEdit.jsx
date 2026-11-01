import { useEffect, useState } from 'react';
import { ArrowLeft, Camera, User, Mail, Phone, Check } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { loadPrefs } from '../prefs.js';
import { saveProfile } from '../store.js';

const initialsOf = (name, email) => {
  const src = String(name || '').trim() || String(email || '').split('@')[0];
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || 'L') + (parts[1]?.[0] || '')).toUpperCase();
};

export default function ProfileEdit({ pop, showToast, user }){
  const { user: authUser } = useAuth();
  const u = user || authUser;
  const email = u?.email || '';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadPrefs(u).then(p => { setName(p.display_name || ''); setPhone(p.phone || ''); });
  }, [u?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(){
    setBusy(true);
    const res = await saveProfile(u, { display_name: name.trim() || null, phone: phone.trim() || null });
    setBusy(false);
    if (res.error) { showToast('Could not save profile', 'error', res.error); return; }
    showToast('Profile updated');
    pop();
  }

  return (
    <main style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16 }}>
        <button className="icon-btn" data-testid="back-btn" onClick={pop} aria-label="Back"><ArrowLeft size={18}/></button>
      </div>

      <div className="pane" style={{ paddingTop:18, textAlign:'center' }}>
        <div style={{ position:'relative', width:96, height:96, margin:'0 auto' }}>
          <div aria-hidden="true" style={{ width:96, height:96, borderRadius:'50%', background:'var(--primary)', color:'#fff', display:'grid', placeItems:'center', fontSize:28, fontWeight:800 }}>
            {initialsOf(name, email)}
          </div>
          <span aria-hidden="true" style={{ position:'absolute', right:2, bottom:2, width:30, height:30, borderRadius:'50%', background:'var(--primary)', border:'3px solid #fff', color:'#fff', display:'grid', placeItems:'center' }}>
            <Camera size={14}/>
          </span>
        </div>
        <button onClick={() => showToast('Photo upload is coming soon')} style={{ background:'none', border:'none', color:'var(--primary)', fontSize:12.5, fontWeight:600, marginTop:10 }}>Change Profile Photo</button>
      </div>

      <div className="pane" style={{ paddingTop:6 }}>
        <div className="label">Full name</div>
        <label className="field">
          <input data-testid="profile-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"/>
          <span className="fi"><User size={17}/></span>
        </label>

        <div className="label">Email address</div>
        <label className="field" style={{ opacity:.75 }}>
          <input value={email} readOnly aria-label="Email address"/>
          <span className="fi"><Mail size={17}/></span>
        </label>

        <div className="label">Contact number</div>
        <label className="field">
          <input data-testid="profile-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 9XX XXX XXXX" inputMode="tel"/>
          <span className="fi"><Phone size={17}/></span>
        </label>

        <div style={{ marginTop:26, paddingBottom:20 }}>
          <button data-testid="profile-save" className="primary-btn" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save Changes'} <Check size={17}/>
          </button>
        </div>
      </div>
    </main>
  );
}
