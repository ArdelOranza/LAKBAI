import { useState } from 'react';
import { TAGS, toggleTag, readLocalPrefs, savePrefs } from '../prefs.js';
import { useAuth } from '../AuthContext.jsx';
import Logo from '../logo.jsx';
import { Chip, PrimaryBtn } from '../ui.jsx';

export default function Preferences({ onContinue }){
  const { user } = useAuth();
  const [picked, setPicked] = useState(() => readLocalPrefs());
  const [busy, setBusy] = useState(false);
  async function done(){
    setBusy(true);
    await savePrefs(user, picked);
    setBusy(false);
    onContinue(picked);
  }
  return (
    <main className="pane" style={{ paddingTop:32, paddingBottom:32 }}>
      <div style={{ display:'grid', placeItems:'center', marginBottom:16 }}><Logo size={56}/></div>
      <h1>Let’s personalize your trip.</h1>
      <p style={{ color:'var(--muted-ink)', fontSize:14, marginTop:-4 }}>Please select the interests you want to explore.</p>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'14px 0 10px' }}>
        <b style={{ fontSize:12, letterSpacing:1 }}>YOUR TRAVEL VIBE</b>
        <span data-testid="pref-count" style={{ color:'var(--primary)', fontSize:13, fontWeight:600 }}>{picked.length} Selected</span>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        {TAGS.map(t => <Chip key={t} active={picked.includes(t)} onClick={() => setPicked(c => toggleTag(c, t))}>{t}</Chip>)}
      </div>
      <div style={{ background:'var(--chip)', borderRadius:16, padding:16, marginTop:22, display:'flex', gap:12 }}>
        <span style={{ fontSize:22, color:'var(--primary)' }}>✦</span>
        <span>
          <b style={{ color:'var(--primary)' }}>AI Recommendation Style</b>
          <p style={{ fontSize:13, color:'var(--muted-ink)', margin:'4px 0 0' }}>LakbAI curates destinations matching your selected tags with real-time transit routes</p>
        </span>
      </div>
      <div style={{ marginTop:22 }}><PrimaryBtn testid="continue-btn" disabled={busy} onClick={done}>Continue →</PrimaryBtn></div>
    </main>
  );
}
