import { useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import Logo from '../logo.jsx';
import GoogleMark from '../GoogleMark.jsx';

const NOTE = 'Google sign-in is not connected yet — use email for now.';

export default function Splash({ onGetStarted, onLogIn }){
  const [googleNote, setGoogleNote] = useState(false);

  return (
    <main style={{ position:'relative', flex:1, minHeight:0, display:'flex', flexDirection:'column', justifyContent:'flex-end', overflow:'hidden', background:'#08243D' }}>
      <img
        className="intro-photo"
        src="/intro-hundred-islands.jpg"
        alt="Hundred Islands National Park, Alaminos, Pangasinan"
        fetchPriority="high"
        decoding="async"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'50% 50%' }}
      />
      <div aria-hidden="true" style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(4,18,34,.6) 0%, rgba(4,18,34,.2) 14%, rgba(4,18,34,0) 30%, rgba(4,18,34,.12) 54%, rgba(4,18,34,.74) 84%, rgba(4,18,34,.93) 100%)' }}/>

      <header style={{ position:'absolute', top:0, left:0, right:0, zIndex:2, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'calc(16px + env(safe-area-inset-top,0px)) 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:38, height:38, minWidth:38, borderRadius:12, background:'#fff', display:'grid', placeItems:'center', boxShadow:'0 8px 20px -10px rgba(0,0,0,.7)' }}>
            <Logo size={22}/>
          </span>
          <span style={{ color:'#fff', fontSize:19, fontWeight:800, letterSpacing:-.3 }}>LakbAI</span>
        </div>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:999, border:'1px solid rgba(255,255,255,.34)', background:'rgba(255,255,255,.14)', backdropFilter:'blur(8px)', color:'rgba(255,255,255,.94)', fontSize:10, fontWeight:700, letterSpacing:1.1, textTransform:'uppercase' }}>
          <MapPin size={11}/> Pangasinan
        </span>
      </header>

      <section style={{ position:'relative', zIndex:2, padding:'0 24px' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8, color:'#C7DCFF', fontSize:9.5, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase' }}>
          <span aria-hidden="true" style={{ width:16, height:1.5, background:'#C7DCFF' }}/> Hundred Islands · Alaminos
        </span>
        <h1 style={{ margin:'10px 0 0', color:'#fff', fontSize:36, lineHeight:1.03, letterSpacing:-1.3, fontWeight:800, textShadow:'0 2px 18px rgba(0,0,0,.3)' }}>
          Find your<br/>Pangasinan.
        </h1>
        <p style={{ margin:'10px 0 0', maxWidth:290, color:'rgba(255,255,255,.84)', fontSize:13.5, lineHeight:1.55 }}>
          Verified spots, real local eats, and a guide that actually knows the province.
        </p>
      </section>

      <section style={{ position:'relative', zIndex:2, padding:'20px 24px calc(20px + env(safe-area-inset-bottom,0px))' }}>
        <button
          type="button"
          data-testid="google-signin"
          onClick={() => setGoogleNote(true)}
          style={{ width:'100%', minHeight:52, display:'flex', alignItems:'center', justifyContent:'center', gap:11, padding:'12px 18px', borderRadius:999, border:'1px solid rgba(15,23,42,.06)', background:'#fff', color:'#1F2937', fontSize:15.5, fontWeight:600, boxShadow:'0 16px 34px -18px rgba(0,0,0,.8)' }}
        >
          <GoogleMark size={19}/> Continue with Google
        </button>

        <div aria-live="polite" style={{ minHeight:19, padding:'6px 2px 0', textAlign:'center' }}>
          {googleNote && <span style={{ fontSize:11.5, lineHeight:1.4, color:'rgba(255,255,255,.82)' }}>{NOTE}</span>}
        </div>

        <div aria-hidden="true" style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 2px 12px', color:'rgba(255,255,255,.6)', fontSize:10, fontWeight:700, letterSpacing:1.4 }}>
          <span style={{ flex:1, height:1, background:'rgba(255,255,255,.26)' }}/> OR <span style={{ flex:1, height:1, background:'rgba(255,255,255,.26)' }}/>
        </div>

        <button
          type="button"
          data-testid="get-started"
          onClick={onGetStarted}
          style={{ width:'100%', minHeight:52, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'12px 18px', borderRadius:999, border:'1px solid rgba(255,255,255,.44)', background:'rgba(255,255,255,.13)', backdropFilter:'blur(10px)', color:'#fff', fontSize:15.5, fontWeight:600 }}
        >
          Continue with email <ArrowRight size={17}/>
        </button>

        <p style={{ margin:'16px 0 0', textAlign:'center', color:'rgba(255,255,255,.78)', fontSize:13.5 }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onLogIn}
            style={{ padding:0, border:'none', background:'none', color:'#fff', fontSize:13.5, fontWeight:700, textDecoration:'underline', textUnderlineOffset:3 }}
          >
            Log in
          </button>
        </p>
      </section>
    </main>
  );
}
