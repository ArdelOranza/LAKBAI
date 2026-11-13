import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ArrowUp, Mic, Plus, CircleCheck, MapPin, Star, CheckCheck,
  ChevronRight, ChevronDown, EllipsisVertical, SlidersHorizontal, MessageSquarePlus,
  Bookmark, Navigation, Compass, ArrowLeft, History, Ticket, Square,
} from 'lucide-react';
import { chat } from '../api.js';
import { fetchSpots } from '../spots.js';
import { cardFor, cardsFromMore } from '../chatCards.js';
import { answerLead } from '../chatAnswer.js';
import { latestThread, listThreads, saveThread, cleanMessages, cachedThreads } from '../chatStore.js';
import { placeImage, mapboxToken } from '../staticMap.js';
import { MdText } from '../mdText.jsx';
import { saveFavorite, listFavorites } from '../store.js';
import { haversineKm, formatDistance, driveMinutes, proximityOf } from '../geo.js';
import { suggestionsFor } from '../chatSuggest.js';
import { topicTabs } from '../chatTopics.js';
import { buildChatContext } from '../chatContext.js';
import { MAX_MESSAGE, clampMessage } from '../chatLimits.js';
import { readLocalPrefs } from '../prefs.js';
import { PhotoPlaceholder } from '../ui.jsx';
import Logo from '../logo.jsx';
// import AiBackdrop from '../AiBackdrop.jsx'; // parked: the chat background stays plain

const WELCOME = { id:'welcome', role:'ai', text:"Hi! I'm LakbAI. Ask me about the places in our verified Pangasinan list — food, tourist spots, fees, or a day trip — and about bus fares and terminals to any Pangasinan town. I answer from those records only, so nothing is made up. Bus fares are LTFRB guides, not live ticket prices; confirm with the conductor or LTFRB 1342." };
const STARTERS = [
  'Tourist spots in Bayambang',
  'Where should I eat in Dagupan?',
  'Fees at Balungao zipline',
  'Bus fare from Cubao to Dagupan',
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

function ChatHero({ card, coords, hasFix = true, user, showToast, push, saved, onSaved, openDirections }){
  const km = hasFix ? haversineKm(coords.lng, coords.lat, card.lng, card.lat) : null;
  const img = placeImage(card, MAP_TOKEN);
  const place = card.spot || {
    id: card.id, name: card.name, lng: card.lng, lat: card.lat,
    blurb: card.description, categories: card.tags, town: card.hint,
  };

  async function add(e){
    e.stopPropagation();
    if (saved) return;
    const res = await saveFavorite(user, { id: card.id, name: card.name, lng: card.lng, lat: card.lat });
    if (res.error) { showToast('Sign in to save', 'error', res.error); return; }
    onSaved(card);
    showToast('Added to Trip');
  }
  function directions(e){
    e.stopPropagation();
    if (!openDirections) { push({ name:'detail', place }); return; }
    openDirections(place);
  }

  return (
    <article
      className="chat-hero"
      data-testid="chat-card"
      onClick={() => push({ name:'detail', place })}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'detail', place }); } }}
    >
      <div className="chat-hero-media">
        {img
          ? <img src={img} alt={card.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}/>
          : <PhotoPlaceholder size={30}/>}

        {card.hint && (
          <span className="chat-hero-town">
            <MapPin size={10}/> {card.hint}
          </span>
        )}
      </div>

      <div className="chat-hero-body">
        <h3 className="chat-hero-name">{card.name}</h3>

        <div className="chat-hero-meta">
          {card.rating != null && (
            <span className="chat-hero-rating">
              <Star size={11} fill="currentColor" strokeWidth={0}/> {card.rating}
            </span>
          )}
          {card.reviews && <span>{card.reviews} reviews</span>}
          {km != null && (
            <button type="button" className="chat-hero-dist" onClick={directions} aria-label={'Drive to ' + card.name}>
              <Navigation size={11}/> {distanceLine(km)}
            </button>
          )}
        </div>

        {card.description && <p className="chat-hero-desc">{card.description}</p>}
        {card.fees && <p className="chat-hero-fees"><Ticket size={12}/> <span>{card.fees}</span></p>}

        <button
          type="button"
          data-testid="chat-card-save"
          className="chat-hero-save"
          onClick={add}
          disabled={saved}
        >
          {saved ? <><CircleCheck size={16}/> Added to Trip</> : <><Plus size={16}/> Add to Trip</>}
        </button>
      </div>
    </article>
  );
}

