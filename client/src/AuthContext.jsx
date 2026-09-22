import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, configured } from './supabaseClient.js';
const Ctx = createContext({ user: null, loading: true, signIn: async () => ({ error: 'Auth not configured' }), signOut: async () => {} });
export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  async function signIn(email){
    if (!supabase) return { error: 'Auth not configured — add Supabase keys to .env.' };
    return supabase.auth.signInWithOtp({ email });
  }
  async function signOut(){ if (supabase) await supabase.auth.signOut(); setUser(null); }
  return <Ctx.Provider value={{ user, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
