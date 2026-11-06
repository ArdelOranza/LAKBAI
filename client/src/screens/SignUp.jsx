import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { validateSignup } from '../authValidate.js';
import Logo from '../logo.jsx';
import { PrimaryBtn, GoogleBtn, OrDivider } from '../ui.jsx';

const LABEL = { display:'block', fontSize:12, fontWeight:600, margin:'16px 0 6px' };
const CARD = { background:'#FFFFFF', borderRadius:'28px 28px 0 0', padding:'28px 24px 32px', marginTop:'-24px' };

export default function SignUp({ onAuthed, onSwitchToLogin }){
  const { signUp, signInWithGoogle, configured } = useAuth();
  const [form, setForm] = useState({ email:'', password:'', confirm:'' });
  const [show, setShow] = useState({ password:false, confirm:false });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // bfcache restore after Google (back pressed) — don't leave buttons dead.
  // (Only pageshow: visibilitychange also fires when the traveler merely
  // backgrounds mid-request, and clearing then allows a double-submit that
  // overwrites the PKCE verifier.)
  useEffect(() => {
    const clear = () => setBusy(false);
    window.addEventListener('pageshow', clear);
    return () => { window.removeEventListener('pageshow', clear); };
  }, []);

  // Enter submits the form (no <form>, so wire it explicitly).
  const onEnter = e => { if (e.key === 'Enter'){ e.preventDefault(); submit(); } };
  async function submit(){
    const v = validateSignup(form);
    if (!v.ok) { setErr(v); return; }
    setBusy(true); setErr(null);
    let res;
    try { res = await signUp(form.email, form.password); }
    catch (e) { res = { error: String(e?.message || e) }; }
    finally { setBusy(false); }
    if (res.error) setErr({ field:null, message:res.error, detail:res.detail });
    else onAuthed(res.needsConfirm ? 'confirm' : 'signup', res.detail, form.email);
  }
  async function google(){
    setBusy(true); setErr(null);
    let res;
    try { res = await signInWithGoogle(); }
    catch (e) { res = { error: String(e?.message || e) }; }
    finally { setBusy(false); }
    if (res.error){
      setErr({ field:null, message: /not enabled|provider/i.test(res.error)
        ? 'Google sign-in isn’t available right now. Use your email to sign up.'
        : res.error });
    }
  }
  const EyeToggle = ({ k }) => <button type="button" className="icon-btn" onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))} aria-label={'Toggle ' + k}>{show[k] ? <EyeOff size={16}/> : <Eye size={16}/>}</button>;
  const field = (k, label, type, eye) => (
    <div>
      <label style={LABEL} htmlFor={'signup-' + k}>{label}</label>
      <div style={{ display:'flex', gap:6 }}>
        <input id={'signup-' + k} data-testid={'signup-' + k} type={eye && !show[k] ? 'password' : type} value={form[k]} onChange={e => set(k, e.target.value)} onKeyDown={onEnter} style={{ flex:1 }} disabled={!configured || busy}/>
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
        {!configured && (
          <p data-testid="auth-unconfigured" style={{ textAlign:'center', fontSize:12, color:'var(--muted-ink)', margin:'0 0 12px' }}>
            Auth isn’t configured yet. Add your Supabase keys to .env to enable sign-in.
          </p>
        )}
        <div style={{ marginTop:18 }}><GoogleBtn onClick={google} disabled={busy || !configured}/></div>
        <OrDivider/>
        {field('email', 'Email Address', 'email', false)}
        {field('password', 'Password', 'password', true)}
        {field('confirm', 'Confirm Password', 'password', true)}
        {err && <p data-testid="signup-error" style={{ color:'var(--accent)', fontSize:13, margin:'12px 0 0' }}>{err.message}{err.detail ? ' — ' + err.detail : ''}</p>}
        <div style={{ marginTop:20 }}><PrimaryBtn testid="signup-send" disabled={busy || !configured} onClick={submit}>Sign Up <ArrowRight size={17}/></PrimaryBtn></div>
        <p style={{ textAlign:'center', marginTop:16, fontSize:14 }}>
          Already have an account? <b><a href="#" onClick={e => { e.preventDefault(); onSwitchToLogin(); }}>Log In</a></b>
        </p>
      </section>
    </main>
  );
}
