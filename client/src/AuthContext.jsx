import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, configured } from './supabaseClient.js';
import { friendlyAuthError } from './authErrors.js';
import { isNativeApp, startGoogleSignIn, listenForAuthCallback, emailRedirectTo } from './nativeAuth.js';

export { friendlyAuthError };

const Ctx = createContext({ user: null, loading: true, recovery: false, authError: null, configured, signUp: async () => ({ error: 'Auth not configured' }), signInWithPassword: async () => ({ error: 'Auth not configured' }), signInWithGoogle: async () => ({ error: 'Auth not configured' }), resendConfirmation: async () => ({ error: 'Auth not configured' }), resetPassword: async () => ({ error: 'Auth not configured' }), updatePassword: async () => ({ error: 'Auth not configured' }), clearRecovery: () => {}, clearAuthError: () => {}, signOut: async () => {} });

function isRecoveryHash(){
  if (typeof window === 'undefined') return false;
  try { return window.location.hash.includes('type=recovery'); } catch { return false; }
}

// Strip auth params (?code= / #access_token=...) once the SDK has exchanged them
// so a refresh or back-button doesn't re-trigger sign-in/recovery.
function cleanAuthUrl(){
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.has('code')) { url.searchParams.delete('code'); changed = true; }
    if (url.hash) {
      const hp = new URLSearchParams(url.hash.replace(/^#/, ''));
      let hashChanged = false;
      ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'code'].forEach(k => { if (hp.has(k)) { hp.delete(k); hashChanged = true; } });
      if (hashChanged) { url.hash = hp.toString() ? '#' + hp.toString() : ''; changed = true; }
    }
    if (changed) window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch { /* non-browser / noop */ }
}

