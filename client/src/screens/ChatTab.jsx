import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Send, ArrowUp, Mic, Plus, Sparkles, CircleCheck, MapPin, Star, CheckCheck,
  ChevronRight, EllipsisVertical, SlidersHorizontal, MessageSquarePlus,
  Bookmark, Navigation, Compass, ArrowLeft,
} from 'lucide-react';
import { chat } from '../api.js';
import { fetchSpots } from '../spots.js';
import { cardFor, mapThumb } from '../chatCards.js';
import { saveFavorite } from '../store.js';
import { haversineKm, formatDistance, driveMinutes } from '../geo.js';
import { PhotoPlaceholder } from '../ui.jsx';
import Logo from '../logo.jsx';
// import AiBackdrop from '../AiBackdrop.jsx'; // parked: the chat background stays plain

const WELCOME = { id:'welcome', role:'ai', text:"Hi! I'm LakbAI. Explore Pangasinan with a smile — ask for beaches, food, festivals, or let me plan your whole trip. I can spotlight secret spots and unique adventures whenever you're ready." };
const STARTERS = [
  'Best beaches near Bolinao',
  'Where should I eat in Dagupan?',
  'Festivals this month',
  'Plan a 2-day Pangasinan trip',
];
const MAP_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
let uid = 0;
const nid = () => 'm' + (++uid);
const clock = ts => new Date(ts).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
function dayLabel(ts){
  const d = new Date(ts), now = new Date();
  const day = d.toDateString() === now.toDateString()
    ? 'Today'
    : d.toLocaleDateString([], { month:'short', day:'numeric' });
  return day + ' • ' + clock(ts);
}
function distanceLine(km){
  const mins = driveMinutes(km);
  return `${mins} ${mins === 1 ? 'min' : 'mins'} away • ${formatDistance(km)}`;
}

function ChatCard({ card, coords, user, showToast, push, saved, onSaved }){
  const km = haversineKm(coords.lng, coords.lat, card.lng, card.lat);
  const img = card.photo || mapThumb(card.lng, card.lat, MAP_TOKEN);
  const badge = card.fees || card.festival;
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
  function directions(e){
    e.stopPropagation();
    if (card.lat == null) { push({ name:'detail', place }); return; }
    window.open('https://www.google.com/maps/dir/?api=1&destination=' + card.lat + ',' + card.lng);
  }

  return (
    <article className="chat-card" data-testid="chat-card" onClick={() => push({ name:'detail', place })}>
      <div className="chat-card-media">
        {img
          ? <img src={img} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}/>
          : <PhotoPlaceholder size={26}/>}

        {card.rating != null && (
          <span className="chat-card-rating">
            <Star size={11} fill="currentColor" strokeWidth={0}/> {card.rating}
          </span>
        )}

        {card.hint && (
          <span className="chat-card-place">
            <MapPin size={11}/> {card.hint}
          </span>
        )}
      </div>

      <div className="chat-card-body">
        <div className="chat-card-title">
          <b>{card.name}</b>
          {badge && <span className="chat-card-badge" title={badge}>{badge}</span>}
        </div>

        {km != null && (
          <button type="button" className="chat-card-dist" onClick={directions} aria-label={'Directions to ' + card.name}>
            <span className="dist-ico"><Navigation size={11}/></span>
            <span>{distanceLine(km)}</span>
            <ChevronRight size={13} className="dist-chev"/>
          </button>
        )}

        {card.tags.length > 0 && (
          <div className="chat-card-tags">
            {card.tags.map(t => <span key={t} className="chat-tag">{t}</span>)}
          </div>
        )}

        <button
          type="button"
          data-testid="chat-card-save"
          className="chat-card-save"
          onClick={add}
          disabled={saved}
        >
          {saved ? <><CircleCheck size={16}/> Added to Trip</> : <><Plus size={16}/> Add to Trip</>}
        </button>
      </div>
    </article>
  );
}

