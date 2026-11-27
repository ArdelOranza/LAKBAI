import { createClient } from '@supabase/supabase-js';
import { isNativeApp } from './nativeAuth.js';

/**
 * Supabase client settings.
 *
 * PKCE: the browser/WebView proves it started the flow, and only the matching
 * code is exchanged for a session. Supabase's default implicit flow hands the
 * access token to any page the callback URL opens on.
 *
 * detectSessionInUrl is on for the website (Supabase owns the callback) and off
 * in the APK, where nativeAuth.js handles the app's own scheme. Otherwise a
 * stray `#access_token` on any open page would be treated as a sign-in.
 */
export function clientOptions({ native = isNativeApp() } = {}){
  return {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: !native,
    },
  };
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = (url && anon) ? createClient(url, anon, clientOptions()) : null;
export const configured = Boolean(url && anon);