function ChatRow({ card, coords, hasFix = true, user, push, showToast, saved, onSaved }){
  const km = hasFix ? haversineKm(coords.lng, coords.lat, card.lng, card.lat) : null;
  const img = placeImage(card, MAP_TOKEN);
  const place = card.spot || {
    id: card.id, name: card.name, lng: card.lng, lat: card.lat,
    blurb: card.description, categories: card.tags, town: card.hint,
  };
  const meta = [
    card.hint,
    card.rating != null ? '★ ' + card.rating : '',
    km != null ? distanceLine(km) : '',
  ].filter(Boolean).join(' · ');

  async function add(e){
    e.stopPropagation();
    if (saved) return;
    const res = await saveFavorite(user, { id: card.id, name: card.name, lng: card.lng, lat: card.lat });
    if (res.error) { showToast('Sign in to save', 'error', res.error); return; }
    onSaved(card);
    showToast('Added to Trip');
  }

  return (
    <article
      className="chat-row"
      data-testid="chat-row"
      onClick={() => push({ name:'detail', place })}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); push({ name:'detail', place }); } }}
    >
      <div className="chat-row-media">
        {img
          ? <img src={img} alt={card.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }}/>
          : <PhotoPlaceholder size={18}/>}
      </div>
      <div className="chat-row-body">
        <b className="chat-row-name">{card.name}</b>
        {meta && <span className="chat-row-sub">{meta}</span>}
      </div>
      <button
        type="button"
        data-testid="chat-row-save"
        className="chat-row-save"
        onClick={add}
        disabled={saved}
        aria-label={saved ? card.name + ' added to Trip' : 'Add ' + card.name + ' to Trip'}
      >
        {saved ? <CircleCheck size={15}/> : <Plus size={16}/>}
      </button>
    </article>
  );
}

