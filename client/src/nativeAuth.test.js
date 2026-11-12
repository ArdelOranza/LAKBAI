// @vitest-environment happy-dom
// Google sign-in inside the APK: open the auth page in a Chrome Custom Tab and
// come straight back through the app's own scheme. The website is never part
// of the flow, and the session lands in the app's own storage.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const browserOpen = vi.hoisted(() => vi.fn(async () => {}));
const browserClose = vi.hoisted(() => vi.fn(async () => {}));
const addListener = vi.hoisted(() => vi.fn(async () => ({ remove: vi.fn() })));
const getLaunchUrl = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@capacitor/browser', () => ({ Browser: { open: browserOpen, close: browserClose } }));
vi.mock('@capacitor/app', () => ({ App: { addListener, getLaunchUrl } }));

import {
  NATIVE_REDIRECT, isNativeApp, isAuthCallback, startGoogleSignIn,
  completeNativeAuth, listenForAuthCallback, emailRedirectTo,
} from './nativeAuth.js';

function fakeSupabase(overrides = {}){
  return {
    auth: {
      signInWithOAuth: vi.fn(async () => ({ data: { url: 'https://khtz.supabase.co/auth/v1/authorize?provider=google' }, error: null })),
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null })),
      setSession: vi.fn(async () => ({ data: {}, error: null })),
      ...overrides,
    },
  };
}

beforeEach(() => {
  browserOpen.mockClear();
  browserClose.mockClear();
  addListener.mockClear();
  getLaunchUrl.mockReset();
  getLaunchUrl.mockResolvedValue(undefined);
  delete window.Capacitor;
});

describe('native detection', () => {
  it('is native only inside the Capacitor shell', () => {
    expect(isNativeApp()).toBe(false);
    window.Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
  });

  it('recognises only its own callback scheme', () => {
    expect(isAuthCallback('com.lakbai.app://auth-callback#access_token=x')).toBe(true);
    expect(isAuthCallback('com.lakbai.app://auth-callback?code=x')).toBe(true);
    expect(isAuthCallback('https://lakbai-app.onrender.com/#access_token=x')).toBe(false);
    expect(isAuthCallback('com.lakbai.app://something-else')).toBe(false);
    expect(isAuthCallback('not a url')).toBe(false);
  });
});

describe('emailRedirectTo', () => {
  // Inside the APK the page origin is https://localhost, which no mail app can
  // open. A confirmation or reset link pointed there signs the traveler into a
  // browser tab and leaves the app signed out — the exact reported bug.
  it('sends email links back through the app scheme inside the APK', () => {
    window.Capacitor = { isNativePlatform: () => true };
    expect(emailRedirectTo()).toBe(NATIVE_REDIRECT);
  });

  it('keeps the same-origin link on the website', () => {
    expect(emailRedirectTo()).toBe(window.location.origin);
  });
});

describe('startGoogleSignIn', () => {
  it('asks Supabase for the URL instead of redirecting the WebView, then opens the Custom Tab', async () => {
    const supabase = fakeSupabase();
    const res = await startGoogleSignIn(supabase);

    expect(res.error).toBeUndefined();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: NATIVE_REDIRECT,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    expect(browserOpen).toHaveBeenCalledWith({ url: 'https://khtz.supabase.co/auth/v1/authorize?provider=google' });
  });

  it('surfaces a friendly error when Supabase refuses', async () => {
    const supabase = fakeSupabase({
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: { message: 'provider is not enabled' } })),
    });
    const res = await startGoogleSignIn(supabase);
    expect(res.error).toBeTruthy();
    expect(browserOpen).not.toHaveBeenCalled();
  });
});

describe('completeNativeAuth', () => {
  it('exchanges a PKCE code for a session inside the app', async () => {
    const supabase = fakeSupabase();
    const res = await completeNativeAuth('com.lakbai.app://auth-callback?code=abc123', supabase);
    expect(res).toEqual({ handled: true, recovery: false, error: null });
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(browserClose).toHaveBeenCalled();
  });

  it('accepts the implicit-flow tokens too, so email links also land in the app', async () => {
    const supabase = fakeSupabase();
    const url = 'com.lakbai.app://auth-callback#access_token=at1&refresh_token=rt1&expires_in=3600&type=signup';
    const res = await completeNativeAuth(url, supabase);
    expect(res).toEqual({ handled: true, recovery: false, error: null });
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'at1', refresh_token: 'rt1' });
  });

  it('flags a recovery link before minting the session, so no signed-in flash', async () => {
    const supabase = fakeSupabase();
    const order = [];
    supabase.auth.setSession.mockImplementation(async () => { order.push('session'); return { data: {}, error: null }; });
    const onRecovery = vi.fn(() => order.push('recovery'));
    const res = await completeNativeAuth(
      'com.lakbai.app://auth-callback#access_token=at&refresh_token=rt&type=recovery',
      supabase,
      { onRecovery },
    );
    expect(res.handled).toBe(true);
    expect(res.recovery).toBe(true);
    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['recovery', 'session']);
  });

  it('does not flag an ordinary sign-in as recovery', async () => {
    const supabase = fakeSupabase();
    const onRecovery = vi.fn();
    const res = await completeNativeAuth('com.lakbai.app://auth-callback?code=abc', supabase, { onRecovery });
    expect(res.recovery).toBe(false);
    expect(onRecovery).not.toHaveBeenCalled();
  });

  it('ignores links that are not its callback', async () => {
    const supabase = fakeSupabase();
    const res = await completeNativeAuth('https://google.com/', supabase);
    expect(res).toEqual({ handled: false });
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('reports a cancelled or rejected Google login instead of silently doing nothing', async () => {
    const supabase = fakeSupabase();
    const res = await completeNativeAuth('com.lakbai.app://auth-callback?error=access_denied&error_description=User+denied', supabase);
    expect(res.handled).toBe(true);
    expect(res.error).toMatch(/cancelled|denied/i);
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('listenForAuthCallback', () => {
  it('handles a cold-start link and later links, then stops listening on cleanup', async () => {
    window.Capacitor = { isNativePlatform: () => true };
    getLaunchUrl.mockResolvedValueOnce({ url: 'com.lakbai.app://auth-callback?code=from-launch' });
    const remove = vi.fn();
    addListener.mockImplementation(async (_event, cb) => ({ remove }));
    const supabase = fakeSupabase();
    const onResult = vi.fn();

    const stop = await listenForAuthCallback(supabase, onResult);

    expect(addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function));
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('from-launch');

    const handler = addListener.mock.calls[0][1];
    await handler({ url: 'com.lakbai.app://auth-callback?code=later' });
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('later');
    expect(onResult).toHaveBeenCalled();

    stop();
    expect(remove).toHaveBeenCalled();
  });

  it('does nothing outside the native shell', async () => {
    const stop = await listenForAuthCallback(fakeSupabase(), () => {});
    expect(addListener).not.toHaveBeenCalled();
    expect(typeof stop).toBe('function');
    stop();
  });
});
