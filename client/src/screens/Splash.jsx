import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Logo from '../logo.jsx';
import GoogleMark from '../GoogleMark.jsx';
import { PrimaryBtn } from '../ui.jsx';

const NOTE = 'Google sign-in is not connected yet — use email for now.';

export default function Splash({ onGetStarted, onLogIn }){
  const [googleNote, setGoogleNote] = useState(false);

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

        <button
          type="button"
          data-testid="google-signin"
          onClick={() => setGoogleNote(true)}
          style={{ width:'100%', minHeight:52, display:'flex', alignItems:'center', justifyContent:'center', gap:11, padding:'12px 18px', border:'1px solid var(--border)', background:'#fff', color:'var(--ink)', fontSize:15.5, fontWeight:600, boxShadow:'var(--shadow)' }}
        >
          <GoogleMark size={19}/> Continue with Google
        </button>
        <div aria-live="polite" style={{ minHeight:19, padding:'5px 2px 0', textAlign:'center' }}>
          {googleNote && <span style={{ fontSize:11.5, lineHeight:1.4, color:'var(--muted-ink)' }}>{NOTE}</span>}
        </div>

        <PrimaryBtn testid="get-started" onClick={onGetStarted}>Get Started <ArrowRight size={17}/></PrimaryBtn>
        <button style={{ display:'block', margin:'14px auto 0', border:'none', background:'none', color:'var(--muted-ink)' }} onClick={onLogIn}>Log In</button>
      </div>
    </main>
  );
}
