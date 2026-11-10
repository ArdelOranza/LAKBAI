import { Component, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { Toast, TabBar, PrimaryBtn, useAutoToast } from './ui.jsx';
import Logo from './logo.jsx';
import { readLocalPrefs, loadPrefs } from './prefs.js';
import { tabFromSearch } from './deepLink.js';
import Splash from './screens/Splash.jsx';
import SignUp from './screens/SignUp.jsx';
import LogIn from './screens/LogIn.jsx';
import Preferences from './screens/Preferences.jsx';
import HomeTab from './screens/Home.jsx';
import MapTab from './screens/MapTab.jsx';
import ChatTab from './screens/ChatTab.jsx';
import SavedTab from './screens/SavedTab.jsx';
import ProfileTab from './screens/Profile.jsx';
import ProfileEdit from './screens/ProfileEdit.jsx';
import SearchResults from './screens/SearchResults.jsx';
import Browse from './screens/Browse.jsx';
import Events from './screens/Events.jsx';
import PlaceDetail from './screens/PlaceDetail.jsx';
import Emergency from './screens/Emergency.jsx';
import Itineraries from './screens/Itineraries.jsx';
import MyReviews from './screens/MyReviews.jsx';
import ItineraryView from './screens/ItineraryView.jsx';

export const FALLBACK_CENTER = { lng: 120.23, lat: 16.03 };

class ScreenErrorBoundary extends Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error){ console.error('Screen failed to render:', error); }
  render(){
    if (this.state.error){
      return (
        <div style={{ flex:1, display:'grid', placeItems:'center', padding:24 }}>
          <div style={{ maxWidth:320, textAlign:'center' }}>
            <h1 style={{ fontSize:20 }}>This screen couldn’t load</h1>
            <p style={{ color:'var(--muted-ink)', fontSize:14 }}>Give it another go below — the rest of the app still works.</p>
            <button type="button" onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}>Back to home</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(){
  return <AuthProvider><Shell/></AuthProvider>;
}

function Shell(){
  const { user, loading, recovery, updatePassword, clearRecovery, signOut } = useAuth();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [authStage, setAuthStage] = useState(null);   // 'signup' | 'login' override while no session yet
  const [authNotice, setAuthNotice] = useState(null); // { text, email } hand-off from Sign Up
  const [prefsStage, setPrefsStage] = useState(false); // onboarding overlay after first signup
  const [toast, setToast] = useAutoToast(4000); // every toast self-dismisses
  const [coords, setCoords] = useState(FALLBACK_CENTER);
  const push = view => setStack(s => [...s, view]);
  const pop = () => setStack(s => s.slice(0, -1));
  const showToast = (text, kind = 'ok', detail) => setToast({ text, kind, detail });

  // PWA app shortcuts open `/?tab=map` etc. Land on that tab, then strip the
  // query so a refresh (and the browser history) stays clean.
  useEffect(() => {
    const t = tabFromSearch(window.location.search);
    if (!t) return;
    setTab(t);
    try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch { /* file:// etc. */ }
  }, []);

  useEffect(() => {  // LIVE touring GPS (high-accuracy, smoothed, accuracy-gated)
    // 'geolocation' in navigator can be true while geolocation itself is null
    // (test DOMs, hardened browsers) — require the callable API.
    if (typeof navigator.geolocation?.watchPosition !== 'function') return;
    // maximumAge 0 — never accept a browser-cached stale fix from a previous session.
    const OPTS = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 };
    let best = null; // best fix so far { lng, lat, accuracy }
    const onOk = pos => {
      const { longitude, latitude, accuracy } = pos.coords || {};
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
      // Reject very poor fixes instead of snapping the map to a guessed point.
      // IndoorWi-Fi / tower fixes often report accuracy > 300 m — worse than useless.
      const acc = Number.isFinite(accuracy) ? accuracy : 999;
      if (acc > 300) return; // keep waiting for a real fix; dot stays honest
      // Smooth: average with the previous best, weighted by inverse accuracy.
      // A single noisy fix then can't yank the dot 100 m.
      if (best){
        const wNew = 1 / Math.max(10, acc);
        const wOld = 1 / Math.max(10, best.accuracy);
        const lng = (best.lng * wOld + longitude * wNew) / (wOld + wNew);
        const lat = (best.lat * wOld + latitude * wNew) / (wOld + wNew);
        best = { lng, lat, accuracy: Math.min(best.accuracy, acc) };
      } else {
        best = { lng: longitude, lat: latitude, accuracy: acc };
      }
      setCoords({ lng: best.lng, lat: best.lat, accuracy: best.accuracy });
    };
    const onErr = () => { /* keep fallback; a failed permission is not a fake pin */ };
    let id = navigator.geolocation.watchPosition(onOk, onErr, OPTS);
    // Fire a fresh high-accuracy fix now so the dot lands quickly instead of
    // waiting for the first watchPosition tick (often a stale cached value).
    navigator.geolocation.getCurrentPosition?.(onOk, onErr, OPTS);
    const onHide = () => {  // battery: no GPS while backgrounded
      navigator.geolocation.clearWatch(id);
      if (!document.hidden) id = navigator.geolocation.watchPosition(onOk, onErr, OPTS);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => { navigator.geolocation.clearWatch(id); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  // first real session → preferences onboarding once (unless already filled
  // locally OR remotely — a fresh device must still see the cloud's chips).
  useEffect(() => {
    if (!user || prefsStage || recovery) return;
    if (localStorage.getItem(`lakbai.prefsSeen:${user.id}`)) return;
    let alive = true;
    loadPrefs(user)
      .then(p => { if (alive && (p.preferences || []).length === 0) setPrefsStage(true); })
      .catch(() => { if (alive) setPrefsStage(true); });
    return () => { alive = false; };
  }, [user?.id, recovery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every screen render (loading, recovery, auth gates, tabs, stacked screens)
  // goes through this guard: one bad screen must degrade to a fallback for that
  // screen only, never a dead app shell.
  const reset = () => { setStack([]); setTab('home'); setPrefsStage(false); };
  const guard = children => <ScreenErrorBoundary onReset={reset}>{children}</ScreenErrorBoundary>;

  if (loading) return guard(
    <main style={{ flex:1, display:'grid', placeItems:'center', minHeight:'100dvh' }} aria-busy="true">
      <div style={{ textAlign:'center', color:'var(--muted-ink)' }}>
        <Logo size={56}/>
        <p style={{ fontSize:14, marginTop:12 }}>Loading Lakbai…</p>
      </div>
    </main>
  );

  // Password-reset recovery: the reset link mints a real session. Don't
  // drop the traveler into the app — ask for a new password first.
  if (recovery) return guard(<SetPassword onDone={() => { clearRecovery(); setPrefsStage(false); }} updatePassword={updatePassword}/>); // recovery exit must also drop a stranded onboarding state


  const prefsOnce = checked => (
    <Preferences onContinue={p => { if (user) localStorage.setItem(`lakbai.prefsSeen:${user.id}`, '1'); setPrefsStage(false); checked && checked(); }}/>
  );

  if (!user){
    if (prefsStage) return guard(prefsOnce(() => setStack([])));
    if (authStage === 'signup') return guard(<SignUp onAuthed={(stage, detail, email) => {
      // Supabase needs the signup email confirmed before the first login. Send
      // the traveler to Log In with the reason (and their email, so "Resend"
      // works straight away) instead of dropping them back on the intro.
      if (stage === 'confirm') {
        setAuthNotice({ text: detail || 'Check your email to confirm your account, then log in.', email: email || '' });
        setAuthStage('login');
        return;
      }
      setAuthStage(null);
    }} onSwitchToLogin={() => setAuthStage('login')} />);
    if (authStage === 'login') return guard(<LogIn notice={authNotice?.text} defaultEmail={authNotice?.email} onAuthed={() => { setAuthNotice(null); setAuthStage(null); }} onSwitchToSignup={() => setAuthStage('signup')} />);
    return guard(<Splash onGetStarted={() => setAuthStage('signup')} onLogIn={() => setAuthStage('login')} />);
  }
  if (prefsStage) return guard(prefsOnce(() => setStack([])));

  // A tab tap must clear the stack, otherwise a tab change while a detail is
  // open is invisible (stuck on the old detail). Screens call setTab directly,
  // so route every tab change through this wrapper.
  const switchTab = t => { setStack([]); setTab(t); };
  // Logout must drop all navigation state, or the next user sees the previous
  // user's detail/plan screens and stale prefs.
  const doSignOut = async () => {
    try { await signOut(); } catch { /* already signed out */ }
    setStack([]); setTab('home'); setPrefsStage(false); setAuthStage(null); setAuthNotice(null);
  };
  const top = stack[stack.length - 1];
  const screenProps = { coords, push, pop, showToast, setTab: switchTab, user, signOut: doSignOut };
  let body;
  if (top?.name === 'search') body = <SearchResults query={top.query} {...screenProps}/>;
  else if (top?.name === 'browse') body = <Browse kind={top.kind} {...screenProps}/>;
  else if (top?.name === 'events') body = <Events {...screenProps}/>;
  else if (top?.name === 'detail') body = <PlaceDetail place={top.place} {...screenProps}/>;
  else if (top?.name === 'emergency') body = <Emergency {...screenProps}/>;
  else if (top?.name === 'prefs-edit') body = <Preferences onBack={pop} onContinue={pop}/>;
  else if (top?.name === 'profileEdit') body = <ProfileEdit {...screenProps}/>;
  else if (top?.name === 'itineraries') body = <Itineraries {...screenProps}/>;
  else if (top?.name === 'myReviews') body = <MyReviews {...screenProps}/>;
  else if (top?.name === 'itinerary') body = <ItineraryView plan={top.plan} {...screenProps}/>;
  else if (tab === 'home') body = <HomeTab {...screenProps}/>;
  else if (tab === 'map') body = <MapTab {...screenProps}/>;
  else if (tab === 'chat') body = <ChatTab {...screenProps}/>;
  else if (tab === 'saved') body = <SavedTab {...screenProps}/>;
  else body = <ProfileTab {...screenProps}/>;

  return (
    <div data-testid="app" style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      {guard(body)}
      {!stack.length && <TabBar tab={tab} onTab={t => { setStack([]); setTab(t); }} />}
    </div>
  );
}

// Minimal set-new-password step for a recovery session. Reuses the same
// card styling as LogIn/SignUp — no full account-recovery UI.
function SetPassword({ onDone, updatePassword }){
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const LABEL = { display:'block', fontSize:12, fontWeight:600, margin:'16px 0 6px' };
  const CARD = { background:'#FFFFFF', borderRadius:'28px 28px 0 0', padding:'28px 24px 32px', marginTop:'-24px' };

  // Enter submits the form (no <form>, so wire it explicitly).
  const onEnter = e => { if (e.key === 'Enter'){ e.preventDefault(); submit(); } };
  async function submit(){
    if (String(pw || '').length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr(null);
    let res;
    try { res = await updatePassword(pw); }
    catch (e) { res = { error: String(e?.message || e) }; }
    finally { setBusy(false); }
    if (res.error) { setErr(res.error); return; }
    onDone?.(); // session already cleared in AuthContext; land on Splash/Log In
  }

  return (
    <main style={{ flex:1, overflowY:'auto', background:'#F7FAFF' }}>
      <div style={{ display:'grid', placeItems:'center', padding:'44px 0 28px' }}><Logo size={72}/></div>
      <section style={CARD}>
        <h1 style={{ textAlign:'center' }}>Set a New Password</h1>
        <p style={{ textAlign:'center', color:'var(--muted-ink)', fontSize:14 }}>Choose a new password for your account.</p>
        <label style={LABEL} htmlFor="set-password-input">New Password</label>
        <input id="set-password-input" data-testid="set-password" type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={onEnter} disabled={busy} />
        <label style={LABEL} htmlFor="set-password-confirm-input">Confirm Password</label>
        <input id="set-password-confirm-input" data-testid="set-password-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={onEnter} disabled={busy} />
        {err && <p data-testid="set-password-error" style={{ color:'var(--accent)', fontSize:13, margin:'12px 0 0' }}>{err}</p>}
        <div style={{ marginTop:20 }}><PrimaryBtn testid="set-password-submit" disabled={busy} onClick={submit}>Update Password</PrimaryBtn></div>
        <div style={{ textAlign:'center', marginTop:16 }}>
          <button type="button" style={{ background:'none', border:'none', color:'var(--muted-ink)' }} onClick={() => onDone?.()}>Cancel and log in</button>
        </div>
      </section>
    </main>
  );
}
