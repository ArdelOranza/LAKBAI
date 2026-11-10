import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight, Mail, MailCheck, RefreshCw } from 'lucide-react';
import { useAuth, friendlyAuthError } from '../AuthContext.jsx';
import { validateLogin, needsEmailConfirmation } from '../authValidate.js';
import Logo from '../logo.jsx';
import { PrimaryBtn, GoogleBtn, OrDivider, TextField } from '../ui.jsx';

const LABEL = { display:'block', fontSize:12, fontWeight:600, margin:'16px 0 6px' };
const CARD = { background:'#FFFFFF', borderRadius:'28px 28px 0 0', padding:'28px 24px 32px', marginTop:'-24px' };

export default function LogIn({ onAuthed, onSwitchToSignup, notice, defaultEmail }){
  const { signInWithPassword, signInWithGoogle, resetPassword, resendConfirmation, configured } = useAuth();
  const [form, setForm] = useState({ email: defaultEmail || '', password:'' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
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
    const v = validateLogin(form);
    if (!v.ok) { setErr(v); return; }
    setBusy(true); setErr(null);
    let res;
    try { res = await signInWithPassword(form.email, form.password); }
    catch (e) { res = { error: friendlyAuthError(String(e?.message || e)) }; }
    finally { setBusy(false); }
    if (res.error) setErr({ field:null, message:res.error });
    else onAuthed('login');
  }
  async function google(){
    setBusy(true); setErr(null);
    let res;
    try { res = await signInWithGoogle(); }
    catch (e) { res = { error: friendlyAuthError(String(e?.message || e)) }; }
    finally { setBusy(false); }
    // On success the browser leaves for Google; only a failure returns here.
    if (res.error){
      setErr({ field:null, message: /not enabled|provider/i.test(res.error)
        ? 'Google sign-in isn’t available right now. Use your email to log in.'
        : res.error });
    }
  }
  async function resend(){
    if (!/^\S+@\S+\.\S+$/.test(String(form.email || '').trim())) { setErr({ field:null, message:'Enter a valid email address first.' }); return; }
    setBusy(true);
    let res;
    try { res = await resendConfirmation(form.email); }
    catch (e) { res = { error: friendlyAuthError(String(e?.message || e)) }; }
    finally { setBusy(false); }
    if (res.error) setErr({ field:null, message:res.error });
    else { setErr(null); setResent(true); }
  }
  async function forgot(){
    const v = validateLogin({ email: form.email, password: 'x' });
    if (!v.ok) { setErr(v.field === 'email' ? v : { field:null, message:'Enter your email first, then tap Forgot Password.' }); return; }
    setErr(null);
    setBusy(true);
    let res;
    try { res = await resetPassword(form.email); }
    catch (e) { res = { error: friendlyAuthError(String(e?.message || e)) }; }
    finally { setBusy(false); }
    setErr(res.error ? { field:null, message:res.error } : { field:null, message:res.detail || 'Check your email.' });
  }
  // Supabase will not let an unconfirmed account log in. Instead of dumping the
  // raw "Email not confirmed" string, keep the resend action right here.
  const confirmNeeded = Boolean(notice) || resent || needsEmailConfirmation(err && err.message);
  const otherErr = err && !needsEmailConfirmation(err.message) ? err.message : null;
  return (
    <main style={{ flex:1, overflowY:'auto', background:'#F7FAFF' }}>
      <div style={{ display:'grid', placeItems:'center', padding:'44px 0 28px' }}><Logo size={72}/></div>
      <section style={CARD}>
        <h1 style={{ textAlign:'center' }}>Welcome back</h1>
        <p style={{ textAlign:'center', color:'var(--muted-ink)', fontSize:14 }}>Log in to continue your journey.</p>
        {!configured && (
          <p data-testid="auth-unconfigured" style={{ textAlign:'center', fontSize:12, color:'var(--muted-ink)', margin:'0 0 12px' }}>
            Auth isn’t configured yet. Add your Supabase keys to .env to enable sign-in.
          </p>
        )}
        <div style={{ marginTop:18 }}><GoogleBtn onClick={google} disabled={busy || !configured}/></div>
        <OrDivider/>
        <label style={LABEL} htmlFor="login-email-input">Email Address</label>
        <TextField id="login-email-input" testid="login-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} onKeyDown={onEnter} disabled={!configured || busy} />
        <label style={LABEL} htmlFor="login-password-input">Password</label>
        <TextField
          id="login-password-input"
          testid="login-password"
          type={show ? 'text' : 'password'}
          value={form.password}
          onChange={e => set('password', e.target.value)}
          onKeyDown={onEnter}
          disabled={!configured || busy}
          trailing={(
            <button type="button" className="field-btn" onClick={() => setShow(s => !s)} aria-label="Toggle password">
              {show ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          )}
        />
        <div style={{ textAlign:'right', marginTop:8 }}>
          <button type="button" style={{ background:'none', border:'none', color:'var(--primary)', fontSize:13, fontWeight:600, padding:0 }} onClick={forgot} data-testid="forgot-link" disabled={!configured || busy}>Forgot Password?</button>
        </div>

        {confirmNeeded && (
          <div className={'auth-note' + (resent ? ' ok' : '')} data-testid="login-notice" role="status" aria-live="polite">
            <span className="auth-note-ico">{resent ? <MailCheck size={18}/> : <Mail size={18}/>}</span>
            <div className="auth-note-body">
              <b>{resent ? 'Confirmation email sent' : 'Confirm your email first'}</b>
              <p>{resent
                ? `We sent a fresh link${form.email ? ` to ${form.email}` : ''}. Open it, then log in.`
                : (notice || 'This account is not confirmed yet. Open the link we emailed you, or send it again.')}</p>
              <button type="button" className="auth-note-btn" data-testid="resend-confirm" onClick={resend} disabled={busy || !configured}>
                <RefreshCw size={14}/> {resent ? 'Send it again' : 'Resend email'}
              </button>
            </div>
          </div>
        )}

        {otherErr && <p data-testid="login-error" className="auth-err">{otherErr}</p>}

        <div style={{ marginTop:18 }}><PrimaryBtn testid="login-send" disabled={busy || !configured} onClick={submit}>Log In <ArrowRight size={17}/></PrimaryBtn></div>
        <p style={{ textAlign:'center', marginTop:16, fontSize:14 }}>
          Don't have an account? <b><button type="button" data-testid="switch-signup" style={{ background:'none', border:'none', padding:0, color:'var(--primary)', font:'inherit', cursor:'pointer' }} onClick={onSwitchToSignup}>Sign Up</button></b>
        </p>
      </section>
    </main>
  );
}