export default function ChatTab({ user, coords, hasFix = true, push, setTab, showToast, openDirections }){
  // Paint the saved conversation from the local mirror on the first frame.
  // Supabase is a background sync, never a gate: waiting on it made the thread
  // disappear into the welcome card on every tab switch / reload.
  const [initial] = useState(() => {
    const threads = cachedThreads(user);
    const latest = threads.find(t => Array.isArray(t.messages) && t.messages.length) || null;
    if (latest) seedUid(latest.messages);
    return {
      threads,
      latest,
      thread: latest
        ? { id: latest.id, created_at: latest.created_at }
        : { id: newThreadId(), created_at: new Date().toISOString() },
    };
  });
  const [msgs, setMsgs] = useState(() => (initial.latest ? initial.latest.messages : [WELCOME]));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [spots, setSpots] = useState([]);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [menu, setMenu] = useState(false);
  const [starters, setStarters] = useState(false);
  const [listening, setListening] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [history, setHistory] = useState(() => initial.threads);
  const [openLists, setOpenLists] = useState(() => new Set());
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const threadRef = useRef(initial.thread);
  const savedSigRef = useRef(initial.latest ? signatureOf(initial.latest.messages, initial.latest.id) : '');
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  // Any local edit (send, new chat, open another thread) wins over a cloud row
  // that was already in flight when it happened.
  const dirtyRef = useRef(false);
  // Thread ids change when the first save returns a canonical id. Answers in
  // flight must survive that, so they track a generation instead of the id.
  const genRef = useRef(0);
  const activeUserRef = useRef(user?.id);

  useEffect(() => { listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight); }, [msgs, busy]);
  useEffect(() => { fetchSpots().then(setSpots).catch(() => {}); }, []);

  // Reconcile with the account history in the background. The screen already
  // shows the local mirror, so a slow or failed network never blanks it.
  useEffect(() => {
    let alive = true;
    const userId = user?.id;
    if (activeUserRef.current !== userId){
      // A different account: swap to that account's mirror before merging.
      activeUserRef.current = userId;
      const threads = cachedThreads(user);
      const latest = threads.find(t => Array.isArray(t.messages) && t.messages.length) || null;
      dirtyRef.current = false;
      if (latest) seedUid(latest.messages);
      setHistory(threads);
      setMsgs(latest ? latest.messages : [WELCOME]);
      threadRef.current = latest
        ? { id: latest.id, created_at: latest.created_at }
        : { id: newThreadId(), created_at: new Date().toISOString() };
      savedSigRef.current = latest ? signatureOf(latest.messages, latest.id) : '';
      return () => { alive = false; };
    }
    Promise.all([latestThread(user), listThreads(user)]).then(([latest, threads]) => {
      if (!alive) return;
      setHistory(threads || []);
      if (!latest || !Array.isArray(latest.messages) || !latest.messages.length) return;
      if (dirtyRef.current) return;
      const current = msgsRef.current;
      const sameThread = latest.id === threadRef.current?.id;
      const cloudIsNewer = !sameThread || latest.messages.length > current.length;
      if (!cloudIsNewer) return;
      seedUid(latest.messages);
      threadRef.current = { id: latest.id, created_at: latest.created_at };
      savedSigRef.current = signatureOf(latest.messages, latest.id);
      setMsgs(latest.messages);
    }).catch(() => { /* the local mirror already holds the chat */ });
    return () => { alive = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist after every settled change. Loading placeholders are stripped and
  // the signature guard avoids rewriting the same state twice.
  useEffect(() => {
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
    const q = clampMessage(text ?? input);
    if (!q || busy) return;
    setInput('');
    setStarters(false);
    dirtyRef.current = true;
    const gen = genRef.current;
    const stillCurrent = () => genRef.current === gen;
    setMsgs(m => [...m, { id:nid(), role:'user', text:q, at:Date.now() }, { id:nid(), role:'ai', loading:true }]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const out = await chat(q, proximityOf(coords, hasFix), ctrl.signal, {
        // Where they are travels as proximity; this adds who they are, what
        // they said they like, and their local time — built on every send so
        // the hour is never stale.
        context: buildChatContext({ user, prefs: readLocalPrefs(user) }),
        hasFix,
      });
      // The traveler may have opened another thread while this was in flight;
      // its answer belongs to the archived one, not to the new screen.
      if (ctrl.signal.aborted || !stillCurrent()) return;
      const candidates = out.candidates || [];
      // Every result becomes a card; the sheet shows the best three first and
      // keeps the rest one tap away instead of dumping bare names as text.
      const cards = candidates.slice(0, 6).map(c => cardFor(c, spots));
      setMsgs(m => [...m.filter(x => !x.loading), {
        id:nid(), role:'ai', at:Date.now(),
        // The intent is what decides which topic tab lights up and which chips
        // come next, so it has to live on the message, not just in this call.
        intent: out.intent || '',
        text: out.answer || 'I could not find that — ask me about Pangasinan travel.',
        cards,
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
    dirtyRef.current = true;
    genRef.current += 1;
    threadRef.current = { id: newThreadId(), created_at: new Date().toISOString() };
    savedSigRef.current = '';
    setMsgs([{ ...WELCOME, at: Date.now() }]);
    setOpenLists(new Set());
    setMenu(false);
  }

  // Saving from a chat card appends a real, data-driven confirmation: the count
  // and the place name come from the account's saved list, never a fixed line.
  async function confirmSaved(card){
    setSavedIds(prev => new Set(prev).add(card.id));
    let count = 1;
    try {
      const r = await listFavorites(user);
      count = (r.data || []).length || 1;
    } catch { /* keep 1 — the save itself already succeeded */ }
    setMsgs(m => [...m, {
      id:nid(), role:'ai', kind:'saved', at:Date.now(),
      saved:{ name: card.name, count },
    }]);
  }

  function openThread(t){
    if (!t) return;
    stop();
    dirtyRef.current = true;
    genRef.current += 1;
    const messages = Array.isArray(t.messages) && t.messages.length
      ? t.messages
      : [{ ...WELCOME, at: Date.now() }];
    seedUid(messages);
    threadRef.current = { id: t.id, created_at: t.created_at };
    savedSigRef.current = signatureOf(messages, t.id);
    setMsgs(messages);
    setOpenLists(new Set());
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
    r.onresult = e => { setListening(false); setInput(String(e.results[0][0].transcript || '').slice(0, MAX_MESSAGE)); inputRef.current?.focus(); };
    r.onerror = () => { setListening(false); showToast('Microphone unavailable', 'error'); };
    r.onend = () => setListening(false); // recognizer ended with no result — don't stick
    setListening(true);
    try { r.start(); }
    catch { setListening(false); showToast('Microphone unavailable', 'error'); }
  }

  const lastAi = [...msgs].reverse().find(m => m.role === 'ai' && !m.loading);
  // Which chip makes sense next: another fare question after a fare answer,
  // the place follow-ups after a place, a town bus prompt when the fix says so.
  const CHIP_ICON = { plan: Compass, more: MapPin, beach: Compass, festival: Ticket, fare: Ticket, bus: Ticket, terminal: Navigation };
  const followUp = suggestionsFor({ lastAi, coords, hasFix }).map(s => ({
    ...s,
    icon: CHIP_ICON[s.id] || MapPin,
  }));

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
              <b className="chat-title">LakbAI</b>
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
            // One featured place, then a short list; the rest stay one tap away.
            // Threads saved before the sheet existed stored their extra results
            // as "Name — Town" lines — rebuild them into cards instead of
            // leaving history on the old plain list.
            const stored = [...(m.cards || []), ...cardsFromMore(m.more, spots)];
            const list = stored.filter((c, n) => stored.findIndex(x => x.id === c.id) === n);
            const expanded = openLists.has(m.id);
            const rows = list.slice(1);
            const shownRows = expanded ? rows : rows.slice(0, 2);
            const hidden = rows.length - shownRows.length;
            const answer = answerLead(m.text, list.length > 0);
            return (
              <Fragment key={m.id}>
                {startsDay && <div className="chat-day">{dayLabel(m.at)}</div>}
                {m.loading ? (
                  <div className="chat-ai">
                    <div className="chat-ai-head">
                      <span className="ai-avatar"><Compass size={14} color="#fff" strokeWidth={2.2}/></span>
                      <span className="ai-name">LakbAI</span>
                    </div>
                    <span className="shimmer" style={{ fontSize:13 }}>Searching places...</span>
                  </div>
                ) : m.kind === 'saved' ? (
                  <div className="chat-saved" data-testid="saved-to-trips">
                    <div className="chat-saved-bar">
                      <Bookmark size={15} color="var(--primary)"/>
                      <span>Saved to <b>Trips</b></span>
                      <span style={{ color:'var(--muted-ink)' }}>· {m.saved.count} {m.saved.count === 1 ? 'place' : 'places'} saved</span>
                      <button type="button" className="chat-saved-view" onClick={() => setTab?.('saved')}>
                        View Trips <ChevronRight size={13}/>
                      </button>
                    </div>
                    <div className="chat-saved-msg">
                      I've added <b>{m.saved.name}</b> to your Trip.{' '}
                      {m.saved.count === 1
                        ? 'Check your Trips tab to generate your schedule!'
                        : `You now have ${m.saved.count} places saved — open your Trips tab to build the day.`}
                    </div>
                    <button type="button" data-testid="saved-to-trips-go" className="chat-saved-go" onClick={() => setTab?.('saved')}>
                      <Bookmark size={15}/> Go to Trips Tab
                    </button>
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
                      <span className="ai-avatar"><Compass size={14} color="#fff" strokeWidth={2.2}/></span>
                      <span className="ai-name">LakbAI</span>
                    </div>
                    {answer.kind === 'label' && list.length > 0 ? (
                      <div className="chat-results-eyebrow" data-testid="chat-results-label">
                        <span>{answer.lead ? answer.lead.replace(/:\s*$/, '') : 'Results'}</span>
                        <i>· {list.length} {list.length === 1 ? 'place' : 'places'}</i>
                      </div>
                    ) : (
                      <div className="ai-text"><MdText text={answer.lead}/></div>
                    )}

                    {list.length > 0 && (
                      <>
                        <div className="chat-results" data-testid="chat-results">
                          <ChatHero
                            card={list[0]}
                            coords={coords}
                            hasFix={hasFix}
                            user={user}
                            push={push}
                            showToast={showToast}
                            saved={savedIds.has(list[0].id)}
                            onSaved={confirmSaved}
                            openDirections={openDirections}
                          />
                          {shownRows.map(card => (
                            <ChatRow
                              key={card.id}
                              card={card}
                              coords={coords}
                              hasFix={hasFix}
                              user={user}
                              push={push}
                              showToast={showToast}
                              saved={savedIds.has(card.id)}
                              onSaved={confirmSaved}
                            />
                          ))}
                        </div>

                        {rows.length > 2 && (
                          <button
                            type="button"
                            data-testid="chat-show-more"
                            className="chat-show-more"
                            aria-expanded={expanded}
                            onClick={() => setOpenLists(prev => {
                              const next = new Set(prev);
                              if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                              return next;
                            })}
                          >
                            {expanded
                              ? <><span>Show less</span> <ChevronDown size={14} style={{ transform:'rotate(180deg)' }}/></>
                              : <><span>Show {hidden} more</span> <ChevronDown size={14}/></>}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="composer">
          <div className="topic-tabs" role="tablist" aria-label="Chat topics">
            {topicTabs({ lastAi, coords, hasFix }).map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.active}
                data-testid={'topic-' + t.id}
                className={'topic-tab' + (t.active ? ' is-on' : '')}
                onClick={() => send(t.send)}
              >
                {t.label}
              </button>
            ))}
          </div>

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
              maxLength={MAX_MESSAGE}
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
              className={'c-send' + (busy ? ' is-stop' : '')}
              onClick={() => (busy ? stop() : send())}
              aria-label={busy ? 'Stop the answer' : 'Send'}
            >
              {busy ? <Square size={13} fill="currentColor" strokeWidth={0}/> : <ArrowUp size={18}/>}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}