export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  // A deep-link sign-in can fail after the traveler already left the app. Keep
  // the reason so the shell can say what happened instead of silently showing
  // the signed-out screens again.
  const [authError, setAuthError] = useState(null);
  // Monotonic seq so the latest auth event wins: a slow/stale getSession
  // result can't clobber a SIGNED_IN that already arrived via onAuthStateChange.
  // Initial getSession is only adopted if no onAuthStateChange event has
  // landed yet (seqRef > 0) — see the getSession handler below.
  const seqRef = useRef(0);
  const recoveryRef = useRef(false);
  // Only a real PASSWORD_RECOVERY event means the current session came from a
  // reset link — only then may "Cancel and log in" drop the session. A hash
  // alone (possibly a dead, reused link on a healthy session) must not log
  // the traveler out.
  const recoveryFromEventRef = useRef(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    // If getSession() never settles (hung network/captive portal), don't leave a
    // permanent blank screen — land on Splash after 8s.
    const bootTimer = setTimeout(() => setLoading(false), 8000);
    const clearBoot = () => clearTimeout(bootTimer);
    const apply = (session, event) => {
      clearBoot();
      // Latest auth event wins; bump seq so a late getSession snapshot
      // (checked below) knows an event already landed.
      const seq = ++seqRef.current;
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true; recoveryFromEventRef.current = true; setRecovery(true);
        setLoading(false);
        cleanAuthUrl();
        return { seq, session, event };
      }
      // A SIGNED_IN that follows a recovery URL is a PKCE password-reset
      // exchange — treat it as recovery (no brief app/onboarding flash).
      if ((event === 'SIGNED_IN') && isRecoveryHash() && session?.user) {
        recoveryRef.current = true; recoveryFromEventRef.current = true; setRecovery(true);
        setLoading(false);
        cleanAuthUrl();
        return { seq, session, event };
      }
      if (session?.user) setAuthError(null);
      setUser(session?.user || null);
      setLoading(false);
      return { seq, session, event };
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't clobber an in-progress recovery screen with a normal session.
      if (recoveryRef.current && event !== 'PASSWORD_RECOVERY') {
        // Still consume OAuth/PKCE codes so the URL is clean, but keep recovery UI.
        if (event === 'SIGNED_IN') cleanAuthUrl();
        return;
      }
      apply(session, event);
      cleanAuthUrl();
    });

    // Initial session snapshot. Catch + finally so a rejected getSession
    // (offline / blocked host) never leaves loading stuck true forever;
    // a cached session (if the SDK resolves one) still renders.
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) { setLoading(false); return; }
        if (recoveryRef.current) { setLoading(false); return; }
        // If onAuthStateChange already fired (e.g. SIGNED_IN during PKCE
        // exchange), don't let this older snapshot null out that user.
        // getSession is the boot baseline only when no event walked ahead.
        if (seqRef.current > 0) return;
        setUser(data.session?.user || null);
        const isRecovery = isRecoveryHash();
        if (isRecovery && data.session?.user) {
          recoveryRef.current = true; setRecovery(true);
        }
        setLoading(false);
      })
      .catch(() => { setLoading(false); })
      .finally(() => setLoading(l => l && false));

    // Recovery-session promotion already happened in the getSession handler
    // above (and in PASSWORD_RECOVERY). A hash alone proves nothing — an
    // expired or reused link must fall through to the normal screens, not
    // trap the traveler on a password form with no session.
    return () => { clearBoot(); sub.subscription.unsubscribe(); };
  }, []);

  // The APK receives Google's answer as a deep link. This listener owns the
  // session exchange; onAuthStateChange above then paints the signed-in app.
  useEffect(() => {
    if (!supabase || !isNativeApp()) return undefined;
    let stop;
    listenForAuthCallback(
      supabase,
      res => { if (res?.error) setAuthError(res.error); },
      {
        // Recovery must win over the SIGNED_IN event the exchange fires, or the
        // traveler lands in the app instead of on the set-password screen.
        onRecovery: () => {
          recoveryRef.current = true;
          recoveryFromEventRef.current = true;
          setRecovery(true);
          setLoading(false);
        },
      },
    ).then(fn => { stop = fn; }).catch(() => {});
    return () => { try { stop?.(); } catch { /* already removed */ } };
  }, []);
  async function signUp(email, password){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    // Point the confirmation link at the app the person signed up in: the
    // website origin on the web, the app's own scheme inside the APK (where the
    // WebView origin is https://localhost and no mailbox can open it).
    const redirect = emailRedirectTo();
    const { data, error } = await supabase.auth.signUp({ email: String(email).trim(), password, options: { emailRedirectTo: redirect } });
    if (error) return { error: friendlyAuthError(String(error.message || error)) };
    return data.session ? {} : { needsConfirm: true, detail: 'Check your email to confirm your account, then log in.' };
  }
  async function signInWithPassword(email, password){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
    return error ? { error: friendlyAuthError(String(error.message || error)) } : {};
  }
  // Full-page redirect to Google, then back to the app. Supabase picks the
  // session out of the return URL, so onAuthStateChange signs the traveler in.
  // In the APK this stays inside the app: Custom Tab out, own scheme back in.
  async function signInWithGoogle(){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    if (isNativeApp()) {
      try { return await startGoogleSignIn(supabase); }
      catch (e) { return { error: friendlyAuthError(String(e?.message || e)) }; }
    }
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    });
    return error ? { error: friendlyAuthError(String(error.message || error)) } : {};
  }
  async function resendConfirmation(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    if (!/^\S+@\S+\.\S+$/.test(String(email || '').trim())) return { error: 'Enter a valid email address.' };
    const { error } = await supabase.auth.resend({ type: 'signup', email: String(email).trim(), options: { emailRedirectTo: emailRedirectTo() } });
    return error ? { error: friendlyAuthError(String(error.message || error)) } : { detail: 'Confirmation email sent again. Check your inbox and spam folder.' };
  }
  async function resetPassword(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: emailRedirectTo() });
    return error ? { error: friendlyAuthError(String(error.message || error)) } : { detail: 'Password reset link sent. Check your email.' };
  }
  async function updatePassword(password){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    if (String(password || '').length < 8) return { error: 'Password must be at least 8 characters.' };
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: friendlyAuthError(String(error.message || error)) };
      // Recovery token consumed — drop the session so we don't end up signed
      // in through the reset link, and surface the login screen instead.
      try { await supabase.auth.signOut(); } catch { /* best effort */ }
      recoveryRef.current = false; setRecovery(false); setUser(null);
      cleanAuthUrl();
      return {};
    } catch (e) { return { error: friendlyAuthError(String(e?.message || e)) }; }
  }
  function clearRecovery(){
    const fromEvent = recoveryFromEventRef.current;
    recoveryRef.current = false; recoveryFromEventRef.current = false; setRecovery(false);
    cleanAuthUrl();
    // Only a real reset-link session is dropped; a hash-only promotion on an
    // already-healthy session keeps the traveler logged in.
    if (fromEvent && supabase) supabase.auth.signOut().catch(() => {}).finally(() => setUser(null));
    else if (fromEvent) setUser(null);
  }
  async function signOut(){ if (supabase) await supabase.auth.signOut(); setUser(null); }
  const clearAuthError = () => setAuthError(null);
  return <Ctx.Provider value={{ user, loading, recovery, authError, configured, signUp, signInWithPassword, signInWithGoogle, resendConfirmation, resetPassword, updatePassword, clearRecovery, clearAuthError, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
