import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Logo from '../logo.jsx';
import { PrimaryBtn, GoogleBtn } from '../ui.jsx';
import { useAuth } from '../AuthContext.jsx';

export default function Splash({ onGetStarted, onLogIn }){
  const { signInWithGoogle, configured } = useAuth();
  const [googleNote, setGoogleNote] = useState(null);
  const [busy, setBusy] = useState(false);

  // If the browser suspends us for Google then restores from bfcache on
  // back-press, busy would still be true and the buttons dead. Clear it.
  // (Only pageshow: visibilitychange also fires when the traveler merely
  // backgrounds mid-request, and clearing then allows a double-submit that
  // overwrites the PKCE verifier.)
  useEffect(() => {
    const clear = () => setBusy(false);
    window.addEventListener('pageshow', clear);
    return () => { window.removeEventListener('pageshow', clear); };
  }, []);

  async function google(){
    setBusy(true); setGoogleNote(null);
    let res;
    try { res = await signInWithGoogle(); }
    catch (e) { res = { error: String(e?.message || e) }; }
    finally { setBusy(false); }
    // A successful call leaves the page for Google, so only errors land here.
    if (res.error){
      setGoogleNote(/not enabled|provider/i.test(res.error)
        ? 'Google sign-in isn’t available right now — use email for now.'
        : res.error);
    }
  }

  return (
    <main style={{ position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <img
        src="/intro-hundred-islands.jpg"
        alt="Hundred Islands, Alaminos, Pangasinan"
        fetchPriority="high"
        decoding="async"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
      />
      <div aria-hidden="true" style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(255,255,255,0) 42%, rgba(255,255,255,.28) 58%, rgba(255,255,255,.8) 70%, rgba(255,255,255,.98) 88%, #FFFFFF 100%)' }}/>
      <div style={{ position:'relative', padding:'0 24px 40px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:28 }}>
          <Logo size={64}/>
          <div>
            <img src="/lakbai-wordmark.png" alt="LakbAI" style={{ display:'block', height:38, width:'auto' }}/>
            <div style={{ fontSize:11, color:'var(--muted-ink)', marginTop:3 }}>Lakbai, smarter, not harder.</div>
          </div>
        </div>

        {!configured && (
          <p data-testid="auth-unconfigured" style={{ textAlign:'center', fontSize:12, color:'var(--muted-ink)', margin:'0 0 12px' }}>
            Auth isn’t configured yet. Add your Supabase keys to .env to enable sign-in.
          </p>
        )}
        <GoogleBtn onClick={google} disabled={busy || !configured}/>
        <div aria-live="polite" style={{ minHeight:19, padding:'5px 2px 0', textAlign:'center' }}>
          {googleNote && <span style={{ fontSize:11.5, lineHeight:1.4, color:'var(--muted-ink)' }}>{googleNote}</span>}
        </div>

        <PrimaryBtn testid="get-started" onClick={onGetStarted} disabled={!configured}>Get Started <ArrowRight size={17}/></PrimaryBtn>
        <button style={{ display:'block', margin:'14px auto 0', border:'none', background:'none', color:'var(--muted-ink)' }} onClick={onLogIn} disabled={!configured}>Log In</button>
      </div>
    </main>
  );
}
