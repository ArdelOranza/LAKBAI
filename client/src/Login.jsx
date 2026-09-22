import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { configured } from './supabaseClient.js';
export default function Login(){
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  async function send(){
    const { error } = await signIn(email.trim());
    setNotice(error ? String(error.message || error) : 'Check your email for the login link.');
  }
  return (
    <section>
      <h2>Log in</h2>
      {!configured && <p data-testid="login-notice">Auth not configured — add Supabase keys to .env.</p>}
      <input data-testid="login-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" aria-label="Email" />
      <button data-testid="login-send" onClick={send}>Send magic link</button>
      {notice && configured && <p data-testid="login-notice">{notice}</p>}
      <button data-testid="google-btn" disabled title="Enable Google in the Supabase dashboard first">Continue with Google (setup required)</button>
    </section>
  );
}
