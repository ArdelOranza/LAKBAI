// @vitest-environment happy-dom
// The provider must route Google sign-in through the native helper inside the
// APK (no WebView redirect), and keep the plain web redirect on the website.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';

const nativeFlags = vi.hoisted(() => ({ native: false }));
const startGoogleSignIn = vi.hoisted(() => vi.fn(async () => ({})));
const listenForAuthCallback = vi.hoisted(() => vi.fn(async () => () => {}));
const signInWithOAuth = vi.hoisted(() => vi.fn(async () => ({ data: {}, error: null })));
const emailRedirectTo = vi.hoisted(() => vi.fn(() => 'app-scheme'));
const signUp = vi.hoisted(() => vi.fn(async () => ({ data: { session: null }, error: null })));
const resend = vi.hoisted(() => vi.fn(async () => ({ data: {}, error: null })));
const resetPasswordForEmail = vi.hoisted(() => vi.fn(async () => ({ data: {}, error: null })));

vi.mock('./nativeAuth.js', () => ({
  NATIVE_REDIRECT: 'com.lakbai.app://auth-callback',
  isNativeApp: () => nativeFlags.native,
  startGoogleSignIn,
  listenForAuthCallback,
  emailRedirectTo,
}));
vi.mock('./supabaseClient.js', () => ({
  configured: true,
  supabase: {
    auth: {
      signInWithOAuth,
      signUp,
      resend,
      resetPasswordForEmail,
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

import { AuthProvider, useAuth } from './AuthContext.jsx';

async function mountAuth(){
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // A ref, not a copied value: every re-render has to be visible to the test.
  const auth = { current: null };
  function Probe(){
    auth.current = useAuth();
    return null;
  }
  await React.act(async () => { root.render(<AuthProvider><Probe/></AuthProvider>); });
  await React.act(async () => { await Promise.resolve(); });
  return { auth, root, container };
}

beforeEach(() => {
  nativeFlags.native = false;
  startGoogleSignIn.mockClear();
  listenForAuthCallback.mockClear();
  signInWithOAuth.mockClear();
  emailRedirectTo.mockClear();
  signUp.mockClear();
  resend.mockClear();
  resetPasswordForEmail.mockClear();
});

describe('AuthContext Google sign-in', () => {
  it('uses the Custom Tab + deep-link helper inside the APK', async () => {
    nativeFlags.native = true;
    const { auth, root, container } = await mountAuth();

    await React.act(async () => { await auth.current.signInWithGoogle(); });

    expect(startGoogleSignIn).toHaveBeenCalledTimes(1);
    // The provider itself must not redirect the WebView away from the app.
    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(listenForAuthCallback).toHaveBeenCalled();

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('keeps the same-origin redirect on the website', async () => {
    const { auth, root, container } = await mountAuth();

    await React.act(async () => { await auth.current.signInWithGoogle(); });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    });
    expect(startGoogleSignIn).not.toHaveBeenCalled();
    expect(listenForAuthCallback).not.toHaveBeenCalled();

    await React.act(async () => root.unmount());
    container.remove();
  });
});

// The reported bug: sign in with an emailed link inside the app and end up
// signed in on the website, still signed out in the app. The link target is the
// WebView's https://localhost origin, which no mailbox can hand back to us.
describe('AuthContext email links', () => {
  it('points confirmation, resend and reset links at the app scheme in the APK', async () => {
    nativeFlags.native = true;
    const { auth, root, container } = await mountAuth();

    await React.act(async () => { await auth.current.signUp('traveler@example.com', 'password123'); });
    expect(signUp).toHaveBeenCalledWith({
      email: 'traveler@example.com',
      password: 'password123',
      options: { emailRedirectTo: 'app-scheme' },
    });

    await React.act(async () => { await auth.current.resendConfirmation('traveler@example.com'); });
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'traveler@example.com',
      options: { emailRedirectTo: 'app-scheme' },
    });

    await React.act(async () => { await auth.current.resetPassword('traveler@example.com'); });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('traveler@example.com', { redirectTo: 'app-scheme' });

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('surfaces a failed callback instead of leaving the traveler silently signed out', async () => {
    nativeFlags.native = true;
    const { auth, root, container } = await mountAuth();
    const onResult = listenForAuthCallback.mock.calls[0][1];

    await React.act(async () => {
      onResult({ handled: true, error: 'redirect_uri is not allowed' });
    });

    expect(auth.current.authError).toMatch(/redirect_uri is not allowed/);

    await React.act(async () => { auth.current.clearAuthError(); });
    expect(auth.current.authError).toBeNull();

    await React.act(async () => root.unmount());
    container.remove();
  });

  it('opens the set-password screen for a recovery link before the session paints', async () => {
    nativeFlags.native = true;
    const { auth, root, container } = await mountAuth();
    const hooks = listenForAuthCallback.mock.calls[0][2];

    await React.act(async () => { hooks.onRecovery(); });

    expect(auth.current.recovery).toBe(true);

    await React.act(async () => root.unmount());
    container.remove();
  });
});
