import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Send, ArrowUp, Mic, Plus, Sparkles, CircleCheck, MapPin, Star, CheckCheck,
  ChevronRight, EllipsisVertical, SlidersHorizontal, MessageSquarePlus,
  Bookmark, Navigation, Compass, ArrowLeft, History,
} from 'lucide-react';
import { chat } from '../api.js';
import { fetchSpots } from '../spots.js';
import { cardFor } from '../chatCards.js';
import { latestThread, listThreads, saveThread, cleanMessages } from '../chatStore.js';
import { placeImage, mapboxToken } from '../staticMap.js';
import { MdText } from '../mdText.jsx';
import { openExternal } from '../extLinks.js';
import { saveFavorite, listFavorites } from '../store.js';
import { haversineKm, formatDistance, driveMinutes } from '../geo.js';
import { PhotoPlaceholder } from '../ui.jsx';
import Logo from '../logo.jsx';
// import AiBackdrop from '../AiBackdrop.jsx'; // parked: the chat background stays plain

const WELCOME = { id:'welcome', role:'ai', text:"Hi! I'm LakbAI. Ask me about the places in our verified Pangasinan list — food, tourist spots, fees, or a day trip. I answer from those records only, so nothing is made up." };
const STARTERS = [
  'Tourist spots in Bayambang',
  'Where should I eat in Dagupan?',
  'Fees at Balungao zipline',
  'Plan a day trip in Bayambang',
];
const MAP_TOKEN = mapboxToken();
let uid = 0;
const nid = () => 'm' + (++uid);
const signatureOf = (messages, id) => `${id || ''}:${messages.length}:${messages[messages.length - 1]?.id || ''}`;
const newThreadId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
/** Restored ids must not collide with fresh ones after a reload (uid resets). */
function seedUid(messages){
  for (const m of messages || []){
    const n = Number(String(m && m.id || '').replace(/^m/, ''));
    if (Number.isFinite(n) && n > uid) uid = n;
  }
}
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
  const img = placeImage(card, MAP_TOKEN);
  const badge = card.fees || card.festival;
  const place = card.spot || {
    id: card.id, name: card.name, lng: card.lng, lat: card.lat,
    blurb: card.description, categories: card.tags, town: card.hint,
  };

  async function add(e){
    e.stopPropagation();
    if (saved) return;
    const res = await saveFavorite(user, { id: card.id, name: card.name, lng: card.lng, lat: card.lat });
    if (res.error) { showToast('Sign in to save', 'error', res.error); return; }
    onSaved(card.id);
    showToast('Added to Trip');
  }
  function directions(e){
    e.stopPropagation();
    if (card.lat == null) { push({ name:'detail', place }); return; }
    openExternal('https://www.google.com/maps/dir/?api=1&destination=' + card.lat + ',' + card.lng);
  }

  return (
    <article className="chat-card" data-testid="chat-card" onClick={() => push({ name:'detail', place })} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'detail', place }); } }}>
      <div className="chat-card-media">
        {img
          ? <img src={img} alt={card.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}/>
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
  const [history, setHistory] = useState([]);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const threadRef = useRef(null);
  const hydratedRef = useRef(false);
  const savedSigRef = useRef('');

  useEffect(() => { listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight); }, [msgs, busy]);
  useEffect(() => { fetchSpots().then(setSpots).catch(() => {}); }, []);

  // Reopen the last conversation (account history, merged with the local
  // mirror). A reload or a tab switch must never erase what was asked.
  useEffect(() => {
    let alive = true;
    hydratedRef.current = false;
    threadRef.current = null;
    savedSigRef.current = '';
    setMsgs([WELCOME]);
    Promise.all([latestThread(user), listThreads(user)]).then(([latest, threads]) => {
      if (!alive) return;
      setHistory(threads || []);
      if (latest && Array.isArray(latest.messages) && latest.messages.length){
        seedUid(latest.messages);
        threadRef.current = { id: latest.id, created_at: latest.created_at };
        savedSigRef.current = signatureOf(latest.messages, latest.id);
        setMsgs(latest.messages);
      } else {
        threadRef.current = { id: newThreadId(), created_at: new Date().toISOString() };
      }
      hydratedRef.current = true;
    }).catch(() => { if (alive) hydratedRef.current = true; });
    return () => { alive = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist after every settled change. Loading placeholders are stripped and
  // the signature guard avoids rewriting the same state twice.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const messages = cleanMessages(msgs);
    if (!messages.some(m => m.role === 'user')) return;
    const id = threadRef.current?.id;
    const sig = signatureOf(messages, id);
    if (sig === savedSigRef.current) return;
    savedSigRef.current = sig;
    saveThread(user, { ...(threadRef.current || {}), messages }).then(saved => {
      if (!saved || !saved.id) return;
      const previousId = id;
      if (saved.id !== previousId){
        threadRef.current = { ...(threadRef.current || {}), id: saved.id, created_at: saved.created_at };
        savedSigRef.current = signatureOf(saved.messages || messages, saved.id);
      }
      setHistory(prev => [
        { id: saved.id, title: saved.title, messages: saved.messages, created_at: saved.created_at, updated_at: saved.updated_at },
        ...prev.filter(t => t.id !== saved.id && t.id !== previousId),
      ].slice(0, 12));
    }).catch(() => { /* the local mirror already holds the chat */ });
  }, [msgs, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Seed saved buttons from the already-saved favorites, so a place saved in
  // a previous session doesn't read as unsaved ("Add to Trip" again).
  useEffect(() => {
    let alive = true;
    listFavorites(user).then(r => {
      if (!alive || r.error || !Array.isArray(r.data)) return;
      setSavedIds(new Set(r.data.map(f => f.place_id).filter(Boolean)));
    }).catch(() => {});
    return () => { alive = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const abortRef = useRef(null);
  async function send(text){
    const q = String(text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setStarters(false);
    const sendingThread = threadRef.current?.id;
    const stillCurrent = () => threadRef.current?.id === sendingThread;
    setMsgs(m => [...m, { id:nid(), role:'user', text:q, at:Date.now() }, { id:nid(), role:'ai', loading:true }]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const out = await chat(q, coords ? `${coords.lng},${coords.lat}` : '', ctrl.signal);
      // The traveler may have opened another thread while this was in flight;
      // its answer belongs to the archived one, not to the new screen.
      if (ctrl.signal.aborted || !stillCurrent()) return;
      const candidates = out.candidates || [];
      const cards = candidates.slice(0, 1).map(c => cardFor(c, spots));
      const more = candidates.slice(1, 6).map(c => c.name + (c.hint ? ' — ' + c.hint : ''));
      setMsgs(m => [...m.filter(x => !x.loading), {
        id:nid(), role:'ai', at:Date.now(),
        text: out.answer || 'I could not find that — ask me about Pangasinan travel.',
        cards, more,
      }]);
    } catch (e) {
      if (ctrl.signal.aborted){
        if (stillCurrent()) setMsgs(m => [...m.filter(x => !x.loading), { id:nid(), role:'ai', at:Date.now(), text: 'No reply — the request was stopped. Try again.' }]);
        return;
      }
      if (!stillCurrent()) return;
      setMsgs(m => [...m.filter(x => !x.loading)]);
      showToast('LakbAI is busy — try again in a minute', 'error', e.message);
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }
  function stop(){ abortRef.current?.abort(new Error('stopped by traveler')); }

  /** Archive the current thread (already saved) and start a clean one. */
  function newChat(){
    stop();
    threadRef.current = { id: newThreadId(), created_at: new Date().toISOString() };
    savedSigRef.current = '';
    setMsgs([{ ...WELCOME, at: Date.now() }]);
    setMenu(false);
  }

  function openThread(t){
    if (!t) return;
    stop();
    const messages = Array.isArray(t.messages) && t.messages.length
      ? t.messages
      : [{ ...WELCOME, at: Date.now() }];
    seedUid(messages);
    threadRef.current = { id: t.id, created_at: t.created_at };
    savedSigRef.current = signatureOf(messages, t.id);
    setMsgs(messages);
    setMenu(false);
  }

  const recogRef = useRef(null);
  function mic(){
    // A second tap stops an active recognizer instead of spawning another.
    if (listening){ try { recogRef.current?.stop(); } catch { /* ignore */ } return; }
    const S = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!S) { showToast('Voice input is not supported in this browser', 'error'); return; }
    const r = new S();
    recogRef.current = r;
    r.lang = 'en-PH';
    r.onresult = e => { setListening(false); setInput(e.results[0][0].transcript); inputRef.current?.focus(); };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    r.onend = () => setListening(false); // recognizer ended with no result — don't stick
    setListening(true);
    try { r.start(); }
    catch { setListening(false); showToast('Microphone unavailable', 'error'); }
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
              <button type="button" role="menuitem" data-testid="chat-new" onClick={newChat}>
                <MessageSquarePlus size={16}/> New chat
              </button>
              {history.length > 0 && (
                <>
                  <div style={{ height:1, background:'#EDF1F7', margin:'4px 0' }} aria-hidden="true"/>
                  <p style={{ fontSize:10.5, color:'var(--muted-ink)', margin:'2px 12px', textTransform:'uppercase', letterSpacing:.5 }}>
                    Recent chats
                  </p>
                  {history.slice(0, 5).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitem"
                      data-testid="chat-thread"
                      title={t.title || 'Chat'}
                      onClick={() => openThread(t)}
                    >
                      <History size={15}/>
                      <span style={{ flex:1, minWidth:0, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {t.title || 'Chat'}
                      </span>
                    </button>
                  ))}
                </>
              )}
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
                    <button type="button" data-testid="chat-stop" className="chat-stop" onClick={stop} style={{ marginLeft:8, fontSize:12 }}>Stop</button>
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
                    <div className="ai-text"><MdText text={m.text}/></div>

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
              aria-label="Ask a follow up question"
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