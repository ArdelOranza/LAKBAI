import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, configured } from './supabaseClient.js';

const Ctx = createContext({ user: null, loading: true, recovery: false, configured, signUp: async () => ({ error: 'Auth not configured' }), signInWithPassword: async () => ({ error: 'Auth not configured' }), signInWithGoogle: async () => ({ error: 'Auth not configured' }), resendConfirmation: async () => ({ error: 'Auth not configured' }), resetPassword: async () => ({ error: 'Auth not configured' }), updatePassword: async () => ({ error: 'Auth not configured' }), clearRecovery: () => {}, signOut: async () => {} });

function isRecoveryHash(){
  if (typeof window === 'undefined') return false;
  try { return window.location.hash.includes('type=recovery'); } catch { return false; }
}

// Map backend provider strings to copy a traveler can act on. Anything unknown
// falls through untouched so real errors are never hidden.
function friendlyAuthError(message){
  const m = String(message || '');
  if (/invalid login credentials/i.test(m)) return 'Invalid email or password.';
  if (/auth session missing/i.test(m)) return 'This link has expired or was already used. Request a new one.';
  if (/failed to fetch|network error|load failed/i.test(m)) return 'Network error — check your connection and try again.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries — wait a minute and try again.';
  if (/user already registered/i.test(m)) return 'An account with this email already exists — try logging in.';
  if (/email not confirmed|email_not_confirmed/i.test(m)) return 'Confirm your email first, then log in.';
  return m;
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
  // Monotonic seq so the latest auth event wins: a slow/stale getSession
  // result can't clobber a SIGNED_IN that already arrived via onAuthStateChange.
  // Initial getSession is only adopted if no onAuthStateChange event has
  // landed yet (seqRef > 0) — see the getSession handler below.
  const seqRef = useRef(0);
  const recoveryRef = useRef(false);

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
        recoveryRef.current = true; setRecovery(true);
        setLoading(false);
        cleanAuthUrl();
        return { seq, session, event };
      }
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
  async function signUp(email, password){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    // Point the confirmation link at the deployment the person signed up on,
    // not whatever Site URL the Supabase project happens to have configured.
    const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.signUp({ email: String(email).trim(), password, options: { emailRedirectTo } });
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
  async function signInWithGoogle(){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    });
    return error ? { error: friendlyAuthError(String(error.message || error)) } : {};
  }
  async function resendConfirmation(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resend({ type: 'signup', email: String(email).trim(), options: { emailRedirectTo } });
    return error ? { error: friendlyAuthError(String(error.message || error)) } : { detail: 'Confirmation email sent again. Check your inbox and spam folder.' };
  }
  async function resetPassword(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: window.location.origin });
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
    recoveryRef.current = false; setRecovery(false);
    cleanAuthUrl();
    if (supabase) supabase.auth.signOut().catch(() => {}).finally(() => setUser(null));
    else setUser(null);
  }
  async function signOut(){ if (supabase) await supabase.auth.signOut(); setUser(null); }
  return <Ctx.Provider value={{ user, loading, recovery, configured, signUp, signInWithPassword, signInWithGoogle, resendConfirmation, resetPassword, updatePassword, clearRecovery, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
