/**
 * Supabase auth errors, translated for travelers.
 *
 * Lives outside AuthContext so the native deep-link helper can use it without
 * importing the React provider (a cycle the bundler resolves unpredictably).
 */
export function friendlyAuthError(message){
  const m = String(message || '');
  if (/invalid login credentials|invalid password/i.test(m)) return 'Invalid email or password.';
  if (/auth session missing/i.test(m)) return 'This link has expired or was already used. Request a new one.';
  if (/email link is invalid|invalid.*otp|link.*expired|email link.*(expired|invalid)/i.test(m)) return 'This link has expired or was already used. Request a new one.';
  if (/failed to fetch|network error|load failed/i.test(m)) return 'Network error — check your connection and try again.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries — wait a minute and try again.';
  if (/user already registered/i.test(m)) return 'An account with this email already exists — try logging in.';
  if (/email not confirmed|email_not_confirmed/i.test(m)) return 'Confirm your email first, then log in.';
  if (/unable to validate email|invalid format/i.test(m)) return 'Enter a valid email address.';
  if (/signup disabled|signups.*disabled/i.test(m)) return 'Sign-ups are closed — sign in instead.';
  if (/password should be at least/i.test(m)) return 'Password must be at least 8 characters.';
  if (/access_denied|user denied|user cancelled|cancelled/i.test(m)) return 'Google sign-in was cancelled.';
  return m;
}
