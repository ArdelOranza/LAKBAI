import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Plus, Car, Navigation, CircleCheck, MapPin } from 'lucide-react';
import { chat } from '../api.js';
import { fetchSpots } from '../spots.js';
import { cardFor, mapThumb } from '../chatCards.js';
import { saveFavorite } from '../store.js';
import { haversineKm, formatDistance, driveMinutes } from '../geo.js';
import { PhotoPlaceholder } from '../ui.jsx';
import Logo from '../logo.jsx';
import AiBackdrop from '../AiBackdrop.jsx';

const WELCOME = { id:'welcome', role:'ai', text:"Hi! I'm LakbAI. Explore Pangasinan with a smile — ask for beaches, food, festivals, or let me plan your whole trip. I can spotlight secret spots and unique adventures whenever you're ready." };
const MAP_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
let uid = 0;
const nid = () => 'm' + (++uid);

function ChatCard({ card, coords, user, showToast, push, saved, onSaved }){
  const km = haversineKm(coords.lng, coords.lat, card.lng, card.lat);
  const img = card.photo || mapThumb(card.lng, card.lat, MAP_TOKEN);
  const place = card.spot || {
    id: card.id, name: card.name, lng: card.lng, lat: card.lat,
    blurb: card.description, categories: card.tags, town: card.hint,
  };

  async function add(e){
    e.stopPropagation();
    if (saved) return;
    const res = await saveFavorite(user, { id: card.id, name: card.name, lng: card.lng, lat: card.lat });
    if (res.error) { showToast('Sign in to save', 'error'); return; }
    onSaved(card.id);
    showToast('Added to Trip');
  }

  return (
    <article
      data-testid="chat-card"
      onClick={() => push({ name:'detail', place })}
      style={{ marginTop:12, border:'1px solid #EDF1F7', borderRadius:16, overflow:'hidden', background:'#fff', cursor:'pointer', boxShadow:'0 10px 24px -20px rgba(15,23,42,.55)' }}
    >
      <div style={{ position:'relative', height:150, background:'#EDF1F7' }}>
        {img
          ? <img src={img} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : <PhotoPlaceholder size={28}/>}

        {card.rating != null && (
          <span style={{ position:'absolute', right:10, top:10, display:'inline-flex', alignItems:'center', gap:4, background:'#fff', borderRadius:999, padding:'4px 9px', fontSize:11.5, fontWeight:700, boxShadow:'0 2px 8px rgba(10,37,64,.18)' }}>
            <Sparkles size={11} color="var(--accent)"/> {card.rating}
          </span>
        )}

        {card.hint && (
          <span style={{ position:'absolute', left:10, bottom:10, display:'inline-flex', alignItems:'center', gap:4, background:'rgba(10,37,64,.62)', color:'#fff', borderRadius:8, padding:'4px 9px', fontSize:10.5, fontWeight:600 }}>
            <Navigation size={10}/> {card.hint}
          </span>
        )}
      </div>

      <div style={{ padding:'10px 12px 12px' }}>
        <b style={{ display:'block', fontSize:16, letterSpacing:'-.3px' }}>{card.name}</b>

        {km != null && (
          <p style={{ margin:'4px 0 0', fontSize:11.5, color:'var(--muted-ink)', display:'flex', alignItems:'center', gap:4 }}>
            <Car size={12} color="var(--accent)"/> {formatDistance(km)} • {driveMinutes(km)} min
          </p>
        )}

        {card.description && (
          <p className="clamp-2" style={{ margin:'7px 0 0', fontSize:12.5, lineHeight:1.55, color:'#475569' }}>{card.description}</p>
        )}

        {card.tags.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:9 }}>
            {card.tags.map(t => (
              <span key={t} style={{ background:'#EFF6FF', color:'var(--primary)', borderRadius:999, padding:'3px 9px', fontSize:10.5, fontWeight:600 }}>{t}</span>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:11 }}>
          <button
            data-testid="chat-card-save"
            onClick={add}
            disabled={saved}
            style={{ flex:1, minHeight:42, borderRadius:999, border:'none', background:'var(--primary)', color:'#fff', fontSize:13.5, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}
          >
            {saved ? <><CircleCheck size={16}/> Added to Trip</> : <><Plus size={16}/> Add to Trip</>}
          </button>
          <button
            aria-label="Directions"
            onClick={e => { e.stopPropagation(); if (card.lat != null) window.open('https://www.google.com/maps/dir/?api=1&destination=' + card.lat + ',' + card.lng); }}
            style={{ width:42, height:42, minWidth:42, borderRadius:'50%', border:'1px solid #D9E2EF', background:'#fff', color:'var(--primary)', display:'grid', placeItems:'center', padding:0 }}
          >
            <Navigation size={17}/>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ChatTab({ user, coords, push, showToast }){
  const [msgs, setMsgs] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [spots, setSpots] = useState([]);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const listRef = useRef(null);

  useEffect(() => { listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight); }, [msgs, busy]);
  useEffect(() => { fetchSpots().then(setSpots).catch(() => {}); }, []);

  async function send(){
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMsgs(m => [...m, { id:nid(), role:'user', text:q }, { id:nid(), role:'ai', loading:true }]);
    setBusy(true);
    try {
      const out = await chat(q);
      const candidates = out.candidates || [];
      const cards = candidates.slice(0, 1).map(c => cardFor(c, spots));
      const more = candidates.slice(1, 6).map(c => c.name + (c.hint ? ' — ' + c.hint : ''));
      setMsgs(m => [...m.filter(x => !x.loading), {
        id:nid(), role:'ai',
        text: out.answer || 'I could not find that — ask me about Pangasinan travel.',
        cards, more,
      }]);
    } catch (e) {
      setMsgs(m => [...m.filter(x => !x.loading)]);
      showToast('LakbAI is busy — try again in a minute', 'error', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, position:'relative', overflow:'hidden' }}>
      <AiBackdrop/>

      <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="pane" style={{ paddingTop:16, display:'flex', gap:10, alignItems:'center' }}>
          <Logo size={36}/>
          <div>
            <b style={{ fontSize:15 }}>LakbAI Travel Assistant</b>
            <p style={{ fontSize:11, color:'var(--muted-ink)', margin:0, display:'flex', alignItems:'center', gap:4 }}>
              <Sparkles size={11} color="var(--primary)"/> {user ? 'Plan smarter, travel better' : 'Sign in to save itineraries'}
            </p>
          </div>
        </div>

        <div ref={listRef} data-testid="chat-log" style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
          {msgs.map(m => m.loading ? (
            <div key={m.id} style={{ alignSelf:'flex-start' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ width:24, height:24, borderRadius:'50%', background:'#EFF6FF', display:'grid', placeItems:'center' }}><Logo size={16}/></span>
                <span style={{ fontSize:12, fontWeight:700 }}>LakbAI Guide</span>
              </div>
              <span className="shimmer" style={{ fontSize:13 }}>Searching places...</span>
            </div>
          ) : (
            <div key={m.id} style={{ alignSelf:m.role === 'user' ? 'flex-end' : 'stretch', maxWidth:m.role === 'user' ? '86%' : '100%' }}>
              {m.role === 'ai' && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ width:24, height:24, borderRadius:'50%', background:'#EFF6FF', display:'grid', placeItems:'center' }}><Logo size={16}/></span>
                  <span style={{ fontSize:12, fontWeight:700 }}>LakbAI Guide</span>
                </div>
              )}
              <div style={{
                whiteSpace:'pre-wrap',
                fontSize:13.5,
                lineHeight:1.5,
                ...(m.role === 'user'
                  ? { background:'var(--ink)', color:'#fff', borderRadius:'16px 16px 4px 16px', padding:'10px 14px' }
                  : { color:'var(--ink)' }),
              }}>{m.text}</div>
              {(m.cards || []).map(card => (
                <ChatCard
                  key={card.id}
                  card={card}
                  coords={coords}
                  user={user}
                  push={push}
                  showToast={showToast}
                  saved={savedIds.has(card.id)}
                  onSaved={id => setSavedIds(prev => new Set(prev).add(id))}
                />
              ))}
              {(m.more || []).length > 0 && (
                <ul data-testid="chat-more" style={{ listStyle:'none', margin:'12px 0 0', padding:'10px 12px', border:'1px solid #EDF1F7', borderRadius:14, background:'rgba(255,255,255,.72)', display:'grid', gap:7 }}>
                  {m.more.map(line => (
                    <li key={line} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#475569' }}>
                      <MapPin size={12} color="var(--primary)"/>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="pane" style={{ paddingBottom:96 }}>
          <div style={{ display:'flex', gap:8, background:'#fff', border:'1px solid #EDF1F7', borderRadius:999, padding:'6px 6px 6px 16px', alignItems:'center', boxShadow:'0 8px 22px -16px rgba(15,23,42,.4)' }}>
            <input data-testid="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Ask a follow up question..." style={{ border:'none', padding:'8px 0', background:'none' }}/>
            <button data-testid="chat-send" onClick={send} disabled={busy} aria-label="Send" style={{ width:38, height:38, flex:'0 0 38px', borderRadius:'50%', background:'var(--primary)', color:'#fff', border:'none', padding:0, display:'grid', placeItems:'center' }}>
              <Send size={16}/>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}