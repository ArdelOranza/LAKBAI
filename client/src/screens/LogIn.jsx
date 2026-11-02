import { useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { validateLogin, needsEmailConfirmation } from '../authValidate.js';
import Logo from '../logo.jsx';
import { PrimaryBtn } from '../ui.jsx';

const LABEL = { display:'block', fontSize:12, fontWeight:600, margin:'16px 0 6px' };
const CARD = { background:'#FFFFFF', borderRadius:'28px 28px 0 0', padding:'28px 24px 32px', marginTop:'-24px' };

export default function LogIn({ onAuthed, onSwitchToSignup, notice }){
  const { signInWithPassword, resetPassword, resendConfirmation } = useAuth();
  const [form, setForm] = useState({ email:'', password:'' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(){
    const v = validateLogin(form);
    if (!v.ok) { setErr(v); return; }
    setBusy(true); setErr(null);
    const res = await signInWithPassword(form.email, form.password);
    setBusy(false);
    if (res.error) setErr({ field:null, message:res.error });
    else onAuthed('login');
  }
  async function resend(){
    setBusy(true);
    const res = await resendConfirmation(form.email);
    setBusy(false);
    setErr({ field:null, message: res.error || res.detail });
  }
  async function forgot(){
    const v = validateLogin({ email: form.email, password: 'x' });
    if (!v.ok) { setErr(v.field === 'email' ? v : { field:null, message:'Enter your email first, then tap Forgot Password.' }); return; }
    setErr(null);
    const res = await resetPassword(form.email);
    setErr(res.error ? { field:null, message:res.error } : { field:null, message:res.detail || 'Check your email.' });
  }
  return (
    <main style={{ flex:1, overflowY:'auto', background:'#F7FAFF' }}>
      <div style={{ display:'grid', placeItems:'center', padding:'44px 0 28px' }}><Logo size={72}/></div>
      <section style={CARD}>
        <h1 style={{ textAlign:'center' }}>Log In your Account</h1>
        <p style={{ textAlign:'center', color:'var(--muted-ink)', fontSize:14 }}>Log in to continue your journey.</p>
        <label style={LABEL}>Email Address</label>
        <input data-testid="login-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        <label style={LABEL}>Password</label>
        <div style={{ display:'flex', gap:6 }}>
          <input data-testid="login-password" type={show ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} style={{ flex:1 }}/>
          <button type="button" className="icon-btn" onClick={() => setShow(s => !s)} aria-label="Toggle password">{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
        </div>
        <div style={{ textAlign:'right', marginTop:8 }}>
          <button type="button" style={{ background:'none', border:'none', color:'var(--primary)', fontSize:13, fontWeight:600, padding:0 }} onClick={forgot} data-testid="forgot-link">Forgot Password?</button>
        </div>
        {notice && !err && <p data-testid="login-notice" style={{ color:'var(--primary)', fontSize:13, margin:'12px 0 0' }}>{notice}</p>}
        {err && <p data-testid="login-error" style={{ color:'var(--accent)', fontSize:13, margin:'12px 0 0' }}>{err.message}</p>}
        {err && needsEmailConfirmation(err.message) && (
          <button
            type="button"
            data-testid="resend-confirm"
            disabled={busy}
            onClick={resend}
            style={{ background:'none', border:'none', color:'var(--primary)', fontSize:13, fontWeight:600, padding:0, marginTop:8 }}
          >
            Resend confirmation email
          </button>
        )}
        <div style={{ marginTop:18 }}><PrimaryBtn testid="login-send" disabled={busy} onClick={submit}>Log In <ArrowRight size={17}/></PrimaryBtn></div>
        <p style={{ textAlign:'center', marginTop:16, fontSize:14 }}>
          Don't have an account? <b><a href="#" onClick={e => { e.preventDefault(); onSwitchToSignup(); }}>Sign Up</a></b>
        </p>
      </section>
    </main>
  );
}
