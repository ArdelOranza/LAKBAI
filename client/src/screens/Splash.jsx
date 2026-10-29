import Logo from '../logo.jsx';
import { PrimaryBtn } from '../ui.jsx';

export default function Splash({ onGetStarted, onLogIn }){
  return (
    <main style={{ position:'relative', minHeight:'100dvh', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <img src="/hero.svg" alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(255,255,255,.05) 35%, rgba(255,255,255,.97) 88%)' }}/>
      <div style={{ position:'relative', padding:'0 24px 40px' }}>
        <div style={{ display:'grid', placeItems:'center', marginBottom:28 }}><Logo size={64} withWordmark/></div>
        <PrimaryBtn testid="get-started" onClick={onGetStarted}>Get Started →</PrimaryBtn>
        <button style={{ display:'block', margin:'14px auto 0', border:'none', background:'none', color:'var(--muted-ink)' }} onClick={onLogIn}>Log In</button>
      </div>
    </main>
  );
}
