import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { TAGS, toggleTag, readLocalPrefs, savePrefs } from '../prefs.js';
import { useAuth } from '../AuthContext.jsx';

export default function Preferences({ onContinue, onBack }){
  const { user } = useAuth();
  const [picked, setPicked] = useState(() => readLocalPrefs(user));
  const [busy, setBusy] = useState(false);
  async function done(){
    setBusy(true);
    try{
      await savePrefs(user, picked);
    }catch{ /* best-effort: never trap the traveler in onboarding */ }
    finally{
      setBusy(false);
      onContinue(picked);
    }
  }
  return (
    <main style={{ flex:1, overflowY:'auto' }}>
      <div className="pane" style={{ paddingTop:16 }}>
        {onBack && <button className="icon-btn" data-testid="back-btn" onClick={onBack} aria-label="Back"><ArrowLeft size={18}/></button>}
        <h1 style={{ marginTop:onBack ? 22 : 34, fontSize:28, letterSpacing:'-.8px', lineHeight:1.2 }}>Let’s personalize your trip.</h1>
        <p style={{ color:'var(--muted-ink)', fontSize:13.5, marginTop:2 }}>Please select the interests you want to explore.</p>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'22px 0 8px' }}>
          <b style={{ fontSize:11, letterSpacing:.9, color:'var(--muted-ink)' }}>YOUR TRAVEL VIBE</b>
          <span data-testid="pref-count" style={{ color:'var(--primary)', fontSize:12.5, fontWeight:600 }}>{picked.length} Selected</span>
        </div>

        <div className="pref-chips">
          {TAGS.map(t => {
            const on = picked.includes(t);
            return (
              <button key={t} type="button" className={'pref-chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setPicked(c => toggleTag(c, t))}>
                {t}{on && <Check size={14}/>}
              </button>
            );
          })}
        </div>

        <div className="soft-card" style={{ marginTop:28 }}>
          <span style={{ width:36, height:36, minWidth:36, borderRadius:12, background:'#fff', color:'var(--primary)', display:'grid', placeItems:'center' }}>
            <Sparkles size={17}/>
          </span>
          <span>
            <b style={{ color:'var(--primary)', fontSize:13.5 }}>AI Recommendation Style</b>
            <p style={{ fontSize:12, color:'var(--muted-ink)', margin:'3px 0 0', lineHeight:1.45 }}>LakbAI curates destinations matching your selected tags with real-time transit routes</p>
          </span>
        </div>

        <div style={{ marginTop:26, paddingBottom:28 }}>
          <button data-testid="continue-btn" className="primary-btn" disabled={busy} onClick={done}>
            {busy ? 'Saving…' : 'Save Preferences'} <ArrowRight size={17}/>
          </button>
        </div>
      </div>
    </main>
  );
}
