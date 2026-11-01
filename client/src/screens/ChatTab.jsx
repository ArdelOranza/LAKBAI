import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { chat } from '../api.js';
import Logo from '../logo.jsx';

const WELCOME = { id:'welcome', role:'ai', text:"Hi! I'm LakbAI. Explore Pangasinan with a smile — ask for beaches, food, festivals, or let me plan your whole trip. I can spotlight secret spots and unique adventures whenever you're ready." };
let uid = 0;
const nid = () => 'm' + (++uid);

export default function ChatTab({ user, showToast }){
  const [msgs, setMsgs] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  useEffect(() => { listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight); }, [msgs, busy]);
  async function send(){
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMsgs(m => [...m, { id:nid(), role:'user', text:q }, { id:nid(), role:'ai', loading:true }]);
    setBusy(true);
    try {
      const out = await chat(q);
      const lines = [];
      if (out.answer) lines.push(out.answer);
      (out.candidates || []).slice(0, 6).forEach(c => {
        lines.push(`**${c.name}${c.hint ? ' — ' + c.hint : ''}**${c.rating ? ` ★${c.rating}` : ''}${c.description ? '\n' + c.description : ''}`);
      });
      setMsgs(m => [...m.filter(x => !x.loading), { id:nid(), role:'ai', text:lines.join('\n\n') || 'I could not find that — ask me about Pangasinan travel.' }]);
    } catch (e) {
      setMsgs(m => [...m.filter(x => !x.loading)]);
      showToast('LakbAI is busy — try again in a minute', 'error', e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
      <div className="pane" style={{ paddingTop:16, display:'flex', gap:10, alignItems:'center' }}>
        <Logo size={36}/>
        <div>
          <b style={{ fontSize:15 }}>LakbAI Travel Assistant</b>
          <p style={{ fontSize:11, color:'var(--muted-ink)', margin:0, display:'flex', alignItems:'center', gap:4 }}>
            <Sparkles size={11} color="var(--primary)"/> {user ? 'Plan smarter, travel better' : 'Sign in to save itineraries'}
          </p>
        </div>
      </div>
      <div ref={listRef} data-testid="chat-log" style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
        {msgs.map(m => m.loading ? (
          <div key={m.id} style={{ alignSelf:'flex-start', background:'#fff', borderRadius:'16px 16px 16px 4px', border:'1px solid #EDF1F7', padding:'10px 14px', fontSize:13 }}>
            <span className="shimmer">Searching places…</span>
          </div>
        ) : (
          <div key={m.id} style={{
            alignSelf:m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth:'86%',
            whiteSpace:'pre-wrap',
            fontSize:13.5,
            lineHeight:1.45,
            ...(m.role === 'user'
              ? { background:'var(--primary)', color:'#fff', borderRadius:'16px 16px 4px 16px', padding:'10px 14px' }
              : { background:'#fff', border:'1px solid #EDF1F7', borderRadius:'16px 16px 16px 4px', padding:'12px 14px' }),
          }}>{m.text}</div>
        ))}
      </div>
      <div className="pane" style={{ paddingBottom:96 }}>
        <div style={{ display:'flex', gap:8, background:'#fff', border:'1px solid #EDF1F7', borderRadius:999, padding:'6px 6px 6px 16px', alignItems:'center', boxShadow:'0 8px 22px -16px rgba(15,23,42,.4)' }}>
          <input data-testid="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Where would you like to explore today?" style={{ border:'none', padding:'8px 0', background:'none' }}/>
          <button data-testid="chat-send" onClick={send} disabled={busy} aria-label="Send" style={{ width:38, height:38, flex:'0 0 38px', borderRadius:'50%', background:'var(--primary)', color:'#fff', border:'none', padding:0, display:'grid', placeItems:'center' }}>
            <Send size={16}/>
          </button>
        </div>
      </div>
    </main>
  );
}
