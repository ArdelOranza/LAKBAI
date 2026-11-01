import { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { validateSignup } from '../authValidate.js';
import Logo from '../logo.jsx';
import { PrimaryBtn } from '../ui.jsx';

const LABEL = { display:'block', fontSize:12, fontWeight:600, margin:'16px 0 6px' };
const CARD = { background:'#FFFFFF', borderRadius:'28px 28px 0 0', padding:'28px 24px 32px', marginTop:'-24px' };

export default function SignUp({ onAuthed, onSwitchToLogin }){
  const { signUp } = useAuth();
  const [form, setForm] = useState({ email:'', password:'', confirm:'' });
  const [show, setShow] = useState({ password:false, confirm:false });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(){
    const v = validateSignup(form);
    if (!v.ok) { setErr(v); return; }
    setBusy(true); setErr(null);
    const res = await signUp(form.email, form.password);
    setBusy(false);
    if (res.error) setErr({ field:null, message:res.error, detail:res.detail });
    else onAuthed(res.needsConfirm ? 'confirm' : 'signup', res.detail);
  }
  const EyeToggle = ({ k }) => <button type="button" className="icon-btn" onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))} aria-label={'Toggle ' + k}>{show[k] ? <EyeOff size={16}/> : <Eye size={16}/>}</button>;
  const field = (k, label, type, eye) => (
    <div>
      <label style={LABEL}>{label}</label>
      <div style={{ display:'flex', gap:6 }}>
        <input data-testid={'signup-' + k} type={eye && !show[k] ? 'password' : type} value={form[k]} onChange={e => set(k, e.target.value)} style={{ flex:1 }}/>
        {eye && <EyeToggle k={k}/>}
      </div>
    </div>
  );
  return (
    <main style={{ flex:1, overflowY:'auto', background:'#F7FAFF' }}>
      <div style={{ display:'grid', placeItems:'center', padding:'44px 0 28px' }}><Logo size={72}/></div>
      <section style={CARD}>
        <h1 style={{ textAlign:'center' }}>Create an Account</h1>
        <p style={{ textAlign:'center', color:'var(--muted-ink)', fontSize:14 }}>Sign up to unlock your personal AI travel guide.</p>
        {field('email', 'Email Address', 'email', false)}
        {field('password', 'Password', 'password', true)}
        {field('confirm', 'Confirm Password', 'password', true)}
        {err && <p data-testid="signup-error" style={{ color:'var(--accent)', fontSize:13, margin:'12px 0 0' }}>{err.message}{err.detail ? ' — ' + err.detail : ''}</p>}
        <div style={{ marginTop:20 }}><PrimaryBtn testid="signup-send" disabled={busy} onClick={submit}>Sign Up <ArrowRight size={17}/></PrimaryBtn></div>
        <p style={{ textAlign:'center', marginTop:16, fontSize:14 }}>
          Already have an account? <b><a href="#" onClick={e => { e.preventDefault(); onSwitchToLogin(); }}>Log In</a></b>
        </p>
      </section>
    </main>
  );
}
