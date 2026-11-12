import { isNativeApp } from './nativeAuth.js';

/**
 * The public web app. Inside the APK the page is served from
 * `https://localhost`, so `window.location` is meaningless to anyone else —
 * links we share (a place, the app itself) always use this origin.
 */
export const PUBLIC_ORIGIN = String(
  import.meta.env.VITE_PUBLIC_URL || 'https://lakbai-app.onrender.com',
).replace(/\/+$/, '');

/** The URL to hand to another person for the screen in front of you. */
export function shareUrl(){
  if (typeof window === 'undefined') return PUBLIC_ORIGIN + '/';
  return isNativeApp() ? PUBLIC_ORIGIN + '/' : window.location.href;
}
