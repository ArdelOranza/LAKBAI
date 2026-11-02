const EMAIL = /.+@.+\..+/;
export function validateSignup({ email, password, confirm }){
  if (!EMAIL.test(String(email || ''))) return { ok: false, field: 'email', message: 'Enter a valid email address.' };
  if (String(password || '').length < 8) return { ok: false, field: 'password', message: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { ok: false, field: 'confirm', message: 'Passwords do not match.' };
  return { ok: true };
}
export function validateLogin({ email, password }){
  if (!EMAIL.test(String(email || ''))) return { ok: false, field: 'email', message: 'Enter a valid email address.' };
  if (!String(password || '').length) return { ok: false, field: 'password', message: 'Enter your password.' };
  return { ok: true };
}
// Supabase refuses the login until the signup email is confirmed. The message
// wording varies ("Email not confirmed" / "email_not_confirmed"), so match both.
export function needsEmailConfirmation(message){
  return /email[_ ]?not[_ ]?confirmed|not confirmed/i.test(String(message || ''));
}