export default function ChatTab({ user, coords, push, setTab, showToast }){
  const [msgs, setMsgs] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [spots, setSpots] = useState([]);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [menu, setMenu] = useState(false);
  const [starters, setStarters] = useState(false);
  const [listening, setListening] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight); }, [msgs, busy]);
  useEffect(() => { fetchSpots().then(setSpots).catch(() => {}); }, []);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  async function send(text){
    const q = String(text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setStarters(false);
    setMsgs(m => [...m, { id:nid(), role:'user', text:q, at:Date.now() }, { id:nid(), role:'ai', loading:true }]);
    setBusy(true);
    try {
      const out = await chat(q);
      const candidates = out.candidates || [];
      const cards = candidates.slice(0, 1).map(c => cardFor(c, spots));
      const more = candidates.slice(1, 6).map(c => c.name + (c.hint ? ' — ' + c.hint : ''));
      setMsgs(m => [...m.filter(x => !x.loading), {
        id:nid(), role:'ai', at:Date.now(),
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

  function mic(){
    const S = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!S) { showToast('Voice input is not supported in this browser', 'error'); return; }
    const r = new S();
    r.lang = 'en-PH';
    r.onresult = e => { setListening(false); setInput(e.results[0][0].transcript); inputRef.current?.focus(); };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    setListening(true);
    r.start();
  }

  const lastAi = [...msgs].reverse().find(m => m.role === 'ai' && !m.loading);
  const followUp = lastAi?.cards?.[0]
    ? [
        { icon:Compass, label:'Plan a day here', send:'Plan a day trip to ' + lastAi.cards[0].name },
        { icon:Sparkles, label:'More like this', send:'Show me more places like ' + lastAi.cards[0].name },
      ]
    : [
        { icon:Compass, label:'Beaches near me', send:'Best beaches near me' },
        { icon:Sparkles, label:'Festivals this month', send:'Which festivals are on this month?' },
      ];

  return (
    <main className="chat-screen">
      <div className="chat-layer">
        <header className="chat-head">
          <button type="button" className="icon-btn" aria-label="Back to Home" onClick={() => setTab?.('home')}>
            <ArrowLeft size={18}/>
          </button>

          <div className="h-brand">
            <span className="brand-tile">
              <Logo size={20}/>
              <i className={'online-dot' + (online ? '' : ' off')}/>
            </span>
            <div className="h-text">
              <b className="chat-title">LakbAI Assistant</b>
              <span className="chat-sub">Your Personal Travel Guide</span>
            </div>
          </div>

          <button type="button" className="icon-btn" aria-label="Chat options" data-testid="chat-menu" onClick={() => setMenu(m => !m)}>
            <EllipsisVertical size={18}/>
          </button>
        </header>

        {menu && (
          <>
            <button type="button" className="menu-scrim" aria-label="Close menu" onClick={() => setMenu(false)}/>
            <div className="chat-menu" role="menu">
              <button type="button" role="menuitem" data-testid="chat-new" onClick={() => { setMsgs([{ ...WELCOME, at:Date.now() }]); setMenu(false); }}>
                <MessageSquarePlus size={16}/> New chat
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); push({ name:'prefs-edit' }); }}>
                <SlidersHorizontal size={16}/> Travel preferences
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setTab?.('saved'); }}>
                <Bookmark size={16}/> Saved trips
              </button>
            </div>
          </>
        )}

        <div ref={listRef} data-testid="chat-log" className="chat-log">
          {msgs.map((m, i) => {
            // The day/time divider sits above the first message that was actually sent.
            const startsDay = m.at && !msgs.slice(0, i).some(x => x.at);
            return (
              <Fragment key={m.id}>
                {startsDay && <div className="chat-day">{dayLabel(m.at)}</div>}
                {m.loading ? (
                  <div className="chat-ai">
                    <div className="chat-ai-head">
                      <span className="ai-avatar"><Sparkles size={14} color="#fff" strokeWidth={2.2}/></span>
                      <span className="ai-name">LakbAI Guide</span>
                    </div>
                    <span className="shimmer" style={{ fontSize:13 }}>Searching places...</span>
                  </div>
                ) : m.role === 'user' ? (
                  <div className="chat-user">
                    <div className="bubble">{m.text}</div>
                    <div className="msg-time">
                      <span>{clock(m.at)}</span>
                      <CheckCheck size={13} color="var(--primary)"/>
                    </div>
                  </div>
                ) : (
                  <div className="chat-ai">
                    <div className="chat-ai-head">
                      <span className="ai-avatar"><Sparkles size={14} color="#fff" strokeWidth={2.2}/></span>
                      <span className="ai-name">LakbAI Guide</span>
                    </div>
                    <p className="ai-text">{m.text}</p>

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
                      <ul data-testid="chat-more" className="chat-more">
                        {m.more.map(line => (
                          <li key={line}>
                            <MapPin size={12} color="var(--primary)"/>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="composer">
          {starters && (
            <div className="starters">
              {STARTERS.map(s => (
                <button key={s} type="button" onClick={() => { setStarters(false); send(s); }}>{s}</button>
              ))}
            </div>
          )}

          <div className="quick-row">
            {followUp.map(({ icon:Icon, label, send:text }) => (
              <button key={label} type="button" className="quick-action" onClick={() => send(text)}>
                <Icon size={13}/> {label}
              </button>
            ))}
          </div>

          <div className="composer-pill">
            <button type="button" className="c-icon" aria-label="Prompt ideas" onClick={() => setStarters(s => !s)}>
              <Plus size={18}/>
            </button>
            <input
              ref={inputRef}
              data-testid="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Ask a follow up question...."
              className="c-input"
            />
            <button
              type="button"
              className="c-icon"
              data-testid="chat-mic"
              aria-label="Voice input"
              onClick={mic}
              style={{ opacity: listening ? .45 : 1 }}
            >
              <Mic size={17}/>
            </button>
            <button
              type="button"
              data-testid="chat-send"
              className="c-send"
              onClick={() => send()}
              disabled={busy}
              aria-label="Send"
            >
              {busy ? <Send size={16}/> : <ArrowUp size={18}/>}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}