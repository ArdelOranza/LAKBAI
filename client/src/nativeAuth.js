import { friendlyAuthError } from './authErrors.js';

/**
 * Google sign-in inside the Android shell.
 *
 * Google refuses OAuth inside a WebView, so the only path that stays in the app
 * is: ask Supabase for the authorize URL (no redirect), open it in a Chrome
 * Custom Tab, and let Android hand the result back through our own scheme. The
 * session is then minted in the WebView's storage — the website is never part
 * of the flow, so there is nothing to "redirect" to.
 */
export const NATIVE_REDIRECT = 'com.lakbai.app://auth-callback';

export function isNativeApp(){
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

/**
 * Where Supabase should send the traveler after an emailed action.
 *
 * Inside the APK the page origin is `https://localhost` — a mailbox cannot open
 * it, so a confirmation or reset link pointed there lands in a browser and the
 * app stays signed out. The link has to come back through the app's own scheme;
 * the callback listener then mints the session in the app's storage.
 */
export function emailRedirectTo(){
  if (isNativeApp()) return NATIVE_REDIRECT;
  return typeof window !== 'undefined' ? window.location.origin : undefined;
}

export function isAuthCallback(url){
  try {
    const u = new URL(String(url));
    return u.protocol === 'com.lakbai.app:' && u.hostname === 'auth-callback';
  } catch {
    return false;
  }
}

/** Start Google OAuth without navigating the WebView away from the app. */
export async function startGoogleSignIn(supabase){
  if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_REDIRECT,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { error: friendlyAuthError(String(error.message || error)) };
  if (!data?.url) return { error: 'Could not start Google sign-in. Try email and password instead.' };
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url });
  return {};
}

/**
 * Turn a callback URL into a session. Handles both shapes Supabase can return:
 * `?code=` (PKCE) and `#access_token=…` (implicit, which email links use).
 */
export async function completeNativeAuth(url, supabase, { onRecovery } = {}){
  if (!isAuthCallback(url)) return { handled: false };
  let parsed;
  try { parsed = new URL(String(url)); } catch { return { handled: false }; }

  const { Browser } = await import('@capacitor/browser');
  try { await Browser.close(); } catch { /* tab already gone */ }

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const denied = parsed.searchParams.get('error_description') || hash.get('error_description') || parsed.searchParams.get('error');
  if (denied) return { handled: true, error: friendlyAuthError(String(denied).replace(/\+/g, ' ')) || 'Google sign-in was cancelled.' };

  // A reset link mints a real session. Tell the app *before* the exchange so the
  // signed-in screens never paint — the traveler must set a new password first.
  const recovery = (hash.get('type') || parsed.searchParams.get('type')) === 'recovery';
  if (recovery) onRecovery?.();

  const code = parsed.searchParams.get('code');
  if (code){
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { handled: true, recovery, error: error ? friendlyAuthError(String(error.message || error)) : null };
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken){
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return { handled: true, recovery, error: error ? friendlyAuthError(String(error.message || error)) : null };
  }

  return { handled: true, recovery, error: 'That sign-in link is incomplete. Try again from the app.' };
}

/**
 * Listen for the callback, including the link that launched the app cold.
 * Returns a cleanup function; a no-op outside the native shell.
 */
export async function listenForAuthCallback(supabase, onResult, hooks = {}){
  if (!isNativeApp() || !supabase) return () => {};
  const { App } = await import('@capacitor/app');
  const run = async url => {
    const res = await completeNativeAuth(url, supabase, hooks);
    if (res.handled) onResult?.(res);
  };
  const handle = await App.addListener('appUrlOpen', async ({ url }) => {
    try { await run(url); } catch { /* malformed link — stay signed out */ }
  });
  // Cold start: the app was launched by the callback itself.
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) await run(launch.url);
  } catch { /* plugin unavailable */ }
  return () => { try { handle?.remove?.(); } catch { /* already removed */ } };
}
