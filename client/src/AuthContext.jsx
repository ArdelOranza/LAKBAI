import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, configured } from './supabaseClient.js';

const Ctx = createContext({ user: null, loading: true, configured, signUp: async () => ({ error: 'Auth not configured' }), signInWithPassword: async () => ({ error: 'Auth not configured' }), resendConfirmation: async () => ({ error: 'Auth not configured' }), resetPassword: async () => ({ error: 'Auth not configured' }), signOut: async () => {} });

export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  async function signUp(email, password){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    // Point the confirmation link at the deployment the person signed up on,
    // not whatever Site URL the Supabase project happens to have configured.
    const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.signUp({ email: String(email).trim(), password, options: { emailRedirectTo } });
    if (error) return { error: String(error.message || error) };
    return data.session ? {} : { needsConfirm: true, detail: 'Check your email to confirm your account, then log in.' };
  }
  async function signInWithPassword(email, password){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
    return error ? { error: String(error.message || error) } : {};
  }
  async function resendConfirmation(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resend({ type: 'signup', email: String(email).trim(), options: { emailRedirectTo } });
    return error ? { error: String(error.message || error) } : { detail: 'Confirmation email sent again. Check your inbox and spam folder.' };
  }
  async function resetPassword(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: window.location.origin });
    return error ? { error: String(error.message || error) } : { detail: 'Password reset link sent. Check your email.' };
  }
  async function signOut(){ if (supabase) await supabase.auth.signOut(); setUser(null); }
  return <Ctx.Provider value={{ user, loading, configured, signUp, signInWithPassword, resendConfirmation, resetPassword, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
