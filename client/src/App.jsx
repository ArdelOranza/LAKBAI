import { useEffect, useState } from 'react';
import MapView from './MapView.jsx';
import { recommend } from './api.js';
import { NearbyButton, Reviews, EmergencyPanel } from './Panels.jsx';
import { thumbUrl } from './mapshot.js';

const BASE = import.meta.env.VITE_API_URL || '';

export default function App(){
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [places, setPlaces] = useState([]);
  const [spotlight, setSpotlight] = useState(null);
  const [status, setStatus] = useState('');
  const [focus, setFocus] = useState(null);
  const [notice, setNotice] = useState('');
  const [readyError, setReadyError] = useState('');

  useEffect(() => {
    fetch(`${BASE}/api/ready`)
      .then(r => { if (!r.ok) throw new Error('API keys missing'); return r.json(); })
      .catch(() => setReadyError('Server not ready — check GEMINI_API_KEY and VITE_MAPBOX_TOKEN in .env.'));
  }, []);

  function applyResults(out){
    setMessages(m => [...m, { role: 'assistant', text: out.answer }]);
    setPlaces(out.places || []);
    setSpotlight(out.spotlight || null);
    setStatus('');
    setFocus(null);
  }

  async function send(){
    const text = input.trim();
    if (!text) return;
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    setStatus('Searching…');
    try {
      applyResults(await recommend(text));
    } catch (e) {
      setStatus('');
      setNotice(e.message);
    }
  }

  return (
    <div data-testid="app">
      <h1>Lakbai</h1>
      {readyError && <p data-testid="notice">{readyError}</p>}
      <section data-testid="chat">
        <ul>{messages.map((m, i) => <li key={i}><b>{m.role}:</b> {m.text}</li>)}</ul>
        <input data-testid="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} placeholder="Ask about places to visit…" />
        <button data-testid="chat-send" onClick={send}>Send</button>
      </section>
      {status && <p data-testid="search-status" className="shimmer">{status}</p>}
      {notice && <p data-testid="notice">{notice}</p>}
      <MapView places={places} focus={focus} />
      {spotlight && (
        <article data-testid="spotlight">
          {thumbUrl(spotlight, 640, 360) && <img src={thumbUrl(spotlight, 640, 360)} alt={'Map of ' + spotlight.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
          <h3>Hidden gem: {spotlight.name}</h3>
          <p>{spotlight.reason}</p>
        </article>
      )}
      <ul>
        {places.map((p, i) => {
          const shot = thumbUrl(p);
          return (
          <li key={p.id} data-testid="place-card" className="place-card" style={{ animationDelay: `${i * 120}ms` }} onClick={() => setFocus(p)}>
            {shot && <img src={shot} alt={'Map of ' + p.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <b>{p.name}</b> <span>{(p.categories || []).join(', ')}</span>
            <p>{p.reason}</p>
            {p.description && <p data-testid="place-desc">{p.description}</p>}
            {p.festival && <p data-testid="place-festival">Festival: {p.festival}</p>}
            {p.fees && <p data-testid="place-fees">Fees: {p.fees}</p>}
            {(p.sources || []).map(s => <a key={s} href={s} target="_blank" rel="noreferrer">{p.sourceKind === 'map' ? 'map' : 'source'}</a>)}
          </li>
          );
        })}
      </ul>
      <NearbyButton onResults={applyResults} onNotice={setNotice} />
      {places.map(p => <Reviews key={'r-' + p.id} place={p} />)}
      <EmergencyPanel />
    </div>
  );
}
