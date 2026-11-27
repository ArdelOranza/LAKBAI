// Supabase auth configuration.
//
// PKCE keeps the OAuth code exchange in the client instead of accepting tokens
// straight from a URL fragment, and the native shell must not let supabase-js
// consume callbacks on whatever page happens to be open.
import { describe, it, expect } from 'vitest';
import { clientOptions } from './supabaseClient.js';

describe('clientOptions', () => {
  it('uses the PKCE flow and persists the session on the website', () => {
    const opts = clientOptions({ native: false });
    expect(opts.auth.flowType).toBe('pkce');
    expect(opts.auth.persistSession).toBe(true);
    expect(opts.auth.autoRefreshToken).toBe(true);
    expect(opts.auth.detectSessionInUrl).toBe(true);
  });

  it('leaves callback handling to the app inside the native shell', () => {
    const opts = clientOptions({ native: true });
    expect(opts.auth.flowType).toBe('pkce');
    expect(opts.auth.detectSessionInUrl).toBe(false);
  });
});
