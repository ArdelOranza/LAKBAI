import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, configured } from './supabaseClient.js';

const Ctx = createContext({ user: null, loading: true, configured, signUp: async () => ({ error: 'Auth not configured' }), signInWithPassword: async () => ({ error: 'Auth not configured' }), resetPassword: async () => ({ error: 'Auth not configured' }), signOut: async () => {} });

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
    const { data, error } = await supabase.auth.signUp({ email: String(email).trim(), password });
    if (error) return { error: String(error.message || error) };
    return data.session ? {} : { needsConfirm: true, detail: 'Check your email to confirm your account, then log in.' };
  }
  async function signInWithPassword(email, password){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
    return error ? { error: String(error.message || error) } : {};
  }
  async function resetPassword(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: window.location.origin });
    return error ? { error: String(error.message || error) } : { detail: 'Password reset link sent. Check your email.' };
  }
  async function signOut(){ if (supabase) await supabase.auth.signOut(); setUser(null); }
  return <Ctx.Provider value={{ user, loading, configured, signUp, signInWithPassword, resetPassword, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
